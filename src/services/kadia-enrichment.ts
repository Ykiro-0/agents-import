import fs from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";

interface SectionRule {
  section: string;
  keywords: string[];
}

interface SpreadsheetRow {
  [key: string]: unknown;
}

interface ApiEnrichmentSuggestion {
  description?: string;
  reducedDescription?: string;
  section?: string;
  confidence?: number;
  note?: string;
}

interface ApiClientConfig {
  url: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface EnrichSpreadsheetOptions {
  inputPath: string;
  outputPath?: string;
  sectionRulesPath?: string;
  sheetName?: string;
  maxReducedLength?: number;
  apiUrl?: string;
  apiKey?: string;
  apiTimeoutMs?: number;
}

export interface EnrichSpreadsheetResult {
  inputPath: string;
  outputPath: string;
  sheetName: string;
  descriptionColumn: string;
  totalRows: number;
  enrichedRows: number;
  pendingSectionRows: number;
  blockedRows: number;
  apiEnabled: boolean;
  apiAttempts: number;
  apiSuccessRows: number;
  apiFallbackRows: number;
}

const DESCRIPTION_COLUMN_CANDIDATES = [
  "descricao",
  "descricao_original",
  "descricao produto",
  "produto",
  "nome",
  "nome produto",
  "item"
];

const EAN_COLUMN_CANDIDATES = ["ean", "ean_tributado", "codigo de barras", "codigo barras", "codbarras"];

const CODE_COLUMN_CANDIDATES = ["codigo", "codigo_original", "sku", "id", "produtoid"];

const DEFAULT_SECTION_RULES: SectionRule[] = [
  {
    section: "BEBIDAS",
    keywords: ["agua", "refrigerante", "suco", "cerveja", "energetico", "cha", "cafe"]
  },
  {
    section: "MERCEARIA",
    keywords: ["arroz", "feijao", "macarrao", "farinha", "acucar", "sal", "oleo", "molho", "tempero"]
  },
  {
    section: "BISCOITOS E SNACKS",
    keywords: ["biscoito", "bolacha", "salgadinho", "snack", "amendoim", "batata"]
  },
  {
    section: "HIGIENE",
    keywords: ["sabonete", "shampoo", "condicionador", "desodorante", "escova", "creme dental"]
  },
  {
    section: "LIMPEZA",
    keywords: ["detergente", "sabao", "amaciante", "desinfetante", "agua sanitaria", "limpador"]
  },
  {
    section: "LATICINIOS",
    keywords: ["leite", "iogurte", "queijo", "manteiga", "requeijao", "creme de leite"]
  },
  {
    section: "ACOUGUE",
    keywords: ["carne", "frango", "peixe", "suino", "linguica", "hamburguer"]
  }
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeKey(value: string): string {
  return normalizeText(value);
}

function normalizeDescription(rawValue: string): string {
  const base = rawValue
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const expanded = base
    .replace(/\bcx\b/gi, "caixa")
    .replace(/\bun\b/gi, "unidade")
    .replace(/\bpct\b/gi, "pacote")
    .replace(/\bkg\b/gi, "kg")
    .replace(/\bml\b/gi, "ml")
    .replace(/\bl\b/gi, "l");

  return expanded.toUpperCase();
}

function normalizeSection(value: string): string {
  return value.trim().toUpperCase();
}

function buildReducedDescription(description: string, maxLength: number): string {
  if (description.length <= maxLength) {
    return description;
  }

  const clipped = description.slice(0, maxLength).trim();
  const lastSpace = clipped.lastIndexOf(" ");

  if (lastSpace > Math.floor(maxLength * 0.6)) {
    return clipped.slice(0, lastSpace).trim();
  }

  return clipped;
}

function scoreSection(normalizedDescription: string, rule: SectionRule): number {
  return rule.keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    return normalizedKeyword && normalizedDescription.includes(normalizedKeyword) ? score + 1 : score;
  }, 0);
}

function suggestSection(description: string, rules: SectionRule[]): { section: string; confidence: number } {
  const normalizedDescription = normalizeText(description);

  if (!normalizedDescription) {
    return { section: "SEM_SECAO", confidence: 0 };
  }

  let bestSection = "SEM_SECAO";
  let bestScore = 0;
  let ruleKeywordCount = 1;

  for (const rule of rules) {
    const score = scoreSection(normalizedDescription, rule);

    if (score > bestScore) {
      bestSection = normalizeSection(rule.section);
      bestScore = score;
      ruleKeywordCount = Math.max(1, rule.keywords.length);
    }
  }

  if (bestScore === 0) {
    return { section: "SEM_SECAO", confidence: 0 };
  }

  const confidence = Number(Math.min(1, bestScore / ruleKeywordCount).toFixed(2));
  return { section: bestSection, confidence };
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function clampConfidence(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  return Number(Math.min(1, Math.max(0, value)).toFixed(2));
}

function resolveColumnByCandidates(rows: SpreadsheetRow[], candidates: string[]): string | undefined {
  const availableColumns = new Map<string, string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!availableColumns.has(normalizeKey(key))) {
        availableColumns.set(normalizeKey(key), key);
      }
    }
  }

  for (const candidate of candidates) {
    const resolved = availableColumns.get(normalizeKey(candidate));

    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function resolveDescriptionColumn(rows: SpreadsheetRow[]): string {
  const resolved = resolveColumnByCandidates(rows, DESCRIPTION_COLUMN_CANDIDATES);

  if (resolved) {
    return resolved;
  }

  const firstColumn = rows[0] ? Object.keys(rows[0])[0] : "";

  if (!firstColumn) {
    throw new Error("Planilha sem colunas detectadas.");
  }

  return firstColumn;
}

function parseSectionRules(rawValue: unknown): SectionRule[] {
  if (!Array.isArray(rawValue)) {
    throw new Error("Arquivo de secoes invalido: esperado um array JSON.");
  }

  const parsedRules = rawValue
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const section = normalizeSection(toStringValue((entry as Record<string, unknown>).section));
      const keywordsRaw = (entry as Record<string, unknown>).keywords;

      const keywords = Array.isArray(keywordsRaw)
        ? keywordsRaw.map((value) => toStringValue(value)).filter(Boolean)
        : [];

      if (!section || keywords.length === 0) {
        return null;
      }

      return { section, keywords };
    })
    .filter((rule): rule is SectionRule => Boolean(rule));

  if (parsedRules.length === 0) {
    throw new Error("Arquivo de secoes invalido: nenhuma regra valida encontrada.");
  }

  return parsedRules;
}

async function loadSectionRules(sectionRulesPath?: string): Promise<SectionRule[]> {
  if (!sectionRulesPath) {
    return DEFAULT_SECTION_RULES;
  }

  const content = await fs.readFile(sectionRulesPath, "utf8");
  const parsed = JSON.parse(content) as unknown;
  return parseSectionRules(parsed);
}

function resolveOutputPath(inputPath: string, outputPath?: string): string {
  if (outputPath) {
    return path.resolve(outputPath);
  }

  const parsed = path.parse(inputPath);
  const extension = parsed.ext || ".xlsx";
  return path.join(parsed.dir, `${parsed.name}_enriquecida${extension}`);
}

function buildApiConfig(options: EnrichSpreadsheetOptions): ApiClientConfig | null {
  if (!options.apiUrl) {
    return null;
  }

  return {
    url: options.apiUrl.trim(),
    apiKey: options.apiKey?.trim() || undefined,
    timeoutMs: Math.max(1000, options.apiTimeoutMs ?? 8000)
  };
}

function pickStringValue(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function parseApiSuggestion(payload: unknown): ApiEnrichmentSuggestion | null {
  let source: unknown = payload;

  if (Array.isArray(source)) {
    source = source[0];
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  const root = source as Record<string, unknown>;
  const nested = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : root;

  const description =
    pickStringValue(nested, ["descricao_nova", "descricaoNova", "melhor_descricao", "description", "descricao"]) ||
    pickStringValue(root, ["descricao_nova", "descricaoNova", "melhor_descricao", "description", "descricao"]);
  const reducedDescription =
    pickStringValue(nested, ["descricao_reduzida", "descricaoReduzida", "short_description", "shortDescription"]) ||
    pickStringValue(root, ["descricao_reduzida", "descricaoReduzida", "short_description", "shortDescription"]);
  const section =
    pickStringValue(nested, ["secao", "section", "categoria", "category"]) ||
    pickStringValue(root, ["secao", "section", "categoria", "category"]);
  const note =
    pickStringValue(nested, ["observacao", "note", "message"]) || pickStringValue(root, ["observacao", "note", "message"]);
  const confidence =
    toNumberOrUndefined(nested.confianca_secao) ??
    toNumberOrUndefined(nested.confidence) ??
    toNumberOrUndefined(nested.score) ??
    toNumberOrUndefined(root.confianca_secao) ??
    toNumberOrUndefined(root.confidence) ??
    toNumberOrUndefined(root.score);

  if (!description && !reducedDescription && !section) {
    return null;
  }

  return {
    description: description || undefined,
    reducedDescription: reducedDescription || undefined,
    section: section ? normalizeSection(section) : undefined,
    confidence,
    note: note || undefined
  };
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return message.replace(/\s+/g, " ").trim().slice(0, 180);
}

async function requestApiSuggestion(
  apiConfig: ApiClientConfig,
  payload: {
    descricaoOriginal: string;
    descricaoNormalizada: string;
    ean?: string;
    codigoOriginal?: string;
  }
): Promise<ApiEnrichmentSuggestion | null> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), apiConfig.timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };

    if (apiConfig.apiKey) {
      headers.Authorization = `Bearer ${apiConfig.apiKey}`;
      headers["x-api-key"] = apiConfig.apiKey;
    }

    const response = await fetch(apiConfig.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`API status ${response.status}`);
    }

    const rawText = await response.text();
    const parsedJson = rawText ? (JSON.parse(rawText) as unknown) : null;
    return parseApiSuggestion(parsedJson);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function enrichSpreadsheet(options: EnrichSpreadsheetOptions): Promise<EnrichSpreadsheetResult> {
  const inputPath = path.resolve(options.inputPath);
  const workbook = XLSX.readFile(inputPath);
  const sheetName = options.sheetName ?? workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("Planilha sem abas disponiveis.");
  }

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`Aba nao encontrada: ${sheetName}`);
  }

  const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, { defval: "" });

  if (rows.length === 0) {
    throw new Error("Planilha sem linhas para enriquecimento.");
  }

  const descriptionColumn = resolveDescriptionColumn(rows);
  const eanColumn = resolveColumnByCandidates(rows, EAN_COLUMN_CANDIDATES);
  const codeColumn = resolveColumnByCandidates(rows, CODE_COLUMN_CANDIDATES);
  const maxReducedLength = Math.max(20, options.maxReducedLength ?? 60);
  const sectionRules = await loadSectionRules(options.sectionRulesPath);
  const apiConfig = buildApiConfig(options);

  let enrichedRows = 0;
  let pendingSectionRows = 0;
  let blockedRows = 0;
  let apiAttempts = 0;
  let apiSuccessRows = 0;
  let apiFallbackRows = 0;

  const outputRows: SpreadsheetRow[] = [];

  for (const row of rows) {
    const originalDescription = toStringValue(row[descriptionColumn]);
    const normalizedDescription = normalizeDescription(originalDescription);
    const eanValue = eanColumn ? toStringValue(row[eanColumn]) : "";
    const codigoOriginal = codeColumn ? toStringValue(row[codeColumn]) : "";

    if (!normalizedDescription) {
      blockedRows += 1;

      outputRows.push({
        ...row,
        descricao_original: originalDescription,
        descricao_nova: "",
        descricao_reduzida: "",
        secao: "SEM_SECAO",
        secao_sugerida: "SEM_SECAO",
        confianca_secao: 0,
        fonte_enriquecimento: "SEM_DADOS",
        api_status: apiConfig ? "API_SKIPPED_DESCRICAO_VAZIA" : "API_NAO_CONFIGURADA",
        api_detalhe: "",
        status_enriquecimento: "BLOQUEADO_DESCRICAO_VAZIA",
        status_validacao: "erro"
      });
      continue;
    }

    let apiSuggestion: ApiEnrichmentSuggestion | null = null;
    let apiStatus = apiConfig ? "API_SEM_RETORNO" : "API_NAO_CONFIGURADA";
    let apiDetail = "";

    if (apiConfig) {
      apiAttempts += 1;

      try {
        apiSuggestion = await requestApiSuggestion(apiConfig, {
          descricaoOriginal: originalDescription,
          descricaoNormalizada: normalizedDescription,
          ean: eanValue || undefined,
          codigoOriginal: codigoOriginal || undefined
        });

        if (apiSuggestion) {
          apiSuccessRows += 1;
          apiStatus = "API_OK";
          apiDetail = apiSuggestion.note ?? "";
        } else {
          apiFallbackRows += 1;
          apiStatus = "API_SEM_SUGESTAO";
        }
      } catch (error: unknown) {
        apiFallbackRows += 1;
        apiStatus = "API_ERRO";
        apiDetail = sanitizeErrorMessage(error);
      }
    }

    const descriptionFromApi = apiSuggestion?.description
      ? normalizeDescription(apiSuggestion.description)
      : "";
    const effectiveDescription = descriptionFromApi || normalizedDescription;
    const reducedFromApi = apiSuggestion?.reducedDescription
      ? normalizeDescription(apiSuggestion.reducedDescription)
      : "";
    const effectiveReducedDescription = buildReducedDescription(
      reducedFromApi || effectiveDescription,
      maxReducedLength
    );

    const localSection = suggestSection(effectiveDescription, sectionRules);
    const finalSection = apiSuggestion?.section || localSection.section;
    const finalConfidence = clampConfidence(apiSuggestion?.confidence ?? localSection.confidence);
    const isPendingSection = !finalSection || finalSection === "SEM_SECAO";

    enrichedRows += 1;

    if (isPendingSection) {
      pendingSectionRows += 1;
    }

    const usedApiResult = apiStatus === "API_OK";
    const statusEnriquecimento = isPendingSection
      ? "PENDENTE_SECAO"
      : usedApiResult
      ? "ENRIQUECIDO_API"
      : apiConfig
      ? "ENRIQUECIDO_FALLBACK_LOCAL"
      : "ENRIQUECIDO";

    outputRows.push({
      ...row,
      descricao_original: originalDescription,
      descricao_nova: effectiveDescription,
      descricao_reduzida: effectiveReducedDescription,
      secao: finalSection || "SEM_SECAO",
      secao_sugerida: finalSection || "SEM_SECAO",
      confianca_secao: finalConfidence,
      fonte_enriquecimento: usedApiResult ? "API" : "LOCAL_RULES",
      api_status: apiStatus,
      api_detalhe: apiDetail,
      status_enriquecimento: statusEnriquecimento,
      status_validacao: isPendingSection ? "precisa_revisao" : "ok"
    });
  }

  const finalOutputPath = resolveOutputPath(inputPath, options.outputPath);
  await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });

  const outputWorkbook = XLSX.utils.book_new();
  const outputSheet = XLSX.utils.json_to_sheet(outputRows);
  XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, sheetName);
  XLSX.writeFile(outputWorkbook, finalOutputPath);

  return {
    inputPath,
    outputPath: finalOutputPath,
    sheetName,
    descriptionColumn,
    totalRows: rows.length,
    enrichedRows,
    pendingSectionRows,
    blockedRows,
    apiEnabled: Boolean(apiConfig),
    apiAttempts,
    apiSuccessRows,
    apiFallbackRows
  };
}

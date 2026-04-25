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
  group?: string;
  confidence?: number;
  note?: string;
}

interface ApiClientConfig {
  url: string;
  apiKey?: string;
  timeoutMs: number;
}

interface GroqConfig {
  url: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  reasoningEffort: "low" | "medium" | "high";
  temperature: number;
  topP: number;
  maxCompletionTokens: number;
}

interface SectionGroupOption {
  section: string;
  group: string;
  sectionCode?: string;
  groupCode?: string;
}

interface SectionCatalog {
  options: SectionGroupOption[];
  sections: string[];
  groupsBySection: Map<string, string[]>;
  sectionByKey: Map<string, string>;
  groupBySectionKey: Map<string, Map<string, string>>;
  sectionCodeBySection: Map<string, string>;
  groupCodeBySection: Map<string, Map<string, string>>;
  promptText: string;
}

interface LocalSectionGroupSuggestion {
  section: string;
  group: string;
  confidence: number;
}

interface SectionGroupChoice {
  section: string;
  group: string;
  isValid: boolean;
  reason: string;
}

function isLowInformationDescription(value: string): boolean {
  const normalized = value.trim();

  if (!normalized) {
    return true;
  }

  const codeLike = /^[A-Z0-9]{2,8}-\d{2,8}$/i.test(normalized) || /^[A-Z]{2,8}\d{2,8}$/i.test(normalized);
  const textTokens = tokenize(normalized).filter((token) => /[a-z]/i.test(token));
  return codeLike || textTokens.length <= 1;
}

export interface EnrichSpreadsheetOptions {
  inputPath: string;
  outputPath?: string;
  sectionRulesPath?: string;
  sectionCatalogPath?: string;
  sheetName?: string;
  maxReducedLength?: number;
  apiUrl?: string;
  apiKey?: string;
  apiTimeoutMs?: number;
  groqApiUrl?: string;
  groqApiKey?: string;
  groqModel?: string;
  groqTimeoutMs?: number;
  groqReasoningEffort?: "low" | "medium" | "high";
  groqTemperature?: number;
  groqTopP?: number;
  groqMaxCompletionTokens?: number;
}

export interface EnrichSpreadsheetResult {
  inputPath: string;
  outputPath: string;
  sheetName: string;
  descriptionColumn: string;
  totalRows: number;
  enrichedRows: number;
  pendingSectionRows: number;
  pendingGroupRows: number;
  blockedRows: number;
  aiEnabled: boolean;
  aiProvider: "GROQ" | "API_GENERIC" | "NONE";
  aiAttempts: number;
  aiSuccessRows: number;
  aiFallbackRows: number;
  catalogSections: number;
  catalogSectionGroupPairs: number;
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
const SECTION_COLUMN_CANDIDATES = ["secao", "section", "secao_nome", "nome_secao"];
const GROUP_COLUMN_CANDIDATES = ["grupo", "group", "grupo_nome", "nome_grupo"];
const SECTION_CODE_COLUMN_CANDIDATES = ["secao_codigo", "secao_id", "codigo_secao"];
const GROUP_CODE_COLUMN_CANDIDATES = ["grupo_codigo", "grupo_id", "codigo_grupo"];

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

const STOPWORDS = new Set([
  "a",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "sem",
  "um",
  "uma",
  "uns",
  "umas"
]);

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
    .replace(/\bpct\b/gi, "pacote");

  return expanded.toUpperCase();
}

function normalizeSection(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeGroup(value: string): string {
  return value.trim().toUpperCase();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
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

      const keywords = Array.isArray(keywordsRaw) ? keywordsRaw.map((value) => toStringValue(value)).filter(Boolean) : [];

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

function buildGroqConfig(options: EnrichSpreadsheetOptions): GroqConfig | null {
  const sourceUrl = options.groqApiUrl?.trim();
  const sourceModel = options.groqModel?.trim();
  const sourceKey = options.groqApiKey?.trim();

  if (!sourceKey) {
    return null;
  }

  return {
    url: sourceUrl || "https://api.groq.com/openai/v1/chat/completions",
    model: sourceModel || "openai/gpt-oss-120b",
    apiKey: sourceKey,
    timeoutMs: Math.max(3000, options.groqTimeoutMs ?? 45000),
    reasoningEffort: options.groqReasoningEffort ?? "medium",
    temperature: Math.max(0, Math.min(2, options.groqTemperature ?? 1)),
    topP: Math.max(0, Math.min(1, options.groqTopP ?? 1)),
    maxCompletionTokens: Math.max(128, Math.min(2048, Math.floor(options.groqMaxCompletionTokens ?? 512)))
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
  const group =
    pickStringValue(nested, ["grupo", "group", "subcategoria", "subcategory"]) ||
    pickStringValue(root, ["grupo", "group", "subcategoria", "subcategory"]);
  const note =
    pickStringValue(nested, ["observacao", "note", "message"]) || pickStringValue(root, ["observacao", "note", "message"]);
  const confidence =
    toNumberOrUndefined(nested.confianca_secao) ??
    toNumberOrUndefined(nested.confidence) ??
    toNumberOrUndefined(nested.score) ??
    toNumberOrUndefined(root.confianca_secao) ??
    toNumberOrUndefined(root.confidence) ??
    toNumberOrUndefined(root.score);

  if (!description && !reducedDescription && !section && !group) {
    return null;
  }

  return {
    description: description || undefined,
    reducedDescription: reducedDescription || undefined,
    section: section ? normalizeSection(section) : undefined,
    group: group ? normalizeGroup(group) : undefined,
    confidence,
    note: note || undefined
  };
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  return message.replace(/\s+/g, " ").trim().slice(0, 220);
}

function removeCodepointMarks(value: string): string {
  return value.replace(/^\ufeff/, "");
}

function parseSectionNameFromLine(line: string): string {
  const dashIndex = line.indexOf("-");

  if (dashIndex === -1) {
    return normalizeSection(line);
  }

  return normalizeSection(line.slice(dashIndex + 1));
}

function parseSectionCatalogFromText(content: string): SectionGroupOption[] {
  const sectionRegex = /^secao:\s*(\d+)\s*-\s*(.+)$/i;
  const groupRegex = /^grupo:\s*(\d+)\s*-\s*(.+)$/i;
  const semGrupoRegex = /^sem\s+grupo$/i;

  let currentSectionName = "";
  let currentSectionCode = "";
  const options: SectionGroupOption[] = [];

  for (const rawLine of content.split(/\r?\n/g)) {
    const cleanLine = removeCodepointMarks(rawLine).trim();

    if (!cleanLine) {
      continue;
    }

    const controlLine = cleanLine
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const sectionMatch = sectionRegex.exec(controlLine);

    if (sectionMatch) {
      currentSectionCode = sectionMatch[1];
      currentSectionName = parseSectionNameFromLine(cleanLine);
      continue;
    }

    if (!currentSectionName) {
      continue;
    }

    if (semGrupoRegex.test(controlLine)) {
      options.push({
        section: currentSectionName,
        group: "SEM GRUPO",
        sectionCode: currentSectionCode,
        groupCode: "0"
      });
      continue;
    }

    const groupMatch = groupRegex.exec(controlLine);

    if (!groupMatch) {
      continue;
    }

    options.push({
      section: currentSectionName,
      group: parseSectionNameFromLine(cleanLine),
      sectionCode: currentSectionCode,
      groupCode: groupMatch[1]
    });
  }

  return options;
}

function parseSectionCatalogFromWorkbook(catalogPath: string): SectionGroupOption[] {
  const workbook = XLSX.readFile(catalogPath);
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return [];
  }

  const worksheet = workbook.Sheets[firstSheetName];

  if (!worksheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(worksheet, { defval: "" });

  if (rows.length === 0) {
    return [];
  }

  const sectionColumn = resolveColumnByCandidates(rows, SECTION_COLUMN_CANDIDATES);
  const groupColumn = resolveColumnByCandidates(rows, GROUP_COLUMN_CANDIDATES);
  const sectionCodeColumn = resolveColumnByCandidates(rows, SECTION_CODE_COLUMN_CANDIDATES);
  const groupCodeColumn = resolveColumnByCandidates(rows, GROUP_CODE_COLUMN_CANDIDATES);

  if (!sectionColumn || !groupColumn) {
    throw new Error("Catalogo secao/grupo invalido: colunas de secao e grupo nao encontradas.");
  }

  const options: SectionGroupOption[] = [];

  for (const row of rows) {
    const section = normalizeSection(toStringValue(row[sectionColumn]));
    const group = normalizeGroup(toStringValue(row[groupColumn]));

    if (!section || !group) {
      continue;
    }

    options.push({
      section,
      group,
      sectionCode: sectionCodeColumn ? toStringValue(row[sectionCodeColumn]) : "",
      groupCode: groupCodeColumn ? toStringValue(row[groupCodeColumn]) : ""
    });
  }

  return options;
}

function buildSectionCatalog(options: SectionGroupOption[]): SectionCatalog {
  const dedupKeys = new Set<string>();
  const normalizedOptions: SectionGroupOption[] = [];

  for (const option of options) {
    const section = normalizeSection(option.section);
    const group = normalizeGroup(option.group);

    if (!section || !group) {
      continue;
    }

    const key = `${normalizeKey(section)}::${normalizeKey(group)}`;

    if (dedupKeys.has(key)) {
      continue;
    }

    dedupKeys.add(key);
    normalizedOptions.push({
      section,
      group,
      sectionCode: option.sectionCode?.trim() || undefined,
      groupCode: option.groupCode?.trim() || undefined
    });
  }

  if (normalizedOptions.length === 0) {
    throw new Error("Catalogo secao/grupo vazio apos normalizacao.");
  }

  const sectionByKey = new Map<string, string>();
  const groupBySectionKey = new Map<string, Map<string, string>>();
  const groupsBySection = new Map<string, string[]>();
  const sectionCodeBySection = new Map<string, string>();
  const groupCodeBySection = new Map<string, Map<string, string>>();
  const sectionOrder: string[] = [];

  for (const option of normalizedOptions) {
    const sectionKey = normalizeKey(option.section);
    const groupKey = normalizeKey(option.group);

    if (!sectionByKey.has(sectionKey)) {
      sectionByKey.set(sectionKey, option.section);
      sectionOrder.push(option.section);
      groupsBySection.set(option.section, []);
      groupBySectionKey.set(sectionKey, new Map<string, string>());
      groupCodeBySection.set(option.section, new Map<string, string>());
    }

    const sectionGroups = groupsBySection.get(option.section)!;

    if (!sectionGroups.includes(option.group)) {
      sectionGroups.push(option.group);
    }

    groupBySectionKey.get(sectionKey)!.set(groupKey, option.group);

    const sectionCode = option.sectionCode?.trim() || "";

    if (sectionCode && !sectionCodeBySection.has(option.section)) {
      sectionCodeBySection.set(option.section, sectionCode);
    }

    const groupCode = option.groupCode?.trim() || "";

    if (groupCode) {
      groupCodeBySection.get(option.section)!.set(option.group, groupCode);
    }
  }

  const promptChunks: string[] = [];

  for (const section of sectionOrder) {
    const groups = groupsBySection.get(section) ?? [];
    promptChunks.push(`${section}=>${groups.join("|")}`);
  }

  return {
    options: normalizedOptions,
    sections: sectionOrder,
    groupsBySection,
    sectionByKey,
    groupBySectionKey,
    sectionCodeBySection,
    groupCodeBySection,
    promptText: `CATALOGO_SECAO_GRUPO:${promptChunks.join(";")}`
  };
}

async function loadSectionCatalog(sectionCatalogPath?: string): Promise<SectionCatalog | null> {
  if (!sectionCatalogPath) {
    return null;
  }

  const resolvedPath = path.resolve(sectionCatalogPath);
  const ext = path.extname(resolvedPath).toLowerCase();
  const exists = await fs
    .stat(resolvedPath)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    throw new Error(`Catalogo secao/grupo nao encontrado: ${resolvedPath}`);
  }

  let options: SectionGroupOption[] = [];

  if (ext === ".txt") {
    const content = await fs.readFile(resolvedPath, "utf8");
    options = parseSectionCatalogFromText(content);
  } else if (ext === ".csv" || ext === ".tsv" || ext === ".xlsx" || ext === ".xls" || ext === ".xlsm") {
    options = parseSectionCatalogFromWorkbook(resolvedPath);
  } else {
    throw new Error(`Formato de catalogo nao suportado: ${ext}`);
  }

  return buildSectionCatalog(options);
}

function scoreCatalogOption(description: string, option: SectionGroupOption): number {
  const normalizedDescription = normalizeText(description);

  if (!normalizedDescription) {
    return 0;
  }

  const descriptionTokens = new Set(tokenize(description));
  const sectionTokens = tokenize(option.section);
  const groupTokens = tokenize(option.group);

  let score = 0;

  for (const token of sectionTokens) {
    if (descriptionTokens.has(token)) {
      score += 2;
    }
  }

  for (const token of groupTokens) {
    if (descriptionTokens.has(token)) {
      score += 5;
    }
  }

  const normalizedGroup = normalizeText(option.group);
  const normalizedSection = normalizeText(option.section);

  if (normalizedGroup && normalizedDescription.includes(normalizedGroup)) {
    score += 14;
  }

  if (normalizedSection && normalizedDescription.includes(normalizedSection)) {
    score += 6;
  }

  if (option.group === "SEM GRUPO") {
    score -= 2;
  }

  return score;
}

function suggestSectionGroupLocally(
  description: string,
  sectionRules: SectionRule[],
  sectionCatalog: SectionCatalog | null
): LocalSectionGroupSuggestion {
  if (sectionCatalog && sectionCatalog.options.length > 0) {
    let bestOption: SectionGroupOption | null = null;
    let bestScore = 0;

    for (const option of sectionCatalog.options) {
      const score = scoreCatalogOption(description, option);

      if (score > bestScore) {
        bestOption = option;
        bestScore = score;
      }
    }

    if (bestOption && bestScore > 0) {
      return {
        section: bestOption.section,
        group: bestOption.group,
        confidence: clampConfidence(bestScore / 30)
      };
    }
  }

  const sectionSuggestion = suggestSection(description, sectionRules);

  if (!sectionCatalog) {
    return {
      section: sectionSuggestion.section,
      group: "",
      confidence: sectionSuggestion.confidence
    };
  }

  const sectionFromCatalog = sectionCatalog.sectionByKey.get(normalizeKey(sectionSuggestion.section));

  if (!sectionFromCatalog) {
    return {
      section: "SEM_SECAO",
      group: "",
      confidence: 0
    };
  }

  const sectionGroups = sectionCatalog.groupsBySection.get(sectionFromCatalog) ?? [];
  const semGrupo = sectionGroups.find((group) => normalizeKey(group) === normalizeKey("SEM GRUPO")) || "";

  return {
    section: sectionFromCatalog,
    group: semGrupo,
    confidence: clampConfidence(sectionSuggestion.confidence * (semGrupo ? 1 : 0.6))
  };
}

function validateSectionGroupChoice(
  sectionRaw: string | undefined,
  groupRaw: string | undefined,
  sectionCatalog: SectionCatalog | null
): SectionGroupChoice {
  const section = normalizeSection(sectionRaw ?? "");
  const group = normalizeGroup(groupRaw ?? "");

  if (!sectionCatalog) {
    return {
      section,
      group,
      isValid: Boolean(section),
      reason: section ? "OK" : "SECAO_VAZIA"
    };
  }

  if (!section) {
    return {
      section: "",
      group: "",
      isValid: false,
      reason: "SECAO_VAZIA"
    };
  }

  const sectionCanonical = sectionCatalog.sectionByKey.get(normalizeKey(section));

  if (!sectionCanonical) {
    return {
      section: "",
      group: "",
      isValid: false,
      reason: "SECAO_NAO_ENCONTRADA_NO_CATALOGO"
    };
  }

  if (!group) {
    return {
      section: sectionCanonical,
      group: "",
      isValid: false,
      reason: "GRUPO_VAZIO"
    };
  }

  const groupMap = sectionCatalog.groupBySectionKey.get(normalizeKey(sectionCanonical));
  const groupCanonical = groupMap?.get(normalizeKey(group));

  if (!groupCanonical) {
    return {
      section: sectionCanonical,
      group: "",
      isValid: false,
      reason: "GRUPO_FORA_DA_SECAO"
    };
  }

  return {
    section: sectionCanonical,
    group: groupCanonical,
    isValid: true,
    reason: "OK"
  };
}

function resolveDefaultCatalogChoice(sectionCatalog: SectionCatalog | null): SectionGroupChoice {
  if (!sectionCatalog || sectionCatalog.sections.length === 0) {
    return {
      section: "",
      group: "",
      isValid: false,
      reason: "CATALOGO_NAO_DISPONIVEL"
    };
  }

  const preferredSection = sectionCatalog.sectionByKey.get(normalizeKey("USO E CONSUMO"));
  const section = preferredSection || sectionCatalog.sections[0];
  const groups = sectionCatalog.groupsBySection.get(section) ?? [];
  const preferredGroup = groups.find((group) => normalizeKey(group) === normalizeKey("SEM GRUPO"));
  const group = preferredGroup || groups[0] || "";

  if (!section || !group) {
    return {
      section: "",
      group: "",
      isValid: false,
      reason: "CATALOGO_SEM_GRUPO_PADRAO"
    };
  }

  return {
    section,
    group,
    isValid: true,
    reason: "FALLBACK_CATALOGO_PADRAO"
  };
}

function resolveSectionGroupCodes(
  choice: SectionGroupChoice,
  sectionCatalog: SectionCatalog | null
): { sectionCode: string; groupCode: string } {
  if (!sectionCatalog || !choice.section) {
    return { sectionCode: "", groupCode: "" };
  }

  const canonicalSection = sectionCatalog.sectionByKey.get(normalizeKey(choice.section)) ?? choice.section;
  const sectionCode = sectionCatalog.sectionCodeBySection.get(canonicalSection) ?? "";
  const canonicalGroup = choice.group || "";
  const groupCode = canonicalGroup
    ? sectionCatalog.groupCodeBySection.get(canonicalSection)?.get(canonicalGroup) ?? ""
    : "";

  return {
    sectionCode,
    groupCode
  };
}

function extractJsonObject(rawText: string): string | null {
  const trimmed = rawText.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

function parseAssistantJsonPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Record<string, unknown>;
  const responseField = payload.response;

  if (typeof responseField === "string") {
    const jsonBlock = extractJsonObject(responseField);

    if (jsonBlock) {
      return JSON.parse(jsonBlock) as unknown;
    }
  }

  const message = payload.message;

  if (message && typeof message === "object" && typeof (message as Record<string, unknown>).content === "string") {
    const content = (message as Record<string, unknown>).content as string;
    const jsonBlock = extractJsonObject(content);

    if (jsonBlock) {
      return JSON.parse(jsonBlock) as unknown;
    }
  }

  const choices = payload.choices;

  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];

    if (first && typeof first === "object") {
      const firstObj = first as Record<string, unknown>;
      const msg = firstObj.message;

      if (msg && typeof msg === "object" && typeof (msg as Record<string, unknown>).content === "string") {
        const content = (msg as Record<string, unknown>).content as string;
        const jsonBlock = extractJsonObject(content);

        if (jsonBlock) {
          return JSON.parse(jsonBlock) as unknown;
        }
      }
    }
  }

  return raw;
}

async function requestApiSuggestion(
  apiConfig: ApiClientConfig,
  payload: {
    descricaoOriginal: string;
    descricaoNormalizada: string;
    ean?: string;
    codigoOriginal?: string;
    catalogo?: string;
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
    const extractedPayload = parseAssistantJsonPayload(parsedJson);
    return parseApiSuggestion(extractedPayload);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildGroqPrompts(
  payload: {
    descricaoOriginal: string;
    descricaoNormalizada: string;
    ean?: string;
    codigoOriginal?: string;
  },
  sectionCatalog: SectionCatalog | null,
  maxReducedLength: number
): { system: string; user: string } {
  const systemPrompt = [
    "Voce e um agente de cadastro de produtos.",
    "Sua tarefa e melhorar descricao e classificar em secao e grupo.",
    "Use somente secoes e grupos do catalogo fornecido.",
    "Retorne JSON puro sem markdown.",
    "Formato obrigatorio:",
    "{",
    '  "descricao_nova": "string",',
    '  "descricao_reduzida": "string",',
    '  "secao": "string",',
    '  "grupo": "string",',
    '  "confianca": 0.0,',
    '  "observacao": "string"',
    "}",
    `Limite descricao_reduzida: ${maxReducedLength} caracteres.`
  ].join("\n");

  const catalogPrompt = sectionCatalog ? sectionCatalog.promptText : "CATALOGO: nao informado";
  const userPrompt = [
    "DADOS DO PRODUTO:",
    `descricao_original: ${payload.descricaoOriginal || "-"}`,
    `descricao_normalizada: ${payload.descricaoNormalizada || "-"}`,
    `ean: ${payload.ean || "-"}`,
    `codigo_original: ${payload.codigoOriginal || "-"}`,
    "",
    catalogPrompt,
    "",
    "Responda somente com JSON valido."
  ].join("\n");

  return { system: systemPrompt, user: userPrompt };
}

async function requestGroqSuggestion(
  groqConfig: GroqConfig,
  payload: {
    descricaoOriginal: string;
    descricaoNormalizada: string;
    ean?: string;
    codigoOriginal?: string;
  },
  sectionCatalog: SectionCatalog | null,
  maxReducedLength: number
): Promise<ApiEnrichmentSuggestion | null> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), groqConfig.timeoutMs);
  const prompts = buildGroqPrompts(payload, sectionCatalog, maxReducedLength);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqConfig.apiKey}`,
      "x-api-key": groqConfig.apiKey
    };

    const body = {
      model: groqConfig.model,
      messages: [
        { role: "system", content: prompts.system },
        { role: "user", content: prompts.user }
      ],
      temperature: groqConfig.temperature,
      top_p: groqConfig.topP,
      max_completion_tokens: groqConfig.maxCompletionTokens,
      reasoning_effort: groqConfig.reasoningEffort,
      stream: false,
      response_format: { type: "json_object" as const },
      stop: null
    };

    const response = await fetch(groqConfig.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`GROQ status ${response.status} - ${responseText.slice(0, 220)}`);
    }

    const rawText = await response.text();
    const parsedJson = rawText ? (JSON.parse(rawText) as unknown) : null;
    const extractedPayload = parseAssistantJsonPayload(parsedJson);
    return parseApiSuggestion(extractedPayload);
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
  const sectionCatalog = await loadSectionCatalog(options.sectionCatalogPath);
  const apiConfig = buildApiConfig(options);
  const groqConfig = buildGroqConfig(options);

  let enrichedRows = 0;
  let pendingSectionRows = 0;
  let pendingGroupRows = 0;
  let blockedRows = 0;
  let aiAttempts = 0;
  let aiSuccessRows = 0;
  let aiFallbackRows = 0;

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
        grupo: "",
        secao_codigo: "",
        grupo_codigo: "",
        confianca_secao_grupo: 0,
        fonte_enriquecimento: "SEM_DADOS",
        ai_status: "AI_SKIPPED_DESCRICAO_VAZIA",
        ai_detalhe: "",
        status_enriquecimento: "BLOQUEADO_DESCRICAO_VAZIA",
        status_validacao: "erro"
      });
      continue;
    }

    const skipAiByDescription = isLowInformationDescription(normalizedDescription);

    let aiSuggestion: ApiEnrichmentSuggestion | null = null;
    let aiStatus = skipAiByDescription
      ? "AI_SKIPPED_DESCRICAO_POUCO_INFORMATIVA"
      : groqConfig || apiConfig
      ? "AI_SEM_RETORNO"
      : "AI_NAO_CONFIGURADA";
    let aiDetail = "";

    if (skipAiByDescription) {
      aiDetail = "Descricao sem contexto suficiente para classificacao por IA.";
    } else {
      const aiAttemptsTrace: string[] = [];

      if (groqConfig) {
        aiAttempts += 1;

        try {
          const groqSuggestion = await requestGroqSuggestion(
            groqConfig,
            {
              descricaoOriginal: originalDescription,
              descricaoNormalizada: normalizedDescription,
              ean: eanValue || undefined,
              codigoOriginal: codigoOriginal || undefined
            },
            sectionCatalog,
            maxReducedLength
          );

          if (groqSuggestion) {
            aiSuggestion = groqSuggestion;
            aiStatus = "GROQ_OK";
            aiDetail = groqSuggestion.note ?? "";
            aiAttemptsTrace.push("GROQ_OK");
          } else {
            aiAttemptsTrace.push("GROQ_SEM_SUGESTAO");
          }
        } catch (error: unknown) {
          aiAttemptsTrace.push(`GROQ_ERRO:${sanitizeErrorMessage(error)}`);
        }
      }

      if (!aiSuggestion && apiConfig) {
        aiAttempts += 1;

        try {
          const apiSuggestion = await requestApiSuggestion(apiConfig, {
            descricaoOriginal: originalDescription,
            descricaoNormalizada: normalizedDescription,
            ean: eanValue || undefined,
            codigoOriginal: codigoOriginal || undefined,
            catalogo: sectionCatalog?.promptText
          });

          if (apiSuggestion) {
            aiSuggestion = apiSuggestion;
            aiStatus = "API_OK";
            aiDetail = `${aiAttemptsTrace.join(" | ")} ${apiSuggestion.note ?? ""}`.trim();
            aiAttemptsTrace.push("API_OK");
          } else {
            aiAttemptsTrace.push("API_SEM_SUGESTAO");
          }
        } catch (error: unknown) {
          aiAttemptsTrace.push(`API_ERRO:${sanitizeErrorMessage(error)}`);
        }
      }

      if (aiSuggestion) {
        aiSuccessRows += 1;
      } else {
        aiFallbackRows += 1;

        if (aiAttemptsTrace.length > 0) {
          const lastAttempt = aiAttemptsTrace[aiAttemptsTrace.length - 1];

          if (lastAttempt.startsWith("API_ERRO")) {
            aiStatus = "API_ERRO";
          } else if (lastAttempt === "API_SEM_SUGESTAO") {
            aiStatus = "API_SEM_SUGESTAO";
          } else if (lastAttempt.startsWith("GROQ_ERRO")) {
            aiStatus = "GROQ_ERRO";
          } else if (lastAttempt === "GROQ_SEM_SUGESTAO") {
            aiStatus = "GROQ_SEM_SUGESTAO";
          }

          aiDetail = aiAttemptsTrace.join(" | ");
        }
      }
    }

    const localSuggestion = suggestSectionGroupLocally(normalizedDescription, sectionRules, sectionCatalog);

    const descriptionFromAi = aiSuggestion?.description ? normalizeDescription(aiSuggestion.description) : "";
    const reducedFromAi = aiSuggestion?.reducedDescription ? normalizeDescription(aiSuggestion.reducedDescription) : "";
    const effectiveDescription = descriptionFromAi || normalizedDescription;
    const effectiveReducedDescription = buildReducedDescription(
      reducedFromAi || effectiveDescription,
      maxReducedLength
    );

    const aiChoice = validateSectionGroupChoice(aiSuggestion?.section, aiSuggestion?.group, sectionCatalog);
    const localChoice = validateSectionGroupChoice(localSuggestion.section, localSuggestion.group, sectionCatalog);

    const defaultChoice = resolveDefaultCatalogChoice(sectionCatalog);
    const usedAiChoice = aiChoice.isValid;
    const usedLocalChoice = !usedAiChoice && localChoice.isValid;
    const usedDefaultChoice = !usedAiChoice && !usedLocalChoice && defaultChoice.isValid;
    const finalChoice = usedAiChoice ? aiChoice : usedLocalChoice ? localChoice : defaultChoice;
    const finalSection = finalChoice.section || "SEM_SECAO";
    const finalGroup = finalChoice.group || "";
    const finalCodes = resolveSectionGroupCodes(finalChoice, sectionCatalog);
    const finalConfidence = clampConfidence(
      aiChoice.isValid ? aiSuggestion?.confidence : aiSuggestion?.confidence ?? localSuggestion.confidence
    );

    const isPendingSection = !finalSection || finalSection === "SEM_SECAO";
    const isPendingGroup = !isPendingSection && !finalGroup;

    enrichedRows += 1;

    if (isPendingSection) {
      pendingSectionRows += 1;
    }

    if (isPendingGroup) {
      pendingGroupRows += 1;
    }

    const usedAi = aiChoice.isValid && (aiStatus === "GROQ_OK" || aiStatus === "API_OK");
    const source = usedAi ? (groqConfig ? "IA_GROQ" : "API_GENERIC") : usedDefaultChoice ? "DEFAULT_CATALOGO" : "LOCAL_RULES";
    const statusEnriquecimento = isPendingSection || isPendingGroup || usedDefaultChoice ? "PENDENTE_REVISAO" : "ENRIQUECIDO";

    outputRows.push({
      ...row,
      descricao_original: originalDescription,
      descricao_nova: effectiveDescription,
      descricao_reduzida: effectiveReducedDescription,
      secao: finalSection,
      grupo: finalGroup,
      secao_codigo: finalCodes.sectionCode,
      grupo_codigo: finalCodes.groupCode,
      confianca_secao_grupo: finalConfidence,
      fonte_enriquecimento: source,
      ai_status: aiStatus,
      ai_detalhe: aiChoice.isValid
        ? aiDetail
        : `${aiDetail} ${usedDefaultChoice ? defaultChoice.reason : aiChoice.reason}`.trim(),
      status_enriquecimento: statusEnriquecimento,
      status_validacao: isPendingSection || isPendingGroup || usedDefaultChoice ? "precisa_revisao" : "ok"
    });
  }

  const finalOutputPath = resolveOutputPath(inputPath, options.outputPath);
  await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });

  const outputWorkbook = XLSX.utils.book_new();
  const outputSheet = XLSX.utils.json_to_sheet(outputRows);
  XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, sheetName);
  XLSX.writeFile(outputWorkbook, finalOutputPath);

  const aiProvider: "GROQ" | "API_GENERIC" | "NONE" = groqConfig ? "GROQ" : apiConfig ? "API_GENERIC" : "NONE";

  return {
    inputPath,
    outputPath: finalOutputPath,
    sheetName,
    descriptionColumn,
    totalRows: rows.length,
    enrichedRows,
    pendingSectionRows,
    pendingGroupRows,
    blockedRows,
    aiEnabled: aiProvider !== "NONE",
    aiProvider,
    aiAttempts,
    aiSuccessRows,
    aiFallbackRows,
    catalogSections: sectionCatalog?.sections.length ?? 0,
    catalogSectionGroupPairs: sectionCatalog?.options.length ?? 0
  };
}

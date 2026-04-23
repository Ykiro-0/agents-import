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

export interface EnrichSpreadsheetOptions {
  inputPath: string;
  outputPath?: string;
  sectionRulesPath?: string;
  sheetName?: string;
  maxReducedLength?: number;
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
      bestSection = rule.section;
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

function resolveDescriptionColumn(rows: SpreadsheetRow[]): string {
  const availableColumns = new Map<string, string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!availableColumns.has(normalizeKey(key))) {
        availableColumns.set(normalizeKey(key), key);
      }
    }
  }

  for (const candidate of DESCRIPTION_COLUMN_CANDIDATES) {
    const resolved = availableColumns.get(normalizeKey(candidate));

    if (resolved) {
      return resolved;
    }
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

      const section = toStringValue((entry as Record<string, unknown>).section);
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
  const maxReducedLength = Math.max(20, options.maxReducedLength ?? 60);
  const sectionRules = await loadSectionRules(options.sectionRulesPath);

  let enrichedRows = 0;
  let pendingSectionRows = 0;
  let blockedRows = 0;

  const outputRows = rows.map((row) => {
    const originalDescription = toStringValue(row[descriptionColumn]);
    const normalizedDescription = normalizeDescription(originalDescription);

    if (!normalizedDescription) {
      blockedRows += 1;

      return {
        ...row,
        descricao_nova: "",
        descricao_reduzida: "",
        secao_sugerida: "SEM_SECAO",
        confianca_secao: 0,
        status_enriquecimento: "BLOQUEADO_DESCRICAO_VAZIA"
      };
    }

    const reducedDescription = buildReducedDescription(normalizedDescription, maxReducedLength);
    const section = suggestSection(normalizedDescription, sectionRules);
    const isPendingSection = section.section === "SEM_SECAO";

    enrichedRows += 1;

    if (isPendingSection) {
      pendingSectionRows += 1;
    }

    return {
      ...row,
      descricao_nova: normalizedDescription,
      descricao_reduzida: reducedDescription,
      secao_sugerida: section.section,
      confianca_secao: section.confidence,
      status_enriquecimento: isPendingSection ? "PENDENTE_SECAO" : "ENRIQUECIDO"
    };
  });

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
    blockedRows
  };
}

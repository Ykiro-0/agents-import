import fs from "node:fs/promises";
import nodeFs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";
import { config } from "../config.js";
import { enrichSpreadsheet } from "./kadia-enrichment.js";
import { resolveUploadedSpreadsheetPath } from "./manual-spreadsheets.js";

const EXCEL_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm"]);
const MANUAL_RESULT_FOLDER = "manual-resultados";

export interface ManualSpreadsheetRunResult {
  outputPath: string;
  outputFileName: string;
  downloadUrl: string;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function resolveSheetName(workbook: XLSX.WorkBook, requestedName: string): string {
  const requestedKey = normalizeKey(requestedName);

  for (const sheetName of workbook.SheetNames) {
    if (normalizeKey(sheetName) === requestedKey) {
      return sheetName;
    }
  }

  throw new Error(`Aba base nao encontrada: ${requestedName}.`);
}

function resolveDefaultSectionCatalogPath(): string | undefined {
  const candidates = [
    path.resolve("backend", "secao", "SECAO NEWSHOP.txt"),
    path.resolve("backend", "secao", "secao_grupo_newshop.csv"),
    path.resolve("config", "kadia-section-catalog.csv")
  ];

  return candidates.find((candidate) => nodeFs.existsSync(candidate));
}

function resolveColumn(rows: Array<Record<string, unknown>>, candidates: string[]): string | undefined {
  const map = new Map<string, string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const normalized = normalizeKey(key);

      if (!map.has(normalized)) {
        map.set(normalized, key);
      }
    }
  }

  for (const candidate of candidates) {
    const resolved = map.get(normalizeKey(candidate));

    if (resolved) {
      return resolved;
    }
  }

  return undefined;
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value).trim();
}

function toCellValue(value: unknown): string | number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = toStringValue(value);

  if (!text) {
    return "";
  }

  const normalized = text.replace(",", ".");
  const asNumber = Number(normalized);

  if (Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(normalized)) {
    return asNumber;
  }

  return text;
}

function truncateReducedDescription(value: string): string {
  if (value.length <= 20) {
    return value;
  }

  return value.slice(0, 20).trim();
}

function buildEnrichmentRows(rows: Array<Record<string, unknown>>): Array<Array<string | number>> {
  const descriptionCol = resolveColumn(rows, ["descricao_nova", "descricao nova", "descricao"]);
  const reducedCol = resolveColumn(rows, ["descricao_reduzida", "descricao reduzida"]);
  const barcodeCol = resolveColumn(rows, ["codigo de barra", "cod de barra", "cod. de barra", "ean", "ean_tributado", "codbarras"]);
  const sectionCodeCol = resolveColumn(rows, ["secao_codigo", "secao id", "secao_id", "codigo_secao"]);
  const groupCodeCol = resolveColumn(rows, ["grupo_codigo", "grupo id", "grupo_id", "codigo_grupo"]);
  const sectionCol = resolveColumn(rows, ["secao", "secao_nome"]);
  const groupCol = resolveColumn(rows, ["grupo", "grupo_nome"]);
  const caixaCol = resolveColumn(rows, ["caixas", "caixa", "q. cx", "q.cx", "q cx"]);
  const unidadeCol = resolveColumn(rows, ["unid", "unid.", "unidade", "und"]);
  const quantidadeCol = resolveColumn(rows, ["quant", "quant.", "quantidade"]);
  const varejoCol = resolveColumn(rows, ["varejo", "preco varejo"]);
  const atacadoCol = resolveColumn(rows, ["atacado", "preco atacado"]);

  if (!descriptionCol) {
    throw new Error("Nao foi possivel mapear coluna de descricao para montar a aba enriquecimento.");
  }

  const output: Array<Array<string | number>> = [];

  for (const row of rows) {
    const improvedDescription = toStringValue(row[descriptionCol]);

    if (!improvedDescription) {
      continue;
    }

    const reducedDescriptionRaw = reducedCol ? toStringValue(row[reducedCol]) : improvedDescription;
    const reducedDescription = truncateReducedDescription(reducedDescriptionRaw || improvedDescription);
    const sectionValue = sectionCodeCol ? row[sectionCodeCol] : sectionCol ? row[sectionCol] : "";
    const groupValue = groupCodeCol ? row[groupCodeCol] : groupCol ? row[groupCol] : "";

    output.push([
      improvedDescription,
      reducedDescription,
      toCellValue(barcodeCol ? row[barcodeCol] : ""),
      toCellValue(sectionValue),
      toCellValue(groupValue),
      toCellValue(caixaCol ? row[caixaCol] : ""),
      toCellValue(unidadeCol ? row[unidadeCol] : ""),
      toCellValue(quantidadeCol ? row[quantidadeCol] : ""),
      toCellValue(varejoCol ? row[varejoCol] : ""),
      toCellValue(atacadoCol ? row[atacadoCol] : "")
    ]);
  }

  return output;
}

function removeSheetIfExists(workbook: XLSX.WorkBook, sheetName: string): void {
  const existingIndex = workbook.SheetNames.findIndex((current) => normalizeKey(current) === normalizeKey(sheetName));

  if (existingIndex === -1) {
    return;
  }

  const existingName = workbook.SheetNames[existingIndex];
  workbook.SheetNames.splice(existingIndex, 1);
  delete workbook.Sheets[existingName];
}

function normalizeRelativePath(filePath: string): string {
  return path.relative(config.outputDir, filePath).replace(/\\/g, "/");
}

function buildDownloadUrl(relativePath: string): string {
  return `/downloads/${encodeURIComponent(relativePath)}`;
}

function resolveUniqueOutputPath(directory: string, baseName: string): string {
  let counter = 0;
  let candidate = `${baseName}_enriquecida.xlsx`;

  while (nodeFs.existsSync(path.join(directory, candidate))) {
    counter += 1;
    candidate = `${baseName}_enriquecida_${counter}.xlsx`;
  }

  return path.join(directory, candidate);
}

async function enrichWorkbookWithNewSheet(inputPath: string, outputPath: string): Promise<void> {
  const originalWorkbook = XLSX.readFile(inputPath);
  const baseSheetName = resolveSheetName(originalWorkbook, "PRECO");
  const sectionCatalogPath = process.env.KADIA_SECTION_CATALOG_PATH ?? resolveDefaultSectionCatalogPath();

  const tempOutputPath = path.join(
    os.tmpdir(),
    `kadia_enrich_temp_${Date.now()}_${Math.random().toString(36).slice(2)}.xlsx`
  );

  try {
    await enrichSpreadsheet({
      inputPath,
      outputPath: tempOutputPath,
      sheetName: baseSheetName,
      sectionCatalogPath,
      sectionRulesPath: process.env.KADIA_SECTION_RULES_PATH,
      groqApiUrl: process.env.GROQ_API_URL,
      groqApiKey: process.env.GROQ_API_KEY ?? process.env.OLLAMA_KEY,
      groqModel: process.env.GROQ_MODEL,
      groqTimeoutMs: process.env.GROQ_TIMEOUT_MS ? Number(process.env.GROQ_TIMEOUT_MS) : undefined,
      groqReasoningEffort: (process.env.GROQ_REASONING_EFFORT as "low" | "medium" | "high" | undefined) ?? "medium",
      groqTemperature: process.env.GROQ_TEMPERATURE ? Number(process.env.GROQ_TEMPERATURE) : undefined,
      groqTopP: process.env.GROQ_TOP_P ? Number(process.env.GROQ_TOP_P) : undefined,
      groqMaxCompletionTokens: process.env.GROQ_MAX_COMPLETION_TOKENS
        ? Number(process.env.GROQ_MAX_COMPLETION_TOKENS)
        : undefined
    });

    const enrichedWorkbook = XLSX.readFile(tempOutputPath);
    const enrichedSheet = enrichedWorkbook.Sheets[baseSheetName];

    if (!enrichedSheet) {
      throw new Error(`Aba enriquecida nao encontrada no temporario: ${baseSheetName}`);
    }

    const enrichedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(enrichedSheet, { defval: "" });
    const enrichmentDataRows = buildEnrichmentRows(enrichedRows);
    const headers = [
      "Descricao (melhorada)",
      "Descricao Reduzida",
      "Codigo de barra",
      "Secao",
      "Grupo",
      "Caixa",
      "Unidade",
      "Quantidade",
      "Varejo",
      "Atacado"
    ];

    const aoa: Array<Array<string | number>> = [headers, ...enrichmentDataRows];
    const enrichmentSheet = XLSX.utils.aoa_to_sheet(aoa);

    removeSheetIfExists(originalWorkbook, "enriquecimento");
    XLSX.utils.book_append_sheet(originalWorkbook, enrichmentSheet, "enriquecimento");

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    XLSX.writeFile(originalWorkbook, outputPath);
  } finally {
    await fs.unlink(tempOutputPath).catch(() => undefined);
  }
}

export async function startUploadedSpreadsheet(fileName: string): Promise<ManualSpreadsheetRunResult> {
  const inputPath = resolveUploadedSpreadsheetPath(fileName);

  if (!nodeFs.existsSync(inputPath)) {
    throw new Error("Planilha nao encontrada para iniciar.");
  }

  const extension = path.extname(inputPath).toLowerCase();

  if (!EXCEL_EXTENSIONS.has(extension)) {
    throw new Error("Botao Iniciar aceita apenas planilha Excel (.xlsx, .xls, .xlsm).");
  }

  const resultDirectory = path.resolve(config.outputDir, MANUAL_RESULT_FOLDER);
  await fs.mkdir(resultDirectory, { recursive: true });

  const parsed = path.parse(inputPath);
  const outputPath = resolveUniqueOutputPath(resultDirectory, parsed.name);
  await enrichWorkbookWithNewSheet(inputPath, outputPath);

  if (!nodeFs.existsSync(outputPath)) {
    throw new Error("Processamento concluido sem gerar arquivo de saida.");
  }

  const outputFileName = path.basename(outputPath);
  const relativePath = normalizeRelativePath(outputPath);

  return {
    outputPath,
    outputFileName,
    downloadUrl: buildDownloadUrl(relativePath)
  };
}

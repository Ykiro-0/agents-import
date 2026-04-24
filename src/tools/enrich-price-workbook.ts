import fs from "node:fs/promises";
import nodeFs from "node:fs";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import XLSX from "xlsx";
import { enrichSpreadsheet } from "../services/kadia-enrichment.js";

dotenv.config();

interface CliOptions {
  inputPath: string;
  outputPath?: string;
  baseSheetName: string;
  targetSheetName: string;
  sectionCatalogPath?: string;
  sectionRulesPath?: string;
}

function readArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function parseCliArgs(args: string[]): CliOptions {
  const inputPath = readArgValue(args, "--input");

  if (!inputPath) {
    throw new Error("Parametro obrigatorio ausente: --input <arquivo.xlsx>");
  }

  return {
    inputPath: path.resolve(inputPath),
    outputPath: readArgValue(args, "--output"),
    baseSheetName: readArgValue(args, "--base-sheet") ?? "PREÇO",
    targetSheetName: readArgValue(args, "--target-sheet") ?? "enriquecimento",
    sectionCatalogPath: readArgValue(args, "--section-catalog") ?? process.env.KADIA_SECTION_CATALOG_PATH,
    sectionRulesPath: readArgValue(args, "--section-rules")
  };
}

function resolveSheetName(workbook: XLSX.WorkBook, requestedName: string): string {
  const requestedKey = normalizeKey(requestedName);

  for (const sheetName of workbook.SheetNames) {
    if (normalizeKey(sheetName) === requestedKey) {
      return sheetName;
    }
  }

  throw new Error(
    `Aba base nao encontrada: ${requestedName}. Disponiveis: ${workbook.SheetNames.join(", ")}`
  );
}

function resolveOutputPath(inputPath: string, outputPath?: string): string {
  if (outputPath?.trim()) {
    return path.resolve(outputPath);
  }

  const parsed = path.parse(inputPath);
  return path.join(parsed.dir, `${parsed.name}_com_enriquecimento${parsed.ext || ".xlsx"}`);
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
  const sectionCol = resolveColumn(rows, ["secao", "secao_nome", "se??o"]);
  const groupCol = resolveColumn(rows, ["grupo", "grupo_nome"]);
  const caixaCol = resolveColumn(rows, ["caixas", "caixa", "q. cx", "q.cx", "q cx"]);
  const unidadeCol = resolveColumn(rows, ["unid", "unid.", "unidade", "und"]);
  const quantidadeCol = resolveColumn(rows, ["quant", "quant.", "quantidade"]);
  const varejoCol = resolveColumn(rows, ["varejo", "preco varejo", "pre?o varejo"]);
  const atacadoCol = resolveColumn(rows, ["atacado", "preco atacado", "pre?o atacado"]);

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

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const originalWorkbook = XLSX.readFile(options.inputPath);
  const resolvedBaseSheetName = resolveSheetName(originalWorkbook, options.baseSheetName);
  const resolvedSectionCatalogPath = options.sectionCatalogPath ?? resolveDefaultSectionCatalogPath();

  const tempOutputPath = path.join(
    os.tmpdir(),
    `kadia_enrich_temp_${Date.now()}_${Math.random().toString(36).slice(2)}.xlsx`
  );

  try {
    await enrichSpreadsheet({
      inputPath: options.inputPath,
      outputPath: tempOutputPath,
      sheetName: resolvedBaseSheetName,
      sectionCatalogPath: resolvedSectionCatalogPath,
      sectionRulesPath: options.sectionRulesPath,
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
    const enrichedSheet = enrichedWorkbook.Sheets[resolvedBaseSheetName];

    if (!enrichedSheet) {
      throw new Error(`Aba enriquecida nao encontrada no temporario: ${resolvedBaseSheetName}`);
    }

    const enrichedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(enrichedSheet, { defval: "" });
    const enrichmentDataRows = buildEnrichmentRows(enrichedRows);

    const headers = [
      "Descrição",
      "Descrição Reduzida",
      "Codigo de barra",
      "Seção",
      "Grupo",
      "Caixa",
      "Unidade",
      "Quantidade",
      "Varejo",
      "Atacado"
    ];

    const aoa: Array<Array<string | number>> = [headers, ...enrichmentDataRows];
    const enrichmentSheet = XLSX.utils.aoa_to_sheet(aoa);

    removeSheetIfExists(originalWorkbook, options.targetSheetName);
    XLSX.utils.book_append_sheet(originalWorkbook, enrichmentSheet, options.targetSheetName);

    const finalOutputPath = resolveOutputPath(options.inputPath, options.outputPath);
    await fs.mkdir(path.dirname(finalOutputPath), { recursive: true });
    XLSX.writeFile(originalWorkbook, finalOutputPath);

    console.log("Planilha enriquecida gerada com sucesso.");
    console.log(`Entrada: ${options.inputPath}`);
    console.log(`Aba base: ${resolvedBaseSheetName}`);
    console.log(`Aba criada: ${options.targetSheetName}`);
    console.log(`Saida: ${finalOutputPath}`);
    console.log(`Linhas enriquecimento: ${enrichmentDataRows.length}`);
    console.log(`Catalogo secao/grupo: ${resolvedSectionCatalogPath ?? "nao informado"}`);
    console.log(`Abas finais: ${originalWorkbook.SheetNames.join(" | ")}`);
  } finally {
    await fs.unlink(tempOutputPath).catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  console.error(`Falha ao gerar aba enriquecimento: ${message}`);
  process.exitCode = 1;
});

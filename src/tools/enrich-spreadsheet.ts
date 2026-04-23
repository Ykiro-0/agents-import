import fs from "node:fs/promises";
import path from "node:path";
import { enrichSpreadsheet } from "../services/kadia-enrichment.js";

type InputSource = "local" | "clickup";

interface CliOptions {
  source: InputSource;
  inputPath?: string;
  inputFolder?: string;
  outputPath?: string;
  sectionRulesPath?: string;
  sheetName?: string;
  maxReducedLength?: number;
  apiUrl?: string;
  apiKey?: string;
  apiTimeoutMs?: number;
}

function readArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printHelp(): void {
  console.log("Uso: npm run enrich:spreadsheet -- [opcoes]");
  console.log("");
  console.log("Opcoes:");
  console.log("  --source <local|clickup>   Origem da planilha (padrao: local)");
  console.log("  --input <caminho>          Caminho da planilha original (modo local)");
  console.log("  --input-folder <caminho>   Pasta local com planilhas (modo local)");
  console.log("  --output <caminho>         Caminho da planilha enriquecida de saida");
  console.log("  --section-rules <arquivo>  JSON com regras de secao e palavras-chave");
  console.log("  --sheet <nome>             Nome da aba a ser processada");
  console.log("  --max-reduced <numero>     Tamanho maximo da descricao reduzida (padrao 60)");
  console.log("  --api-url <url>            Endpoint opcional para enriquecer descricao/secao");
  console.log("  --api-key <chave>          Chave opcional da API de enriquecimento");
  console.log("  --api-timeout <ms>         Timeout da API em milissegundos (padrao 8000)");
  console.log("  --help                     Mostrar ajuda");
  console.log("");
  console.log("Exemplos:");
  console.log("  npm run enrich:spreadsheet -- --source clickup");
  console.log(
    "  npm run enrich:spreadsheet -- --source local --input data/planilha_original.xlsx --section-rules config/kadia-section-rules.json"
  );
  console.log("  npm run enrich:spreadsheet -- --source local --input-folder data");
  console.log("  npm run enrich:spreadsheet -- --source local --input data/base.xlsx --api-url https://seu-endpoint/enrich");
}

function parseCliArgs(args: string[]): CliOptions {
  if (hasFlag(args, "--help")) {
    printHelp();
    process.exit(0);
  }

  const sourceRaw = readArgValue(args, "--source") ?? "local";
  const source = sourceRaw.toLowerCase();

  if (source !== "local" && source !== "clickup") {
    throw new Error("Parametro invalido: --source deve ser local ou clickup.");
  }

  const inputPath = readArgValue(args, "--input");
  const inputFolder = readArgValue(args, "--input-folder");

  if (source === "local" && !inputPath && !inputFolder) {
    throw new Error("Modo local exige --input <arquivo.xlsx> ou --input-folder <pasta>.");
  }

  if (source === "clickup" && (inputPath || inputFolder)) {
    throw new Error("Modo clickup nao usa --input nem --input-folder.");
  }

  const outputPath = readArgValue(args, "--output");
  const sectionRulesPath = readArgValue(args, "--section-rules");
  const sheetName = readArgValue(args, "--sheet");
  const maxReducedRaw = readArgValue(args, "--max-reduced");
  const apiUrl = readArgValue(args, "--api-url") ?? process.env.KADIA_ENRICHMENT_API_URL;
  const apiKey = readArgValue(args, "--api-key") ?? process.env.KADIA_ENRICHMENT_API_KEY;
  const apiTimeoutRaw = readArgValue(args, "--api-timeout") ?? process.env.KADIA_ENRICHMENT_API_TIMEOUT_MS;
  let maxReducedLength: number | undefined;
  let apiTimeoutMs: number | undefined;

  if (maxReducedRaw) {
    const parsedMaxReduced = Number(maxReducedRaw);

    if (!Number.isFinite(parsedMaxReduced) || parsedMaxReduced <= 0) {
      throw new Error("Parametro invalido: --max-reduced deve ser numero positivo.");
    }

    maxReducedLength = parsedMaxReduced;
  }

  if (apiTimeoutRaw) {
    const parsedApiTimeout = Number(apiTimeoutRaw);

    if (!Number.isFinite(parsedApiTimeout) || parsedApiTimeout <= 0) {
      throw new Error("Parametro invalido: --api-timeout deve ser numero positivo.");
    }

    apiTimeoutMs = parsedApiTimeout;
  }

  return {
    source,
    inputPath,
    inputFolder,
    outputPath,
    sectionRulesPath,
    sheetName,
    maxReducedLength,
    apiUrl: apiUrl?.trim() || undefined,
    apiKey: apiKey?.trim() || undefined,
    apiTimeoutMs
  };
}

const LOCAL_SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".csv"]);

function normalizeFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
}

async function resolveLatestSpreadsheetPath(inputFolder: string): Promise<string> {
  const resolvedFolder = path.resolve(inputFolder);
  const entries = await fs.readdir(resolvedFolder, { withFileTypes: true });

  const spreadsheetFiles = entries
    .filter((entry) => entry.isFile() && LOCAL_SPREADSHEET_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(resolvedFolder, entry.name));

  if (spreadsheetFiles.length === 0) {
    throw new Error(`Nenhuma planilha encontrada na pasta: ${resolvedFolder}`);
  }

  const filesWithStats = await Promise.all(
    spreadsheetFiles.map(async (filePath) => ({ filePath, stats: await fs.stat(filePath) }))
  );

  filesWithStats.sort((left, right) => right.stats.mtimeMs - left.stats.mtimeMs);
  return filesWithStats[0].filePath;
}

function resolveSpreadsheetAttachment(
  attachments: Array<{ title: string; extension?: string; url: string }>
): { title: string; extension?: string; url: string } {
  const extensionPriority = [".xlsx", ".xlsm", ".xls", ".csv"];
  const candidates = attachments.filter((attachment) => {
    const titleExtension = normalizeFileExtension(attachment.title);
    const extension = attachment.extension ? `.${attachment.extension.toLowerCase()}` : "";
    return LOCAL_SPREADSHEET_EXTENSIONS.has(titleExtension) || LOCAL_SPREADSHEET_EXTENSIONS.has(extension);
  });

  if (candidates.length === 0) {
    throw new Error("Task do ClickUp sem planilha original anexada (.xlsx/.xls/.csv).");
  }

  candidates.sort((left, right) => {
    const leftExt = normalizeFileExtension(left.title) || (left.extension ? `.${left.extension.toLowerCase()}` : "");
    const rightExt = normalizeFileExtension(right.title) || (right.extension ? `.${right.extension.toLowerCase()}` : "");
    const leftPriority = extensionPriority.indexOf(leftExt);
    const rightPriority = extensionPriority.indexOf(rightExt);

    const leftScore = leftPriority === -1 ? 999 : leftPriority;
    const rightScore = rightPriority === -1 ? 999 : rightPriority;
    return leftScore - rightScore;
  });

  return candidates[0];
}

async function resolveInputPath(options: CliOptions): Promise<{ inputPath: string; sourceNote: string }> {
  if (options.source === "clickup") {
    const [{ config }, { getTaskToProcess, downloadAttachment }] = await Promise.all([
      import("../config.js"),
      import("../clients/clickup.js")
    ]);
    const selectedTask = await getTaskToProcess(config.clickUpStatusName, config.clickUpTaskId || undefined);
    const spreadsheetAttachment = resolveSpreadsheetAttachment(selectedTask.attachments);
    const spreadsheetBuffer = await downloadAttachment(spreadsheetAttachment.url);
    const targetDir = path.join(config.outputDir, "kadia-originais");
    const safeFileName = sanitizeFileName(spreadsheetAttachment.title || "planilha_original.xlsx");
    const inputPath = path.join(targetDir, `${selectedTask.id}_${safeFileName}`);
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(inputPath, spreadsheetBuffer);

    return {
      inputPath,
      sourceNote: `ClickUp task ${selectedTask.name} (${selectedTask.id}) / anexo original ${spreadsheetAttachment.title}`
    };
  }

  if (options.inputPath) {
    return {
      inputPath: path.resolve(options.inputPath),
      sourceNote: "Arquivo local informado via --input"
    };
  }

  const folderInputPath = await resolveLatestSpreadsheetPath(options.inputFolder!);

  return {
    inputPath: folderInputPath,
    sourceNote: `Arquivo local detectado automaticamente em ${path.resolve(options.inputFolder!)}`
  };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const resolvedInput = await resolveInputPath(options);
  const result = await enrichSpreadsheet({
    inputPath: resolvedInput.inputPath,
    outputPath: options.outputPath,
    sectionRulesPath: options.sectionRulesPath,
    sheetName: options.sheetName,
    maxReducedLength: options.maxReducedLength,
    apiUrl: options.apiUrl,
    apiKey: options.apiKey,
    apiTimeoutMs: options.apiTimeoutMs
  });

  console.log("Enriquecimento finalizado.");
  console.log(`Fonte: ${options.source}`);
  console.log(`Contexto: ${resolvedInput.sourceNote}`);
  console.log(`Entrada: ${result.inputPath}`);
  console.log(`Saida: ${result.outputPath}`);
  console.log(`Aba: ${result.sheetName}`);
  console.log(`Coluna descricao usada: ${result.descriptionColumn}`);
  console.log(`Total de itens: ${result.totalRows}`);
  console.log(`Itens enriquecidos: ${result.enrichedRows}`);
  console.log(`Pendentes de secao: ${result.pendingSectionRows}`);
  console.log(`Bloqueados: ${result.blockedRows}`);
  console.log(`API habilitada: ${result.apiEnabled ? "sim" : "nao"}`);
  console.log(`API tentativas: ${result.apiAttempts}`);
  console.log(`API sucesso por linha: ${result.apiSuccessRows}`);
  console.log(`API fallback local: ${result.apiFallbackRows}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erro desconhecido";
  console.error(`Falha no enriquecimento: ${message}`);
  process.exitCode = 1;
});

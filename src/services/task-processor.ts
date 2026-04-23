import fs from "node:fs/promises";
import path from "node:path";
import { downloadAttachment, getTask, getTasksByStatus, getTaskToProcess } from "../clients/clickup.js";
import { config } from "../config.js";
import { parseCsv } from "../parsers/csv.js";
import { parseHtml } from "../parsers/html.js";
import { parseXml } from "../parsers/xml.js";
import { analyzeAgCadInputs, formatAgCadIssues } from "./ag-cad-agent.js";
import { loadState, markTaskAsProcessed } from "./state-store.js";
import type { AgCadIssue, ProcessingStatus } from "../types.js";
import type { ClickUpAttachment, CsvItem, HtmlItem, ProcessedTaskResult, VfRow, XmlItem } from "../types.js";
import { writeVfWorkbook } from "./vf-workbook.js";

type ProgressReporter = (status: ProcessingStatus) => void;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buildReducedDescription(value: string): string {
  return value.trim().slice(0, 20);
}

function normalizeReference(value: string): string {
  return value.replace(/^0+/, "").trim();
}

function extractReferenceCandidates(...values: Array<string | undefined>): string[] {
  const candidates = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    const matches = value.match(/\d{4,}/g) ?? [];

    for (const match of matches) {
      const normalized = normalizeReference(match);

      if (normalized) {
        candidates.add(normalized);
      }
    }
  }

  return [...candidates];
}

function xmlMatchesReference(xmlItem: XmlItem, references: string[]): boolean {
  if (references.length === 0) {
    return false;
  }

  const xmlReferenceCandidates = extractReferenceCandidates(xmlItem.codigoFornecedor, xmlItem.descricao);

  return references.some((reference) => xmlReferenceCandidates.includes(reference));
}

function buildTabelaA(origem: string): string {
  const firstDigit = origem.trim().charAt(0);

  if (firstDigit === "1" || firstDigit === "2") {
    return "2";
  }

  return "0";
}

function ensureAgCadCanProceed(issues: AgCadIssue[]): void {
  const blockingIssues = issues.filter((issue) => issue.severity === "error");

  if (blockingIssues.length === 0) {
    return;
  }

  throw new Error(`AG-CAD bloqueou a geracao da planilha: ${formatAgCadIssues(blockingIssues)}`);
}

function extractNfNumber(taskName: string, taskDescription: string, xmlItems: XmlItem[]): string {
  const sources = [taskName, taskDescription, ...xmlItems.map((item) => item.numeroNf)];

  for (const source of sources) {
    const match = source.match(/NF\s*[:\-]?\s*(\d+)/i) ?? source.match(/\b(\d{3,})\b/);

    if (match) {
      return match[1];
    }
  }

  throw new Error("Nao foi possivel identificar o numero da NF na task ou no XML.");
}

function findAttachment(attachments: ClickUpAttachment[], extension: string): ClickUpAttachment {
  const attachment = attachments.find((item) => {
    const title = item.title.toLowerCase();
    const ext = item.extension?.toLowerCase();
    return title.endsWith(extension) || ext === extension.replace(".", "");
  });

  if (!attachment) {
    throw new Error(`Anexo obrigatorio nao encontrado: ${extension}`);
  }

  return attachment;
}

function hasAttachment(attachments: ClickUpAttachment[], extension: string): boolean {
  return attachments.some((item) => {
    const title = item.title.toLowerCase();
    const ext = item.extension?.toLowerCase();
    return title.endsWith(extension) || ext === extension.replace(".", "");
  });
}

function hasRequiredAttachments(attachments: ClickUpAttachment[]): boolean {
  return [".csv", ".html", ".xml"].every((extension) => hasAttachment(attachments, extension));
}

function findXmlItem(csvItem: CsvItem, xmlItems: XmlItem[]): XmlItem | undefined {
  const descriptionReferences = extractReferenceCandidates(csvItem.descricao);

  return xmlItems.find((xmlItem) => {
    if (csvItem.ean && xmlItem.ean && csvItem.ean === xmlItem.ean) {
      return true;
    }

    if (xmlMatchesReference(xmlItem, descriptionReferences)) {
      return true;
    }

    return normalizeText(xmlItem.descricao) === normalizeText(csvItem.descricao);
  });
}

function findHtmlItem(csvItem: CsvItem, htmlItems: HtmlItem[]): HtmlItem | undefined {
  return htmlItems.find((htmlItem) => {
    if (csvItem.ean && htmlItem.ean && csvItem.ean === htmlItem.ean) {
      return true;
    }

    return normalizeText(htmlItem.descricao).includes(normalizeText(csvItem.descricao));
  });
}

function buildVfRows(csvItems: CsvItem[], htmlItems: HtmlItem[], xmlItems: XmlItem[]): VfRow[] {
  return csvItems.map((csvItem) => {
    const xmlItem = findXmlItem(csvItem, xmlItems);
    const htmlItem = findHtmlItem(csvItem, htmlItems);
    const ean = csvItem.ean || xmlItem?.ean || htmlItem?.ean || "";
    const descricao = csvItem.descricao || xmlItem?.descricao || htmlItem?.descricao || "";

    return {
      produtoCriado: "",
      auxiliarCriado: "",
      produtoId: "",
      secaoId: "",
      grupoId: "",
      subgrupoId: "",
      marcaId: "",
      descricao,
      descricaoReduzida: buildReducedDescription(descricao),
      pesoVariavel: "",
      unidadeDeCompra: xmlItem?.unidade ?? "",
      unidadeDeVenda: xmlItem?.unidade ?? "",
      tabelaA: buildTabelaA(xmlItem?.origem ?? ""),
      situacaoFiscalId: "1",
      generoId: xmlItem?.ncm2 ?? "",
      nomeclaturaMercosulId: xmlItem?.ncm8 ?? "",
      itensImpostosFederais: "01;02",
      naturezaDeImpostoFederalId: "",
      tipo: ean ? "EAN" : "LITERAL",
      id: ean,
      fator: 1,
      eanTributado: ean ? "true" : "",
      custoProduto: xmlItem?.custo ?? 0,
      precoVenda1: "",
      precoOferta1: "",
      margemPreco1: "",
      identificadorDeOrigem: xmlItem?.numeroNf ?? ""
    };
  });
}

export async function processPendingReceiptTask(): Promise<ProcessedTaskResult> {
  if (config.clickUpTaskId) {
    const selectedTask = await getTaskToProcess(config.clickUpStatusName, config.clickUpTaskId);
    return processTask(selectedTask);
  }

  const tasks = await getTasksByStatus(config.clickUpStatusName);

  if (tasks.length === 0) {
    throw new Error(`Nenhuma task encontrada com status ${config.clickUpStatusName}.`);
  }

  const sortedTasks = [...tasks].sort((left, right) => {
    const leftDate = Number(left.date_updated ?? left.date_created ?? 0);
    const rightDate = Number(right.date_updated ?? right.date_created ?? 0);
    return rightDate - leftDate;
  });

  for (const taskSummary of sortedTasks) {
    const fullTask = await getTask(taskSummary.id);

    if (hasRequiredAttachments(fullTask.attachments)) {
      return processTask(fullTask);
    }
  }

  throw new Error(
    `Tasks com status ${config.clickUpStatusName} foram encontradas, mas nenhuma possui CSV, HTML e XML juntos.`
  );
}

export async function reprocessTaskById(
  taskId: string,
  reportProgress?: ProgressReporter
): Promise<ProcessedTaskResult> {
  const selectedTask = await getTask(taskId);
  return processTaskWithProgress(selectedTask, reportProgress);
}

async function processTask(selectedTask: { id: string; name: string; description: string; attachments: ClickUpAttachment[] }): Promise<ProcessedTaskResult> {
  return processTaskWithProgress(selectedTask);
}

async function processTaskWithProgress(
  selectedTask: { id: string; name: string; description: string; attachments: ClickUpAttachment[] },
  reportProgress?: ProgressReporter
): Promise<ProcessedTaskResult> {
  const sendProgress = (stage: string): void => {
    reportProgress?.({
      active: true,
      taskId: selectedTask.id,
      taskName: selectedTask.name,
      stage,
      startedAt: new Date().toISOString()
    });
  };

  sendProgress("validando anexos");
  const csvAttachment = findAttachment(selectedTask.attachments, ".csv");
  const htmlAttachment = findAttachment(selectedTask.attachments, ".html");
  const xmlAttachment = findAttachment(selectedTask.attachments, ".xml");

  sendProgress("baixando anexos");
  const [csvBuffer, htmlBuffer, xmlBuffer] = await Promise.all([
    downloadAttachment(csvAttachment.url),
    downloadAttachment(htmlAttachment.url),
    downloadAttachment(xmlAttachment.url)
  ]);

  sendProgress("lendo CSV, HTML e XML");
  const csvItems = parseCsv(csvBuffer);
  const htmlItems = parseHtml(htmlBuffer);
  const xmlItems = parseXml(xmlBuffer);

  sendProgress("AG-CAD analisando estrutura");
  const agCadAnalysis = analyzeAgCadInputs(
    csvItems,
    htmlItems,
    xmlItems,
    (csvItem) => findXmlItem(csvItem, xmlItems),
    (csvItem) => findHtmlItem(csvItem, htmlItems)
  );
  ensureAgCadCanProceed(agCadAnalysis.issues);

  sendProgress("cruzando dados da NF");
  const nfNumber = extractNfNumber(selectedTask.name, selectedTask.description, xmlItems);
  const rows = buildVfRows(csvItems, htmlItems, xmlItems);

  await fs.mkdir(config.outputDir, { recursive: true });

  const issuesSummary = formatAgCadIssues(agCadAnalysis.issues);
  await fs.writeFile(
    path.join(config.outputDir, `AG_CAD_REPORT_${nfNumber}.json`),
    JSON.stringify(
      {
        taskId: selectedTask.id,
        taskName: selectedTask.name,
        nfNumber,
        issues: agCadAnalysis.issues,
        summary: issuesSummary
      },
      null,
      2
    ),
    "utf8"
  );

  sendProgress("gerando planilha VF");
  const outputPath = path.join(config.outputDir, `VF_EXCEL_NF_${nfNumber}.xlsx`);
  writeVfWorkbook(rows, outputPath);

  sendProgress("finalizando processamento");
  await markTaskAsProcessed(selectedTask.id);

  return {
    taskId: selectedTask.id,
    taskName: selectedTask.name,
    nfNumber,
    outputPath,
    totalItems: rows.length
  };
}

export async function processNewestUnprocessedReceiptTask(
  reportProgress?: ProgressReporter
): Promise<ProcessedTaskResult | null> {
  if (config.clickUpTaskId) {
    const forcedTask = await getTaskToProcess(config.clickUpStatusName, config.clickUpTaskId);
    const state = await loadState();

    if (state.processedTaskIds.includes(forcedTask.id)) {
      return null;
    }

    return processTaskWithProgress(forcedTask, reportProgress);
  }

  const tasks = await getTasksByStatus(config.clickUpStatusName);

  if (tasks.length === 0) {
    return null;
  }

  const state = await loadState();
  const sortedTasks = [...tasks].sort((left, right) => {
    const leftDate = Number(left.date_updated ?? left.date_created ?? 0);
    const rightDate = Number(right.date_updated ?? right.date_created ?? 0);
    return rightDate - leftDate;
  });

  for (const taskSummary of sortedTasks) {
    if (state.processedTaskIds.includes(taskSummary.id)) {
      continue;
    }

    const fullTask = await getTask(taskSummary.id);

    if (!hasRequiredAttachments(fullTask.attachments)) {
      continue;
    }

    return processTaskWithProgress(fullTask, reportProgress);
  }

  return null;
}

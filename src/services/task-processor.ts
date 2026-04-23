import fs from "node:fs/promises";
import path from "node:path";
import { downloadAttachment, getTask, getTasksByStatus, getTaskToProcess } from "../clients/clickup.js";
import { config } from "../config.js";
import { parseCsv } from "../parsers/csv.js";
import { parseHtml } from "../parsers/html.js";
import { parseXml } from "../parsers/xml.js";
import { loadState, markTaskAsProcessed } from "./state-store.js";
import type { ClickUpAttachment, CsvItem, HtmlItem, ProcessedTaskResult, VfRow, XmlItem } from "../types.js";
import { writeVfWorkbook } from "./vf-workbook.js";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
  return xmlItems.find((xmlItem) => {
    if (csvItem.ean && xmlItem.ean && csvItem.ean === xmlItem.ean) {
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
      statusImportado: "",
      status: "PENDENTE",
      codigoErp: "",
      secao: "",
      grupo: "",
      subgrupo: "",
      descricao,
      descricaoReduzida: descricao.slice(0, 60),
      unidadeCompra: xmlItem?.unidade ?? "",
      unidadeVenda: xmlItem?.unidade ?? "",
      origem: xmlItem?.origem ?? "",
      situacaoFiscal: xmlItem?.situacaoFiscal ?? "",
      ncm2: xmlItem?.ncm2 ?? "",
      ncm8: xmlItem?.ncm8 ?? "",
      aliquota: "01;20",
      tipoCodigo: ean ? "EAN" : "LITERAL",
      ean,
      fatorConversao: 1,
      possuiEan: Boolean(ean),
      custo: xmlItem?.custo ?? 0,
      numeroNf: xmlItem?.numeroNf ?? ""
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

async function processTask(selectedTask: { id: string; name: string; description: string; attachments: ClickUpAttachment[] }): Promise<ProcessedTaskResult> {
  const csvAttachment = findAttachment(selectedTask.attachments, ".csv");
  const htmlAttachment = findAttachment(selectedTask.attachments, ".html");
  const xmlAttachment = findAttachment(selectedTask.attachments, ".xml");

  const [csvBuffer, htmlBuffer, xmlBuffer] = await Promise.all([
    downloadAttachment(csvAttachment.url),
    downloadAttachment(htmlAttachment.url),
    downloadAttachment(xmlAttachment.url)
  ]);

  const csvItems = parseCsv(csvBuffer);
  const htmlItems = parseHtml(htmlBuffer);
  const xmlItems = parseXml(xmlBuffer);
  const nfNumber = extractNfNumber(selectedTask.name, selectedTask.description, xmlItems);
  const rows = buildVfRows(csvItems, htmlItems, xmlItems);

  await fs.mkdir(config.outputDir, { recursive: true });

  const outputPath = path.join(config.outputDir, `VF_EXCEL_NF_${nfNumber}.xlsx`);
  writeVfWorkbook(rows, outputPath);

  await markTaskAsProcessed(selectedTask.id);

  return {
    taskId: selectedTask.id,
    taskName: selectedTask.name,
    nfNumber,
    outputPath,
    totalItems: rows.length
  };
}

export async function processNewestUnprocessedReceiptTask(): Promise<ProcessedTaskResult | null> {
  if (config.clickUpTaskId) {
    const forcedTask = await getTaskToProcess(config.clickUpStatusName, config.clickUpTaskId);
    const state = await loadState();

    if (state.processedTaskIds.includes(forcedTask.id)) {
      return null;
    }

    return processTask(forcedTask);
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

    return processTask(fullTask);
  }

  return null;
}

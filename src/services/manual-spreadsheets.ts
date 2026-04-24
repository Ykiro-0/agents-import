import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { UploadedSpreadsheetInfo } from "../types.js";

const MANUAL_SPREADSHEET_FOLDER = "manual-planilhas";
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".xlsm", ".csv", ".tsv"]);

function getManualSpreadsheetDirectory(): string {
  return path.resolve(config.outputDir, MANUAL_SPREADSHEET_FOLDER);
}

function resolvePathInsideDirectory(directory: string, fileName: string): string {
  const filePath = path.resolve(directory, fileName);
  const relative = path.relative(directory, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Arquivo invalido.");
  }

  return filePath;
}

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName).trim();
  const normalized = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");

  return normalized || `planilha_${Date.now()}.xlsx`;
}

function ensureAllowedSpreadsheet(fileName: string): void {
  const extension = path.extname(fileName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error("Formato de planilha invalido. Use xlsx, xls, xlsm, csv ou tsv.");
  }
}

function normalizeRelativePath(filePath: string): string {
  return path.relative(config.outputDir, filePath).replace(/\\/g, "/");
}

function buildDownloadUrl(relativePath: string): string {
  return `/downloads/${encodeURIComponent(relativePath)}`;
}

function resolveUniqueFilePath(directory: string, fileName: string): string {
  const extension = path.extname(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  let counter = 0;
  let candidateName = fileName;

  while (fs.existsSync(path.join(directory, candidateName))) {
    counter += 1;
    candidateName = `${baseName}_${counter}${extension}`;
  }

  return path.join(directory, candidateName);
}

function mapFileToUploadedInfo(filePath: string): UploadedSpreadsheetInfo {
  const stats = fs.statSync(filePath);
  const relativePath = normalizeRelativePath(filePath);
  const fileName = path.basename(filePath);

  return {
    fileName,
    downloadUrl: buildDownloadUrl(relativePath),
    uploadedAt: stats.mtime.toISOString(),
    deleteUrl: `/api/upload-planilha/${encodeURIComponent(fileName)}`,
    startUrl: "/api/upload-planilha/start"
  };
}

export function listUploadedSpreadsheets(): UploadedSpreadsheetInfo[] {
  const directory = getManualSpreadsheetDirectory();

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    .map(mapFileToUploadedInfo);
}

export function saveUploadedSpreadsheet(fileName: string, contentBase64: string): UploadedSpreadsheetInfo {
  const safeFileName = sanitizeFileName(fileName);
  ensureAllowedSpreadsheet(safeFileName);

  if (!contentBase64.trim()) {
    throw new Error("Conteudo da planilha vazio.");
  }

  const directory = getManualSpreadsheetDirectory();
  fs.mkdirSync(directory, { recursive: true });

  const filePath = resolveUniqueFilePath(directory, safeFileName);
  const buffer = Buffer.from(contentBase64, "base64");

  if (!buffer.length) {
    throw new Error("Falha ao ler a planilha enviada.");
  }

  fs.writeFileSync(filePath, buffer);
  return mapFileToUploadedInfo(filePath);
}

export function resolveUploadedSpreadsheetPath(fileName: string): string {
  const directory = getManualSpreadsheetDirectory();
  const safeFileName = path.basename(fileName).trim();

  if (!safeFileName) {
    throw new Error("Nome de arquivo invalido.");
  }

  return resolvePathInsideDirectory(directory, safeFileName);
}

export function deleteUploadedSpreadsheet(fileName: string): void {
  const filePath = resolveUploadedSpreadsheetPath(fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error("Planilha nao encontrada.");
  }

  try {
    fs.rmSync(filePath, {
      force: false,
      maxRetries: 6,
      retryDelay: 120
    });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "Erro desconhecido";
    throw new Error(`Nao foi possivel remover a planilha. Feche o arquivo e tente novamente. (${detail})`);
  }
}

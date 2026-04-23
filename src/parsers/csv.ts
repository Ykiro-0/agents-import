import { parse } from "csv-parse/sync";
import type { CsvItem } from "../types.js";

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findValue(record: Record<string, string>, candidates: string[]): string {
  const normalizedEntries = Object.entries(record).map(([key, value]) => [normalizeKey(key), value] as const);

  for (const candidate of candidates) {
    const match = normalizedEntries.find(([key]) => key === normalizeKey(candidate));

    if (match) {
      return String(match[1] ?? "").trim();
    }
  }

  return "";
}

export function parseCsv(buffer: Buffer): CsvItem[] {
  const content = buffer.toString("utf8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    delimiter: [",", ";"]
  }) as Record<string, string>[];

  return records.map((record) => ({
    descricao: findValue(record, ["descricao", "descrição", "produto"]),
    ean: findValue(record, ["ean", "codigo de barras", "código de barras"]),
    quantidade: Number(findValue(record, ["quantidade", "qtd"]) || "0")
  }));
}

import XLSX from "xlsx";
import type { VfRow } from "../types.js";

function toWorksheetData(rows: VfRow[]): Array<Array<string | number | boolean>> {
  const headers = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "H",
    "I",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "S",
    "T",
    "U",
    "V",
    "W",
    "AA"
  ];

  const data: Array<Array<string | number | boolean>> = [headers];

  for (const row of rows) {
    data.push([
      row.statusImportado,
      row.status,
      row.codigoErp,
      row.secao,
      row.grupo,
      row.subgrupo,
      row.descricao,
      row.descricaoReduzida,
      row.unidadeCompra,
      row.unidadeVenda,
      row.origem,
      row.situacaoFiscal,
      row.ncm2,
      row.ncm8,
      row.aliquota,
      row.tipoCodigo,
      row.ean,
      row.fatorConversao,
      row.possuiEan,
      row.custo,
      row.numeroNf
    ]);
  }

  return data;
}

export function writeVfWorkbook(rows: VfRow[], outputPath: string): void {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(toWorksheetData(rows));

  worksheet["!cols"] = [
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 50 },
    { wch: 30 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 8 },
    { wch: 8 },
    { wch: 12 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "VF");
  XLSX.writeFile(workbook, outputPath);
}

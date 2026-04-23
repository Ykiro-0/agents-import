import XLSX from "xlsx";
import type { VfRow } from "../types.js";

function toWorksheetData(rows: VfRow[]): Array<Array<string | number | boolean>> {
  const headers = [
    "produtoCriado",
    "auxiliarCriado",
    "produtoId",
    "secaoId",
    "grupoId",
    "subgrupoId",
    "marcaId",
    "descricao",
    "descricaoReduzida",
    "pesoVariavel",
    "unidadeDeCompra",
    "unidadeDeVenda",
    "tabelaA",
    "situacaoFiscalId",
    "generoId",
    "nomeclaturaMercosulId",
    "itensImpostosFederais",
    "naturezaDeImpostoFederalId",
    "tipo",
    "id",
    "fator",
    "eanTributado",
    "custoProduto",
    "precoVenda1",
    "precoOferta1",
    "margemPreco1",
    "identificadorDeOrigem"
  ];

  const data: Array<Array<string | number | boolean>> = [headers];

  for (const row of rows) {
    data.push([
      row.produtoCriado,
      row.auxiliarCriado,
      row.produtoId,
      row.secaoId,
      row.grupoId,
      row.subgrupoId,
      row.marcaId,
      row.descricao,
      row.descricaoReduzida,
      row.pesoVariavel,
      row.unidadeDeCompra,
      row.unidadeDeVenda,
      row.tabelaA,
      row.situacaoFiscalId,
      row.generoId,
      row.nomeclaturaMercosulId,
      row.itensImpostosFederais,
      row.naturezaDeImpostoFederalId,
      row.tipo,
      row.id,
      row.fator,
      row.eanTributado,
      row.custoProduto,
      row.precoVenda1,
      row.precoOferta1,
      row.margemPreco1,
      row.identificadorDeOrigem
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
    { wch: 16 },
    { wch: 50 },
    { wch: 30 },
    { wch: 14 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "VF");
  XLSX.writeFile(workbook, outputPath);
}

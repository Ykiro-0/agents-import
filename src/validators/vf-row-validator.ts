import type { VfRow } from "../types.js";
import { createValidationIssue, type ValidationIssue } from "./validation-result.js";

const EAN_REGEX = /^\d{8,14}$/;
const NCM8_REGEX = /^\d{8}$/;
const MAX_REDUCED_DESCRIPTION_LENGTH = 60;

function toStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isValidPositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function validateVfRows(rows: VfRow[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const descricao = toStringValue(row.descricao);
    const descricaoReduzida = toStringValue(row.descricaoReduzida);
    const tipo = toStringValue(row.tipo);
    const id = toStringValue(row.id);
    const eanTributado = toStringValue(row.eanTributado);
    const ncm8 = toStringValue(row.nomeclaturaMercosulId);
    const ncm2 = toStringValue(row.generoId);
    const situacaoFiscalId = toStringValue(row.situacaoFiscalId);
    const unidadeCompra = toStringValue(row.unidadeDeCompra);
    const unidadeVenda = toStringValue(row.unidadeDeVenda);
    const tabelaA = toStringValue(row.tabelaA);
    const itensImpostosFederais = toStringValue(row.itensImpostosFederais);

    if (!descricao) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "descricao",
          rule: "VF_DESCRICAO_OBRIGATORIA",
          message: "Linha VF sem descricao.",
          suggestedAction: "Preencher descricao antes de exportar a planilha VF."
        })
      );
    }

    if (!descricaoReduzida) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "descricaoReduzida",
          rule: "VF_DESCRICAO_REDUZIDA_OBRIGATORIA",
          message: "Linha VF sem descricao reduzida.",
          suggestedAction: "Gerar descricao reduzida para o item."
        })
      );
    } else if (descricaoReduzida.length > MAX_REDUCED_DESCRIPTION_LENGTH) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "descricaoReduzida",
          value: descricaoReduzida,
          rule: "VF_DESCRICAO_REDUZIDA_LIMITE",
          message: `Descricao reduzida excede ${MAX_REDUCED_DESCRIPTION_LENGTH} caracteres.`,
          suggestedAction: "Cortar descricao reduzida para o limite permitido."
        })
      );
    }

    if (!["EAN", "LITERAL"].includes(tipo)) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "tipo",
          value: tipo,
          rule: "VF_TIPO_VALIDO",
          message: "Tipo de codigo invalido (esperado EAN ou LITERAL).",
          suggestedAction: "Definir tipo como EAN quando houver codigo ou LITERAL quando nao houver."
        })
      );
    }

    if (tipo === "EAN") {
      if (!EAN_REGEX.test(id)) {
        issues.push(
          createValidationIssue({
            sourceType: "vf",
            severity: "error",
            itemIndex: index,
            rowNumber,
            field: "id",
            value: id,
            rule: "VF_EAN_FORMATO",
            message: "Linha VF marcada como EAN sem codigo valido de 8 a 14 digitos.",
            suggestedAction: "Corrigir o EAN ou trocar tipo para LITERAL."
          })
        );
      }

      if (eanTributado !== "true") {
        issues.push(
          createValidationIssue({
            sourceType: "vf",
            severity: "error",
            itemIndex: index,
            rowNumber,
            field: "eanTributado",
            value: eanTributado,
            rule: "VF_EAN_TRIBUTADO_COERENTE",
            message: "Item EAN deve estar com eanTributado igual a true.",
            suggestedAction: "Ajustar eanTributado para true quando tipo for EAN."
          })
        );
      }
    }

    if (tipo === "LITERAL" && eanTributado) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "eanTributado",
          value: eanTributado,
          rule: "VF_LITERAL_SEM_EAN_TRIBUTADO",
          message: "Item LITERAL nao deveria enviar eanTributado preenchido.",
          suggestedAction: "Limpar eanTributado para itens sem EAN."
        })
      );
    }

    if (!isValidPositiveNumber(row.fator)) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "fator",
          value: String(row.fator),
          rule: "VF_FATOR_POSITIVO",
          message: "Fator invalido na linha VF.",
          suggestedAction: "Ajustar fator para numero maior que zero."
        })
      );
    }

    if (!situacaoFiscalId) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "situacaoFiscalId",
          rule: "VF_SITUACAO_FISCAL_OBRIGATORIA",
          message: "Situacao fiscal obrigatoria na linha VF.",
          suggestedAction: "Preencher situacaoFiscalId conforme regra fiscal valida."
        })
      );
    }

    if (!NCM8_REGEX.test(ncm8)) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "nomeclaturaMercosulId",
          value: ncm8,
          rule: "VF_NCM_8_DIGITOS",
          message: "NCM da linha VF invalido (esperado 8 digitos).",
          suggestedAction: "Corrigir NCM antes da exportacao da planilha."
        })
      );
    } else if (ncm2 !== ncm8.slice(0, 2)) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "generoId",
          value: ncm2,
          rule: "VF_NCM2_CONSISTENTE",
          message: "generoId diferente dos dois primeiros digitos do NCM.",
          suggestedAction: "Ajustar generoId para refletir o NCM informado."
        })
      );
    }

    if (!["0", "2"].includes(tabelaA)) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "tabelaA",
          value: tabelaA,
          rule: "VF_TABELA_A_VALIDA",
          message: "tabelaA invalida (esperado 0 ou 2).",
          suggestedAction: "Calcular tabelaA a partir da origem fiscal."
        })
      );
    }

    if (!unidadeCompra || !unidadeVenda) {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "unidade",
          value: `${unidadeCompra}/${unidadeVenda}`,
          rule: "VF_UNIDADE_OBRIGATORIA",
          message: "Unidade de compra/venda obrigatoria.",
          suggestedAction: "Preencher unidade no XML e refazer o cruzamento."
        })
      );
    }

    if (itensImpostosFederais !== "01;20") {
      issues.push(
        createValidationIssue({
          sourceType: "vf",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "itensImpostosFederais",
          value: itensImpostosFederais,
          rule: "VF_ALIQUOTA_PADRAO",
          message: "Aliquota federal fora do padrao esperado (01;20).",
          suggestedAction: "Ajustar itensImpostosFederais para 01;20."
        })
      );
    }
  });

  return issues;
}

import type { CsvItem } from "../types.js";
import { createValidationIssue, type ValidationIssue } from "./validation-result.js";

const EAN_REGEX = /^\d{8,14}$/;

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidEan(value: string): boolean {
  return EAN_REGEX.test(value);
}

export function validateCsvItems(csvItems: CsvItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const eanIndexes = new Map<string, number[]>();

  if (csvItems.length === 0) {
    issues.push(
      createValidationIssue({
        sourceType: "csv",
        severity: "error",
        itemIndex: null,
        rowNumber: null,
        field: "arquivo",
        rule: "CSV_COM_ITENS",
        message: "CSV sem itens para processar.",
        suggestedAction: "Conferir o arquivo CSV e garantir que existe cabecalho e linhas de itens."
      })
    );

    return issues;
  }

  csvItems.forEach((item, index) => {
    const rowNumber = index + 2;
    const description = item.descricao.trim();
    const eanRaw = item.ean.trim();
    const eanDigits = normalizeDigits(eanRaw);
    const quantity = item.quantidade;

    if (!description) {
      issues.push(
        createValidationIssue({
          sourceType: "csv",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "descricao",
          value: item.descricao,
          rule: "CSV_DESCRICAO_OBRIGATORIA",
          message: "Item do CSV sem descricao.",
          suggestedAction: "Preencher a descricao do item na planilha de origem."
        })
      );
    }

    if (!Number.isFinite(quantity)) {
      issues.push(
        createValidationIssue({
          sourceType: "csv",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "quantidade",
          value: String(item.quantidade),
          rule: "CSV_QUANTIDADE_NUMERICA",
          message: "Quantidade invalida no CSV.",
          suggestedAction: "Corrigir a quantidade para um numero valido."
        })
      );
    } else if (quantity <= 0) {
      issues.push(
        createValidationIssue({
          sourceType: "csv",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "quantidade",
          value: String(item.quantidade),
          rule: "CSV_QUANTIDADE_POSITIVA",
          message: "Quantidade igual ou menor que zero.",
          suggestedAction: "Revisar a quantidade e confirmar se o item deve ser importado."
        })
      );
    }

    if (eanRaw) {
      if (!isValidEan(eanDigits)) {
        issues.push(
          createValidationIssue({
            sourceType: "csv",
            severity: "error",
            itemIndex: index,
            rowNumber,
            field: "ean",
            value: item.ean,
            rule: "CSV_EAN_FORMATO",
            message: "EAN do CSV invalido (esperado de 8 a 14 digitos).",
            suggestedAction: "Corrigir o EAN ou deixar vazio quando o item nao possuir codigo de barras."
          })
        );
      } else {
        const indexes = eanIndexes.get(eanDigits) ?? [];
        indexes.push(index);
        eanIndexes.set(eanDigits, indexes);
      }
    }
  });

  for (const [ean, indexes] of eanIndexes.entries()) {
    if (indexes.length <= 1) {
      continue;
    }

    for (const index of indexes) {
      issues.push(
        createValidationIssue({
          sourceType: "csv",
          severity: "error",
          itemIndex: index,
          rowNumber: index + 2,
          field: "ean",
          value: ean,
          rule: "CSV_EAN_DUPLICADO",
          message: "EAN duplicado no CSV.",
          suggestedAction: "Remover duplicidade ou ajustar EAN para refletir o item correto."
        })
      );
    }
  }

  return issues;
}

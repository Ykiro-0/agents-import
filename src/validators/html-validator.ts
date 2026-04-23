import type { HtmlItem } from "../types.js";
import { createValidationIssue, type ValidationIssue } from "./validation-result.js";

const EAN_REGEX = /^\d{8,14}$/;

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateHtmlItems(htmlItems: HtmlItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let hasImage = false;

  if (htmlItems.length === 0) {
    issues.push(
      createValidationIssue({
        sourceType: "html",
        severity: "error",
        itemIndex: null,
        rowNumber: null,
        field: "arquivo",
        rule: "HTML_COM_ITENS",
        message: "HTML sem itens reconhecidos.",
        suggestedAction: "Conferir se o anexo HTML contem os dados da NF."
      })
    );

    return issues;
  }

  htmlItems.forEach((item, index) => {
    const rowNumber = index + 2;
    const description = item.descricao.trim();
    const eanRaw = item.ean.trim();
    const eanDigits = normalizeDigits(eanRaw);
    const hasItemImage = Boolean(item.imagemBase64 && item.imagemBase64.trim());

    if (hasItemImage) {
      hasImage = true;
    }

    if (!description) {
      issues.push(
        createValidationIssue({
          sourceType: "html",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "descricao",
          value: item.descricao,
          rule: "HTML_DESCRICAO_PRESENTE",
          message: "Item extraido do HTML sem descricao clara.",
          suggestedAction: "Validar o HTML de origem ou revisar manualmente a descricao."
        })
      );
    }

    if (eanRaw && !EAN_REGEX.test(eanDigits)) {
      issues.push(
        createValidationIssue({
          sourceType: "html",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "ean",
          value: item.ean,
          rule: "HTML_EAN_FORMATO",
          message: "EAN extraido do HTML fora do formato esperado (8 a 14 digitos).",
          suggestedAction: "Conferir o bloco de EAN no HTML e corrigir no arquivo de origem."
        })
      );
    }

    if (!hasItemImage) {
      issues.push(
        createValidationIssue({
          sourceType: "html",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "imagemBase64",
          rule: "HTML_IMAGEM_PRESENTE",
          message: "Item sem imagem extraida do HTML.",
          suggestedAction: "Manter pendente para revisao de foto antes da automacao visual."
        })
      );
    }
  });

  if (!hasImage) {
    issues.push(
      createValidationIssue({
        sourceType: "html",
        severity: "warning",
        itemIndex: null,
        rowNumber: null,
        field: "imagemBase64",
        rule: "HTML_TEM_IMAGEM",
        message: "Nenhuma imagem foi extraida do HTML.",
        suggestedAction: "Revisar o anexo HTML e preparar lote de fotos manualmente."
      })
    );
  }

  return issues;
}

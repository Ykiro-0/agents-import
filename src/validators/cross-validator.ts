import type { CsvItem, HtmlItem, XmlItem } from "../types.js";
import { createValidationIssue, type ValidationIssue } from "./validation-result.js";

export interface CrossValidatorContext {
  findXmlItem: (csvItem: CsvItem) => XmlItem | undefined;
  findHtmlItem: (csvItem: CsvItem) => HtmlItem | undefined;
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function areDescriptionsSimilar(left: string, right: string): boolean {
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  return left.includes(right) || right.includes(left);
}

export function validateCrossSourceItems(csvItems: CsvItem[], context: CrossValidatorContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  csvItems.forEach((csvItem, index) => {
    const rowNumber = index + 2;
    const xmlItem = context.findXmlItem(csvItem);
    const htmlItem = context.findHtmlItem(csvItem);
    const csvEan = normalizeDigits(csvItem.ean.trim());

    if (!xmlItem) {
      issues.push(
        createValidationIssue({
          sourceType: "cross",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "xml_match",
          value: csvItem.descricao,
          rule: "CROSS_MATCH_CSV_XML",
          message: "Item do CSV sem correspondencia no XML.",
          suggestedAction: "Revisar referencia, EAN ou descricao para garantir match fiscal."
        })
      );
    }

    if (!htmlItem) {
      issues.push(
        createValidationIssue({
          sourceType: "cross",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "html_match",
          value: csvItem.descricao,
          rule: "CROSS_MATCH_CSV_HTML",
          message: "Item do CSV sem correspondencia no HTML.",
          suggestedAction: "Marcar item para revisao de imagem/descricao antes da etapa de foto."
        })
      );
    }

    if (xmlItem) {
      const xmlEan = normalizeDigits(xmlItem.ean.trim());

      if (csvEan && xmlEan && csvEan !== xmlEan) {
        issues.push(
          createValidationIssue({
            sourceType: "cross",
            severity: "error",
            itemIndex: index,
            rowNumber,
            field: "ean",
            value: `${csvItem.ean} <> ${xmlItem.ean}`,
            rule: "CROSS_EAN_CSV_XML",
            message: "EAN divergente entre CSV e XML.",
            suggestedAction: "Conferir EAN correto e ajustar arquivo de origem."
          })
        );
      }

      const normalizedCsvDescription = normalizeText(csvItem.descricao);
      const normalizedXmlDescription = normalizeText(xmlItem.descricao);

      if (
        normalizedCsvDescription &&
        normalizedXmlDescription &&
        !areDescriptionsSimilar(normalizedCsvDescription, normalizedXmlDescription)
      ) {
        issues.push(
          createValidationIssue({
            sourceType: "cross",
            severity: "warning",
            itemIndex: index,
            rowNumber,
            field: "descricao",
            value: `${csvItem.descricao} <> ${xmlItem.descricao}`,
            rule: "CROSS_DESCRICAO_CSV_XML",
            message: "Descricao divergente entre CSV e XML.",
            suggestedAction: "Confirmar se os itens representam o mesmo produto."
          })
        );
      }
    }

    if (htmlItem) {
      const htmlEan = normalizeDigits(htmlItem.ean.trim());

      if (csvEan && htmlEan && csvEan !== htmlEan) {
        issues.push(
          createValidationIssue({
            sourceType: "cross",
            severity: "warning",
            itemIndex: index,
            rowNumber,
            field: "ean",
            value: `${csvItem.ean} <> ${htmlItem.ean}`,
            rule: "CROSS_EAN_CSV_HTML",
            message: "EAN divergente entre CSV e HTML.",
            suggestedAction: "Revisar fonte do HTML e manter item pendente para confirmacao."
          })
        );
      }
    }
  });

  return issues;
}

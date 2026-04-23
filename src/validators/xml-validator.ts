import type { XmlItem } from "../types.js";
import { createValidationIssue, type ValidationIssue } from "./validation-result.js";

const EAN_REGEX = /^\d{8,14}$/;
const NCM8_REGEX = /^\d{8}$/;

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateXmlItems(xmlItems: XmlItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (xmlItems.length === 0) {
    issues.push(
      createValidationIssue({
        sourceType: "xml",
        severity: "error",
        itemIndex: null,
        rowNumber: null,
        field: "arquivo",
        rule: "XML_COM_ITENS",
        message: "XML sem itens reconhecidos.",
        suggestedAction: "Conferir o anexo XML e validar se a NF esta completa."
      })
    );

    return issues;
  }

  xmlItems.forEach((item, index) => {
    const rowNumber = index + 2;
    const ean = normalizeDigits(item.ean.trim());
    const ncm8 = normalizeDigits(item.ncm8.trim());
    const ncm2 = normalizeDigits(item.ncm2.trim());
    const unidade = item.unidade.trim();
    const origem = item.origem.trim();
    const situacaoFiscal = item.situacaoFiscal.trim();
    const numeroNf = item.numeroNf.trim();

    if (!item.descricao.trim()) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "descricao",
          rule: "XML_DESCRICAO_OBRIGATORIA",
          message: "XML sem descricao de produto (xProd).",
          suggestedAction: "Corrigir a NF/XML para incluir descricao do item."
        })
      );
    }

    if (!unidade) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "unidade",
          rule: "XML_UNIDADE_OBRIGATORIA",
          message: "XML sem unidade comercial/tributavel.",
          suggestedAction: "Preencher unidade no XML antes de importar."
        })
      );
    }

    if (!origem) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "origem",
          rule: "XML_ORIGEM_OBRIGATORIA",
          message: "XML sem origem fiscal.",
          suggestedAction: "Revisar CST/ICMS e preencher origem do item."
        })
      );
    }

    if (!situacaoFiscal) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "situacaoFiscal",
          rule: "XML_SITUACAO_FISCAL_OBRIGATORIA",
          message: "XML sem CST/CSOSN.",
          suggestedAction: "Ajustar regra fiscal no documento fiscal de origem."
        })
      );
    }

    if (!NCM8_REGEX.test(ncm8)) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "ncm8",
          value: item.ncm8,
          rule: "XML_NCM_8_DIGITOS",
          message: "NCM invalido no XML (esperado 8 digitos).",
          suggestedAction: "Corrigir o NCM no XML conforme tabela oficial."
        })
      );
    } else if (ncm2 !== ncm8.slice(0, 2)) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "ncm2",
          value: item.ncm2,
          rule: "XML_NCM2_CONSISTENTE",
          message: "ncm2 divergente dos dois primeiros digitos do NCM.",
          suggestedAction: "Recalcular ncm2 a partir do NCM de 8 digitos."
        })
      );
    }

    if (!Number.isFinite(item.custo)) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "custo",
          value: String(item.custo),
          rule: "XML_CUSTO_NUMERICO",
          message: "Custo invalido no XML.",
          suggestedAction: "Corrigir valor unitario no XML."
        })
      );
    } else if (item.custo <= 0) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "warning",
          itemIndex: index,
          rowNumber,
          field: "custo",
          value: String(item.custo),
          rule: "XML_CUSTO_POSITIVO",
          message: "Custo igual ou menor que zero.",
          suggestedAction: "Revisar custo antes do envio para cadastro."
        })
      );
    }

    if (!numeroNf) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "numeroNf",
          rule: "XML_NUMERO_NF_OBRIGATORIO",
          message: "XML sem numero da NF.",
          suggestedAction: "Conferir campo ide.nNF no XML."
        })
      );
    }

    if (ean && !EAN_REGEX.test(ean)) {
      issues.push(
        createValidationIssue({
          sourceType: "xml",
          severity: "error",
          itemIndex: index,
          rowNumber,
          field: "ean",
          value: item.ean,
          rule: "XML_EAN_FORMATO",
          message: "EAN no XML fora do formato esperado (8 a 14 digitos).",
          suggestedAction: "Corrigir cEAN/cEANTrib no XML."
        })
      );
    }
  });

  return issues;
}

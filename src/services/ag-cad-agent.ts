import type { AgCadAnalysis, AgCadIssue, CsvItem, HtmlItem, XmlItem } from "../types.js";

type MatchFn = (csvItem: CsvItem) => XmlItem | HtmlItem | undefined;

function pushIssue(
  issues: AgCadIssue[],
  source: AgCadIssue["source"],
  severity: AgCadIssue["severity"],
  message: string
): void {
  issues.push({ source, severity, message });
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function analyzeAgCadInputs(
  csvItems: CsvItem[],
  htmlItems: HtmlItem[],
  xmlItems: XmlItem[],
  findXmlMatch: MatchFn,
  findHtmlMatch: MatchFn
): AgCadAnalysis {
  const issues: AgCadIssue[] = [];

  if (csvItems.length === 0) {
    pushIssue(issues, "csv", "error", "CSV sem itens validos para processamento.");
  }

  if (htmlItems.length === 0) {
    pushIssue(issues, "html", "error", "HTML sem itens reconhecidos.");
  }

  if (xmlItems.length === 0) {
    pushIssue(issues, "xml", "error", "XML sem itens reconhecidos.");
  }

  csvItems.forEach((item, index) => {
    if (!item.descricao.trim()) {
      pushIssue(issues, "csv", "error", `CSV item ${index + 1} sem descricao.`);
    }

    if (item.quantidade <= 0) {
      pushIssue(issues, "csv", "warning", `CSV item ${index + 1} com quantidade zerada ou invalida.`);
    }

    if (!findXmlMatch(item)) {
      pushIssue(
        issues,
        "cross",
        "warning",
        `AG-CAD nao encontrou correspondencia no XML para o item CSV "${item.descricao}".`
      );
    }

    if (!findHtmlMatch(item)) {
      pushIssue(
        issues,
        "cross",
        "warning",
        `AG-CAD nao encontrou correspondencia no HTML para o item CSV "${item.descricao}".`
      );
    }
  });

  const csvEans = uniqueNonEmpty(csvItems.map((item) => item.ean));
  const htmlEans = uniqueNonEmpty(htmlItems.map((item) => item.ean));
  const xmlEans = uniqueNonEmpty(xmlItems.map((item) => item.ean));

  if (htmlEans.length === 0) {
    pushIssue(issues, "html", "warning", "HTML sem EANs extraidos. O AG-CAD vai depender de descricao/referencia.");
  }

  if (csvEans.length > 0 && xmlEans.length > 0) {
    const missingXmlEans = csvEans.filter((ean) => !xmlEans.includes(ean));

    if (missingXmlEans.length > 0) {
      pushIssue(
        issues,
        "cross",
        "warning",
        `EANs do CSV ausentes no XML: ${missingXmlEans.slice(0, 5).join(", ")}.`
      );
    }
  }

  xmlItems.forEach((item, index) => {
    if (!item.codigoFornecedor.trim()) {
      pushIssue(issues, "xml", "warning", `XML item ${index + 1} sem codigo do fornecedor (cProd).`);
    }

    if (!item.ncm8.trim()) {
      pushIssue(issues, "xml", "error", `XML item ${index + 1} sem NCM.`);
    }

    if (!item.origem.trim()) {
      pushIssue(issues, "xml", "warning", `XML item ${index + 1} sem origem.`);
    }

    if (!item.situacaoFiscal.trim()) {
      pushIssue(issues, "xml", "warning", `XML item ${index + 1} sem CST/CSOSN.`);
    }
  });

  if (csvItems.length > 0 && xmlItems.length > 0 && Math.abs(csvItems.length - xmlItems.length) > 3) {
    pushIssue(
      issues,
      "cross",
      "warning",
      `Quantidade de itens entre CSV (${csvItems.length}) e XML (${xmlItems.length}) esta muito diferente.`
    );
  }

  return { issues };
}

export function formatAgCadIssues(issues: AgCadIssue[]): string {
  if (issues.length === 0) {
    return "AG-CAD nao encontrou inconsistencias estruturais.";
  }

  return issues
    .map((issue) => `[${issue.severity.toUpperCase()}][${issue.source.toUpperCase()}] ${issue.message}`)
    .join(" | ");
}

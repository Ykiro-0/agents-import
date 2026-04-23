import fs from "node:fs/promises";
import path from "node:path";
import { countIssuesBySeverity, type ValidationIssue, type ValidationSourceType } from "../validators/validation-result.js";

export interface ValidationReportContext {
  taskId: string;
  taskName: string;
  nfNumber: string;
  totalItems: number;
  exportedItems: number;
  blockedItems: number;
  sourceFiles: {
    csv: string;
    html: string;
    xml: string;
  };
}

export interface ValidationReportResult {
  jsonPath: string;
  csvPath: string;
  errorCount: number;
  warningCount: number;
}

const CSV_HEADERS = [
  "taskId",
  "taskName",
  "nfNumber",
  "sourceFile",
  "sourceType",
  "itemIndex",
  "rowNumber",
  "field",
  "value",
  "severity",
  "rule",
  "message",
  "suggestedAction"
];

function resolveSourceFile(sourceType: ValidationSourceType, sourceFiles: ValidationReportContext["sourceFiles"]): string {
  if (sourceType === "csv") {
    return sourceFiles.csv;
  }

  if (sourceType === "html") {
    return sourceFiles.html;
  }

  if (sourceType === "xml") {
    return sourceFiles.xml;
  }

  return `${sourceFiles.csv}|${sourceFiles.html}|${sourceFiles.xml}`;
}

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  return value;
}

function toCsvLine(cells: string[]): string {
  return cells.map(escapeCsvCell).join(",");
}

export async function writeValidationReport(
  outputDir: string,
  context: ValidationReportContext,
  issues: ValidationIssue[]
): Promise<ValidationReportResult> {
  await fs.mkdir(outputDir, { recursive: true });

  const severityCount = countIssuesBySeverity(issues);
  const jsonPath = path.join(outputDir, `VALIDATION_REPORT_${context.nfNumber}.json`);
  const csvPath = path.join(outputDir, `VALIDATION_ERRORS_${context.nfNumber}.csv`);

  const jsonPayload = {
    generatedAt: new Date().toISOString(),
    context,
    summary: {
      totalIssues: issues.length,
      errors: severityCount.errors,
      warnings: severityCount.warnings
    },
    issues
  };

  const csvLines = [toCsvLine(CSV_HEADERS)];

  for (const issue of issues) {
    csvLines.push(
      toCsvLine([
        context.taskId,
        context.taskName,
        context.nfNumber,
        resolveSourceFile(issue.sourceType, context.sourceFiles),
        issue.sourceType,
        issue.itemIndex === null ? "" : String(issue.itemIndex),
        issue.rowNumber === null ? "" : String(issue.rowNumber),
        issue.field,
        issue.value,
        issue.severity,
        issue.rule,
        issue.message,
        issue.suggestedAction
      ])
    );
  }

  await Promise.all([
    fs.writeFile(jsonPath, JSON.stringify(jsonPayload, null, 2), "utf8"),
    fs.writeFile(csvPath, csvLines.join("\n"), "utf8")
  ]);

  return {
    jsonPath,
    csvPath,
    errorCount: severityCount.errors,
    warningCount: severityCount.warnings
  };
}

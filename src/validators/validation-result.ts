export type ValidationSeverity = "error" | "warning";

export type ValidationSourceType = "csv" | "html" | "xml" | "cross" | "vf";

export interface ValidationIssue {
  sourceType: ValidationSourceType;
  severity: ValidationSeverity;
  itemIndex: number | null;
  rowNumber: number | null;
  field: string;
  value: string;
  rule: string;
  message: string;
  suggestedAction: string;
}

interface CreateValidationIssueParams {
  sourceType: ValidationSourceType;
  severity: ValidationSeverity;
  itemIndex: number | null;
  rowNumber: number | null;
  field: string;
  value?: string;
  rule: string;
  message: string;
  suggestedAction: string;
}

export function createValidationIssue(params: CreateValidationIssueParams): ValidationIssue {
  return {
    sourceType: params.sourceType,
    severity: params.severity,
    itemIndex: params.itemIndex,
    rowNumber: params.rowNumber,
    field: params.field,
    value: params.value ?? "",
    rule: params.rule,
    message: params.message,
    suggestedAction: params.suggestedAction
  };
}

export function mergeValidationIssues(...issueGroups: ValidationIssue[][]): ValidationIssue[] {
  return issueGroups.flat();
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "error");
}

export function getBlockedItemIndexes(issues: ValidationIssue[]): Set<number> {
  const indexes = new Set<number>();

  for (const issue of issues) {
    if (issue.severity !== "error") {
      continue;
    }

    if (issue.itemIndex === null || issue.itemIndex < 0) {
      continue;
    }

    indexes.add(issue.itemIndex);
  }

  return indexes;
}

export function countIssuesBySeverity(issues: ValidationIssue[]): { errors: number; warnings: number } {
  return issues.reduce(
    (accumulator, issue) => {
      if (issue.severity === "error") {
        accumulator.errors += 1;
      } else {
        accumulator.warnings += 1;
      }

      return accumulator;
    },
    { errors: 0, warnings: 0 }
  );
}

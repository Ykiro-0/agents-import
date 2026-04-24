export interface ClickUpAttachment {
  id: string;
  title: string;
  url: string;
  extension?: string;
}

export interface ClickUpTask {
  id: string;
  name: string;
  description: string;
  date_created?: string;
  date_updated?: string;
  status: {
    status: string;
  };
  attachments: ClickUpAttachment[];
}

export interface CsvItem {
  descricao: string;
  ean: string;
  quantidade: number;
}

export interface HtmlItem {
  descricao: string;
  ean: string;
  imagemBase64?: string;
}

export interface XmlItem {
  codigoFornecedor: string;
  descricao: string;
  ean: string;
  unidade: string;
  origem: string;
  situacaoFiscal: string;
  ncm2: string;
  ncm8: string;
  custo: number;
  numeroNf: string;
}

export interface VfRow {
  produtoCriado: string;
  auxiliarCriado: string;
  produtoId: string;
  secaoId: string;
  grupoId: string;
  subgrupoId: string;
  marcaId: string;
  descricao: string;
  descricaoReduzida: string;
  pesoVariavel: string;
  unidadeDeCompra: string;
  unidadeDeVenda: string;
  tabelaA: string;
  situacaoFiscalId: string;
  generoId: string;
  nomeclaturaMercosulId: string;
  itensImpostosFederais: string;
  naturezaDeImpostoFederalId: string;
  tipo: string;
  id: string;
  fator: number;
  eanTributado: string;
  custoProduto: number;
  precoVenda1: string;
  precoOferta1: string;
  margemPreco1: string;
  identificadorDeOrigem: string;
}

export type ClassificationConfidenceLevel = "high" | "medium" | "low";

export interface ProductClassification {
  secaoId: string;
  grupoId: string;
  subgrupoId: string;
  confidence: number;
  confidenceLevel: ClassificationConfidenceLevel;
  matchedPath: string;
}

export interface ProcessedTaskResult {
  taskId: string;
  taskName: string;
  nfNumber: string;
  outputPath: string;
  totalItems: number;
  exportedItems?: number;
  blockedItems?: number;
  validationErrorCount?: number;
  validationWarningCount?: number;
  validationReportJsonPath?: string;
  validationReportCsvPath?: string;
}

export interface ProcessingStatus {
  active: boolean;
  taskId?: string;
  taskName?: string;
  stage?: string;
  startedAt?: string;
}

export interface AgCadIssue {
  source: "csv" | "html" | "xml" | "cross";
  severity: "warning" | "error";
  message: string;
}

export interface AgCadAnalysis {
  issues: AgCadIssue[];
}

export interface AutomationState {
  processedTaskIds: string[];
}

export interface ExecutionLogEntry {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "success" | "error" | "idle";
  message: string;
  taskId?: string;
  taskName?: string;
  nfNumber?: string;
  outputPath?: string;
  downloadUrl?: string;
  totalItems?: number;
}

export interface DashboardTaskInfo {
  id: string;
  name: string;
  status: string;
  dateUpdated?: string;
  attachments: string[];
  hasCsv: boolean;
  hasHtml: boolean;
  hasXml: boolean;
  readyToProcess: boolean;
  alreadyProcessed: boolean;
  processingStage?: string;
  latestDownloadUrl?: string;
  latestDeleteUrl?: string;
  hasGeneratedFile: boolean;
  generatedFileName?: string;
}

export interface StatusCount {
  status: string;
  total: number;
}

export type AgentStepStatus = "pending" | "running" | "completed" | "blocked";

export interface AgentPipelineStep {
  id: string;
  title: string;
  description: string;
  status: AgentStepStatus;
  detail?: string;
}

export interface AgentPipelineState {
  name: string;
  mode: "kadia";
  currentStage?: string;
  steps: AgentPipelineStep[];
}

export interface UploadedSpreadsheetInfo {
  fileName: string;
  downloadUrl: string;
  uploadedAt: string;
  deleteUrl: string;
  startUrl: string;
}

export interface MonitorSnapshot {
  serverTime: string;
  targetStatus: string;
  pollIntervalMs: number;
  watcherActive: boolean;
  lastCycleAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastMessage: string;
  processing: ProcessingStatus;
  latestFile?: {
    taskName?: string;
    nfNumber?: string;
    outputPath?: string;
    downloadUrl?: string;
  };
  statusCounts: StatusCount[];
  targetTasks: DashboardTaskInfo[];
  recentRuns: ExecutionLogEntry[];
  agent: AgentPipelineState;
  uploadedSpreadsheets: UploadedSpreadsheetInfo[];
}

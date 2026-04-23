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
  statusImportado: string;
  status: string;
  codigoErp: string;
  secao: string;
  grupo: string;
  subgrupo: string;
  descricao: string;
  descricaoReduzida: string;
  unidadeCompra: string;
  unidadeVenda: string;
  origem: string;
  situacaoFiscal: string;
  ncm2: string;
  ncm8: string;
  aliquota: string;
  tipoCodigo: string;
  ean: string;
  fatorConversao: number;
  possuiEan: boolean;
  custo: number;
  numeroNf: string;
}

export interface ProcessedTaskResult {
  taskId: string;
  taskName: string;
  nfNumber: string;
  outputPath: string;
  totalItems: number;
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
}

export interface StatusCount {
  status: string;
  total: number;
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
  statusCounts: StatusCount[];
  targetTasks: DashboardTaskInfo[];
  recentRuns: ExecutionLogEntry[];
}

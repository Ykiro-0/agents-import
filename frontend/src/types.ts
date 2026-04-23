export type ExecutionLogEntry = {
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
};

export type DashboardTaskInfo = {
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
};

export type StatusCount = {
  status: string;
  total: number;
};

export type AgentStepStatus = "pending" | "running" | "completed" | "blocked";

export type AgentPipelineStep = {
  id: string;
  title: string;
  description: string;
  status: AgentStepStatus;
  detail?: string;
};

export type AgentPipelineState = {
  name: string;
  mode: "kadia";
  currentStage?: string;
  steps: AgentPipelineStep[];
};

export type MonitorSnapshot = {
  serverTime: string;
  targetStatus: string;
  pollIntervalMs: number;
  watcherActive: boolean;
  lastCycleAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastMessage: string;
  processing: {
    active: boolean;
    taskId?: string;
    taskName?: string;
    stage?: string;
    startedAt?: string;
  };
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
};

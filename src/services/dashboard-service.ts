import fs from "node:fs";
import path from "node:path";
import { getTask, getTasksByStatus } from "../clients/clickup.js";
import { config } from "../config.js";
import type {
  AgentPipelineState,
  AgentPipelineStep,
  ClickUpTask,
  DashboardTaskInfo,
  ExecutionLogEntry,
  MonitorSnapshot,
  StatusCount
} from "../types.js";
import { loadState } from "./state-store.js";
import { getMonitorState } from "./monitor.js";
import { getLatestSuccessfulRun, getRecentRuns } from "./runs-store.js";
import { listUploadedSpreadsheets } from "./manual-spreadsheets.js";

function hasAttachment(task: ClickUpTask, extension: string): boolean {
  return task.attachments.some((attachment) => {
    const title = attachment.title.toLowerCase();
    const ext = attachment.extension?.toLowerCase();
    return title.endsWith(extension) || ext === extension.replace(".", "");
  });
}

function mapTask(task: ClickUpTask, processedIds: string[]): DashboardTaskInfo {
  const attachmentNames = task.attachments.map((attachment) => attachment.title);
  const hasCsv = hasAttachment(task, ".csv");
  const hasHtml = hasAttachment(task, ".html");
  const hasXml = hasAttachment(task, ".xml");

  return {
    id: task.id,
    name: task.name,
    status: task.status.status,
    dateUpdated: task.date_updated,
    attachments: attachmentNames,
    hasCsv,
    hasHtml,
    hasXml,
    readyToProcess: hasCsv && hasHtml && hasXml,
    alreadyProcessed: processedIds.includes(task.id),
    hasGeneratedFile: false
  };
}

async function buildStatusCounts(): Promise<StatusCount[]> {
  const statuses = [
    "NF A CHEGAR",
    "CONCLUIDO RECEBIMENTO",
    "AGUARDANDO PRECO",
    "AGUARDANDO ENVIO"
  ];

  const results = await Promise.all(
    statuses.map(async (status) => ({
      status,
      total: (await getTasksByStatus(status)).length
    }))
  );

  return results;
}

function buildEmptyStatusCounts(): StatusCount[] {
  return [
    { status: "NF A CHEGAR", total: 0 },
    { status: "CONCLUIDO RECEBIMENTO", total: 0 },
    { status: "AGUARDANDO PRECO", total: 0 },
    { status: "AGUARDANDO ENVIO", total: 0 }
  ];
}

function normalizeText(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mapMessageToStepId(message?: string): string | undefined {
  const text = normalizeText(message);

  if (!text) {
    return undefined;
  }

  if (text.includes("anexo") || text.includes("baixando") || text.includes("lendo csv")) {
    return "receber_arquivos";
  }

  if (text.includes("validando") || text.includes("ag-cad") || text.includes("cruzando")) {
    return "validador_0";
  }

  if (text.includes("enriquec")) {
    return "agente_1_enriquecimento";
  }

  if (text.includes("master")) {
    return "agente_2_master";
  }

  if (text.includes("api")) {
    return "envio_api";
  }

  if (text.includes("planilha")) {
    return "gerar_planilha_vf";
  }

  if (text.includes("finalizando") || text.includes("relatorio")) {
    return "relatorio";
  }

  return undefined;
}

function buildAgentStepsTemplate(): AgentPipelineStep[] {
  return [
    {
      id: "receber_arquivos",
      title: "Receber Arquivos",
      description: "Carregar CSV, HTML e XML da task.",
      status: "pending"
    },
    {
      id: "validador_0",
      title: "Validador 0",
      description: "Estrutura minima, EAN, NCM e obrigatorios.",
      status: "pending"
    },
    {
      id: "agente_1_enriquecimento",
      title: "Agente 1",
      description: "Enriquecimento de descricao, secao e grupo.",
      status: "pending"
    },
    {
      id: "validador_1",
      title: "Validador 1",
      description: "Conferencia do enriquecimento e imagens.",
      status: "pending"
    },
    {
      id: "agente_2_master",
      title: "Agente 2",
      description: "Montagem da planilha master no layout da API.",
      status: "pending"
    },
    {
      id: "validador_2",
      title: "Validador 2",
      description: "Validacao de modelo API e campos fiscais.",
      status: "pending"
    },
    {
      id: "envio_api",
      title: "Envio API",
      description: "Enviar somente itens validados para cadastro.",
      status: "pending"
    },
    {
      id: "gerar_planilha_vf",
      title: "Gerar Planilha VF",
      description: "Exportar lote valido para revisao/importacao.",
      status: "pending"
    },
    {
      id: "relatorio",
      title: "Relatorio",
      description: "Gerar relatorio de validos, bloqueados e pendencias.",
      status: "pending"
    }
  ];
}

function buildAgentPipelineState(
  monitorStage: string | undefined,
  processingActive: boolean,
  latestSuccessfulRun: ExecutionLogEntry | undefined,
  recentRuns: ExecutionLogEntry[]
): AgentPipelineState {
  const steps = buildAgentStepsTemplate();
  const stepById = new Map(steps.map((step) => [step.id, step]));

  if (latestSuccessfulRun) {
    for (const stepId of ["receber_arquivos", "validador_0", "gerar_planilha_vf", "relatorio"]) {
      const step = stepById.get(stepId);

      if (step) {
        step.status = "completed";
        step.detail = "Executado no ultimo ciclo com sucesso.";
      }
    }
  }

  const runningStepId = processingActive ? mapMessageToStepId(monitorStage) : undefined;

  if (runningStepId) {
    const runningStep = stepById.get(runningStepId);

    if (runningStep) {
      runningStep.status = "running";
      runningStep.detail = monitorStage;
    }
  }

  const lastRun = recentRuns[0];
  const hasRecentError = Boolean(lastRun && lastRun.status === "error" && !processingActive);

  if (hasRecentError) {
    const blockedStepId = mapMessageToStepId(lastRun.message ?? monitorStage) ?? "validador_0";
    const blockedStep = stepById.get(blockedStepId);

    if (blockedStep) {
      blockedStep.status = "blocked";
      blockedStep.detail = lastRun.message;
    }
  }

  return {
    name: "Kadia",
    mode: "kadia",
    currentStage: monitorStage,
    steps
  };
}

export async function getDashboardSnapshot(): Promise<MonitorSnapshot> {
  const [state, recentRuns, latestSuccessfulRun, monitorState, uploadedSpreadsheets] = await Promise.all([
    loadState(),
    getRecentRuns(),
    getLatestSuccessfulRun(),
    Promise.resolve(getMonitorState()),
    Promise.resolve(listUploadedSpreadsheets())
  ]);

  let targetTasks: ClickUpTask[] = [];
  let statusCounts: StatusCount[] = buildEmptyStatusCounts();

  try {
    [targetTasks, statusCounts] = await Promise.all([
      getTasksByStatus(config.clickUpStatusName),
      buildStatusCounts()
    ]);
  } catch {
    targetTasks = [];
    statusCounts = buildEmptyStatusCounts();
  }

  const sortedTasks = targetTasks.sort(
    (left, right) => Number(right.date_updated ?? right.date_created ?? 0) - Number(left.date_updated ?? left.date_created ?? 0)
  );

  const hydratedTasks = await Promise.all(
    sortedTasks.map(async (task) => {
      try {
        return await getTask(task.id);
      } catch {
        return task;
      }
    })
  );

  const latestRunByTaskId = new Map(
    recentRuns
      .filter((run) => run.status === "success" && run.taskId)
      .map((run) => [run.taskId as string, run])
  );

  const mappedTasks = hydratedTasks.map((task) => {
    const taskInfo = mapTask(task, state.processedTaskIds);
    const latestRun = latestRunByTaskId.get(task.id);
    const outputPath = latestRun?.outputPath;
    const hasGeneratedFile = Boolean(outputPath && fs.existsSync(outputPath));
    const generatedFileName = outputPath ? path.basename(outputPath) : undefined;

    return {
      ...taskInfo,
      processingStage: monitorState.processing.active && monitorState.processing.taskId === task.id
        ? monitorState.processing.stage
        : undefined,
      latestDownloadUrl: hasGeneratedFile ? latestRun?.downloadUrl : undefined,
      latestDeleteUrl: hasGeneratedFile && generatedFileName ? `/api/files/${encodeURIComponent(generatedFileName)}` : undefined,
      hasGeneratedFile,
      generatedFileName
    };
  });

  const agent = buildAgentPipelineState(
    monitorState.processing.stage,
    monitorState.processing.active,
    latestSuccessfulRun,
    recentRuns
  );

  return {
    serverTime: new Date().toISOString(),
    targetStatus: config.clickUpStatusName,
    pollIntervalMs: config.pollIntervalMs,
    watcherActive: monitorState.watcherActive,
    lastCycleAt: monitorState.lastCycleAt,
    lastSuccessAt: monitorState.lastSuccessAt,
    lastErrorAt: monitorState.lastErrorAt,
    lastMessage: monitorState.lastMessage,
    processing: monitorState.processing,
    latestFile: latestSuccessfulRun
      ? {
          taskName: latestSuccessfulRun.taskName,
          nfNumber: latestSuccessfulRun.nfNumber,
          outputPath: latestSuccessfulRun.outputPath,
          downloadUrl: latestSuccessfulRun.downloadUrl
        }
      : undefined,
    statusCounts,
    targetTasks: mappedTasks,
    recentRuns,
    agent,
    uploadedSpreadsheets
  };
}

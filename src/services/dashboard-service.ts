import { getTask, getTasksByStatus } from "../clients/clickup.js";
import { config } from "../config.js";
import type { ClickUpTask, DashboardTaskInfo, MonitorSnapshot, StatusCount } from "../types.js";
import { loadState } from "./state-store.js";
import { getMonitorState } from "./monitor.js";
import { getLatestSuccessfulRun, getRecentRuns } from "./runs-store.js";

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
    alreadyProcessed: processedIds.includes(task.id)
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

export async function getDashboardSnapshot(): Promise<MonitorSnapshot> {
  const [targetTasks, state, recentRuns, latestSuccessfulRun, monitorState, statusCounts] = await Promise.all([
    getTasksByStatus(config.clickUpStatusName),
    loadState(),
    getRecentRuns(),
    getLatestSuccessfulRun(),
    Promise.resolve(getMonitorState()),
    buildStatusCounts()
  ]);

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

    return {
      ...taskInfo,
      processingStage: monitorState.processing.active && monitorState.processing.taskId === task.id
        ? monitorState.processing.stage
        : undefined,
      latestDownloadUrl: latestRun?.downloadUrl
    };
  });

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
    recentRuns
  };
}

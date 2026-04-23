import { config } from "../config.js";
import { appendErrorRun, appendIdleRun, appendSuccessRun } from "./runs-store.js";
import { processNewestUnprocessedReceiptTask, reprocessTaskById } from "./task-processor.js";
import type { ProcessingStatus } from "../types.js";

type MonitorState = {
  watcherActive: boolean;
  lastCycleAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastMessage: string;
  processing: ProcessingStatus;
};

const state: MonitorState = {
  watcherActive: false,
  lastMessage: "Monitor ainda nao iniciado.",
  processing: {
    active: false
  }
};

let loopPromise: Promise<void> | null = null;

export function getMonitorState(): MonitorState {
  return { ...state };
}

function setProcessing(processing: ProcessingStatus): void {
  state.processing = processing;
}

function progressHandler(processing: ProcessingStatus): void {
  setProcessing(processing);
  state.lastMessage = processing.active
    ? `${processing.taskName ?? "Task"}: ${processing.stage ?? "processando"}`
    : state.lastMessage;
}

export async function runMonitorCycle(): Promise<void> {
  state.watcherActive = true;
  state.lastCycleAt = new Date().toISOString();
  setProcessing({
    active: false
  });

  try {
    const result = await processNewestUnprocessedReceiptTask(progressHandler);

    if (result) {
      state.lastSuccessAt = new Date().toISOString();
      state.lastMessage = `Task ${result.taskName} processada com sucesso.`;
      setProcessing({ active: false });
      await appendSuccessRun(result);
      return;
    }

    state.lastMessage = "Nenhuma nova task pronta para processar neste ciclo.";
    setProcessing({ active: false });
    await appendIdleRun(state.lastMessage);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    state.lastErrorAt = new Date().toISOString();
    state.lastMessage = message;
    setProcessing({ active: false });
    await appendErrorRun(message);
  }
}

export async function runManualReprocess(taskId: string): Promise<void> {
  state.watcherActive = true;
  state.lastCycleAt = new Date().toISOString();

  try {
    const result = await reprocessTaskById(taskId, progressHandler);
    state.lastSuccessAt = new Date().toISOString();
    state.lastMessage = `Task ${result.taskName} reprocessada com sucesso.`;
    setProcessing({ active: false });
    await appendSuccessRun(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    state.lastErrorAt = new Date().toISOString();
    state.lastMessage = message;
    setProcessing({ active: false });
    await appendErrorRun(message);
    throw error;
  }
}

export function startMonitorLoop(): void {
  if (loopPromise) {
    return;
  }

  loopPromise = (async () => {
    state.watcherActive = true;
    state.lastMessage = `Monitorando ClickUp a cada ${config.pollIntervalMs}ms.`;

    while (true) {
      await runMonitorCycle();
      await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
    }
  })();

  void loopPromise;
}

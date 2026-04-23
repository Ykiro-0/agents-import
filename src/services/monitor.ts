import { config } from "../config.js";
import { appendErrorRun, appendIdleRun, appendSuccessRun } from "./runs-store.js";
import { processNewestUnprocessedReceiptTask } from "./task-processor.js";

type MonitorState = {
  watcherActive: boolean;
  lastCycleAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastMessage: string;
};

const state: MonitorState = {
  watcherActive: false,
  lastMessage: "Monitor ainda nao iniciado."
};

let loopPromise: Promise<void> | null = null;

export function getMonitorState(): MonitorState {
  return { ...state };
}

export async function runMonitorCycle(): Promise<void> {
  state.watcherActive = true;
  state.lastCycleAt = new Date().toISOString();

  try {
    const result = await processNewestUnprocessedReceiptTask();

    if (result) {
      state.lastSuccessAt = new Date().toISOString();
      state.lastMessage = `Task ${result.taskName} processada com sucesso.`;
      await appendSuccessRun(result);
      return;
    }

    state.lastMessage = "Nenhuma nova task pronta para processar neste ciclo.";
    await appendIdleRun(state.lastMessage);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    state.lastErrorAt = new Date().toISOString();
    state.lastMessage = message;
    await appendErrorRun(message);
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

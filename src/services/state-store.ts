import fs from "node:fs/promises";
import { config } from "../config.js";
import type { AutomationState } from "../types.js";

const EMPTY_STATE: AutomationState = {
  processedTaskIds: []
};

export async function loadState(): Promise<AutomationState> {
  try {
    const content = await fs.readFile(config.stateFilePath, "utf8");
    const parsed = JSON.parse(content) as Partial<AutomationState>;

    return {
      processedTaskIds: Array.isArray(parsed.processedTaskIds) ? parsed.processedTaskIds : []
    };
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return EMPTY_STATE;
    }

    throw error;
  }
}

export async function saveState(state: AutomationState): Promise<void> {
  await fs.writeFile(config.stateFilePath, JSON.stringify(state, null, 2), "utf8");
}

export async function markTaskAsProcessed(taskId: string): Promise<void> {
  const state = await loadState();

  if (state.processedTaskIds.includes(taskId)) {
    return;
  }

  state.processedTaskIds.push(taskId);
  await saveState(state);
}

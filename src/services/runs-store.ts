import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import type { ExecutionLogEntry, ProcessedTaskResult } from "../types.js";

const MAX_RUNS = 50;

async function loadRuns(): Promise<ExecutionLogEntry[]> {
  try {
    const content = await fs.readFile(config.runsFilePath, "utf8");
    const parsed = JSON.parse(content) as ExecutionLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function saveRuns(runs: ExecutionLogEntry[]): Promise<void> {
  await fs.writeFile(config.runsFilePath, JSON.stringify(runs, null, 2), "utf8");
}

export async function appendIdleRun(message: string): Promise<void> {
  const now = new Date().toISOString();
  const runs = await loadRuns();

  runs.unshift({
    id: randomUUID(),
    startedAt: now,
    finishedAt: now,
    status: "idle",
    message
  });

  await saveRuns(runs.slice(0, MAX_RUNS));
}

export async function appendErrorRun(message: string): Promise<void> {
  const now = new Date().toISOString();
  const runs = await loadRuns();

  runs.unshift({
    id: randomUUID(),
    startedAt: now,
    finishedAt: now,
    status: "error",
    message
  });

  await saveRuns(runs.slice(0, MAX_RUNS));
}

export async function appendSuccessRun(result: ProcessedTaskResult): Promise<void> {
  const now = new Date().toISOString();
  const runs = await loadRuns();

  runs.unshift({
    id: randomUUID(),
    startedAt: now,
    finishedAt: now,
    status: "success",
    message: "Task processada com sucesso.",
    taskId: result.taskId,
    taskName: result.taskName,
    nfNumber: result.nfNumber,
    outputPath: result.outputPath,
    totalItems: result.totalItems
  });

  await saveRuns(runs.slice(0, MAX_RUNS));
}

export async function getRecentRuns(limit = 15): Promise<ExecutionLogEntry[]> {
  const runs = await loadRuns();
  return runs.slice(0, limit);
}

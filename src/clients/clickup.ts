import { config } from "../config.js";
import type { ClickUpTask } from "../types.js";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1200;

class ClickUpRequestError extends Error {
  retryable: boolean;

  constructor(message: string, retryable = false) {
    super(message);
    this.name = "ClickUpRequestError";
    this.retryable = retryable;
  }
}

function normalizeTask(task: Partial<ClickUpTask>): ClickUpTask {
  return {
    id: String(task.id ?? ""),
    name: String(task.name ?? ""),
    description: String(task.description ?? ""),
    date_created: task.date_created,
    date_updated: task.date_updated,
    status: {
      status: String(task.status?.status ?? "")
    },
    attachments: Array.isArray(task.attachments) ? task.attachments : []
  };
}

async function clickUpFetch<T>(pathname: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(`${CLICKUP_API_BASE}${pathname}`, {
        headers: {
          Authorization: config.clickUpApiToken,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const error = await buildClickUpHttpError(response);

        if (attempt < MAX_RETRIES && error.retryable) {
          await waitForRetry(attempt);
          lastError = error;
          continue;
        }

        throw error;
      }

      return response.json() as Promise<T>;
    } catch (error: unknown) {
      const normalizedError = normalizeFetchError(error);

      if (attempt < MAX_RETRIES && normalizedError.retryable) {
        await waitForRetry(attempt);
        lastError = normalizedError;
        continue;
      }

      throw normalizedError;
    }
  }

  throw lastError ?? new Error("Falha ao consultar ClickUp.");
}

export async function getTasksByStatus(statusName: string): Promise<ClickUpTask[]> {
  const query = new URLSearchParams({
    include_closed: "false",
    subtasks: "true"
  });

  const payload = await clickUpFetch<{ tasks: ClickUpTask[] }>(
    `/list/${config.clickUpListId}/task?${query.toString()}`
  );

  return payload.tasks
    .map((task) => normalizeTask(task))
    .filter(
    (task) => task.status.status.trim().toUpperCase() === statusName.trim().toUpperCase()
    );
}

export async function getTask(taskId: string): Promise<ClickUpTask> {
  const task = await clickUpFetch<ClickUpTask>(`/task/${taskId}`);
  return normalizeTask(task);
}

export async function getTaskToProcess(statusName: string, preferredTaskId?: string): Promise<ClickUpTask> {
  if (preferredTaskId) {
    const task = await getTask(preferredTaskId);

    if (task.status.status.trim().toUpperCase() !== statusName.trim().toUpperCase()) {
      throw new Error(
        `A task ${preferredTaskId} foi encontrada, mas nao esta com status ${statusName}.`
      );
    }

    return task;
  }

  const tasks = await getTasksByStatus(statusName);

  if (tasks.length === 0) {
    throw new Error(`Nenhuma task encontrada com status ${statusName}.`);
  }

  const sortedTasks = [...tasks].sort((left, right) => {
    const leftDate = Number(left.date_updated ?? left.date_created ?? 0);
    const rightDate = Number(right.date_updated ?? right.date_created ?? 0);
    return rightDate - leftDate;
  });

  return getTask(sortedTasks[0].id);
}

export async function getNewestTaskByStatus(statusName: string): Promise<ClickUpTask | null> {
  const tasks = await getTasksByStatus(statusName);

  if (tasks.length === 0) {
    return null;
  }

  const sortedTasks = [...tasks].sort((left, right) => {
    const leftDate = Number(left.date_updated ?? left.date_created ?? 0);
    const rightDate = Number(right.date_updated ?? right.date_created ?? 0);
    return rightDate - leftDate;
  });

  return getTask(sortedTasks[0].id);
}

export async function downloadAttachment(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: {
      Authorization: config.clickUpApiToken
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro ao baixar anexo (${response.status}): ${errorBody}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function buildClickUpHttpError(response: Response): Promise<ClickUpRequestError> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const rawBody = await response.text();
  const cleanBody = sanitizeErrorBody(rawBody, contentType);
  const retryable = RETRYABLE_STATUS_CODES.has(response.status);

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return new ClickUpRequestError(
      `ClickUp indisponivel temporariamente (${response.status}). Tente novamente em instantes.`,
      retryable
    );
  }

  if (response.status === 429) {
    return new ClickUpRequestError(
      "ClickUp limitou temporariamente as requisicoes (429). Tente novamente em instantes.",
      retryable
    );
  }

  if (!cleanBody) {
    return new ClickUpRequestError(`Erro ao consultar ClickUp (${response.status}).`, retryable);
  }

  return new ClickUpRequestError(`Erro ao consultar ClickUp (${response.status}): ${cleanBody}`, retryable);
}

function sanitizeErrorBody(body: string, contentType: string): string {
  const trimmed = body.trim();

  if (!trimmed) {
    return "";
  }

  if (contentType.includes("text/html") || trimmed.startsWith("<")) {
    return "";
  }

  return trimmed.replace(/\s+/g, " ").slice(0, 240);
}

function normalizeFetchError(error: unknown): ClickUpRequestError {
  if (error instanceof ClickUpRequestError) {
    return error;
  }

  if (error instanceof Error) {
    return new ClickUpRequestError(error.message, true);
  }

  return new ClickUpRequestError("Falha de rede ao consultar ClickUp.", true);
}

async function waitForRetry(attempt: number): Promise<void> {
  const delay = BASE_RETRY_DELAY_MS * (attempt + 1);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

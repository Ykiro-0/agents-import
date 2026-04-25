import { config } from "../config.js";
import type { ClickUpTask } from "../types.js";

const CLICKUP_API_BASE = "https://api.clickup.com/api/v2";

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
  const response = await fetch(`${CLICKUP_API_BASE}${pathname}`, {
    headers: {
      Authorization: config.clickUpApiToken,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro ao consultar ClickUp (${response.status}): ${errorBody}`);
  }

  return response.json() as Promise<T>;
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


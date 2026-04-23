import type { MonitorSnapshot } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error ?? "Erro desconhecido");
  }

  return response.json() as Promise<T>;
}

export async function fetchDashboard(): Promise<MonitorSnapshot> {
  const response = await fetch("/api/dashboard");
  return parseJson<MonitorSnapshot>(response);
}

export async function reprocessTask(taskId: string): Promise<MonitorSnapshot> {
  const response = await fetch("/api/reprocess", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ taskId })
  });

  return parseJson<MonitorSnapshot>(response);
}

export async function deleteGeneratedFile(deleteUrl: string): Promise<MonitorSnapshot> {
  const response = await fetch(deleteUrl, {
    method: "DELETE"
  });

  return parseJson<MonitorSnapshot>(response);
}

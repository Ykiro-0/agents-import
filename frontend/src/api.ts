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

export async function runMonitorNow(): Promise<MonitorSnapshot> {
  const response = await fetch("/api/run-now", {
    method: "POST"
  });

  return parseJson<MonitorSnapshot>(response);
}

export async function deleteGeneratedFile(deleteUrl: string): Promise<MonitorSnapshot> {
  const response = await fetch(deleteUrl, {
    method: "DELETE"
  });

  return parseJson<MonitorSnapshot>(response);
}

export async function uploadSpreadsheet(fileName: string, contentBase64: string): Promise<MonitorSnapshot> {
  const response = await fetch("/api/upload-planilha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileName,
      contentBase64
    })
  });

  return parseJson<MonitorSnapshot>(response);
}

export async function deleteUploadedSpreadsheet(deleteUrl: string): Promise<MonitorSnapshot> {
  const response = await fetch(deleteUrl, {
    method: "DELETE"
  });

  return parseJson<MonitorSnapshot>(response);
}

export async function startUploadedSpreadsheet(
  fileName: string
): Promise<{
  snapshot: MonitorSnapshot;
  result: {
    outputPath: string;
    outputFileName: string;
    downloadUrl: string;
  };
}> {
  const response = await fetch("/api/upload-planilha/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fileName })
  });

  return parseJson<{
    snapshot: MonitorSnapshot;
    result: {
      outputPath: string;
      outputFileName: string;
      downloadUrl: string;
    };
  }>(response);
}

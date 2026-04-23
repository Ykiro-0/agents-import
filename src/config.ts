import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Variavel de ambiente obrigatoria ausente: ${name}`);
  }

  return value;
}

export const config = {
  clickUpApiToken: requireEnv("CLICKUP_API_TOKEN"),
  clickUpListId: requireEnv("CLICKUP_LIST_ID"),
  clickUpStatusName: process.env.CLICKUP_STATUS_NAME ?? "CONCLUIDO RECEBIMENTO",
  clickUpTaskId: process.env.CLICKUP_TASK_ID ?? "",
  outputDir: path.resolve(process.cwd(), process.env.OUTPUT_DIR ?? "outputs"),
  stateFilePath: path.resolve(process.cwd(), process.env.STATE_FILE_PATH ?? ".ag-cad-state.json"),
  runsFilePath: path.resolve(process.cwd(), process.env.RUNS_FILE_PATH ?? ".ag-cad-runs.json"),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? "60000"),
  dashboardPort: Number(process.env.DASHBOARD_PORT ?? "3000")
};

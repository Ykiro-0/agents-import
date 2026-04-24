import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getDashboardSnapshot } from "../services/dashboard-service.js";
import { deleteUploadedSpreadsheet, saveUploadedSpreadsheet } from "../services/manual-spreadsheets.js";
import { startUploadedSpreadsheet } from "../services/manual-spreadsheet-runner.js";
import { runManualReprocess, runMonitorCycle, startMonitorLoop } from "../services/monitor.js";

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendFile(response: http.ServerResponse, filePath: string): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeByExt: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon"
  };

  response.writeHead(200, {
    "Content-Type": contentTypeByExt[ext] ?? "application/octet-stream"
  });

  fs.createReadStream(filePath).pipe(response);
}

function resolveOutputFile(fileName: string): string {
  const filePath = path.resolve(config.outputDir, fileName);
  const relativePath = path.relative(config.outputDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Arquivo invalido.");
  }

  return filePath;
}

async function readRequestBody(request: http.IncomingMessage): Promise<string> {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
  }

  return body;
}

export function startDashboardServer(): void {
  startMonitorLoop();
  const clientBuildDir = path.resolve(process.cwd(), "dist/client");
  const clientIndexPath = path.join(clientBuildDir, "index.html");

  const server = http.createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 400, { error: "Requisicao invalida." });
      return;
    }

    const url = new URL(request.url, `http://localhost:${config.dashboardPort}`);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        if (fs.existsSync(clientIndexPath)) {
          sendFile(response, clientIndexPath);
          return;
        }

        sendJson(response, 503, { error: "Frontend do dashboard ainda nao foi compilado." });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/downloads/")) {
        const fileName = decodeURIComponent(url.pathname.replace("/downloads/", ""));
        const filePath = resolveOutputFile(fileName);

        if (!fs.existsSync(filePath)) {
          sendJson(response, 404, { error: "Arquivo nao encontrado." });
          return;
        }

        response.writeHead(200, {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`
        });

        fs.createReadStream(filePath).pipe(response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/run-now") {
        await runMonitorCycle();
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reprocess") {
        const body = await readRequestBody(request);
        let payload: { taskId?: string };

        try {
          payload = JSON.parse(body || "{}") as { taskId?: string };
        } catch {
          sendJson(response, 400, { error: "JSON invalido." });
          return;
        }

        if (!payload.taskId) {
          sendJson(response, 400, { error: "taskId obrigatorio." });
          return;
        }

        await runManualReprocess(payload.taskId);
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/upload-planilha") {
        const body = await readRequestBody(request);
        let payload: { fileName?: string; contentBase64?: string };

        try {
          payload = JSON.parse(body || "{}") as { fileName?: string; contentBase64?: string };
        } catch {
          sendJson(response, 400, { error: "JSON invalido." });
          return;
        }

        if (!payload.fileName || !payload.contentBase64) {
          sendJson(response, 400, { error: "fileName e contentBase64 sao obrigatorios." });
          return;
        }

        saveUploadedSpreadsheet(payload.fileName, payload.contentBase64);
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/upload-planilha/start") {
        const body = await readRequestBody(request);
        let payload: { fileName?: string };

        try {
          payload = JSON.parse(body || "{}") as { fileName?: string };
        } catch {
          sendJson(response, 400, { error: "JSON invalido." });
          return;
        }

        if (!payload.fileName) {
          sendJson(response, 400, { error: "fileName obrigatorio." });
          return;
        }

        const result = await startUploadedSpreadsheet(payload.fileName);
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, {
          snapshot,
          result
        });
        return;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/upload-planilha/")) {
        const fileName = decodeURIComponent(url.pathname.replace("/api/upload-planilha/", ""));

        if (!fileName || fileName === "start") {
          sendJson(response, 400, { error: "fileName obrigatorio." });
          return;
        }

        deleteUploadedSpreadsheet(fileName);
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/files/")) {
        const fileName = decodeURIComponent(url.pathname.replace("/api/files/", ""));
        const filePath = resolveOutputFile(fileName);

        if (!fs.existsSync(filePath)) {
          sendJson(response, 404, { error: "Arquivo nao encontrado." });
          return;
        }

        fs.unlinkSync(filePath);
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "GET") {
        const assetPath = path.resolve(clientBuildDir, `.${url.pathname}`);
        const relativeAssetPath = path.relative(clientBuildDir, assetPath);

        if (!relativeAssetPath.startsWith("..") && !path.isAbsolute(relativeAssetPath) && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
          sendFile(response, assetPath);
          return;
        }

        if (fs.existsSync(clientIndexPath)) {
          sendFile(response, clientIndexPath);
          return;
        }
      }

      sendJson(response, 404, { error: "Rota nao encontrada." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      sendJson(response, 500, { error: message });
    }
  });

  server.listen(config.dashboardPort, () => {
    console.log(`Dashboard AG-CAD disponivel em http://localhost:${config.dashboardPort}`);
  });
}

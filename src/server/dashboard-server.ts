import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { getDashboardSnapshot } from "../services/dashboard-service.js";
import { runManualReprocess, runMonitorCycle, startMonitorLoop } from "../services/monitor.js";
import { renderDashboardPage } from "./dashboard-page.js";

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

export function startDashboardServer(): void {
  startMonitorLoop();

  const server = http.createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 400, { error: "Requisicao invalida." });
      return;
    }

    const url = new URL(request.url, `http://localhost:${config.dashboardPort}`);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(renderDashboardPage());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/dashboard") {
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/downloads/")) {
        const fileName = decodeURIComponent(url.pathname.replace("/downloads/", ""));
        const filePath = path.resolve(config.outputDir, fileName);
        const relativePath = path.relative(config.outputDir, filePath);

        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
          sendJson(response, 400, { error: "Arquivo invalido." });
          return;
        }

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
        let body = "";

        for await (const chunk of request) {
          body += chunk;
        }

        const payload = JSON.parse(body || "{}") as { taskId?: string };

        if (!payload.taskId) {
          sendJson(response, 400, { error: "taskId obrigatorio." });
          return;
        }

        await runManualReprocess(payload.taskId);
        const snapshot = await getDashboardSnapshot();
        sendJson(response, 200, snapshot);
        return;
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

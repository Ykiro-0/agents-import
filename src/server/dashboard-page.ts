export function renderDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AG-CAD Monitor</title>
    <style>
      :root {
        --bg: #f5efe4;
        --panel: #fffaf2;
        --ink: #20160f;
        --muted: #6b5b50;
        --accent: #d97706;
        --accent-2: #0f766e;
        --danger: #b91c1c;
        --line: #e8dcc8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, #fce7b2 0, transparent 28%),
          radial-gradient(circle at top right, #c7f9e8 0, transparent 24%),
          linear-gradient(180deg, #f9f2e7 0%, var(--bg) 100%);
      }
      .wrap {
        max-width: 1280px;
        margin: 0 auto;
        padding: 28px;
      }
      .hero {
        display: grid;
        gap: 14px;
        margin-bottom: 22px;
      }
      h1 {
        margin: 0;
        font-size: 40px;
        line-height: 1;
      }
      .sub {
        color: var(--muted);
        max-width: 760px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 16px;
      }
      .card {
        background: rgba(255, 250, 242, 0.9);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 18px;
        box-shadow: 0 16px 40px rgba(32, 22, 15, 0.07);
      }
      .span-12 { grid-column: span 12; }
      .span-8 { grid-column: span 8; }
      .span-4 { grid-column: span 4; }
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      .kpi {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px;
        background: rgba(255,255,255,0.55);
      }
      .eyebrow {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }
      .big {
        font-size: 28px;
        margin-top: 8px;
      }
      .meta {
        color: var(--muted);
        font-size: 14px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 14px;
        background: #fff;
        border: 1px solid var(--line);
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent-2);
      }
      .action-link {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 9px 12px;
        background: var(--accent-2);
        color: #fffaf2;
        text-decoration: none;
        font-size: 13px;
      }
      .secondary-button {
        background: #fff;
        color: var(--ink);
        border: 1px solid var(--line);
        padding: 9px 12px;
      }
      .muted-box {
        border: 1px dashed var(--line);
        border-radius: 16px;
        padding: 12px;
        background: rgba(255,255,255,0.45);
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        cursor: pointer;
        background: var(--ink);
        color: #fffaf2;
        font-size: 14px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
        font-size: 14px;
      }
      th {
        color: var(--muted);
        font-weight: normal;
      }
      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 5px 9px;
        font-size: 12px;
        border: 1px solid var(--line);
        margin-right: 6px;
        margin-bottom: 6px;
        background: #fff;
      }
      .ok { color: var(--accent-2); }
      .warn { color: var(--accent); }
      .error { color: var(--danger); }
      @media (max-width: 900px) {
        .span-8, .span-4, .span-12 { grid-column: span 12; }
        .kpis { grid-template-columns: repeat(2, 1fr); }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <div class="badge"><span class="dot"></span> AG-CAD monitor local</div>
        <h1>Painel da pipeline do ClickUp</h1>
        <div class="sub">
          Acompanhe o status da fila, veja quais tasks em CONCLUIDO RECEBIMENTO estao prontas para processar
          e monitore o historico do agente que gera a planilha VF.
        </div>
      </section>

      <section class="grid">
        <div class="card span-12">
          <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;">
            <div>
              <div class="eyebrow">Monitor</div>
              <div id="monitor-message" class="big">Carregando...</div>
              <div id="monitor-meta" class="meta"></div>
            </div>
            <button id="refresh-button" type="button">Atualizar agora</button>
          </div>
        </div>

        <div class="card span-8">
          <div class="eyebrow">Pipeline</div>
          <div id="status-counts" class="kpis"></div>
        </div>

        <div class="card span-4">
          <div class="eyebrow">Processamento</div>
          <div id="processing-details" class="muted-box meta"></div>
        </div>

        <div class="card span-4">
          <div class="eyebrow">Ultima planilha</div>
          <div id="latest-file" class="muted-box meta"></div>
        </div>

        <div class="card span-4">
          <div class="eyebrow">Ciclos</div>
          <div id="cycle-details" class="meta"></div>
        </div>

        <div class="card span-12">
          <div class="eyebrow">Tasks em foco</div>
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Anexos</th>
                <th>Processo</th>
                <th>Pronta</th>
                <th>Processada</th>
                <th>Planilha</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody id="target-tasks"></tbody>
          </table>
        </div>

        <div class="card span-12">
          <div class="eyebrow">Historico recente</div>
          <table>
            <thead>
              <tr>
                <th>Horario</th>
                <th>Status</th>
                <th>Mensagem</th>
                <th>NF</th>
                <th>Arquivo</th>
                <th>Baixar</th>
              </tr>
            </thead>
            <tbody id="recent-runs"></tbody>
          </table>
        </div>
      </section>
    </div>

    <script>
      const statusCountsEl = document.getElementById("status-counts");
      const targetTasksEl = document.getElementById("target-tasks");
      const recentRunsEl = document.getElementById("recent-runs");
      const monitorMessageEl = document.getElementById("monitor-message");
      const monitorMetaEl = document.getElementById("monitor-meta");
      const cycleDetailsEl = document.getElementById("cycle-details");
      const processingDetailsEl = document.getElementById("processing-details");
      const latestFileEl = document.getElementById("latest-file");
      const refreshButton = document.getElementById("refresh-button");

      async function reprocessTask(taskId) {
        await fetch("/api/reprocess", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ taskId })
        });

        await loadDashboard();
      }

      function fmt(date) {
        if (!date) return "-";
        return new Date(date).toLocaleString("pt-BR");
      }

      function textOrDash(value) {
        return value && String(value).trim() ? value : "-";
      }

      async function loadDashboard() {
        const response = await fetch("/api/dashboard");
        const data = await response.json();

        monitorMessageEl.textContent = data.lastMessage;
        monitorMetaEl.textContent = "Status observado: " + data.targetStatus + " | polling: " + data.pollIntervalMs + "ms | servidor: " + fmt(data.serverTime);
        cycleDetailsEl.innerHTML = [
          "Watcher ativo: " + (data.watcherActive ? "sim" : "nao"),
          "Ultimo ciclo: " + fmt(data.lastCycleAt),
          "Ultimo sucesso: " + fmt(data.lastSuccessAt),
          "Ultimo erro: " + fmt(data.lastErrorAt)
        ].join("<br>");

        processingDetailsEl.innerHTML = data.processing && data.processing.active
          ? [
              "Task: " + textOrDash(data.processing.taskName),
              "Etapa: " + textOrDash(data.processing.stage),
              "Inicio: " + fmt(data.processing.startedAt)
            ].join("<br>")
          : "Nenhuma planilha em criacao agora.";

        latestFileEl.innerHTML = data.latestFile && data.latestFile.downloadUrl
          ? [
              "Task: " + textOrDash(data.latestFile.taskName),
              "NF: " + textOrDash(data.latestFile.nfNumber),
              '<a class="action-link" href="' + data.latestFile.downloadUrl + '">Baixar planilha</a>'
            ].join("<br>")
          : "Nenhuma planilha gerada ainda.";

        statusCountsEl.innerHTML = data.statusCounts.map((item) => \`
          <div class="kpi">
            <div class="eyebrow">\${item.status}</div>
            <div class="big">\${item.total}</div>
          </div>
        \`).join("");

        targetTasksEl.innerHTML = data.targetTasks.map((task) => \`
          <tr>
            <td>
              <strong>\${task.name}</strong><br />
              <span class="meta">\${task.id}</span><br />
              <span class="meta">Atualizada: \${fmt(task.dateUpdated)}</span>
            </td>
            <td>
              <span class="pill \${task.hasCsv ? "ok" : "error"}">CSV: \${task.hasCsv ? "ok" : "faltando"}</span>
              <span class="pill \${task.hasHtml ? "ok" : "error"}">HTML: \${task.hasHtml ? "ok" : "faltando"}</span>
              <span class="pill \${task.hasXml ? "ok" : "error"}">XML: \${task.hasXml ? "ok" : "faltando"}</span>
            </td>
            <td>\${textOrDash(task.processingStage)}</td>
            <td class="\${task.readyToProcess ? "ok" : "warn"}">\${task.readyToProcess ? "Sim" : "Nao"}</td>
            <td class="\${task.alreadyProcessed ? "ok" : "warn"}">\${task.alreadyProcessed ? "Sim" : "Nao"}</td>
            <td>\${task.latestDownloadUrl ? '<a class="action-link" href="' + task.latestDownloadUrl + '">Baixar</a>' : "-"}</td>
            <td><button class="secondary-button" type="button" onclick="reprocessTask('\${task.id}')">Reprocessar</button></td>
          </tr>
        \`).join("");

        recentRunsEl.innerHTML = data.recentRuns.map((run) => \`
          <tr>
            <td>\${fmt(run.finishedAt || run.startedAt)}</td>
            <td class="\${run.status === "success" ? "ok" : run.status === "error" ? "error" : "warn"}">\${run.status}</td>
            <td>\${textOrDash(run.message)}<br /><span class="meta">\${textOrDash(run.taskName)}</span></td>
            <td>\${textOrDash(run.nfNumber)}</td>
            <td>\${textOrDash(run.outputPath)}</td>
            <td>\${run.downloadUrl ? '<a class="action-link" href="' + run.downloadUrl + '">Baixar</a>' : "-"}</td>
          </tr>
        \`).join("");
      }

      refreshButton.addEventListener("click", loadDashboard);
      loadDashboard();
      setInterval(loadDashboard, 10000);
    </script>
  </body>
</html>`;
}

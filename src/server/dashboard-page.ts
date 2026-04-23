export function renderDashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AG-CAD Monitor</title>
    <style>
      :root {
        --bg: #09111f;
        --bg-2: #0f172a;
        --panel: rgba(15, 23, 42, 0.78);
        --panel-strong: rgba(19, 31, 55, 0.92);
        --ink: #e8eefc;
        --muted: #9aa8c7;
        --accent: #60a5fa;
        --accent-2: #22c55e;
        --danger: #f87171;
        --warning: #fbbf24;
        --line: rgba(148, 163, 184, 0.18);
        --shadow: 0 24px 60px rgba(2, 6, 23, 0.45);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Tahoma, Arial, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(96, 165, 250, 0.22) 0, transparent 28%),
          radial-gradient(circle at top right, rgba(34, 197, 94, 0.16) 0, transparent 24%),
          radial-gradient(circle at bottom center, rgba(168, 85, 247, 0.12) 0, transparent 24%),
          linear-gradient(180deg, #08101d 0%, var(--bg) 55%, var(--bg-2) 100%);
        min-height: 100vh;
      }
      .wrap {
        max-width: 1280px;
        margin: 0 auto;
        padding: 32px 24px 40px;
      }
      .hero {
        display: grid;
        gap: 16px;
        margin-bottom: 26px;
      }
      h1 {
        margin: 0;
        font-size: 38px;
        line-height: 1.1;
        font-weight: 600;
        letter-spacing: -0.02em;
      }
      .sub {
        color: var(--muted);
        max-width: 760px;
        line-height: 1.6;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(12, 1fr);
        gap: 18px;
      }
      .card {
        background:
          linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%),
          var(--panel);
        backdrop-filter: blur(18px);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 20px;
        box-shadow: var(--shadow);
      }
      .span-12 { grid-column: span 12; }
      .span-8 { grid-column: span 8; }
      .span-4 { grid-column: span 4; }
      .kpis {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 14px;
      }
      .kpi {
        border: 1px solid var(--line);
        border-radius: 18px;
        padding: 16px;
        background:
          linear-gradient(180deg, rgba(96, 165, 250, 0.08) 0%, rgba(15, 23, 42, 0.08) 100%),
          rgba(255,255,255,0.02);
      }
      .eyebrow {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--muted);
      }
      .big {
        font-size: 30px;
        margin-top: 10px;
        font-weight: 600;
      }
      .meta {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 14px;
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--line);
        color: var(--ink);
        width: fit-content;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent-2);
        box-shadow: 0 0 16px rgba(34, 197, 94, 0.65);
      }
      .action-link {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 9px 12px;
        background: linear-gradient(135deg, var(--accent) 0%, #2563eb 100%);
        color: #f8fbff;
        text-decoration: none;
        font-size: 13px;
        border: 1px solid rgba(255,255,255,0.08);
        box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
      }
      .file-card {
        min-width: 148px;
        max-width: 168px;
      }
      .file-tile {
        width: 100%;
        height: 56px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.08);
        background:
          linear-gradient(180deg, rgba(96, 165, 250, 0.16) 0%, rgba(15, 23, 42, 0.12) 100%),
          rgba(255,255,255,0.04);
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
      }
      .file-tile.inactive {
        opacity: 0.38;
        filter: grayscale(0.18);
      }
      .file-tile-top {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
      }
      .file-tag {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #dbeafe;
      }
      .file-corner {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        background: rgba(255,255,255,0.16);
      }
      .file-name {
        font-size: 11px;
        line-height: 1.25;
        color: #dbeafe;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        flex: 1 1 auto;
      }
      .file-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      .secondary-button {
        background: rgba(255,255,255,0.03);
        color: var(--ink);
        border: 1px solid var(--line);
        padding: 0;
        width: 40px;
        height: 40px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
      }
      .secondary-button:disabled {
        opacity: 0.34;
        cursor: not-allowed;
        box-shadow: none;
      }
      .muted-box {
        border: 1px dashed rgba(148, 163, 184, 0.22);
        border-radius: 18px;
        padding: 14px;
        background: rgba(255,255,255,0.025);
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        cursor: pointer;
        background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
        color: #eff6ff;
        font-size: 14px;
        transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        box-shadow: 0 12px 28px rgba(29, 78, 216, 0.28);
      }
      button:hover,
      .action-link:hover {
        transform: translateY(-1px);
      }
      .secondary-button:hover {
        background: rgba(255,255,255,0.07);
      }
      .icon-button svg {
        width: 18px;
        height: 18px;
      }
      .icon-button.is-loading {
        opacity: 0.8;
        cursor: wait;
      }
      .icon-button.is-loading svg {
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      table {
        width: 100%;
        border-collapse: collapse;
        overflow: hidden;
      }
      th, td {
        text-align: left;
        padding: 10px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
        vertical-align: middle;
        font-size: 14px;
      }
      th {
        color: var(--muted);
        font-weight: 500;
      }
      tbody tr {
        transition: background 140ms ease;
      }
      tbody tr:hover {
        background: rgba(255,255,255,0.03);
      }
      .pill {
        display: inline-block;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        border: 1px solid var(--line);
        margin-right: 6px;
        margin-bottom: 6px;
        background: rgba(255,255,255,0.04);
      }
      .ok { color: #4ade80; }
      .warn { color: var(--warning); }
      .error { color: var(--danger); }
      .table-wrap {
        overflow-x: auto;
      }
      @media (max-width: 900px) {
        .span-8, .span-4, .span-12 { grid-column: span 12; }
        .kpis { grid-template-columns: repeat(2, 1fr); }
        h1 { font-size: 30px; }
        .wrap { padding: 20px 16px 30px; }
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
          <div class="eyebrow">Erros do Sistema</div>
          <div id="error-log" class="muted-box meta"></div>
        </div>

        <div class="card span-12">
          <div class="eyebrow">Tasks em foco</div>
          <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Anexos</th>
                <th>Processo</th>
                <th>Pronta</th>
                <th>Processada</th>
                <th>Planilha</th>
                <th>Reprocessar</th>
              </tr>
            </thead>
            <tbody id="target-tasks"></tbody>
          </table>
          </div>
        </div>

        <div class="card span-12">
          <div class="eyebrow">Historico recente</div>
          <div class="table-wrap">
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
        </div>
      </section>
    </div>

    <script>
      const statusCountsEl = document.getElementById("status-counts");
      const targetTasksEl = document.getElementById("target-tasks");
      const recentRunsEl = document.getElementById("recent-runs");
      const monitorMessageEl = document.getElementById("monitor-message");
      const monitorMetaEl = document.getElementById("monitor-meta");
      const errorLogEl = document.getElementById("error-log");
      const refreshButton = document.getElementById("refresh-button");
      const reprocessingTasks = new Set();
      const deletingFiles = new Set();
      let currentSnapshot = null;

      function renderDashboard(data) {
        currentSnapshot = data;
        const errorRuns = data.recentRuns.filter((run) => run.status === "error").slice(0, 3);

        monitorMessageEl.textContent = data.lastMessage;
        monitorMetaEl.textContent = "Status observado: " + data.targetStatus + " | polling: " + data.pollIntervalMs + "ms | servidor: " + fmt(data.serverTime);
        errorLogEl.innerHTML = errorRuns.length > 0
          ? [
              "Ultimo erro: " + fmt(data.lastErrorAt),
              ...errorRuns.map((run) =>
                '<span class="error">' + textOrDash(run.message) + "</span>"
              )
            ].join("<br><br>")
          : "Nenhum erro registrado no momento.";

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
            <td>\${renderFileTile(task)}</td>
            <td>
              <button
                class="secondary-button icon-button \${reprocessingTasks.has(task.id) ? "is-loading" : ""}"
                type="button"
                onclick="reprocessTask('\${task.id}')"
                title="Reprocessar task"
                aria-label="Reprocessar task"
                \${reprocessingTasks.has(task.id) ? "disabled" : ""}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 0 1-15.5 6.36" />
                  <path d="M3 12A9 9 0 0 1 18.5 5.64" />
                  <path d="M7 17H5v-2" />
                  <path d="M17 7h2v2" />
                </svg>
              </button>
            </td>
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

      async function reprocessTask(taskId) {
        reprocessingTasks.add(taskId);
        if (currentSnapshot) {
          renderDashboard(currentSnapshot);
        }

        try {
          const response = await fetch("/api/reprocess", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ taskId })
          });
          const data = await response.json();
          renderDashboard(data);
        } finally {
          reprocessingTasks.delete(taskId);
          if (currentSnapshot) {
            renderDashboard(currentSnapshot);
          }
        }
      }

      async function deleteGeneratedFile(fileUrl) {
        deletingFiles.add(fileUrl);
        if (currentSnapshot) {
          renderDashboard(currentSnapshot);
        }

        try {
          const response = await fetch(fileUrl, {
            method: "DELETE"
          });
          const data = await response.json();
          renderDashboard(data);
        } finally {
          deletingFiles.delete(fileUrl);
          if (currentSnapshot) {
            renderDashboard(currentSnapshot);
          }
        }
      }

      function fmt(date) {
        if (!date) return "-";
        return new Date(date).toLocaleString("pt-BR");
      }

      function textOrDash(value) {
        return value && String(value).trim() ? value : "-";
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function renderFileTile(task) {
        const isActive = Boolean(task.hasGeneratedFile && task.latestDownloadUrl && task.latestDeleteUrl);
        const isDeleting = Boolean(task.latestDeleteUrl && deletingFiles.has(task.latestDeleteUrl));
        const fileLabel = task.generatedFileName || "VF.xlsx";

        return \`
          <div class="file-card">
            <div class="file-tile \${isActive ? "" : "inactive"}">
              <div class="file-tile-top">
                <span class="file-tag">XLSX</span>
                <span class="file-corner"></span>
              </div>
              <div class="file-name">\${escapeHtml(fileLabel)}</div>
            </div>
            <div class="file-actions">
              <button
                class="secondary-button icon-button"
                type="button"
                title="Baixar planilha"
                aria-label="Baixar planilha"
                \${isActive ? 'onclick="window.location.href=\\'' + task.latestDownloadUrl + '\\'' + '"' : "disabled"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </button>
              <button
                class="secondary-button icon-button \${isDeleting ? "is-loading" : ""}"
                type="button"
                title="Excluir planilha"
                aria-label="Excluir planilha"
                \${isActive && !isDeleting ? 'onclick="deleteGeneratedFile(\\'' + task.latestDeleteUrl + '\\'' + ')"' : "disabled"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          </div>
        \`;
      }

      async function loadDashboard() {
        const response = await fetch("/api/dashboard");
        const data = await response.json();
        renderDashboard(data);
      }

      refreshButton.addEventListener("click", loadDashboard);
      loadDashboard();
      setInterval(loadDashboard, 10000);
    </script>
  </body>
</html>`;
}

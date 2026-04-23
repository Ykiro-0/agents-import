import { useEffect, useMemo, useState } from "react";
import { deleteGeneratedFile, fetchDashboard, reprocessTask } from "./api";
import type { DashboardTaskInfo, ExecutionLogEntry, MonitorSnapshot } from "./types";

type ViewKey = "project" | "list" | "approval" | "logs" | "files";

type ApprovalDraft = {
  descricao: string;
  descricaoReduzida: string;
  observacao: string;
};

function SidebarIcon({ view }: { view: ViewKey }) {
  const commonProps = {
    className: "h-[18px] w-[18px]",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    viewBox: "0 0 24 24"
  } as const;

  if (view === "project") {
    return (
      <svg {...commonProps}>
        <path d="M4 6h7v5H4z" />
        <path d="M13 6h7v5h-7z" />
        <path d="M4 13h7v5H4z" />
        <path d="M13 13h7v5h-7z" />
      </svg>
    );
  }

  if (view === "list") {
    return (
      <svg {...commonProps}>
        <path d="M8 6h12" />
        <path d="M8 12h12" />
        <path d="M8 18h12" />
        <path d="M4 6h.01" />
        <path d="M4 12h.01" />
        <path d="M4 18h.01" />
      </svg>
    );
  }

  if (view === "approval") {
    return (
      <svg {...commonProps}>
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
      </svg>
    );
  }

  if (view === "logs") {
    return (
      <svg {...commonProps}>
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-6" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M4 7h16" />
      <path d="M7 4v6" />
      <path d="M17 14H7" />
      <path d="M17 10v8" />
    </svg>
  );
}

function fmt(date?: string): string {
  if (!date) return "-";

  const numericDate = Number(date);

  if (Number.isFinite(numericDate) && numericDate > 0) {
    return new Date(numericDate).toLocaleString("pt-BR");
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR");
}

function extractTaskMeta(task: DashboardTaskInfo): {
  nf: string;
  fornecedor: string;
  tituloCurto: string;
} {
  const normalized = task.name.replace(/\s+/g, " ").trim();
  const nfMatch = normalized.match(/NF\s*([0-9]+)/i);
  const nf = nfMatch ? nfMatch[1] : "000";
  const splitByDash = normalized.split(" - ").map((part) => part.trim()).filter(Boolean);

  if (splitByDash.length >= 2 && /^NF\s*[0-9]+$/i.test(splitByDash[0])) {
    return {
      nf,
      fornecedor: splitByDash.slice(1).join(" - "),
      tituloCurto: splitByDash[0]
    };
  }

  const fornecedor = normalized.replace(/.*NF\s*[0-9]+\s*-?\s*/i, "").trim() || normalized;

  return {
    nf,
    fornecedor,
    tituloCurto: `NF ${nf}`
  };
}

function getTaskBadgeClass(task: DashboardTaskInfo): string {
  if (task.processingStage) return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  if (task.hasGeneratedFile) return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  if (task.readyToProcess) return "border-blue-400/20 bg-blue-500/10 text-blue-100";
  return "border-rose-400/20 bg-rose-500/10 text-rose-200";
}

function getTaskStatusLabel(task: DashboardTaskInfo): string {
  if (task.processingStage) return "Processando";
  if (task.hasGeneratedFile) return "Planilha gerada";
  if (task.readyToProcess) return "Pronta para processar";
  return "Aguardando anexos";
}

function IconButton({
  title,
  disabled,
  spinning,
  onClick,
  children
}: {
  title: string;
  disabled?: boolean;
  spinning?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-slate-100 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-35",
        spinning ? "animate-pulse" : ""
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      <span className={spinning ? "animate-spin" : ""}>{children}</span>
    </button>
  );
}

function FileCard({
  task,
  deleting,
  onDelete
}: {
  task: DashboardTaskInfo;
  deleting: boolean;
  onDelete: () => void;
}) {
  const active = Boolean(task.hasGeneratedFile && task.latestDownloadUrl && task.latestDeleteUrl);

  return (
    <div className="w-full min-w-[180px] max-w-[220px]">
      <div
        className={[
          "flex h-16 items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500/15 via-emerald-400/5 to-white/[0.02] px-4 shadow-inner shadow-white/5",
          active ? "opacity-100" : "opacity-40 grayscale-[0.18]"
        ].join(" ")}
      >
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-200">Planilha VF</div>
          <div className="mt-1 text-xs text-slate-200">{task.generatedFileName ?? "Aguardando arquivo"}</div>
        </div>
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-100">
          XLSX
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <IconButton
          disabled={!active}
          onClick={() => {
            if (task.latestDownloadUrl) {
              window.location.href = task.latestDownloadUrl;
            }
          }}
          title="Baixar planilha"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </IconButton>
        <IconButton
          disabled={!active || deleting}
          onClick={onDelete}
          spinning={deleting}
          title="Excluir planilha"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
            <path d="M3 6h18" />
            <path d="M8 6V4h8v2" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </IconButton>
      </div>
    </div>
  );
}

function RunTable({ runs }: { runs: ExecutionLogEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="border-b border-white/10 px-2 py-3 font-medium">Horario</th>
            <th className="border-b border-white/10 px-2 py-3 font-medium">Status</th>
            <th className="border-b border-white/10 px-2 py-3 font-medium">Mensagem</th>
            <th className="border-b border-white/10 px-2 py-3 font-medium">NF</th>
            <th className="border-b border-white/10 px-2 py-3 font-medium">Arquivo</th>
            <th className="border-b border-white/10 px-2 py-3 font-medium">Baixar</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="transition hover:bg-white/[0.03]">
              <td className="border-b border-white/10 px-2 py-3 align-middle">{fmt(run.finishedAt || run.startedAt)}</td>
              <td
                className={[
                  "border-b border-white/10 px-2 py-3 align-middle",
                  run.status === "success" ? "text-emerald-400" : run.status === "error" ? "text-rose-400" : "text-amber-300"
                ].join(" ")}
              >
                {run.status}
              </td>
              <td className="border-b border-white/10 px-2 py-3 align-middle text-slate-300">
                {run.message}
                <div className="text-slate-500">{run.taskName ?? "-"}</div>
              </td>
              <td className="border-b border-white/10 px-2 py-3 align-middle">{run.nfNumber ?? "-"}</td>
              <td className="border-b border-white/10 px-2 py-3 align-middle text-slate-500">{run.outputPath ?? "-"}</td>
              <td className="border-b border-white/10 px-2 py-3 align-middle">
                {run.downloadUrl ? (
                  <a
                    className="inline-flex items-center rounded-full border border-white/10 bg-gradient-to-r from-blue-400 to-blue-700 px-3 py-2 text-xs text-blue-50 shadow-lg shadow-blue-900/30"
                    href={run.downloadUrl}
                  >
                    Baixar
                  </a>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardApp() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [reprocessing, setReprocessing] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>({
    descricao: "",
    descricaoReduzida: "",
    observacao: ""
  });
  const [approvalDecision, setApprovalDecision] = useState<string>("Aguardando decisao");

  async function loadSnapshot() {
    try {
      const data = await fetchDashboard();
      setSnapshot(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao carregar dashboard.");
    }
  }

  useEffect(() => {
    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!snapshot?.targetTasks.length) {
      setSelectedTaskId(null);
      return;
    }

    const taskExists = snapshot.targetTasks.some((task) => task.id === selectedTaskId);
    const nextTask = taskExists
      ? snapshot.targetTasks.find((task) => task.id === selectedTaskId) ?? snapshot.targetTasks[0]
      : snapshot.targetTasks[0];

    setSelectedTaskId(nextTask.id);
  }, [snapshot, selectedTaskId]);

  const selectedTask = useMemo(
    () => snapshot?.targetTasks.find((task) => task.id === selectedTaskId) ?? snapshot?.targetTasks[0] ?? null,
    [selectedTaskId, snapshot]
  );

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    const meta = extractTaskMeta(selectedTask);
    setApprovalDraft({
      descricao: selectedTask.name,
      descricaoReduzida: meta.tituloCurto.slice(0, 20),
      observacao: ""
    });
  }, [selectedTask?.id]);

  const errorRuns = useMemo(
    () => snapshot?.recentRuns.filter((run) => run.status === "error").slice(0, 4) ?? [],
    [snapshot]
  );

  const counts = useMemo(() => {
    const tasks = snapshot?.targetTasks ?? [];

    return {
      withSpreadsheet: tasks.filter((task) => task.hasGeneratedFile).length,
      ready: tasks.filter((task) => task.readyToProcess).length,
      pending: tasks.filter((task) => !task.readyToProcess).length
    };
  }, [snapshot]);

  const sidebarItems: Array<{ key: ViewKey; label: string; description: string }> = [
    { key: "project", label: "Project View - agents 2D", description: "Visao estrutural do fluxo" },
    { key: "list", label: "List", description: "NF em lista para operacao" },
    { key: "approval", label: "Aprovacao", description: "Analise, edicao e decisao" },
    { key: "logs", label: "Logs", description: "Erros e execucoes" },
    { key: "files", label: "Arquivos/Testes", description: "Area tecnica e manual" }
  ];

  async function handleReprocess(taskId: string) {
    setReprocessing((prev) => new Set(prev).add(taskId));

    try {
      const data = await reprocessTask(taskId);
      setSnapshot(data);
      setErrorMessage(null);
      setSelectedTaskId(taskId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao reprocessar task.");
    } finally {
      setReprocessing((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  }

  async function handleDelete(deleteUrl: string) {
    setDeleting((prev) => new Set(prev).add(deleteUrl));

    try {
      const data = await deleteGeneratedFile(deleteUrl);
      setSnapshot(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao excluir planilha.");
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(deleteUrl);
        return next;
      });
    }
  }

  const selectedMeta = selectedTask ? extractTaskMeta(selectedTask) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_24%),radial-gradient(circle_at_bottom_center,rgba(168,85,247,0.12),transparent_24%),linear-gradient(180deg,#08101d_0%,#09111f_55%,#0f172a_100%)] text-slate-100">
      <div className="flex min-h-screen gap-4">
        <aside
          className={[
            "sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-slate-950/95 px-2 py-3 shadow-glow backdrop-blur-xl transition-all duration-300 lg:block",
            sidebarCollapsed ? "w-[78px]" : "w-[196px]"
          ].join(" ")}
        >
          <div className="flex items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.03] px-2.5 py-2.5">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(34,197,94,0.65)]" />
              {!sidebarCollapsed ? <span className="text-sm font-medium text-slate-100">AG-CAD</span> : null}
            </div>
            <button
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.08]"
              onClick={() => setSidebarCollapsed((value) => !value)}
              title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
              type="button"
            >
              <svg
                className={["h-4 w-4 transition-transform", sidebarCollapsed ? "rotate-180" : ""].join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </div>

          {!sidebarCollapsed ? (
            <div className="mt-3 rounded-[14px] border border-white/10 bg-white/[0.02] px-2.5 py-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Workspace</h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Operacao, aprovacao e area tecnica com mais foco no conteudo principal.
              </p>
            </div>
          ) : null}

          <nav className="mt-3 space-y-1.5">
            {sidebarItems.map((item) => {
              const active = item.key === activeView;

              return (
                <button
                  key={item.key}
                  className={[
                    "flex w-full items-center gap-2 rounded-[14px] border transition",
                    active
                      ? "border-blue-400/30 bg-gradient-to-r from-blue-500/18 to-transparent text-slate-50 shadow-lg shadow-blue-950/20"
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]",
                    sidebarCollapsed ? "justify-center px-0 py-2.5" : "px-2.5 py-2 text-left"
                  ].join(" ")}
                  onClick={() => setActiveView(item.key)}
                  title={sidebarCollapsed ? item.label : undefined}
                  type="button"
                >
                  <span
                    className={[
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border",
                      active
                        ? "border-blue-300/20 bg-blue-500/15 text-blue-100"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                    ].join(" ")}
                  >
                    <SidebarIcon view={item.key} />
                  </span>
                  {!sidebarCollapsed ? (
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium leading-5">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">{item.description}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 md:px-5 md:py-7">
          <section className="mb-6 grid gap-4">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(34,197,94,0.65)]" />
              AG-CAD monitor local
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Painel operacional da automacao</h1>
            <p className="max-w-4xl text-slate-400">
              Acompanhe a fila do ClickUp, abra a lista de NFs, revise a planilha gerada e use a area tecnica para testes e diagnostico.
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {sidebarItems.map((item) => {
                const active = item.key === activeView;

                return (
                  <button
                    key={item.key}
                    className={[
                      "whitespace-nowrap rounded-full border px-4 py-2 text-sm transition",
                      active
                        ? "border-blue-400/30 bg-blue-500/15 text-slate-50"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                    ].join(" ")}
                    onClick={() => setActiveView(item.key)}
                    type="button"
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-12 gap-5">
            <div className="col-span-12 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Monitor</div>
                  <div className="mt-2 text-3xl font-semibold">{snapshot?.lastMessage ?? "Carregando..."}</div>
                  <div className="mt-2 text-sm text-slate-400">
                    {snapshot
                      ? `Status observado: ${snapshot.targetStatus} | polling: ${snapshot.pollIntervalMs}ms | servidor: ${fmt(snapshot.serverTime)}`
                      : "Aguardando snapshot do dashboard..."}
                  </div>
                </div>
                <button
                  className="rounded-full bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3 text-sm text-blue-50 shadow-lg shadow-blue-900/30 transition hover:-translate-y-px"
                  onClick={() => {
                    void loadSnapshot();
                  }}
                  type="button"
                >
                  Atualizar agora
                </button>
              </div>
            </div>

            {errorMessage ? (
              <div className="col-span-12 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                {errorMessage}
              </div>
            ) : null}

            {activeView === "project" ? (
              <>
                <div className="col-span-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Project View</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {[
                      {
                        title: "Agente de captura",
                        text: "Identifica a task em CONCLUIDO RECEBIMENTO e consolida os anexos do ClickUp."
                      },
                      {
                        title: "AG-CAD",
                        text: "Valida CSV, HTML e XML, detecta anomalias e estrutura a planilha para aprovacao."
                      },
                      {
                        title: "Saida VF Import",
                        text: "Gera o XLSX final, permite reprocesso e prepara integracao futura com ERP."
                      }
                    ].map((card) => (
                      <div key={card.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm font-semibold text-slate-100">{card.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">{card.text}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
                    Fluxo 2D: ClickUp Recebimento {"->"} Analise AG-CAD {"->"} Planilha VF {"->"} Aprovacao {"->"} ERP futuramente.
                  </div>
                </div>

                <div className="col-span-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Pipeline</div>
                  <div className="mt-4 space-y-3">
                    {(snapshot?.statusCounts ?? []).map((item) => (
                      <div key={item.status} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-400">{item.status}</div>
                        <div className="mt-2 text-3xl font-semibold">{item.total}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            {activeView === "list" ? (
              <>
                <div className="col-span-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">List</div>
                      <div className="mt-2 text-lg font-semibold">Tela principal das NFs</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
                      {snapshot?.targetTasks.length ?? 0} NFs em foco
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="border-b border-white/10 px-3 py-3 font-medium">NF</th>
                          <th className="border-b border-white/10 px-3 py-3 font-medium">Fornecedor</th>
                          <th className="border-b border-white/10 px-3 py-3 font-medium">Status</th>
                          <th className="border-b border-white/10 px-3 py-3 font-medium">Data</th>
                          <th className="border-b border-white/10 px-3 py-3 font-medium">Detalhes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(snapshot?.targetTasks ?? []).map((task) => {
                          const meta = extractTaskMeta(task);
                          const selected = selectedTask?.id === task.id;

                          return (
                            <tr
                              key={task.id}
                              className={[
                                "transition hover:bg-white/[0.03]",
                                selected ? "bg-white/[0.04]" : ""
                              ].join(" ")}
                            >
                              <td className="border-b border-white/10 px-3 py-4 align-middle">
                                <div className="font-semibold text-slate-100">{meta.nf}</div>
                                <div className="text-xs text-slate-500">{task.id}</div>
                              </td>
                              <td className="border-b border-white/10 px-3 py-4 align-middle">
                                <div className="font-medium text-slate-200">{meta.fornecedor}</div>
                                <div className="text-xs text-slate-500">{task.name}</div>
                              </td>
                              <td className="border-b border-white/10 px-3 py-4 align-middle">
                                <span className={["inline-flex rounded-full border px-3 py-1 text-xs", getTaskBadgeClass(task)].join(" ")}>
                                  {getTaskStatusLabel(task)}
                                </span>
                              </td>
                              <td className="border-b border-white/10 px-3 py-4 align-middle text-slate-300">{fmt(task.dateUpdated)}</td>
                              <td className="border-b border-white/10 px-3 py-4 align-middle">
                                <button
                                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-slate-100 transition hover:bg-white/[0.07]"
                                  onClick={() => setSelectedTaskId(task.id)}
                                  type="button"
                                >
                                  Ver detalhes
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="col-span-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Detalhes da NF</div>
                  {selectedTask && selectedMeta ? (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-lg font-semibold">{selectedMeta.fornecedor}</div>
                        <div className="mt-1 text-sm text-slate-400">NF {selectedMeta.nf}</div>
                        <div className="mt-3 text-xs text-slate-500">Atualizada em {fmt(selectedTask.dateUpdated)}</div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "CSV", value: selectedTask.hasCsv },
                          { label: "HTML", value: selectedTask.hasHtml },
                          { label: "XML", value: selectedTask.hasXml }
                        ].map((attachment) => (
                          <div
                            key={attachment.label}
                            className={[
                              "rounded-2xl border px-3 py-3 text-center text-xs",
                              attachment.value
                                ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                                : "border-rose-400/20 bg-rose-500/10 text-rose-200"
                            ].join(" ")}
                          >
                            {attachment.label}
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="text-sm text-slate-300">Status operacional</div>
                        <div className="mt-2 text-lg font-semibold">{getTaskStatusLabel(selectedTask)}</div>
                        <div className="mt-2 text-sm text-slate-400">
                          {selectedTask.processingStage ?? "Sem processamento ativo neste momento."}
                        </div>
                      </div>

                      <FileCard
                        task={selectedTask}
                        deleting={Boolean(selectedTask.latestDeleteUrl && deleting.has(selectedTask.latestDeleteUrl))}
                        onDelete={() => {
                          if (selectedTask.latestDeleteUrl) {
                            void handleDelete(selectedTask.latestDeleteUrl);
                          }
                        }}
                      />

                      <div className="flex gap-2">
                        <button
                          className="inline-flex flex-1 items-center justify-center rounded-full border border-white/10 bg-gradient-to-r from-blue-700 to-blue-500 px-4 py-3 text-sm text-blue-50 shadow-lg shadow-blue-900/30 transition hover:-translate-y-px"
                          onClick={() => {
                            void handleReprocess(selectedTask.id);
                          }}
                          type="button"
                        >
                          <svg
                            className={["mr-2 h-[18px] w-[18px]", reprocessing.has(selectedTask.id) ? "animate-spin" : ""].join(" ")}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            viewBox="0 0 24 24"
                          >
                            <path d="M21 12a9 9 0 0 1-15.5 6.36" />
                            <path d="M3 12A9 9 0 0 1 18.5 5.64" />
                            <path d="M7 17H5v-2" />
                            <path d="M17 7h2v2" />
                          </svg>
                          Reprocessar
                        </button>
                        <button
                          className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.07]"
                          onClick={() => setActiveView("approval")}
                          type="button"
                        >
                          Ir para aprovacao
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                      Nenhuma NF carregada no momento.
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {activeView === "approval" ? (
              <>
                <div className="col-span-7 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Aprovacao</div>
                  {selectedTask && selectedMeta ? (
                    <div className="mt-4">
                      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div>
                          <div className="text-lg font-semibold text-slate-100">NF {selectedMeta.nf}</div>
                          <div className="mt-1 text-sm text-slate-400">{selectedMeta.fornecedor}</div>
                          <div className="mt-3 text-xs text-slate-500">Status atual: {getTaskStatusLabel(selectedTask)}</div>
                        </div>
                        <FileCard
                          task={selectedTask}
                          deleting={Boolean(selectedTask.latestDeleteUrl && deleting.has(selectedTask.latestDeleteUrl))}
                          onDelete={() => {
                            if (selectedTask.latestDeleteUrl) {
                              void handleDelete(selectedTask.latestDeleteUrl);
                            }
                          }}
                        />
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                          <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Descricao</div>
                          <input
                            className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                            onChange={(event) =>
                              setApprovalDraft((prev) => ({ ...prev, descricao: event.target.value }))
                            }
                            value={approvalDraft.descricao}
                          />
                        </label>
                        <label className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                          <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Descricao reduzida</div>
                          <input
                            className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                            maxLength={20}
                            onChange={(event) =>
                              setApprovalDraft((prev) => ({ ...prev, descricaoReduzida: event.target.value }))
                            }
                            value={approvalDraft.descricaoReduzida}
                          />
                        </label>
                      </div>

                      <label className="mt-4 block rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                        <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Observacoes da aprovacao</div>
                        <textarea
                          className="mt-3 min-h-[120px] w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100 outline-none"
                          onChange={(event) =>
                            setApprovalDraft((prev) => ({ ...prev, observacao: event.target.value }))
                          }
                          placeholder="Observacoes, ajustes de cadastro, validacoes finais..."
                          value={approvalDraft.observacao}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                      Selecione uma NF na lista para iniciar a aprovacao.
                    </div>
                  )}
                </div>

                <div className="col-span-5 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Decisao</div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-sm text-slate-400">Estado atual</div>
                    <div className="mt-2 text-2xl font-semibold">{approvalDecision}</div>
                    <div className="mt-3 text-sm text-slate-500">
                      Esta area ja esta pronta para virar o core do sistema. Hoje a decisao fica local na interface.
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <button
                      className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-4 text-sm font-medium text-white shadow-lg shadow-emerald-950/30"
                      onClick={() => setApprovalDecision("Aprovada para seguir")}
                      type="button"
                    >
                      Aprovar planilha
                    </button>
                    <button
                      className="w-full rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-4 text-sm font-medium text-rose-200"
                      onClick={() => setApprovalDecision("Reprovada para ajuste")}
                      type="button"
                    >
                      Reprovar planilha
                    </button>
                    <button
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm font-medium text-slate-100"
                      onClick={() => setApprovalDecision("Aguardando decisao")}
                      type="button"
                    >
                      Limpar decisao
                    </button>
                  </div>

                  {selectedTask ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Resumo da task</div>
                      <div className="mt-3 space-y-2">
                        <div>Pronta: {selectedTask.readyToProcess ? "Sim" : "Nao"}</div>
                        <div>Planilha gerada: {selectedTask.hasGeneratedFile ? "Sim" : "Nao"}</div>
                        <div>Processamento: {selectedTask.processingStage ?? "Sem processamento ativo"}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {activeView === "logs" ? (
              <>
                <div className="col-span-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Erros do Sistema</div>
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                    {errorRuns.length > 0 ? (
                      <>
                        <div>Ultimo erro: {fmt(snapshot?.lastErrorAt)}</div>
                        <div className="mt-4 space-y-4">
                          {errorRuns.map((run) => (
                            <div key={run.id} className="text-rose-400">
                              {run.message}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      "Nenhum erro registrado no momento."
                    )}
                  </div>
                </div>

                <div className="col-span-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="mb-4 text-xs uppercase tracking-[0.14em] text-slate-400">Logs</div>
                  <RunTable runs={snapshot?.recentRuns ?? []} />
                </div>
              </>
            ) : null}

            {activeView === "files" ? (
              <>
                <div className="col-span-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Arquivos/Testes</div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Tasks com CSV</div>
                      <div className="mt-2 text-3xl font-semibold">{snapshot?.targetTasks.filter((task) => task.hasCsv).length ?? 0}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Planilhas geradas</div>
                      <div className="mt-2 text-3xl font-semibold">{counts.withSpreadsheet}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Prontas para processar</div>
                      <div className="mt-2 text-3xl font-semibold">{counts.ready}</div>
                    </div>
                  </div>
                </div>

                <div className="col-span-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Area tecnica</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {[
                      "Upload manual de arquivos para debug",
                      "Rodar pipeline sem ClickUp",
                      "Baixar Excel e validar estrutura gerada"
                    ].map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-slate-400">
                    Esta area fica reservada para desenvolvimento e testes internos da pipeline.
                  </div>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

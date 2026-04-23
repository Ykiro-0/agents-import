import { useEffect, useMemo, useState } from "react";
import { deleteGeneratedFile, fetchDashboard, reprocessTask, runMonitorNow } from "./api";
import type { AgentPipelineStep, DashboardTaskInfo, ExecutionLogEntry, MonitorSnapshot } from "./types";

type ViewKey = "project" | "agent" | "list" | "approval" | "agCad" | "agPrice" | "logs" | "files" | "settings";

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

  if (view === "agent") {
    return (
      <svg {...commonProps}>
        <path d="M12 3v6" />
        <path d="M5.5 7.5 9 10" />
        <path d="M18.5 7.5 15 10" />
        <path d="M12 21v-6" />
        <path d="M5.5 16.5 9 14" />
        <path d="M18.5 16.5 15 14" />
        <circle cx="12" cy="12" r="3.2" />
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

  if (view === "agCad") {
    return (
      <svg {...commonProps}>
        <path d="M12 3l7 4v10l-7 4-7-4V7l7-4z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </svg>
    );
  }

  if (view === "agPrice") {
    return (
      <svg {...commonProps}>
        <path d="M12 2v20" />
        <path d="M17 6.5c0-1.9-2.24-3.5-5-3.5S7 4.6 7 6.5 8.7 9.6 12 10.2s5 2 5 3.8-2.24 3.5-5 3.5S7 15.9 7 14" />
      </svg>
    );
  }

  if (view === "settings") {
    return (
      <svg {...commonProps}>
        <path d="M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.54V21a2 2 0 0 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.54-1H3a2 2 0 0 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.54 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z" />
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

function getAgentStepClass(step: AgentPipelineStep): string {
  if (step.status === "completed") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
  }

  if (step.status === "running") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-200";
  }

  if (step.status === "blocked") {
    return "border-rose-400/20 bg-rose-500/10 text-rose-200";
  }

  return "border-white/10 bg-white/[0.03] text-slate-300";
}

function getAgentStepLabel(step: AgentPipelineStep): string {
  if (step.status === "completed") return "Concluida";
  if (step.status === "running") return "Em execucao";
  if (step.status === "blocked") return "Bloqueada";
  return "Pendente";
}

type PixelAgentStatus = AgentPipelineStep["status"];

interface PixelAgentFrame {
  width: number;
  rows: string[];
}

const PIXEL_AGENT_FRAMES: PixelAgentFrame[] = [
  {
    width: 16,
    rows: [
      "................",
      ".....HHHH.......",
      "....HSSSSH......",
      "...HSEEESH......",
      "...HSSSSSH......",
      "....HSSSH.......",
      ".....BBBB.......",
      "....BBTBBB......",
      "...BBTTTBBB.....",
      "..MMMMMMMMMM....",
      "..MCCCCCCCCM....",
      "..MMMMMMMMMM....",
      "...DDDDDDDD.....",
      "...D......D.....",
      "...D......D.....",
      "......W........."
    ]
  },
  {
    width: 16,
    rows: [
      "................",
      ".....HHHH.......",
      "....HSSSSH......",
      "...HSEEESH......",
      "...HSSSSSH......",
      "....HSSSH.......",
      ".....BBBB.......",
      "...BBTTTBBB.....",
      "....BBTBBB......",
      "..MMMMMMMMMM....",
      "..MCCCCCCCCM....",
      "..MMMMMMMMMM....",
      "...DDDDDDDD.....",
      "...D......D.....",
      "...D......D.....",
      "........W......."
    ]
  },
  {
    width: 16,
    rows: [
      "................",
      ".....HHHH.......",
      "....HSSSSH......",
      "...HSEEESH......",
      "...HSSSSSH......",
      "....HSSSH.......",
      ".....BBBB.......",
      "....BBTBBB......",
      "...BBTTTBBB.....",
      "..MMMMMMMMMM....",
      "..MCCCCCCCCM....",
      "..MMMMMMMMMM....",
      "...DDDDDDDD.....",
      "...D......D.....",
      "...D......D.....",
      "....W..........."
    ]
  }
];

function getPixelBodyColor(status: PixelAgentStatus): string {
  if (status === "running") {
    return "#f59e0b";
  }

  if (status === "completed") {
    return "#22c55e";
  }

  if (status === "blocked") {
    return "#ef4444";
  }

  return "#64748b";
}

function getPixelScreenColor(status: PixelAgentStatus, frameIndex: number): string {
  if (status === "running") {
    return frameIndex % 2 === 0 ? "#22d3ee" : "#38bdf8";
  }

  if (status === "completed") {
    return "#34d399";
  }

  if (status === "blocked") {
    return frameIndex % 2 === 0 ? "#f87171" : "#fb7185";
  }

  return "#94a3b8";
}

function getPixelSparkColor(status: PixelAgentStatus, frameIndex: number): string {
  if (status === "running") {
    return frameIndex % 2 === 0 ? "#fde047" : "#f59e0b";
  }

  if (status === "blocked") {
    return "#f97316";
  }

  if (status === "completed") {
    return "#86efac";
  }

  return "transparent";
}

function getPixelCellColor(cell: string, status: PixelAgentStatus, frameIndex: number): string {
  if (cell === "H") return "#111827";
  if (cell === "S") return "#fbcaa4";
  if (cell === "E") return "#0f172a";
  if (cell === "B") return getPixelBodyColor(status);
  if (cell === "T") return status === "blocked" ? "#dc2626" : "#94a3b8";
  if (cell === "M") return "#334155";
  if (cell === "C") return getPixelScreenColor(status, frameIndex);
  if (cell === "D") return "#475569";
  if (cell === "W") return getPixelSparkColor(status, frameIndex);
  return "transparent";
}

function getPixelFrameInterval(status: PixelAgentStatus): number {
  if (status === "running") return 240;
  if (status === "blocked") return 420;
  if (status === "pending") return 680;
  return 900;
}

function PixelAgentSprite({ status, frameSeed }: { status: PixelAgentStatus; frameSeed: number }) {
  const [frameIndex, setFrameIndex] = useState(frameSeed % PIXEL_AGENT_FRAMES.length);
  const pixelSize = 6;
  const intervalMs = getPixelFrameInterval(status);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % PIXEL_AGENT_FRAMES.length);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs]);

  const frame = PIXEL_AGENT_FRAMES[frameIndex];
  const flatCells = frame.rows.join("").split("");
  const frameHeight = frame.rows.length;

  return (
    <div className="rounded-2xl border border-white/15 bg-slate-950/80 p-2 shadow-inner shadow-black/40">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${frame.width}, ${pixelSize}px)`,
          gridTemplateRows: `repeat(${frameHeight}, ${pixelSize}px)`
        }}
      >
        {flatCells.map((cell, index) => (
          <span
            key={`${index}-${cell}`}
            style={{
              width: `${pixelSize}px`,
              height: `${pixelSize}px`,
              backgroundColor: getPixelCellColor(cell, status, frameIndex),
              imageRendering: "pixelated"
            }}
          />
        ))}
      </div>
    </div>
  );
}

function getWorkstationCardClass(status: PixelAgentStatus): string {
  if (status === "running") return "border-amber-300/35 bg-amber-500/10";
  if (status === "completed") return "border-emerald-300/35 bg-emerald-500/10";
  if (status === "blocked") return "border-rose-300/35 bg-rose-500/10";
  return "border-slate-600/60 bg-slate-800/45";
}

function getWorkstationBadgeClass(status: PixelAgentStatus): string {
  if (status === "running") return "border-amber-300/35 bg-amber-500/15 text-amber-100";
  if (status === "completed") return "border-emerald-300/35 bg-emerald-500/15 text-emerald-100";
  if (status === "blocked") return "border-rose-300/35 bg-rose-500/15 text-rose-100";
  return "border-slate-500/40 bg-slate-700/30 text-slate-200";
}

function getWorkstationScreenColor(status: PixelAgentStatus, index: number): string {
  if (status === "running") return index % 2 === 0 ? "#22d3ee" : "#38bdf8";
  if (status === "completed") return "#34d399";
  if (status === "blocked") return index % 2 === 0 ? "#fb7185" : "#f87171";
  return "#64748b";
}

function getWorkstationScreenGlow(status: PixelAgentStatus): string {
  if (status === "running") return "rgba(34, 211, 238, 0.55)";
  if (status === "completed") return "rgba(16, 185, 129, 0.5)";
  if (status === "blocked") return "rgba(251, 113, 133, 0.55)";
  return "rgba(148, 163, 184, 0.35)";
}

function getWorkstationProgress(status: PixelAgentStatus): number {
  if (status === "running") return 66;
  if (status === "completed") return 100;
  if (status === "blocked") return 40;
  return 18;
}

function PixelControlRoom({
  steps,
  agentName
}: {
  steps: AgentPipelineStep[];
  agentName: string;
}) {
  const stations = useMemo(() => {
    const fallback: AgentPipelineStep[] = [
      {
        id: "agent-slot-1",
        title: "Aguardando pipeline",
        description: "Sem execucao ativa no momento.",
        status: "pending"
      },
      {
        id: "agent-slot-2",
        title: "Aguardando pipeline",
        description: "Sem execucao ativa no momento.",
        status: "pending"
      },
      {
        id: "agent-slot-3",
        title: "Aguardando pipeline",
        description: "Sem execucao ativa no momento.",
        status: "pending"
      }
    ];

    const base = steps.length ? steps : fallback;
    const filled = [...base];

    while (filled.length < 6) {
      const slot = filled.length + 1;
      filled.push({
        id: `agent-slot-${slot}`,
        title: "Slot disponivel",
        description: "Aguardando novo agente.",
        status: "pending"
      });
    }

    return filled.slice(0, 6);
  }, [steps]);

  const running = stations.filter((step) => step.status === "running").length;
  const completed = stations.filter((step) => step.status === "completed").length;

  return (
    <div className="mt-4 rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.2),transparent_34%),radial-gradient(circle_at_80%_16%,rgba(251,191,36,0.16),transparent_30%),linear-gradient(to_bottom,rgba(15,23,42,0.35),rgba(2,6,23,0.85))]" />
        <div className="pointer-events-none absolute inset-x-0 top-[46%] h-px bg-cyan-200/20" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/95 to-transparent" />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Sala de Agentes</div>
              <div className="mt-1 text-sm text-slate-200">Operacao visual do {agentName}</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-emerald-100">
                Concluidas: {completed}
              </span>
              <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1 text-amber-100">
                Em execucao: {running}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {stations.map((step, index) => (
              <div key={step.id} className={["relative rounded-2xl border p-3 backdrop-blur-sm", getWorkstationCardClass(step.status)].join(" ")}>
                <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-white/30" />

                <div className="relative">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-slate-300">Mesa {String(index + 1).padStart(2, "0")}</span>
                    <span className={["rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.14em]", getWorkstationBadgeClass(step.status)].join(" ")}>
                      {getAgentStepLabel(step)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-[auto_1fr] gap-3">
                    <PixelAgentSprite frameSeed={index + 3} status={step.status} />

                    <div className="space-y-2">
                      <div className="rounded-xl border border-white/10 bg-slate-900/90 p-2">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">PC {index + 1}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div
                            className="h-7 w-10 rounded-sm border border-slate-500/70"
                            style={{
                              backgroundColor: getWorkstationScreenColor(step.status, index),
                              boxShadow: `0 0 12px ${getWorkstationScreenGlow(step.status)}`
                            }}
                          />
                          <div className="h-[4px] flex-1 rounded-full bg-slate-700/70">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${getWorkstationProgress(step.status)}%`,
                                backgroundColor: getWorkstationScreenColor(step.status, index)
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
                        <div className="truncate text-xs font-semibold text-slate-100">{step.title}</div>
                        <div className="truncate text-[11px] text-slate-400">{step.detail ?? step.description}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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

  const sidebarGroups: Array<{
    title: string;
    items: Array<{ key: ViewKey; label: string }>;
  }> = [
    {
      title: "PROJETO",
      items: [
        { key: "project", label: "Project View" },
        { key: "list", label: "Listas de NF" },
        { key: "approval", label: "Aprovacao" }
      ]
    },
    {
      title: "AGENTES",
      items: [
        { key: "agent", label: "Kadia Pipeline" },
        { key: "agCad", label: "AG-CAD" },
        { key: "agPrice", label: "AG-PRICE" }
      ]
    },
    {
      title: "REGISTROS",
      items: [
        { key: "logs", label: "Logs" },
        { key: "files", label: "Areas de testes" }
      ]
    },
    {
      title: "APP",
      items: [{ key: "settings", label: "Configuracoes" }]
    }
  ];

  async function handleRunNow() {
    try {
      const data = await runMonitorNow();
      setSnapshot(data);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro ao rodar ciclo manual.");
    }
  }

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
      <div className="flex min-h-screen">
        <aside
          className={[
            "sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-slate-950/95 transition-all duration-300 lg:block",
            sidebarCollapsed ? "w-[64px]" : "w-[140px]"
          ].join(" ")}
        >
          <div className="flex h-full flex-col">
            <div className={["flex items-center border-b border-white/8", sidebarCollapsed ? "justify-center px-2 py-4" : "justify-between px-3 py-4"].join(" ")}>
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-500" />
                {!sidebarCollapsed ? <span className="text-sm font-medium text-slate-100">AG-CAD</span> : null}
              </div>
              {!sidebarCollapsed ? (
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  title="Recolher menu"
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              ) : (
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.06] hover:text-slate-200"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                  title="Expandir menu"
                  type="button"
                >
                  <svg className="h-4 w-4 rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-1.5 py-4">
              <div className="space-y-4">
                {sidebarGroups.map((group) => (
                  <div key={group.title}>
                    {!sidebarCollapsed ? (
                      <div className="mb-2 px-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-500">
                        {group.title}
                      </div>
                    ) : null}
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const active = item.key === activeView;

                        return (
                          <button
                            key={item.key}
                            className={[
                              "flex w-full items-center gap-3 rounded-xl border border-transparent transition",
                              active
                                ? "border-blue-400/20 bg-blue-500/12 text-slate-50"
                                : "text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200",
                              sidebarCollapsed ? "justify-center px-0 py-2.5" : "px-1.5 py-2 text-left"
                            ].join(" ")}
                            onClick={() => setActiveView(item.key)}
                            title={sidebarCollapsed ? item.label : undefined}
                            type="button"
                          >
                            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                              <SidebarIcon view={item.key} />
                            </span>
                            {!sidebarCollapsed ? <span className="text-[10px] font-medium tracking-[0.01em]">{item.label}</span> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-4 border-t border-white/8 last:hidden" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-7">
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
              {sidebarGroups.flatMap((group) => group.items).map((item) => {
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
                <div className="flex gap-2">
                  <button
                    className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm text-slate-100 transition hover:-translate-y-px hover:bg-white/[0.07]"
                    onClick={() => {
                      void loadSnapshot();
                    }}
                    type="button"
                  >
                    Atualizar
                  </button>
                  <button
                    className="rounded-full bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3 text-sm text-blue-50 shadow-lg shadow-blue-900/30 transition hover:-translate-y-px"
                    onClick={() => {
                      void handleRunNow();
                    }}
                    type="button"
                  >
                    Rodar ciclo
                  </button>
                </div>
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

            {activeView === "agent" ? (
              <>
                <div className="col-span-8 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Agente</div>
                      <div className="mt-2 text-lg font-semibold">
                        {snapshot?.agent.name ?? "Kadia"} ({snapshot?.agent.mode ?? "kadia"})
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300">
                      Etapa atual: {snapshot?.agent.currentStage ?? "sem execucao ativa"}
                    </span>
                  </div>

                  <PixelControlRoom
                    agentName={snapshot?.agent.name ?? "Kadia"}
                    steps={snapshot?.agent.steps ?? []}
                  />

                  <div className="mt-5 space-y-3">
                    {(snapshot?.agent.steps ?? []).map((step, index) => (
                      <div key={step.id} className={["rounded-2xl border p-4", getAgentStepClass(step)].join(" ")}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <PixelAgentSprite frameSeed={index} status={step.status} />
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-xs font-semibold">
                                {index + 1}
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{step.title}</div>
                                <div className="mt-1 text-sm opacity-90">{step.description}</div>
                                {step.detail ? <div className="mt-2 text-xs opacity-80">Detalhe: {step.detail}</div> : null}
                              </div>
                            </div>
                          </div>
                          <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-xs">
                            {getAgentStepLabel(step)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-4 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl max-lg:col-span-12">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Resumo do Agente</div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-emerald-200">Concluidas</div>
                      <div className="mt-2 text-3xl font-semibold">
                        {snapshot?.agent.steps.filter((step) => step.status === "completed").length ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-amber-200">Em execucao</div>
                      <div className="mt-2 text-3xl font-semibold">
                        {snapshot?.agent.steps.filter((step) => step.status === "running").length ?? 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-rose-200">Bloqueadas</div>
                      <div className="mt-2 text-3xl font-semibold">
                        {snapshot?.agent.steps.filter((step) => step.status === "blocked").length ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Proxima entrega</div>
                    <div className="mt-2">
                      Implementar `Agente 1`, `Validador 1`, `Agente 2` e `Validador 2` na pipeline real.
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {activeView === "list" ? (
              <>
                <div className="col-span-12 rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-glow backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.14em] text-slate-400">List</div>
                      <div className="mt-1 text-base font-semibold">Tela principal das NFs</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
                      {snapshot?.targetTasks.length ?? 0} NFs em foco
                    </div>
                  </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="text-left text-slate-400">
                            <th className="border-b border-white/10 px-2 py-2.5 font-medium">NF</th>
                            <th className="border-b border-white/10 px-2 py-2.5 font-medium">Fornecedor</th>
                            <th className="border-b border-white/10 px-2 py-2.5 font-medium">Status</th>
                            <th className="border-b border-white/10 px-2 py-2.5 font-medium">Data</th>
                            <th className="border-b border-white/10 px-2 py-2.5 font-medium">Acoes</th>
                            <th className="border-b border-white/10 px-2 py-2.5 font-medium">ID ClickUp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(snapshot?.targetTasks ?? []).map((task) => {
                            const meta = extractTaskMeta(task);
                            const isReprocessing = reprocessing.has(task.id);
                            const canDownload = Boolean(task.hasGeneratedFile && task.latestDownloadUrl && !isReprocessing);

                            return (
                              <tr
                                key={task.id}
                                className="transition hover:bg-white/[0.03]"
                              >
                                <td className="border-b border-white/10 px-2 py-3 align-middle">
                                  <div className="text-sm font-semibold text-slate-100">{meta.nf}</div>
                                </td>
                                <td className="border-b border-white/10 px-2 py-3 align-middle">
                                  <div className="text-sm font-medium text-slate-200">{meta.fornecedor}</div>
                                  <div className="text-[11px] text-slate-500">{task.name}</div>
                                </td>
                                <td className="border-b border-white/10 px-2 py-3 align-middle">
                                  <div className="flex flex-wrap gap-1.5">
                                    {[
                                      { label: "HTML", ok: task.hasHtml },
                                      { label: "CSV", ok: task.hasCsv },
                                      { label: "XML", ok: task.hasXml }
                                    ].map((item) => (
                                      <span
                                        key={item.label}
                                        className={[
                                          "inline-flex rounded-full border px-2 py-1 text-[10px] font-medium",
                                          item.ok
                                            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                                            : "border-rose-400/20 bg-rose-500/10 text-rose-300"
                                        ].join(" ")}
                                      >
                                        {item.label}: {item.ok ? "OK" : "FALTA"}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="border-b border-white/10 px-2 py-3 align-middle text-[11px] text-slate-300">{fmt(task.dateUpdated)}</td>
                                <td className="border-b border-white/10 px-2 py-3 align-middle">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      className={[
                                        "rounded-full border px-3 py-1.5 text-[11px] font-medium transition",
                                        canDownload
                                          ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20"
                                          : "border-white/10 bg-white/[0.03] text-slate-500",
                                        isReprocessing ? "cursor-not-allowed opacity-60" : ""
                                      ].join(" ")}
                                      disabled={!canDownload}
                                      onClick={() => {
                                        if (task.latestDownloadUrl && !isReprocessing) {
                                          window.location.href = task.latestDownloadUrl;
                                        }
                                      }}
                                      type="button"
                                    >
                                      Baixar
                                    </button>
                                    <button
                                      className="rounded-full border border-blue-400/20 bg-blue-500/12 px-3 py-1.5 text-[11px] font-medium text-blue-100 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                                      disabled={isReprocessing}
                                      onClick={() => {
                                        void handleReprocess(task.id);
                                      }}
                                      type="button"
                                    >
                                      {isReprocessing ? "Reprocessando..." : "Reprocessar"}
                                    </button>
                                  </div>
                                </td>
                                <td className="border-b border-white/10 px-2 py-3 align-middle text-[11px] text-slate-500">
                                  {task.id}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
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

            {activeView === "agCad" ? (
              <div className="col-span-12 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">AG-CAD</div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
                  O AG-CAD e o agente principal de estruturacao da planilha. Aqui vamos concentrar analise de parsing, alertas de estrutura e evolucao do fluxo inteligente.
                </div>
              </div>
            ) : null}

            {activeView === "agPrice" ? (
              <div className="col-span-12 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">AG-PRICE</div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
                  Area reservada para o agente de preco. Futuramente ele podera sugerir margem, preco de venda e validacoes comerciais.
                </div>
              </div>
            ) : null}

            {activeView === "settings" ? (
              <div className="col-span-12 rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-glow backdrop-blur-xl">
                <div className="text-xs uppercase tracking-[0.14em] text-slate-400">Configuracoes</div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
                  Espaco preparado para configuracoes da aplicacao, integracoes e parametros da automacao.
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

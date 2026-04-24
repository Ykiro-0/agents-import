import { useEffect, useMemo, useState } from "react";
import type { AgentPipelineStep } from "../types";

type HubAgentStatus = "working" | "idle" | "error";
type HubAgentColor = "matcha" | "amber" | "terracotta" | "crt-blue";

type HubTile = {
  x: number;
  y: number;
};

type HubAgent = {
  id: string;
  name: string;
  role: string;
  color: HubAgentColor;
  status: HubAgentStatus;
  cpu: number;
  ram: number;
  happiness: number;
  task: string;
  log: string[];
  tile: HubTile;
};

const HUB_TILES: HubTile[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 2, y: 1 }
];

const HUB_COLORS: HubAgentColor[] = ["matcha", "terracotta", "amber", "crt-blue"];

const STATUS_LABEL: Record<HubAgentStatus, string> = {
  working: "Trabalhando",
  idle: "Ocioso",
  error: "Bloqueado"
};

const STATUS_DOT: Record<HubAgentStatus, string> = {
  working: "bg-[#78b46a]",
  idle: "bg-[#e6b86d]",
  error: "bg-[#ef4444]"
};

const BODY_COLOR: Record<HubAgentColor, string> = {
  matcha: "bg-[#78b46a]",
  amber: "bg-[#e6b86d]",
  terracotta: "bg-[#db7f63]",
  "crt-blue": "bg-[#79a9d9]"
};

const HAIR_COLOR: Record<HubAgentColor, string> = {
  matcha: "bg-[#9fd08b]",
  amber: "bg-[#f3ce8c]",
  terracotta: "bg-[#e59a85]",
  "crt-blue": "bg-[#9bc3ea]"
};

const FALLBACK_STEPS: AgentPipelineStep[] = [
  {
    id: "slot-1",
    title: "Aguardando Pipeline",
    description: "Sem execucao ativa no momento.",
    status: "pending"
  },
  {
    id: "slot-2",
    title: "Aguardando Pipeline",
    description: "Sem execucao ativa no momento.",
    status: "pending"
  },
  {
    id: "slot-3",
    title: "Aguardando Pipeline",
    description: "Sem execucao ativa no momento.",
    status: "pending"
  }
];

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
}

function seedInRange(seed: number, min: number, max: number): number {
  const span = max - min + 1;
  return min + (seed % span);
}

function toHubStatus(status: AgentPipelineStep["status"]): HubAgentStatus {
  if (status === "running") return "working";
  if (status === "blocked") return "error";
  return "idle";
}

function shorten(text: string, max = 16): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

function buildAgentsFromSteps(steps: AgentPipelineStep[]): HubAgent[] {
  const source = (steps.length ? steps : FALLBACK_STEPS).slice(0, HUB_TILES.length);

  return source.map((step, index) => {
    const seed = hashSeed(`${step.id}-${step.title}-${index}`);
    const status = toHubStatus(step.status);

    const cpuBase = status === "working" ? [72, 95] : status === "error" ? [45, 70] : [8, 28];
    const ramBase = status === "working" ? [56, 88] : status === "error" ? [35, 68] : [18, 42];
    const moodBase = status === "working" ? [74, 100] : status === "error" ? [24, 52] : [60, 88];

    return {
      id: step.id,
      name: shorten(step.title.toUpperCase().replace(/\s+/g, " "), 14),
      role: `Etapa ${index + 1}`,
      color: HUB_COLORS[index % HUB_COLORS.length],
      status,
      cpu: seedInRange(seed, cpuBase[0], cpuBase[1]),
      ram: seedInRange(seed >> 3, ramBase[0], ramBase[1]),
      happiness: seedInRange(seed >> 7, moodBase[0], moodBase[1]),
      task: step.detail ?? step.description,
      log: [
        `status: ${STATUS_LABEL[status].toLowerCase()}`,
        step.description,
        step.detail ?? "sem detalhe adicional"
      ],
      tile: HUB_TILES[index]
    };
  });
}

function StatBar({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono-pixel uppercase">{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 w-full border border-[#1d2b3a] bg-[#0b1118] p-[2px]">
        <div className={cx("h-full transition-all duration-300", colorClass)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PixelAgentSprite({
  agent,
  selected,
  onClick
}: {
  agent: HubAgent;
  selected: boolean;
  onClick: () => void;
}) {
  const bubbleText =
    agent.status === "idle" ? "idle" : agent.status === "error" ? "preciso de input" : agent.name;

  return (
    <button
      aria-label={`Selecionar ${agent.name}`}
      className="group relative flex cursor-pointer flex-col items-center outline-none"
      onClick={onClick}
      type="button"
    >
      <div
        className={cx(
          "absolute -top-7 z-20 whitespace-nowrap border border-[#1d2b3a] bg-[#f1e7d2] px-1.5 py-0.5 text-[10px] font-mono-pixel leading-none text-[#101010]",
          "opacity-0 transition-opacity group-hover:opacity-100",
          selected && "opacity-100",
          agent.status === "error" && "bg-[#ef4444] text-white opacity-100",
          agent.status === "idle" && "opacity-100"
        )}
      >
        {bubbleText}
      </div>

      <div className={cx("relative flex flex-col items-center", agent.status === "working" && "pixel-bob")}>
        <div className={cx("h-[6px] w-6 border border-[#101827]", HAIR_COLOR[agent.color])} />
        <div className="relative -mt-px flex h-5 w-6 items-center justify-center gap-1 border border-[#101827] border-t-0 bg-[#f5d0ab]">
          {agent.status === "idle" ? (
            <>
              <span className="h-px w-1 bg-[#101827]" />
              <span className="h-px w-1 bg-[#101827]" />
            </>
          ) : agent.status === "error" ? (
            <>
              <span className="text-[8px] font-bold leading-none text-[#101827]">x</span>
              <span className="text-[8px] font-bold leading-none text-[#101827]">x</span>
            </>
          ) : (
            <>
              <span className="h-1 w-1 bg-[#101827]" />
              <span className="h-1 w-1 bg-[#101827]" />
            </>
          )}
        </div>
        <div className="h-[2px] w-2 border-x border-[#101827] bg-[#e9bf96]" />
        <div className={cx("relative h-5 w-8 border border-[#101827]", BODY_COLOR[agent.color])}>
          <span className={cx("absolute left-[3px] top-[3px] h-3 w-[3px]", HAIR_COLOR[agent.color])} />
          <span className="absolute left-1/2 top-1 h-3 w-px -translate-x-1/2 bg-[#101827]/70" />
        </div>
        <div className="flex gap-[2px]">
          <span className="h-2 w-[10px] border border-[#101827] bg-[#101827]" />
          <span className="h-2 w-[10px] border border-[#101827] bg-[#101827]" />
        </div>
      </div>

      <div className="mt-[2px] h-1 w-8 rounded-full bg-black/30 blur-[1px]" />
      {selected ? <div className="absolute -bottom-[2px] h-2 w-10 rounded-full border border-[#db7f63]" /> : null}
    </button>
  );
}

function IsometricRoom({
  agents,
  selectedId,
  onSelect
}: {
  agents: HubAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-[#1d2b3a] bg-[#0f1720]">
      <div className="absolute inset-x-0 top-0 h-1/2 border-b border-[#101827] bg-[#d9c7a4]">
        <div className="absolute bottom-0 h-6 w-full border-t border-[#101827] bg-[#9e6d3f]" />
        <div className="absolute left-[12%] top-6 h-20 w-32 border-2 border-[#101827] bg-[#8db2d6]" />
        <div className="absolute right-[14%] top-8 flex h-28 w-24 flex-col items-center justify-center gap-2 border-2 border-[#101827] bg-[#f1e7d2]">
          <div className="h-10 w-10 rounded-full border border-[#101827] bg-[#78b46a]" />
          <div className="font-mono-pixel text-sm text-[#101827]">AGENTS</div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#7f4f2a]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,24,39,0.2)_2px,transparent_2px),linear-gradient(90deg,rgba(16,24,39,0.2)_2px,transparent_2px)] bg-[length:72px_72px]" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%)] bg-[length:100%_4px]" />

      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-x-12 gap-y-4 px-8 pb-12 pt-[17%]">
        {HUB_TILES.map((tile) => {
          const agent = agents.find((item) => item.tile.x === tile.x && item.tile.y === tile.y);
          return (
            <div key={`${tile.x}-${tile.y}`} className="relative flex items-end justify-center">
              <div className="relative h-20 w-32">
                <div className="absolute -top-14 left-1/2 flex h-14 w-16 -translate-x-1/2 items-center justify-center border-2 border-[#101827] bg-[#d9c7a4]">
                  <div className="h-10 w-12 overflow-hidden bg-[#101827] p-1">
                    <div className="font-mono-pixel text-[8px] leading-tight text-[#9fd08b]">
                      {agent ? (
                        <>
                          <div>{">"} {shorten(agent.name, 10)}</div>
                          <div>{shorten(agent.task, 10)}</div>
                          <div className="cursor-blink">_</div>
                        </>
                      ) : (
                        <>
                          <div>{">"} aguardando</div>
                          <div>{">"} slot livre</div>
                          <div className="cursor-blink">_</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 h-2 w-4 -translate-x-1/2 border border-[#101827] bg-[#d9c7a4]" />
                </div>
                <div className="absolute bottom-6 inset-x-0 h-3 border border-[#101827] bg-[#8f5f33]" />
                <div className="absolute bottom-0 left-1 h-6 w-2 border border-[#101827] bg-[#8f5f33]" />
                <div className="absolute bottom-0 right-1 h-6 w-2 border border-[#101827] bg-[#8f5f33]" />
              </div>

              {agent ? (
                <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-2">
                  <PixelAgentSprite agent={agent} onClick={() => onSelect(agent.id)} selected={selectedId === agent.id} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="absolute left-4 top-4 z-10 border border-[#101827] bg-[#f1e7d2] px-3 py-1 text-[#101827]">
        <div className="pixel-title uppercase leading-none">Sala dos Agentes</div>
        <div className="font-mono-pixel text-xs leading-none text-[#334155]">{agents.length}/6 ocupada</div>
      </div>
    </div>
  );
}

function AgentInspector({ agent }: { agent: HubAgent | null }) {
  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-300">
        Selecione um agente na sala.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#1d2b3a] bg-[#f1e7d2] p-4 text-[#101827]">
        <div className="flex items-start gap-3">
          <div className="h-16 w-16 flex-shrink-0 border border-[#101827] bg-white/70">
            <div className="flex h-full items-end justify-center pb-1">
              <PixelAgentSprite agent={agent} onClick={() => undefined} selected={false} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="pixel-title truncate text-base uppercase">{agent.name}</div>
            <div className="mt-1 text-xs opacity-70">{agent.role}</div>
            <span className="mt-2 inline-flex items-center gap-1 rounded border border-[#101827] bg-[#d9c7a4] px-2 py-0.5 text-[10px] uppercase">
              <span className={cx("h-2 w-2 rounded-full", STATUS_DOT[agent.status])} />
              {STATUS_LABEL[agent.status]}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3 border-b border-[#1d2b3a] p-4">
        <StatBar colorClass="bg-[#db7f63]" label="CPU" value={agent.cpu} />
        <StatBar colorClass="bg-[#78b46a]" label="RAM" value={agent.ram} />
        <StatBar colorClass="bg-[#e6b86d]" label="Confianca" value={agent.happiness} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">Log</div>
        <div className="min-h-[160px] flex-1 overflow-y-auto border border-[#1d2b3a] bg-[#0b1118] p-3 text-sm text-[#9fd08b]">
          {agent.log.map((line) => (
            <div key={line} className="font-mono-pixel leading-tight">
              <span className="text-[#e6b86d]">{">"}</span> {line}
            </div>
          ))}
          <div className="font-mono-pixel leading-tight">
            <span className="text-[#e6b86d]">{">"}</span> <span className="cursor-blink">_</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PixelAgentHub({
  agentName,
  currentStage,
  steps
}: {
  agentName: string;
  currentStage?: string;
  steps: AgentPipelineStep[];
}) {
  const agentsFromSteps = useMemo(() => buildAgentsFromSteps(steps), [steps]);
  const [agents, setAgents] = useState<HubAgent[]>(agentsFromSteps);
  const [selectedId, setSelectedId] = useState<string | null>(agentsFromSteps[0]?.id ?? null);

  useEffect(() => {
    setAgents(agentsFromSteps);
  }, [agentsFromSteps]);

  useEffect(() => {
    if (agents.length === 0) {
      setSelectedId(null);
      return;
    }

    const exists = selectedId ? agents.some((agent) => agent.id === selectedId) : false;
    if (!exists) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          if (agent.status !== "working") return agent;
          return {
            ...agent,
            cpu: clamp(agent.cpu + (Math.random() > 0.5 ? 2 : -2), 60, 99),
            ram: clamp(agent.ram + (Math.random() > 0.5 ? 1 : -1), 48, 95)
          };
        })
      );
    }, 1900);

    return () => window.clearInterval(timer);
  }, []);

  const selected = agents.find((agent) => agent.id === selectedId) ?? null;
  const runningCount = agents.filter((agent) => agent.status === "working").length;
  const blockedCount = agents.filter((agent) => agent.status === "error").length;
  const idleCount = agents.filter((agent) => agent.status === "idle").length;

  return (
    <div className="pixel-hub">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1d2b3a] bg-[#0b1118] p-3">
        <div>
          <div className="pixel-title text-sm uppercase text-[#d7c7aa]">{agentName}</div>
          <div className="mt-1 text-xs text-slate-400">Etapa atual: {currentStage ?? "sem execucao ativa"}</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-emerald-100">
            Running: {runningCount}
          </span>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-amber-100">
            Idle: {idleCount}
          </span>
          <span className="rounded-full border border-rose-400/30 bg-rose-500/15 px-3 py-1 text-rose-100">
            Blocked: {blockedCount}
          </span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <IsometricRoom agents={agents} onSelect={setSelectedId} selectedId={selectedId} />
        <div className="rounded-2xl border border-[#1d2b3a] bg-[#111827]">
          <AgentInspector agent={selected} />
        </div>
      </div>
    </div>
  );
}

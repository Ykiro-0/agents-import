import type { CSSProperties } from "react";

type ManualPipelineStage = "idle" | "drop" | "carry" | "desk" | "working" | "celebrate";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

const CONFETTI_COLORS = ["#22c55e", "#f59e0b", "#38bdf8", "#f43f5e", "#fde047", "#34d399"];

const CONFETTI_PARTICLES = Array.from({ length: 26 }, (_, index) => ({
  id: index,
  left: `${6 + ((index * 37) % 88)}%`,
  delayMs: (index * 75) % 420,
  durationMs: 980 + ((index * 113) % 760),
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  drift: `${((index % 2 === 0 ? 1 : -1) * (8 + (index % 5) * 3)).toFixed(0)}px`
}));

function getStatusLabel(stage: ManualPipelineStage): string {
  if (stage === "drop") return "Pacote chegando do ceu...";
  if (stage === "carry") return "Agente levando a planilha para a mesa...";
  if (stage === "working") return "Agente trabalhando na planilha...";
  if (stage === "celebrate") return "Planilha pronta. Download liberado.";
  if (stage === "desk") return "Planilha posicionada na mesa.";
  return "Aguardando planilha.";
}

export function ManualPipelineScene({ stage }: { stage: ManualPipelineStage }) {
  return (
    <div className="manual-pipeline-scene">
      <div className="manual-pipeline-scene__backdrop" />
      <div className="manual-pipeline-scene__floor" />

      <div className={cx("manual-pipeline-scene__desk", (stage === "working" || stage === "celebrate") && "is-working")}>
        <div className="manual-pipeline-scene__monitor" />
      </div>

      <div className={cx("manual-pipeline-scene__agent", `stage-${stage}`, stage === "working" && "is-working")}>
        <span className="manual-pipeline-scene__head" />
        <span className="manual-pipeline-scene__body" />
        <span className="manual-pipeline-scene__leg left" />
        <span className="manual-pipeline-scene__leg right" />
      </div>

      <div className={cx("manual-pipeline-scene__block", `stage-${stage}`)} />

      {stage === "working" ? (
        <div className="manual-pipeline-scene__bubble">
          <span className="dot">.</span>
          <span className="dot">.</span>
          <span className="dot">.</span>
        </div>
      ) : null}

      {stage === "celebrate" ? (
        <div className="manual-pipeline-scene__confetti" aria-hidden="true">
          {CONFETTI_PARTICLES.map((particle) => (
            <span
              key={particle.id}
              className="manual-pipeline-scene__confetti-piece"
              style={
                {
                  left: particle.left,
                  backgroundColor: particle.color,
                  animationDelay: `${particle.delayMs}ms`,
                  animationDuration: `${particle.durationMs}ms`,
                  "--drift-x": particle.drift
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <div className="manual-pipeline-scene__status">{getStatusLabel(stage)}</div>
    </div>
  );
}

export type { ManualPipelineStage };

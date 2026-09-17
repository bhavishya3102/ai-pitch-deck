import type { Stage } from "../lib/pipeline.ts";

const MARKERS = { done: "✓", failed: "✕", active: "", waiting: "" } as const;

export function Pipeline({ stages }: { stages: Stage[] }) {
  return (
    <ol className="pipeline" aria-label="Generation pipeline">
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          className="stage"
          data-state={stage.state}
          style={{ animationDelay: `${index * 70}ms` }}
          aria-current={stage.state === "active" ? "step" : undefined}
        >
          <span className="stage-node" aria-hidden>
            {MARKERS[stage.state] || String(index + 1).padStart(2, "0")}
          </span>
          <div className="stage-body">
            <span className="stage-label">{stage.label}</span>
            <code className="stage-step">{stage.step}</code>
            <span className="stage-detail">{stage.detail}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

import { buildPipeline } from "../lib/pipeline.ts";
import { Pipeline } from "./Pipeline.tsx";

export function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-copy">
        <span className="eyebrow">How it works</span>
        <h1 className="empty-title">
          One idea in.
          <br />
          <em>A whole deck</em> out.
        </h1>
        <p className="empty-lede">
          Write your startup idea on the left. An Inngest job picks it up, an OpenAI agent writes the slides, every
          slide gets its own image on ImageKit, and you can watch each step happen here.
        </p>
      </div>
      <div className="empty-pipeline">
        <Pipeline stages={buildPipeline(null)} />
      </div>
    </div>
  );
}

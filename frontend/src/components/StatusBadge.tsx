import type { DeckStatus } from "../lib/types.ts";

const LABELS: Record<DeckStatus, string> = {
  PENDING: "Queued",
  GENERATING: "Generating",
  COMPLETE: "Complete",
  FAILED: "Failed",
};

export function StatusBadge({ status }: { status: DeckStatus }) {
  return (
    <span className="badge" data-status={status}>
      <span className="badge-dot" aria-hidden />
      {LABELS[status]}
    </span>
  );
}

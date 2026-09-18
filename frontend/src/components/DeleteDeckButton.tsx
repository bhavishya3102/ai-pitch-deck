import { useEffect, useState } from "react";

import { ApiError, useDeleteDeck } from "../lib/api.ts";

type Props = {
  deckId: string;
  running: boolean;
  onDeleted: (id: string) => void;
  /** "icon" = small button in the deck list, "full" = labelled button in the deck header */
  variant: "icon" | "full";
};

/** Two-click delete: first click asks to confirm, second click deletes. */
export function DeleteDeckButton({ deckId, running, onDeleted, variant }: Props) {
  const [confirming, setConfirming] = useState(false);
  const deleteDeck = useDeleteDeck(onDeleted);

  // Drop back out of confirm mode if the user doesn't follow through
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setConfirming(false);
    deleteDeck.mutate(deckId);
  }

  const idleLabel = running ? "Stop & delete" : "Delete";
  const label = deleteDeck.isPending ? "Deleting…" : confirming ? "Confirm?" : idleLabel;
  const failed = deleteDeck.isError && !(deleteDeck.error instanceof ApiError && deleteDeck.error.status === 404);

  return (
    <span className="delete-wrap">
      <button
        type="button"
        className={`delete-button delete-${variant}`}
        data-confirming={confirming}
        disabled={deleteDeck.isPending}
        onClick={handleClick}
        aria-label={variant === "icon" ? `${label} deck` : undefined}
        title={variant === "icon" ? label : undefined}
      >
        {variant === "icon" ? (confirming ? "Confirm?" : <TrashIcon />) : label}
      </button>
      {failed && variant === "full" && (
        <span className="delete-error" role="alert">
          {deleteDeck.error.message}
        </span>
      )}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

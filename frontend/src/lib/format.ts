const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return relative.format(seconds, "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86400), "day");
}

export function duration(fromIso: string, toMs: number): string {
  const total = Math.max(0, Math.round((toMs - new Date(fromIso).getTime()) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/** Agent writes content as "• point" lines — split them into a list. */
export function toBullets(content: string): string[] {
  return content
    .split(/\n|(?=•)/)
    .map((line) => line.replace(/^[•\-\s]+/, "").trim())
    .filter(Boolean);
}

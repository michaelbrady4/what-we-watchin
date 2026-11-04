import type { Phase } from "@/lib/types";
import { nightStatusKey, nightStatusLabel } from "@/lib/text";

export function StatusPill({ status, spinning = false }: { status: Phase; spinning?: boolean }) {
  const key = nightStatusKey(status, spinning);
  return (
    <span className="status-pill" data-status={key}>
      {status !== "complete" ? <span className="lamp" aria-hidden="true" /> : null}
      {nightStatusLabel(status, spinning)}
    </span>
  );
}

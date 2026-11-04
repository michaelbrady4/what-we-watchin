"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { nightStatusLabel } from "@/lib/text";
import { useTrackedNights } from "./useTrackedNights";

export function ReturnBar() {
  const pathname = usePathname();
  const nights = useTrackedNights();
  const here = (pathname ?? "").replace(/\/$/, "");
  const live = (nights ?? []).filter((night) => night.status !== "complete");
  const visible = live.filter((night) => here !== `/s/${night.code}`);
  const card = visible[0];
  if (!card) return null;

  return (
    <Link className="return-bar" href={`/s/${card.code}`} data-testid="return-bar">
      <span className="return-copy">
        <span className="return-kicker">
          <span className="lamp" aria-hidden="true" />
          Back to your night
        </span>
        <span className="return-name">{card.displayName}</span>
      </span>
      <span className="return-status">
        {nightStatusLabel(card.status, card.spinning)}
        {live.length > 1 ? <small>{live.length} live</small> : null}
      </span>
    </Link>
  );
}

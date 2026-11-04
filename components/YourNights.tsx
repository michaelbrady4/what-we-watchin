"use client";

import Link from "next/link";
import { StatusPill } from "./StatusPill";
import { useTrackedNights } from "./useTrackedNights";

export function YourNights() {
  const nights = useTrackedNights();
  if (!nights || nights.length === 0) return null;

  return (
    <section className="yours" data-testid="your-nights" aria-label="Your nights">
      <h2 className="section-label">Your nights</h2>
      <div>
        {nights.map((night) => (
          <Link className="your-night" key={night.code} href={`/s/${night.code}`}>
            <strong>{night.displayName}</strong>
            <StatusPill status={night.status} spinning={night.spinning} />
          </Link>
        ))}
      </div>
    </section>
  );
}

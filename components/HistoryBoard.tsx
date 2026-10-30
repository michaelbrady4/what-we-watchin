"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HistoryNight } from "@/lib/types";
import { formatNight } from "@/lib/text";
import { api } from "./api";
import { SiteHeader } from "./SiteHeader";

export function HistoryBoard() {
  const [nights, setNights] = useState<HistoryNight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    api<{ nights?: HistoryNight[]; message?: string }>("/api/history")
      .then(({ ok, data }) => {
        if (stop) return;
        if (!ok || !data.nights) {
          setError(data.message ?? "Could not load past nights.");
          setNights([]);
          return;
        }
        setNights(data.nights);
      })
      .catch(() => {
        if (!stop) {
          setError("Could not load past nights.");
          setNights([]);
        }
      });
    return () => {
      stop = true;
    };
  }, []);

  return (
    <main className="sheet">
      <SiteHeader />
      <h1>Past nights</h1>
      <p className="lede">Winners from nights you already settled.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {nights === null ? <p className="quiet">Looking back...</p> : null}
      {nights && nights.length === 0 && !error ? (
        <p className="quiet">
          No winners yet. The wheel has not crowned anything. <Link href="/">Start a night</Link>
        </p>
      ) : null}
      <div>
        {nights?.map((night) => (
          <Link className="night" key={night.code} href={`/s/${night.code}`}>
            <time dateTime={night.completedAt ?? night.createdAt}>
              {formatNight(night.completedAt ?? night.createdAt)}
            </time>
            <span>
              <strong>{night.winnerTitle}</strong>
              <em>added by {night.addedBy}</em>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

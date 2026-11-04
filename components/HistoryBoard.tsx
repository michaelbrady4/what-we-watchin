"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HistoryNight, NightCard } from "@/lib/types";
import { formatNight } from "@/lib/text";
import { api } from "./api";
import { SiteHeader } from "./SiteHeader";
import { StatusPill } from "./StatusPill";

export function HistoryBoard() {
  const [nights, setNights] = useState<HistoryNight[] | null>(null);
  const [live, setLive] = useState<NightCard[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;

    async function load() {
      try {
        const { ok, data } = await api<{ nights?: HistoryNight[]; live?: NightCard[]; message?: string }>(
          "/api/history",
        );
        if (stop) return;
        if (!ok || !data.nights) {
          setError(data.message ?? "Could not load past nights.");
          setNights((current) => current ?? []);
          return;
        }
        setError(null);
        setNights(data.nights);
        setLive(data.live ?? []);
      } catch {
        if (!stop) {
          setError("Could not load past nights.");
          setNights((current) => current ?? []);
        }
      }
    }

    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <main className="sheet">
      <SiteHeader />
      <h1>Past nights</h1>
      <p className="lede">Rooms still in motion, then the winners you already settled.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {nights === null ? <p className="quiet">Looking back...</p> : null}
      {live.length > 0 ? (
        <section data-testid="happening-now" aria-label="Happening now">
          <h2 className="subhead">Happening now</h2>
          <div>
            {live.map((night) => (
              <Link className="night" key={night.code} href={`/s/${night.code}`}>
                <time dateTime={night.createdAt}>{formatNight(night.createdAt)}</time>
                <span>
                  <strong>{night.displayName}</strong>
                  <StatusPill status={night.status} spinning={night.spinning} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {live.length > 0 && nights && nights.length > 0 ? <h2 className="subhead">Settled</h2> : null}
      {nights && nights.length === 0 && live.length === 0 && !error ? (
        <p className="quiet">
          No winners yet. The wheel has not crowned anything. <Link href="/">Start a night</Link>
        </p>
      ) : null}
      {nights && nights.length === 0 && live.length > 0 && !error ? (
        <p className="quiet">No settled nights yet.</p>
      ) : null}
      <div>
        {nights?.map((night) => (
          <Link className="night" key={night.code} href={`/s/${night.code}`}>
            <time dateTime={night.completedAt ?? night.createdAt}>
              {formatNight(night.completedAt ?? night.createdAt)}
            </time>
            <span>
              <strong>{night.winnerTitle}</strong>
              <em>
                {night.displayName}
                <span aria-hidden="true"> · </span>
                added by {night.addedBy}
              </em>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}

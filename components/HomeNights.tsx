"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { NightCard } from "@/lib/types";
import { api } from "./api";
import { StatusPill } from "./StatusPill";
import { useTrackedNights } from "./useTrackedNights";

function useOpenNights() {
  const [nights, setNights] = useState<NightCard[] | null>(null);

  useEffect(() => {
    let stop = false;

    async function load() {
      try {
        const { ok, data } = await api<{ nights?: NightCard[] }>("/api/open-nights");
        if (stop) return;
        if (!ok || !data.nights) {
          setNights((current) => current ?? []);
          return;
        }
        setNights(data.nights.filter((night) => night.status === "open"));
      } catch {
        if (!stop) setNights((current) => current ?? []);
      }
    }

    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 4000);
    const onFocus = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      stop = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return nights;
}

export function HomeNights() {
  const open = useOpenNights();
  const tracked = useTrackedNights();
  const openList = open ?? [];
  const openCodes = new Set(openList.map((night) => night.code));
  const yours = open === null ? [] : (tracked ?? []).filter((night) => !openCodes.has(night.code));

  return (
    <>
      {openList.length > 0 ? (
        <section className="yours" data-testid="open-nights" aria-label="Open nights">
          <h2 className="section-label">Open nights</h2>
          <div>
            {openList.map((night) => (
              <Link className="your-night" key={night.code} href={`/s/${night.code}`}>
                <strong>{night.displayName}</strong>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      {yours.length > 0 ? (
        <section className="yours" data-testid="your-nights" aria-label="Your nights">
          <h2 className="section-label">Your nights</h2>
          <div>
            {yours.map((night) => (
              <Link className="your-night" key={night.code} href={`/s/${night.code}`}>
                <strong>{night.displayName}</strong>
                <StatusPill status={night.status} spinning={night.spinning} />
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

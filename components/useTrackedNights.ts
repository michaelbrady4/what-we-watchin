"use client";

import { useEffect, useState } from "react";
import type { NightCard } from "@/lib/types";
import { api } from "./api";
import { forgetNights, readNights, NIGHTS_EVENT } from "./remember";

const listeners = new Set<(nights: NightCard[] | null) => void>();
let snapshot: NightCard[] | null = null;
let timer = 0;
let request = 0;

function publish(next: NightCard[] | null) {
  snapshot = next;
  for (const listener of listeners) listener(next);
}

async function refresh() {
  const ticket = ++request;
  const remembered = readNights();
  if (remembered.length === 0) {
    if (ticket === request) publish([]);
    return;
  }
  try {
    const codes = remembered.map((night) => night.code).join(",");
    const { ok, data } = await api<{ nights?: NightCard[] }>(`/api/nights?codes=${encodeURIComponent(codes)}`);
    if (ticket !== request) return;
    if (!ok || !data.nights) return;
    const found = new Map(data.nights.map((night) => [night.code, night]));
    const ordered = remembered.flatMap((night) => {
      const card = found.get(night.code);
      return card ? [card] : [];
    });
    const missing = remembered.filter((night) => !found.has(night.code)).map((night) => night.code);
    if (missing.length > 0) forgetNights(missing);
    if (ticket === request) publish(ordered);
  } catch {
    // Keep the last list. The next poll tries again.
  }
}

function onWake() {
  if (!document.hidden) void refresh();
}

function ensurePolling() {
  if (timer !== 0 || typeof window === "undefined") return;
  void refresh();
  timer = window.setInterval(onWake, 4000);
  window.addEventListener("focus", onWake);
  window.addEventListener(NIGHTS_EVENT, onWake);
  document.addEventListener("visibilitychange", onWake);
}

function stopPolling() {
  if (listeners.size > 0 || timer === 0) return;
  window.clearInterval(timer);
  timer = 0;
  window.removeEventListener("focus", onWake);
  window.removeEventListener(NIGHTS_EVENT, onWake);
  document.removeEventListener("visibilitychange", onWake);
}

export function useTrackedNights() {
  const [nights, setNights] = useState<NightCard[] | null>(snapshot);
  useEffect(() => {
    listeners.add(setNights);
    setNights(snapshot);
    ensurePolling();
    return () => {
      listeners.delete(setNights);
      stopPolling();
    };
  }, []);
  return nights;
}

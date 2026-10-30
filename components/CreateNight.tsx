"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

export function CreateNight() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { ok, data } = await api<{ code?: string; message?: string }>("/api/sessions", { method: "POST" });
      if (!ok || !data.code) {
        setError(data.message ?? "Could not start a night.");
        setPending(false);
        return;
      }
      router.push(`/s/${data.code}`);
    } catch {
      setError("Could not start a night.");
      setPending(false);
    }
  }

  return (
    <div>
      <button className="btn btn-remote" type="button" onClick={start} disabled={pending}>
        {pending ? "Starting..." : "Start a night"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

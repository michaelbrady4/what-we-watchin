"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NIGHT_NAME_MAX } from "@/lib/text";
import { api } from "./api";
import { rememberNight } from "./remember";

export function CreateNight() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nightName, setNightName] = useState("");

  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { ok, data } = await api<{ code?: string; message?: string }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ name: nightName }),
      });
      if (!ok || !data.code) {
        setError(data.message ?? "Could not start a night.");
        setPending(false);
        return;
      }
      rememberNight(data.code);
      router.push(`/s/${data.code}`);
    } catch {
      setError("Could not start a night.");
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void start();
  }

  return (
    <form className="start-stack" onSubmit={onSubmit}>
      <label className="field">
        <span>Night name (optional)</span>
        <input
          value={nightName}
          onChange={(event) => setNightName(event.target.value)}
          placeholder="Friday night picks"
          maxLength={NIGHT_NAME_MAX}
          autoComplete="off"
          disabled={pending}
        />
      </label>
      <button className="btn btn-remote" type="submit" disabled={pending}>
        {pending ? "Starting..." : "Start a night"}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

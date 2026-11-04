"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isSessionCode } from "@/lib/codes";
import { api } from "./api";
import { rememberNight } from "./remember";

export function JoinNight() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const cleaned = code.trim().toLowerCase();
    if (!cleaned) {
      setError("Enter a room code.");
      return;
    }
    if (!isSessionCode(cleaned)) {
      setError("Room codes are 4 characters, like qb7g.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { ok, status, data } = await api<{ message?: string }>(`/api/sessions/${cleaned}`);
      if (status === 404) {
        setError("No night with that code. Check it and try again.");
        setPending(false);
        return;
      }
      if (!ok) {
        setError(data.message ?? "Could not look up that night.");
        setPending(false);
        return;
      }
      rememberNight(cleaned);
      router.push(`/s/${cleaned}`);
    } catch {
      setError("Could not look up that night.");
      setPending(false);
    }
  }

  return (
    <div className="join-wrap">
      <form className="join-box" onSubmit={onSubmit}>
        <label className="field">
          <span>Room code</span>
          <input
            value={code}
            onChange={(event) => {
              setCode(event.target.value.toLowerCase().replace(/\s+/g, "").slice(0, 8));
              setError(null);
            }}
            placeholder="qb7g"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            inputMode="text"
            disabled={pending}
          />
        </label>
        <button className="btn btn-join" type="submit" disabled={pending} aria-busy={pending}>
          Join
        </button>
      </form>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { SessionView, ShowView } from "@/lib/types";
import { cleanName, cleanTitle } from "@/lib/text";
import { api } from "./api";
import { getSavedName, saveName } from "./device";
import { SiteHeader } from "./SiteHeader";
import { Wheel } from "./Wheel";

type ViewResponse = {
  view?: SessionView;
  message?: string;
  result?: string;
};

export function SessionRoom({ code }: { code: string }) {
  const [view, setView] = useState<SessionView | null>(null);
  const [receivedAt, setReceivedAt] = useState(() => Date.now());
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const nameDirty = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const applyView = useCallback((next: SessionView) => {
    setReceivedAt(Date.now());
    setView(next);
    setMissing(false);
    setOffline(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const { ok, status, data } = await api<ViewResponse>(`/api/sessions/${code}`);
      if (status === 404) {
        setMissing(true);
        return;
      }
      if (!ok || !data.view) {
        setOffline(true);
        if (!viewRef.current) setError(data.message ?? "Could not reach the wheel.");
        return;
      }
      if (!viewRef.current) setError(null);
      applyView(data.view);
    } catch {
      setOffline(true);
      if (!viewRef.current) setError("Could not reach the wheel.");
    }
  }, [applyView, code]);

  useEffect(() => {
    const saved = getSavedName();
    if (saved) {
      setName(saved);
      nameDirty.current = true;
    }
  }, []);

  useEffect(() => {
    if (!nameDirty.current && view?.you?.name) setName(view.you.name);
  }, [view?.you?.name]);

  useEffect(() => {
    let stop = false;
    let timer = 0;
    async function loop() {
      if (stop) return;
      await load();
      if (stop) return;
      const delay = document.hidden ? 4000 : 1500;
      timer = window.setTimeout(loop, delay);
    }
    void loop();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [load]);

  async function copyLink() {
    const url = `${window.location.origin}/s/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copy failed. The link is in the address bar.");
    }
  }

  async function join(nextName: string) {
    const cleaned = cleanName(nextName);
    if (!cleaned || view?.status === "complete") return;
    saveName(cleaned);
    const { data } = await api<ViewResponse>(`/api/sessions/${code}/join`, {
      method: "POST",
      body: JSON.stringify({ name: cleaned }),
    });
    if (data.view) applyView(data.view);
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const cleanedName = cleanName(name);
    const cleanedTitle = cleanTitle(title);
    if (!cleanedName) {
      setError("Enter a name, up to 24 characters.");
      return;
    }
    if (!cleanedTitle) {
      setError("Give the show a name, up to 60 characters.");
      return;
    }
    setPending("add");
    setError(null);
    saveName(cleanedName);
    const { ok, data } = await api<ViewResponse>(`/api/sessions/${code}/shows`, {
      method: "POST",
      body: JSON.stringify({ name: cleanedName, title: cleanedTitle }),
    });
    setPending(null);
    if (data.view) applyView(data.view);
    if (!ok) {
      setError(data.message ?? "Could not add that show.");
      return;
    }
    setTitle("");
  }

  async function onRemove(show: ShowView) {
    if (pending) return;
    setPending(show.id);
    setError(null);
    const { ok, data } = await api<ViewResponse>(`/api/sessions/${code}/shows/${show.id}`, { method: "DELETE" });
    setPending(null);
    if (data.view) applyView(data.view);
    if (!ok) setError(data.message ?? "Could not remove that show.");
  }

  async function onLock() {
    if (pending) return;
    setPending("lock");
    setError(null);
    const { ok, data } = await api<ViewResponse>(`/api/sessions/${code}/lock`, { method: "POST" });
    setPending(null);
    if (data.view) applyView(data.view);
    if (!ok) setError(data.message ?? "Could not lock the list.");
  }

  async function onSpin() {
    if (pending || view?.activeSpin) return;
    setPending("spin");
    setError(null);
    const { ok, data } = await api<ViewResponse>(`/api/sessions/${code}/spin`, { method: "POST" });
    setPending(null);
    if (data.view) applyView(data.view);
    if (!ok) setError(data.message ?? "Could not spin.");
  }

  if (missing) {
    return (
      <main className="sheet missing">
        <SiteHeader />
        <h1>Nothing on this channel.</h1>
        <p className="lede">That link does not match a night.</p>
        <Link className="nav-link" href="/">
          Start a night
        </Link>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="sheet">
        <SiteHeader />
        <p className="status-line">Getting the wheel...</p>
        {error ? <p className="form-error">{error}</p> : null}
      </main>
    );
  }

  const active = view.shows.filter((show) => !show.eliminated);
  const eliminated = view.shows
    .filter((show) => show.eliminated)
    .sort((a, b) => (a.eliminationOrder ?? 0) - (b.eliminationOrder ?? 0));
  const spinning = Boolean(view.activeSpin) || pending === "spin";
  const picksLeft = Math.max(0, 3 - (view.you?.showCount ?? 0));

  let statusLine = "Add shows. The wheel updates for everyone.";
  if (view.status === "locked" && view.activeSpin) statusLine = "Watch it go.";
  else if (view.status === "locked") statusLine = `${active.length} still on the wheel.`;
  else if (view.status === "complete") statusLine = "That is the one.";

  return (
    <main className="room" data-status={view.status}>
      <section className="panel">
        <SiteHeader />
        <div className="ticket">
          <div>
            <p className="ticket-label">Send this link</p>
            <p className="ticket-code">{view.code}</p>
          </div>
          <button className="btn btn-ink" type="button" onClick={copyLink}>
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <p className="status-line" aria-live="polite">
          {offline ? "Trying to reconnect." : statusLine}
        </p>

        {view.status === "complete" && view.winner ? (
          <div data-testid="winner">
            <div className="stamp">The pick</div>
            <p className="kicker winner-kicker">Tonight we watch</p>
            <h1 className="winner-title" data-testid="winner-title">
              {view.winner.title}
            </h1>
            <p className="winner-by">{view.winner.addedBy} put this on the list.</p>
          </div>
        ) : null}

        {view.status !== "complete" ? (
          <form onSubmit={onAdd}>
            <label className="field">
              <span>Your name</span>
              <input
                value={name}
                onChange={(event) => {
                  nameDirty.current = true;
                  setName(event.target.value);
                }}
                onBlur={() => {
                  void join(name);
                }}
                maxLength={24}
                autoComplete="nickname"
                placeholder="What do we call you?"
              />
            </label>
            {view.status === "open" && picksLeft > 0 ? (
              <label className="field">
                <span>Add a show</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={60}
                  placeholder="A show you will fight for"
                />
              </label>
            ) : null}
            {view.status === "open" && picksLeft > 0 ? (
              <button className="btn btn-block" type="submit" disabled={pending === "add"}>
                {pending === "add" ? "Adding..." : "Put it on the wheel"}
              </button>
            ) : null}
            {view.status === "open" ? (
              <p className="hint">
                {picksLeft === 0
                  ? "That is your 3. You can still pull one off before lock."
                  : "Up to 3 each. Titles show up live. Who added them stays hidden."}
              </p>
            ) : null}
          </form>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <p className="section-label">In the room</p>
        <p className="roster-names">
          {view.participants.length === 0
            ? "Waiting for names."
            : view.participants.map((person) => person.name).join(", ")}
        </p>

        {view.status !== "complete" && active.length > 0 ? (
          <>
            <p className="section-label">On the wheel</p>
            <div className="show-scroll">
              {active.map((show) => (
                <div className="show-row" key={show.id} data-testid="show-row">
                  <span className="pip" style={{ background: show.fill }} />
                  <strong>{show.title}</strong>
                  {show.mine && view.status === "open" ? (
                    <button
                      className="btn btn-text"
                      type="button"
                      onClick={() => void onRemove(show)}
                      disabled={pending === show.id}
                      aria-label={`Remove ${show.title}`}
                    >
                      Remove
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {eliminated.length > 0 ? (
          <>
            <p className="section-label">{view.status === "complete" ? "How we got here" : "Off the wheel"}</p>
            {eliminated.map((show) => (
              <div className="elim-row" key={show.id}>
                <b>{String(show.eliminationOrder ?? 0).padStart(2, "0")}</b>
                <div>
                  <strong>{show.title}</strong>
                  {view.status === "complete" && show.addedBy ? <small>added by {show.addedBy}</small> : null}
                </div>
              </div>
            ))}
          </>
        ) : null}
      </section>

      <section className="stage">
        <Wheel
          shows={active.map((show) => ({
            id: show.id,
            title: show.title,
            fill: show.fill,
            ink: show.ink,
          }))}
          activeSpin={view.activeSpin}
          spinAnimMs={view.spinAnimMs}
          serverNow={view.serverNow}
          receivedAt={receivedAt}
        />
        {view.status === "open" ? (
          <div className="action">
            <button
              className="btn btn-block"
              type="button"
              onClick={onLock}
              disabled={pending === "lock" || view.shows.length < 2}
            >
              {pending === "lock" ? "Locking..." : "Lock it in"}
            </button>
            <p className="hint">
              {view.shows.length < 2
                ? "Add at least two shows before locking."
                : "Anyone can lock once the group is ready."}
            </p>
          </div>
        ) : null}
        {view.status === "locked" ? (
          <div className="action">
            <button className="btn btn-block" type="button" onClick={onSpin} disabled={spinning}>
              {spinning ? "Watch it go" : "Give it a spin"}
            </button>
            <p className="hint">Anyone in the room can spin.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

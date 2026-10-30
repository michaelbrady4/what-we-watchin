"use client";

import { useEffect, useRef } from "react";
import {
  easeOutQuint,
  labelBudget,
  landingRotation,
  polar,
  sliceGeometry,
  truncateTitle,
  wedgePath,
} from "@/lib/wheel";

export type WheelSlice = {
  id: string;
  title: string;
  fill: string;
  ink: string;
};

type ActiveSpin = {
  showId: string;
  spinSeq: number;
  startedAt: number;
};

export function Wheel({
  shows,
  activeSpin,
  spinAnimMs,
  serverNow,
  receivedAt,
}: {
  shows: WheelSlice[];
  activeSpin: ActiveSpin | null;
  spinAnimMs: number;
  serverNow: number;
  receivedAt: number;
}) {
  const rotatorRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const skewRef = useRef(0);
  const showsRef = useRef(shows);
  const spinRef = useRef(activeSpin);
  skewRef.current = serverNow - receivedAt;
  showsRef.current = shows;
  spinRef.current = activeSpin;

  const ids = shows.map((show) => show.id).join("|");
  const spinKey = activeSpin ? `${activeSpin.spinSeq}:${activeSpin.showId}` : "still";

  useEffect(() => {
    const node = rotatorRef.current;
    const pointer = pointerRef.current;
    if (!node) return;

    const spin = spinRef.current;
    const current = showsRef.current;
    const index = spin ? current.findIndex((show) => show.id === spin.showId) : -1;
    if (!spin || index < 0 || current.length === 0) {
      node.style.transform = "rotate(0deg)";
      if (pointer) pointer.style.transform = "translateX(-50%) rotate(0deg)";
      return;
    }

    const target = landingRotation(index, current.length);
    const slice = 360 / current.length;
    let frame = 0;

    const tick = () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduced ? 0 : spinAnimMs;
      const now = Date.now() + skewRef.current;
      const t = duration <= 0 ? 1 : Math.min(1, Math.max(0, (now - spin.startedAt) / duration));
      const rotation = target * easeOutQuint(t);
      node.style.transform = `rotate(${rotation}deg)`;
      if (pointer) {
        const amp = reduced || t >= 1 ? 0 : 8 * (1 - t) ** 0.7;
        const wobble = Math.sin((rotation / slice) * Math.PI) * amp;
        pointer.style.transform = `translateX(-50%) rotate(${wobble}deg)`;
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(frame);
  }, [ids, spinAnimMs, spinKey]);

  if (shows.length === 0) {
    return (
      <div className="wheel-stack">
        <div className="empty-ring" />
        <p className="empty-copy">The wheel is empty.</p>
      </div>
    );
  }

  const names = shows.map((show) => show.title).join(", ");
  const budget = labelBudget(shows.length);
  const geom = sliceGeometry(shows.length);

  return (
    <div className="wheel-stack" data-testid="wheel" role="img" aria-label={`Wheel with ${names}`}>
      <div className="pointer" ref={pointerRef} aria-hidden="true">
        <svg viewBox="0 0 40 52">
          <path
            d="M20 50 L5 16 Q20 2 35 16 Z"
            fill="#E7A33A"
            stroke="#14110E"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="wheel-scale" key={ids}>
        <div className="wheel-rotator" ref={rotatorRef}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            {shows.length === 1 ? (
              <circle cx="50" cy="50" r="47.2" fill={shows[0]!.fill} />
            ) : (
              geom.map((slice, index) => (
                <path key={shows[index]!.id} d={wedgePath(slice.start, slice.end)} fill={shows[index]!.fill} />
              ))
            )}
            <circle cx="50" cy="50" r="47.2" fill="none" stroke="#14110e" strokeWidth="0.7" />
            <Labels shows={shows} budget={budget} />
          </svg>
        </div>
      </div>
      {shows.length > 1 ? <div className="hub" aria-hidden="true">{shows.length}</div> : null}
    </div>
  );
}

function Labels({
  shows,
  budget,
}: {
  shows: WheelSlice[];
  budget: { maxChars: number; font: number; mode: "upright" | "radial" };
}) {
  const geom = sliceGeometry(shows.length);
  return (
    <>
      {shows.map((show, index) => {
        const slice = geom[index]!;
        const text = truncateTitle(show.title, budget.maxChars);
        const style = {
          fontSize: budget.font,
          fontFamily: "var(--font-sans), sans-serif",
          fontWeight: 650,
        } as const;

        if (budget.mode === "upright" || shows.length === 1) {
          const spot = polar(50, 50, shows.length === 1 ? 0 : 30, slice.mid);
          return (
            <text
              key={show.id}
              x={shows.length === 1 ? 50 : spot.x}
              y={shows.length === 1 ? 52 : spot.y}
              fill={show.ink}
              textAnchor="middle"
              dominantBaseline="middle"
              style={style}
            >
              {text}
            </text>
          );
        }

        const left = slice.mid > 90 && slice.mid < 270;
        const from = polar(50, 50, left ? 43.5 : 18, slice.mid);
        const toward = polar(50, 50, left ? 18 : 43.5, slice.mid);
        const rot = (Math.atan2(toward.y - from.y, toward.x - from.x) * 180) / Math.PI;
        return (
          <text
            key={show.id}
            x={from.x}
            y={from.y}
            fill={show.ink}
            textAnchor="start"
            dominantBaseline="middle"
            transform={`rotate(${rot} ${from.x} ${from.y})`}
            style={style}
          >
            {text}
          </text>
        );
      })}
    </>
  );
}

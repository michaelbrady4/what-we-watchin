export type ShowRow = {
  id: string;
  eliminated: boolean;
  eliminationOrder: number | null;
};

export type Phase = "open" | "locked" | "complete";

export type SpinState = {
  status: Phase;
  winnerShowId: string | null;
  spinSeq: number;
  activeSpinShowId: string | null;
  activeSpinStartedAt: number | null;
  shows: ShowRow[];
};

export type SpinOutcome =
  | { type: "error"; error: "not_locked" | "need_two" }
  | { type: "replay"; showId: string; spinSeq: number; startedAt: number }
  | { type: "winner"; showId: string; spinSeq: number }
  | { type: "spin"; showId: string; spinSeq: number; startedAt: number };

export function remainingShows(shows: ShowRow[]): ShowRow[] {
  return shows.filter((show) => !show.eliminated);
}

export function pickIndex(count: number, rng: () => number): number {
  if (count <= 0) {
    throw new Error("Cannot pick from an empty wheel");
  }
  const raw = rng();
  const scaled = Math.floor(raw * count);
  if (scaled >= count) return count - 1;
  if (scaled < 0) return 0;
  return scaled;
}

export function settleState(state: SpinState, now: number, windowMs: number): SpinState {
  if (!state.activeSpinShowId || state.activeSpinStartedAt == null) return state;
  if (now < state.activeSpinStartedAt + windowMs) return state;

  const target = state.shows.find((show) => show.id === state.activeSpinShowId);
  if (!target || target.eliminated) {
    return {
      ...state,
      activeSpinShowId: null,
      activeSpinStartedAt: null,
    };
  }

  const nextOrder = Math.max(0, ...state.shows.map((show) => show.eliminationOrder ?? 0)) + 1;
  const shows = state.shows.map((show) =>
    show.id === target.id ? { ...show, eliminated: true, eliminationOrder: nextOrder } : show,
  );
  const left = shows.filter((show) => !show.eliminated);
  const finished = left.length === 1;

  return {
    ...state,
    shows,
    status: finished ? "complete" : state.status,
    winnerShowId: finished ? left[0]!.id : state.winnerShowId,
    activeSpinShowId: null,
    activeSpinStartedAt: null,
  };
}

export function decideSpin(
  state: SpinState,
  now: number,
  rng: () => number,
  windowMs: number,
): { state: SpinState; outcome: SpinOutcome } {
  const settled = settleState(state, now, windowMs);

  if (settled.status === "open") {
    return { state: settled, outcome: { type: "error", error: "not_locked" } };
  }

  if (
    settled.activeSpinShowId &&
    settled.activeSpinStartedAt != null &&
    now < settled.activeSpinStartedAt + windowMs
  ) {
    return {
      state: settled,
      outcome: {
        type: "replay",
        showId: settled.activeSpinShowId,
        spinSeq: settled.spinSeq,
        startedAt: settled.activeSpinStartedAt,
      },
    };
  }

  const left = remainingShows(settled.shows);
  if (settled.status === "complete" || left.length <= 1) {
    const winnerId = settled.winnerShowId ?? left[0]?.id ?? null;
    if (!winnerId) {
      return { state: settled, outcome: { type: "error", error: "need_two" } };
    }
    if (settled.status === "complete" && settled.winnerShowId === winnerId) {
      return {
        state: settled,
        outcome: { type: "winner", showId: winnerId, spinSeq: settled.spinSeq },
      };
    }
    const crowned: SpinState = {
      ...settled,
      status: "complete",
      winnerShowId: winnerId,
      activeSpinShowId: null,
      activeSpinStartedAt: null,
    };
    return {
      state: crowned,
      outcome: { type: "winner", showId: winnerId, spinSeq: crowned.spinSeq },
    };
  }

  const chosen = left[pickIndex(left.length, rng)]!;
  const next: SpinState = {
    ...settled,
    status: "locked",
    spinSeq: settled.spinSeq + 1,
    activeSpinShowId: chosen.id,
    activeSpinStartedAt: now,
  };
  return {
    state: next,
    outcome: {
      type: "spin",
      showId: chosen.id,
      spinSeq: next.spinSeq,
      startedAt: now,
    },
  };
}

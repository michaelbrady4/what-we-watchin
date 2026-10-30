import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, isSessionCode, makeCode } from "../lib/codes";
import { decideSpin, pickIndex, settleState, type SpinState } from "../lib/elimination";
import { cleanName, cleanTitle } from "../lib/text";
import { labelBudget, landingRotation, sliceGeometry, sliceUnderPointer, wedgePath } from "../lib/wheel";

function shows(ids: string[]): SpinState["shows"] {
  return ids.map((id) => ({ id, eliminated: false, eliminationOrder: null }));
}

function locked(ids: string[], extra: Partial<SpinState> = {}): SpinState {
  return {
    status: "locked",
    winnerShowId: null,
    spinSeq: 0,
    activeSpinShowId: null,
    activeSpinStartedAt: null,
    shows: shows(ids),
    ...extra,
  };
}

describe("server pick", () => {
  it("stays inside the remaining slice range", () => {
    expect(pickIndex(5, () => 0)).toBe(0);
    expect(pickIndex(5, () => 0.2)).toBe(1);
    expect(pickIndex(5, () => 0.999)).toBe(4);
    expect(pickIndex(5, () => 1)).toBe(4);
  });

  it("does not roll the rng again while a spin is still in the window", () => {
    const state = locked(["a", "b", "c"], {
      spinSeq: 1,
      activeSpinShowId: "b",
      activeSpinStartedAt: 1_000,
    });
    let calls = 0;
    const decision = decideSpin(state, 1_200, () => {
      calls += 1;
      return 0;
    }, 5_000);
    expect(calls).toBe(0);
    expect(decision.outcome).toMatchObject({ type: "replay", showId: "b", spinSeq: 1 });
    expect(decision.state.shows.every((show) => !show.eliminated)).toBe(true);
  });

  it("rejects a spin before lock", () => {
    const decision = decideSpin({ ...locked(["a", "b"]), status: "open" }, 0, () => 0, 1_000);
    expect(decision.outcome).toEqual({ type: "error", error: "not_locked" });
  });
});

describe("last one wins", () => {
  it("eliminates until one show remains and then refuses to touch it", () => {
    const windowMs = 1_000;
    let now = 0;
    let state = locked(["a", "b", "c"]);

    const first = decideSpin(state, now, () => 0, windowMs);
    expect(first.outcome).toMatchObject({ type: "spin", showId: "a" });
    state = first.state;

    const replay = decideSpin(state, now + 10, () => 0.99, windowMs);
    expect(replay.outcome).toMatchObject({ type: "replay", showId: "a" });

    const second = decideSpin(state, now + windowMs, () => 0, windowMs);
    expect(second.outcome).toMatchObject({ type: "spin", showId: "b" });
    expect(second.state.shows.filter((show) => show.eliminated).map((show) => show.id)).toEqual(["a"]);
    state = second.state;

    now += windowMs * 2;
    const finale = decideSpin(state, now, () => 0, windowMs);
    expect(finale.outcome).toMatchObject({ type: "winner", showId: "c" });
    expect(finale.state.status).toBe("complete");
    expect(finale.state.shows.filter((show) => !show.eliminated).map((show) => show.id)).toEqual(["c"]);
    expect(finale.state.shows.find((show) => show.id === "c")?.eliminated).toBe(false);

    const again = decideSpin(finale.state, now + 50, () => 0, windowMs);
    expect(again.outcome).toMatchObject({ type: "winner", showId: "c" });
    expect(again.state.shows.filter((show) => show.eliminated)).toHaveLength(2);
    expect(again.state).toBe(finale.state);
  });

  it("settles a finished spin without starting another", () => {
    const state = locked(["a", "b"], {
      spinSeq: 4,
      activeSpinShowId: "a",
      activeSpinStartedAt: 0,
    });
    const settled = settleState(state, 1_000, 1_000);
    expect(settled.status).toBe("complete");
    expect(settled.winnerShowId).toBe("b");
    expect(settled.activeSpinShowId).toBeNull();
    expect(settled.shows.find((show) => show.id === "b")?.eliminated).toBe(false);
  });
});

describe("wheel geometry", () => {
  it("lands the server pick under the pointer", () => {
    for (const count of [2, 3, 4, 7, 8, 15, 30]) {
      for (let index = 0; index < count; index += 1) {
        const rotation = landingRotation(index, count);
        expect(sliceUnderPointer(rotation, count)).toBe(index);
      }
      const budget = labelBudget(count);
      expect(budget.maxChars).toBeGreaterThanOrEqual(4);
      expect(Number.isFinite(budget.font)).toBe(true);
      for (const slice of sliceGeometry(count)) {
        if (count === 1) continue;
        const path = wedgePath(slice.start, slice.end);
        expect(path.includes("NaN")).toBe(false);
      }
    }
  });
});

describe("names and codes", () => {
  it("trims names and titles", () => {
    expect(cleanName("  Sam   I   ")).toBe("Sam I");
    expect(cleanName("")).toBeNull();
    expect(cleanName("x".repeat(25))).toBeNull();
    expect(cleanTitle("  The   Bear ")).toBe("The Bear");
    expect(cleanTitle("")).toBeNull();
  });

  it("builds short unambiguous codes", () => {
    const code = makeCode(4, () => 0);
    expect(code).toHaveLength(4);
    expect(isSessionCode(code)).toBe(true);
    expect(CODE_ALPHABET.includes("0")).toBe(false);
    expect(CODE_ALPHABET.includes("1")).toBe(false);
    expect(CODE_ALPHABET.includes("l")).toBe(false);
    expect(CODE_ALPHABET.includes("o")).toBe(false);
  });
});

describe("copy", () => {
  it("keeps em dashes and en dashes out of the product text", () => {
    const roots = ["app", "components", "lib", "e2e", "README.md"];
    const files: string[] = [];
    for (const root of roots) {
      const full = path.join(process.cwd(), root);
      collect(full, files);
    }
    const bad: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (text.includes("\u2014") || text.includes("\u2013")) bad.push(path.relative(process.cwd(), file));
    }
    expect(bad).toEqual([]);
  });
});

function collect(target: string, files: string[]) {
  const stat = statSync(target);
  if (stat.isFile()) {
    if (/\.(tsx?|css|md)$/.test(target)) files.push(target);
    return;
  }
  for (const entry of readdirSync(target)) {
    if (entry === "node_modules" || entry === ".next") continue;
    collect(path.join(target, entry), files);
  }
}

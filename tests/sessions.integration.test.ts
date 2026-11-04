import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { spinWindowMs } from "../lib/config";
import { closeDb, ensureSchema, getSql } from "../lib/db";
import { SCHEMA_STATEMENTS } from "../lib/schema";
import {
  addShow,
  createSession,
  getSession,
  joinSession,
  listHistory,
  listLiveNights,
  lockSession,
  removeShow,
  renameSession,
  resetTables,
  spinSession,
  summarizeNights,
} from "../lib/sessions";
import { nightStatusLabel } from "../lib/text";

beforeAll(async () => {
  await ensureSchema();
});

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await resetTables();
  await closeDb();
});

async function add(code: string, title: string, name: string, deviceToken = randomUUID()) {
  const result = await addShow(code, { title, name, deviceToken });
  expect(result.ok, JSON.stringify(result)).toBe(true);
  return deviceToken;
}

it("hides who added a show until the night is over", async () => {
  const { code } = await createSession();
  const token = await add(code, "The Bear", "Sam");
  await add(code, "Succession", "Jordan");
  const open = await getSession(code, token);
  expect(open?.shows.every((show) => show.addedBy === null)).toBe(true);
  expect(open?.shows.find((show) => show.title === "The Bear")?.mine).toBe(true);
  expect(open?.shows.find((show) => show.title === "Succession")?.mine).toBe(false);
  expect(open?.winner).toBeNull();
});

it("caps each person at 3 shows and only lets them remove their own before lock", async () => {
  const { code } = await createSession();
  const sam = randomUUID();
  const jordan = randomUUID();
  await add(code, "The Bear", "Sam", sam);
  await add(code, "Hacks", "Sam", sam);
  await add(code, "The Pitt", "Sam", sam);
  const fourth = await addShow(code, { title: "Industry", name: "Sam", deviceToken: sam });
  expect(fourth.ok).toBe(false);
  if (!fourth.ok) expect(fourth.error).toBe("limit");

  const duplicate = await addShow(code, { title: "the bear", name: "Sam", deviceToken: sam });
  expect(duplicate.ok).toBe(false);

  const view = await getSession(code, sam);
  const bear = view?.shows.find((show) => show.title === "The Bear");
  const stolen = await removeShow(code, bear!.id, jordan);
  expect(stolen.ok).toBe(false);

  const removed = await removeShow(code, bear!.id, sam);
  expect(removed.ok).toBe(true);
  if (removed.ok) expect(removed.view.shows.some((show) => show.title === "The Bear")).toBe(false);

  const again = await addShow(code, { title: "Industry", name: "Sam", deviceToken: sam });
  expect(again.ok).toBe(true);
});

it("blocks adds after lock and requires two shows", async () => {
  const { code } = await createSession();
  const token = await add(code, "The Bear", "Sam");
  const tooSoon = await lockSession(code, token);
  expect(tooSoon.ok).toBe(false);
  if (!tooSoon.ok) expect(tooSoon.error).toBe("need_two");

  await add(code, "Hacks", "Sam", token);
  const locked = await lockSession(code, token);
  expect(locked.ok).toBe(true);

  const late = await addShow(code, { title: "Shogun", name: "Sam", deviceToken: token });
  expect(late.ok).toBe(false);
  if (!late.ok) expect(late.error).toBe("locked");

  const earlySpin = await spinSession(code, token, Date.now(), () => 0);
  expect(earlySpin.ok).toBe(true);
});

it("keeps two overlapping spins on the same show", async () => {
  const { code } = await createSession();
  for (const title of ["A", "B", "C", "D", "E", "F"]) {
    await add(code, title, title);
  }
  await lockSession(code, null);
  const now = Date.now();
  let held = 0;
  let release: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });

  const firstPromise = spinSession(code, null, now, () => 0, async () => {
    held += 1;
    await hold;
  });

  const secondPromise = (async () => {
    while (held < 1) await delay(5);
    return spinSession(code, null, now, () => 0.999);
  })();

  while (held < 1) await delay(5);
  await waitForRowLock();
  release();

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
  if (first.ok && second.ok) {
    expect(first.result).toBe("spin");
    expect(second.result).toBe("replay");
    expect(first.showId).toBe(second.showId);
    expect(second.view.shows.filter((show) => show.eliminated)).toHaveLength(0);
    expect(second.view.activeSpin?.showId).toBe(first.showId);
  }
});

it("lets a poll settle one spin, then crowns the last show and stops", async () => {
  const { code } = await createSession();
  const names = [
    ["Ann", "Alpha"],
    ["Bo", "Bravo"],
    ["Cy", "Charlie"],
  ] as const;
  for (const [name, title] of names) await add(code, title, name);
  await lockSession(code, null);

  const windowMs = spinWindowMs();
  let now = 1_700_000_000_000;
  const first = await spinSession(code, null, now, () => 0);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(first.result).toBe("spin");
  expect(first.showId).toBeTruthy();

  const mid = await getSession(code, null, now + 20);
  expect(mid?.activeSpin?.showId).toBe(first.showId);
  expect(mid?.shows.some((show) => show.eliminated)).toBe(false);
  expect(mid?.shows.every((show) => show.addedBy === null)).toBe(true);

  const settled = await getSession(code, null, now + windowMs);
  expect(settled?.activeSpin).toBeNull();
  expect(settled?.shows.filter((show) => show.eliminated)).toHaveLength(1);
  expect(settled?.status).toBe("locked");

  now += windowMs;
  const second = await spinSession(code, null, now, () => 0);
  expect(second.ok && second.result).toBe("spin");

  now += windowMs;
  const finale = await spinSession(code, null, now, () => 0);
  expect(finale.ok).toBe(true);
  if (!finale.ok) return;
  expect(finale.result).toBe("winner");
  expect(finale.view.status).toBe("complete");
  expect(finale.view.winner?.title).toBe("Charlie");
  expect(finale.view.winner?.addedBy).toBe("Cy");
  expect(finale.view.shows.filter((show) => show.eliminated)).toHaveLength(2);
  expect(finale.view.shows.find((show) => show.title === "Charlie")?.eliminated).toBe(false);

  const order = finale.view.shows
    .filter((show) => show.eliminated)
    .sort((a, b) => (a.eliminationOrder ?? 0) - (b.eliminationOrder ?? 0));
  expect(order.map((show) => show.title)).toEqual(["Alpha", "Bravo"]);
  expect(order.map((show) => show.addedBy)).toEqual(["Ann", "Bo"]);

  const extra = await spinSession(code, null, now + 10, () => 0);
  expect(extra.ok && extra.result).toBe("winner");
  if (extra.ok) expect(extra.view.shows.filter((show) => show.eliminated)).toHaveLength(2);

  const history = await listHistory();
  expect(history.map((night) => night.winnerTitle)).toContain("Charlie");
  expect(history.find((night) => night.code === code)?.addedBy).toBe("Cy");
});

it("stores an optional night name and lets the room rename it", async () => {
  const created = await createSession("  Friday night picks  ");
  expect(created.name).toBe("Friday night picks");
  const named = await getSession(created.code, null);
  expect(named?.name).toBe("Friday night picks");
  expect(named?.displayName).toBe("Friday night picks");

  const renamed = await renameSession(created.code, "Sunday couch");
  expect(renamed.ok).toBe(true);
  if (renamed.ok) {
    expect(renamed.view.name).toBe("Sunday couch");
    expect(renamed.view.displayName).toBe("Sunday couch");
  }

  const cleared = await renameSession(created.code, "   ");
  expect(cleared.ok).toBe(true);
  if (cleared.ok) {
    expect(cleared.view.name).toBeNull();
    expect(cleared.view.displayName).toBe(`Night ${created.code}`);
  }

  const tooLong = await renameSession(created.code, "x".repeat(41));
  expect(tooLong.ok).toBe(false);
  if (!tooLong.ok) expect(tooLong.error).toBe("bad_night_name");

  await expect(createSession("x".repeat(41))).rejects.toThrow(/Invalid night name/);

  const unnamed = await createSession();
  const view = await getSession(unnamed.code, null);
  expect(view?.name).toBeNull();
  expect(view?.displayName).toBe(`Night ${unnamed.code}`);
  const missing = await renameSession("nope", "Hello");
  expect(missing.ok).toBe(false);
});

it("reports live nights separately and keeps a null name after migration", async () => {
  const live = await createSession("Friday night picks");
  const { code } = await createSession();
  await add(code, "The Bear", "Sam");
  await add(code, "Hacks", "Sam");
  await lockSession(code, null);
  const now = 1_700_000_000_000;
  const spin = await spinSession(code, null, now, () => 0);
  expect(spin.ok).toBe(true);

  const during = await summarizeNights([live.code, code, "no", "zzzz"], now + 50);
  expect(during.map((night) => night.code).sort()).toEqual([code, live.code].sort());
  const spinning = during.find((night) => night.code === code);
  expect(spinning?.spinning).toBe(true);
  expect(spinning?.status).toBe("locked");
  expect(nightStatusLabel(spinning!.status, spinning!.spinning)).toBe("Spinning");
  expect(during.find((night) => night.code === live.code)?.displayName).toBe("Friday night picks");

  const happening = await listLiveNights(now + 50);
  expect(happening.map((night) => night.code)).toEqual(expect.arrayContaining([live.code, code]));
  expect(happening.find((night) => night.code === code)?.spinning).toBe(true);

  const settledWindow = await summarizeNights([code], now + spinWindowMs());
  expect(settledWindow[0]?.spinning).toBe(false);
  expect(nightStatusLabel("locked", false)).toBe("Locked");

  const finale = await spinSession(code, null, now + spinWindowMs(), () => 0);
  expect(finale.ok && finale.result).toBe("winner");
  const after = await listLiveNights(now + spinWindowMs());
  expect(after.map((night) => night.code)).toContain(live.code);
  expect(after.map((night) => night.code)).not.toContain(code);
  const history = await listHistory();
  expect(history.find((night) => night.code === code)?.displayName).toBe(`Night ${code}`);
  expect(history.find((night) => night.code === code)?.name).toBeNull();

  const sql = getSql();
  const alter = SCHEMA_STATEMENTS.find((statement) => statement.includes("ADD COLUMN IF NOT EXISTS name"));
  expect(alter).toBeTruthy();
  await sql`ALTER TABLE sessions DROP COLUMN IF EXISTS name`;
  try {
    await sql`DELETE FROM sessions WHERE id = 'qb7g'`;
    await sql`INSERT INTO sessions (id) VALUES ('qb7g')`;
    await sql.unsafe(alter!);
    const legacy = await getSession("qb7g", null);
    expect(legacy?.name).toBeNull();
    expect(legacy?.displayName).toBe("Night qb7g");
    const cards = await summarizeNights(["qb7g"]);
    expect(cards[0]?.status).toBe("open");
    expect(cards[0]?.displayName).toBe("Night qb7g");
    const columns = await sql<{ is_nullable: string }[]>`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'name'
    `;
    expect(columns[0]?.is_nullable).toBe("YES");
  } finally {
    if (alter) await sql.unsafe(alter);
  }
});

it("remembers a renamed person on the same device", async () => {
  const { code } = await createSession();
  const token = randomUUID();
  const joined = await joinSession(code, "Sam", token);
  expect(joined.ok).toBe(true);
  const renamed = await joinSession(code, "Samantha", token);
  expect(renamed.ok).toBe(true);
  if (renamed.ok) expect(renamed.view.participants.map((person) => person.name)).toEqual(["Samantha"]);
});

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRowLock() {
  const sql = getSql();
  const start = Date.now();
  while (Date.now() - start < 4_000) {
    const rows = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND wait_event_type = 'Lock'
    `;
    if (Number(rows[0]?.n ?? 0) > 0) return;
    await delay(15);
  }
  throw new Error("Second spin never waited on the row lock");
}

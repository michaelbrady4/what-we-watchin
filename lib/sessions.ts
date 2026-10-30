import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { colorForId } from "./colors";
import { spinWindowMs } from "./config";
import { isSessionCode, makeCode } from "./codes";
import { ensureSchema, getSql } from "./db";
import {
  decideSpin,
  settleState,
  type SpinState,
} from "./elimination";
import { messages, type MessageKey } from "./messages";
import { cleanName, cleanTitle, isUuid } from "./text";
import type { HistoryNight, Phase, SessionView, ShowView } from "./types";
import { spinAnimMs } from "./wheel";

type Sql = postgres.Sql;
type Querier = postgres.Sql | postgres.TransactionSql;

type SessionRow = {
  id: string;
  created_at: Date;
  completed_at: Date | null;
  locked_at: Date | null;
  status: Phase;
  winner_show_id: string | null;
  spin_seq: number | string;
  active_spin_show_id: string | null;
  active_spin_started_at: Date | string | null;
};

type ShowRowDb = {
  id: string;
  title: string;
  participant_id: string;
  created_at: Date;
  eliminated_at: Date | null;
  elimination_order: number | null;
};

type ParticipantRow = {
  id: string;
  name: string;
  device_token: string;
  created_at: Date;
};

type Loaded = {
  createdAt: Date;
  completedAt: Date | null;
  state: SpinState;
  shows: ShowRowDb[];
  participants: ParticipantRow[];
};

type Failure = { ok: false; error: MessageKey; message: string };

export type Mutation = { ok: true; view: SessionView } | Failure;

export type SpinMutation =
  | { ok: true; view: SessionView; result: "spin" | "replay" | "winner"; showId: string }
  | Failure;

function fail(error: MessageKey): Failure {
  return { ok: false, error, message: messages[error] };
}

function stamp(value: Date | string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function toState(session: SessionRow, shows: ShowRowDb[]): SpinState {
  return {
    status: session.status,
    winnerShowId: session.winner_show_id,
    spinSeq: Number(session.spin_seq) || 0,
    activeSpinShowId: session.active_spin_show_id,
    activeSpinStartedAt: stamp(session.active_spin_started_at),
    shows: shows.map((show) => ({
      id: show.id,
      eliminated: show.eliminated_at != null,
      eliminationOrder: show.elimination_order,
    })),
  };
}

async function selectSession(q: Querier, code: string, forUpdate: boolean): Promise<SessionRow | null> {
  const rows = forUpdate
    ? await q<SessionRow[]>`
        SELECT id, created_at, completed_at, locked_at, status, winner_show_id,
               spin_seq, active_spin_show_id, active_spin_started_at
        FROM sessions
        WHERE id = ${code}
        FOR UPDATE
      `
    : await q<SessionRow[]>`
        SELECT id, created_at, completed_at, locked_at, status, winner_show_id,
               spin_seq, active_spin_show_id, active_spin_started_at
        FROM sessions
        WHERE id = ${code}
      `;
  return rows[0] ?? null;
}

async function selectShows(q: Querier, code: string): Promise<ShowRowDb[]> {
  return q<ShowRowDb[]>`
    SELECT id, title, participant_id, created_at, eliminated_at, elimination_order
    FROM shows
    WHERE session_id = ${code}
    ORDER BY created_at ASC, id ASC
  `;
}

async function selectParticipants(q: Querier, code: string): Promise<ParticipantRow[]> {
  return q<ParticipantRow[]>`
    SELECT id, name, device_token, created_at
    FROM participants
    WHERE session_id = ${code}
    ORDER BY created_at ASC, id ASC
  `;
}

async function load(q: Querier, code: string, forUpdate = false): Promise<Loaded | null> {
  const session = await selectSession(q, code, forUpdate);
  if (!session) return null;
  const shows = await selectShows(q, code);
  const participants = await selectParticipants(q, code);
  return {
    createdAt: new Date(session.created_at),
    completedAt: session.completed_at ? new Date(session.completed_at) : null,
    state: toState(session, shows),
    shows,
    participants,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function persist(q: Querier, code: string, before: SpinState, after: SpinState, now: number): Promise<void> {
  for (const show of after.shows) {
    const prev = before.shows.find((item) => item.id === show.id);
    if (!prev || prev.eliminated || !show.eliminated) continue;
    await q`
      UPDATE shows
      SET eliminated_at = ${new Date(now)},
          elimination_order = ${show.eliminationOrder}
      WHERE id = ${show.id}
        AND eliminated_at IS NULL
    `;
  }

  const started = after.activeSpinStartedAt == null ? null : new Date(after.activeSpinStartedAt);
  if (before.status !== "complete" && after.status === "complete") {
    await q`
      UPDATE sessions
      SET status = ${after.status},
          winner_show_id = ${after.winnerShowId},
          spin_seq = ${after.spinSeq},
          active_spin_show_id = ${after.activeSpinShowId},
          active_spin_started_at = ${started},
          completed_at = COALESCE(completed_at, ${new Date(now)})
      WHERE id = ${code}
    `;
    return;
  }

  await q`
    UPDATE sessions
    SET status = ${after.status},
        winner_show_id = ${after.winnerShowId},
        spin_seq = ${after.spinSeq},
        active_spin_show_id = ${after.activeSpinShowId},
        active_spin_started_at = ${started}
    WHERE id = ${code}
  `;
}

function present(loaded: Loaded, code: string, deviceToken: string | null, now: number): SessionView {
  const { state } = loaded;
  const people = new Map(loaded.participants.map((person) => [person.id, person]));
  const reveal = state.status === "complete";
  const you = deviceToken
    ? loaded.participants.find((person) => person.device_token === deviceToken) ?? null
    : null;

  const shows: ShowView[] = loaded.shows.map((show) => {
    const person = people.get(show.participant_id);
    const colors = colorForId(show.id);
    const eliminated = show.eliminated_at != null;
    return {
      id: show.id,
      title: show.title,
      mine: Boolean(you && person && person.id === you.id),
      eliminated,
      eliminationOrder: show.elimination_order,
      addedBy: reveal ? (person?.name ?? null) : null,
      fill: colors.fill,
      ink: colors.ink,
    };
  });

  const winnerShow = state.winnerShowId
    ? loaded.shows.find((show) => show.id === state.winnerShowId) ?? null
    : null;
  const winnerPerson = winnerShow ? people.get(winnerShow.participant_id) : undefined;
  const windowMs = spinWindowMs();

  return {
    code,
    status: state.status,
    createdAt: loaded.createdAt.toISOString(),
    completedAt: loaded.completedAt ? loaded.completedAt.toISOString() : null,
    serverNow: now,
    spinWindowMs: windowMs,
    spinAnimMs: spinAnimMs(windowMs),
    you: you ? { name: you.name, showCount: loaded.shows.filter((show) => show.participant_id === you.id).length } : null,
    participants: loaded.participants.map((person) => ({ name: person.name })),
    shows,
    activeSpin:
      state.activeSpinShowId && state.activeSpinStartedAt != null
        ? {
            showId: state.activeSpinShowId,
            spinSeq: state.spinSeq,
            startedAt: state.activeSpinStartedAt,
          }
        : null,
    winner:
      reveal && winnerShow
        ? {
            showId: winnerShow.id,
            title: winnerShow.title,
            addedBy: winnerPerson?.name ?? "Someone",
          }
        : null,
  };
}

async function viewFrom(q: Querier, code: string, deviceToken: string | null, now: number): Promise<SessionView | null> {
  const loaded = await load(q, code, false);
  if (!loaded) return null;
  return present(loaded, code, deviceToken, now);
}

function needsSettle(state: SpinState, now: number): boolean {
  return Boolean(
    state.activeSpinShowId &&
      state.activeSpinStartedAt != null &&
      now >= state.activeSpinStartedAt + spinWindowMs(),
  );
}

export async function createSession(): Promise<{ code: string }> {
  await ensureSchema();
  const sql = getSql();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = makeCode();
    try {
      await sql`INSERT INTO sessions (id) VALUES (${code})`;
      return { code };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  throw new Error("Could not allocate a session code");
}

export async function getSession(
  code: string,
  deviceToken: string | null,
  now = Date.now(),
): Promise<SessionView | null> {
  if (!isSessionCode(code)) return null;
  await ensureSchema();
  const sql = getSql();
  const peek = await load(sql, code, false);
  if (!peek) return null;

  if (needsSettle(peek.state, now)) {
    return sql.begin(async (tx) => {
      const locked = await load(tx, code, true);
      if (!locked) return null;
      const next = settleState(locked.state, now, spinWindowMs());
      if (next !== locked.state) await persist(tx, code, locked.state, next, now);
      return viewFrom(tx, code, deviceToken, now);
    });
  }

  return present(peek, code, deviceToken, now);
}

async function upsertParticipant(
  tx: Sql | postgres.TransactionSql,
  code: string,
  name: string,
  deviceToken: string,
): Promise<ParticipantRow> {
  const existing = await tx<ParticipantRow[]>`
    SELECT id, name, device_token, created_at
    FROM participants
    WHERE session_id = ${code} AND device_token = ${deviceToken}
    FOR UPDATE
  `;
  if (existing[0]) {
    if (existing[0].name !== name) {
      await tx`UPDATE participants SET name = ${name} WHERE id = ${existing[0].id}`;
      return { ...existing[0], name };
    }
    return existing[0];
  }
  const id = randomUUID();
  const inserted = await tx<ParticipantRow[]>`
    INSERT INTO participants (id, session_id, name, device_token)
    VALUES (${id}, ${code}, ${name}, ${deviceToken})
    RETURNING id, name, device_token, created_at
  `;
  return inserted[0]!;
}

export async function joinSession(code: string, nameInput: string, deviceToken: string | null): Promise<Mutation> {
  if (!isSessionCode(code)) return fail("not_found");
  const name = cleanName(nameInput);
  if (!name) return fail("bad_name");
  if (!deviceToken || !isUuid(deviceToken)) return fail("bad_device");
  await ensureSchema();
  const sql = getSql();
  return sql.begin(async (tx) => {
    const session = await selectSession(tx, code, true);
    if (!session) return fail("not_found");
    if (session.status === "complete") return fail("over");
    await upsertParticipant(tx, code, name, deviceToken);
    const view = await viewFrom(tx, code, deviceToken, Date.now());
    if (!view) return fail("not_found");
    return { ok: true, view };
  });
}

export async function addShow(
  code: string,
  input: { title: string; name: string; deviceToken: string | null },
): Promise<Mutation> {
  if (!isSessionCode(code)) return fail("not_found");
  const title = cleanTitle(input.title);
  const name = cleanName(input.name);
  if (!title) return fail("bad_title");
  if (!name) return fail("bad_name");
  if (!input.deviceToken || !isUuid(input.deviceToken)) return fail("bad_device");
  const deviceToken = input.deviceToken;
  await ensureSchema();
  const sql = getSql();

  return sql.begin(async (tx) => {
    const session = await selectSession(tx, code, true);
    if (!session) return fail("not_found");
    if (session.status !== "open") return fail("locked");

    const participant = await upsertParticipant(tx, code, name, deviceToken);
    const counts = await tx<{ count: number }[]>`
      SELECT count(*)::int AS count FROM shows WHERE participant_id = ${participant.id}
    `;
    if (Number(counts[0]?.count ?? 0) >= 3) return fail("limit");

    const dupes = await tx<{ id: string }[]>`
      SELECT id FROM shows
      WHERE participant_id = ${participant.id}
        AND lower(title) = lower(${title})
    `;
    if (dupes.length > 0) return fail("duplicate");

    await tx`
      INSERT INTO shows (id, session_id, participant_id, title)
      VALUES (${randomUUID()}, ${code}, ${participant.id}, ${title})
    `;
    const view = await viewFrom(tx, code, deviceToken, Date.now());
    if (!view) return fail("not_found");
    return { ok: true, view };
  });
}

export async function removeShow(code: string, showId: string, deviceToken: string | null): Promise<Mutation> {
  if (!isSessionCode(code) || !isUuid(showId)) return fail("not_yours");
  if (!deviceToken || !isUuid(deviceToken)) return fail("bad_device");
  await ensureSchema();
  const sql = getSql();

  return sql.begin(async (tx) => {
    const session = await selectSession(tx, code, true);
    if (!session) return fail("not_found");
    if (session.status !== "open") return fail("locked");
    const removed = await tx<{ id: string }[]>`
      DELETE FROM shows
      WHERE id = ${showId}
        AND session_id = ${code}
        AND participant_id = (
          SELECT id FROM participants
          WHERE session_id = ${code} AND device_token = ${deviceToken}
        )
      RETURNING id
    `;
    if (removed.length === 0) return fail("not_yours");
    const view = await viewFrom(tx, code, deviceToken, Date.now());
    if (!view) return fail("not_found");
    return { ok: true, view };
  });
}

export async function lockSession(code: string, deviceToken: string | null, now = Date.now()): Promise<Mutation> {
  if (!isSessionCode(code)) return fail("not_found");
  await ensureSchema();
  const sql = getSql();
  return sql.begin(async (tx) => {
    const session = await selectSession(tx, code, true);
    if (!session) return fail("not_found");
    if (session.status === "complete") return fail("over");
    if (session.status === "open") {
      const counts = await tx<{ count: number }[]>`
        SELECT count(*)::int AS count FROM shows WHERE session_id = ${code}
      `;
      if (Number(counts[0]?.count ?? 0) < 2) return fail("need_two");
      await tx`
        UPDATE sessions
        SET status = 'locked', locked_at = ${new Date(now)}
        WHERE id = ${code}
      `;
    }
    const view = await viewFrom(tx, code, deviceToken, now);
    if (!view) return fail("not_found");
    return { ok: true, view };
  });
}

export async function spinSession(
  code: string,
  deviceToken: string | null,
  now = Date.now(),
  rng: () => number = Math.random,
  afterLock?: () => Promise<void>,
): Promise<SpinMutation> {
  if (!isSessionCode(code)) return fail("not_found");
  await ensureSchema();
  const sql = getSql();
  const windowMs = spinWindowMs();

  return sql.begin(async (tx) => {
    const locked = await load(tx, code, true);
    if (!locked) return fail("not_found");
    if (afterLock) await afterLock();
    const decision = decideSpin(locked.state, now, rng, windowMs);
    if (decision.state !== locked.state) {
      await persist(tx, code, locked.state, decision.state, now);
    }
    if (decision.outcome.type === "error") {
      return fail(decision.outcome.error);
    }
    const view = await viewFrom(tx, code, deviceToken, now);
    if (!view) return fail("not_found");
    return {
      ok: true,
      view,
      result: decision.outcome.type,
      showId: decision.outcome.showId,
    };
  });
}

export async function listHistory(): Promise<HistoryNight[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = await sql<{
    id: string;
    created_at: Date;
    completed_at: Date | null;
    winner_title: string;
    added_by: string;
  }[]>`
    SELECT s.id, s.created_at, s.completed_at, sh.title AS winner_title, p.name AS added_by
    FROM sessions s
    JOIN shows sh ON sh.id = s.winner_show_id
    JOIN participants p ON p.id = sh.participant_id
    WHERE s.status = 'complete'
    ORDER BY COALESCE(s.completed_at, s.created_at) DESC
    LIMIT 100
  `;
  return rows.map((row) => ({
    code: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    winnerTitle: row.winner_title,
    addedBy: row.added_by,
  }));
}

export async function resetTables(): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`TRUNCATE sessions CASCADE`;
}

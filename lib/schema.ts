export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open',
    winner_show_id UUID,
    spin_seq INTEGER NOT NULL DEFAULT 0,
    active_spin_show_id UUID,
    active_spin_started_at TIMESTAMPTZ,
    CONSTRAINT sessions_status_check CHECK (status IN ('open', 'locked', 'complete'))
  )`,
  `CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, device_token)
  )`,
  `CREATE TABLE IF NOT EXISTS shows (
    id UUID PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    eliminated_at TIMESTAMPTZ,
    elimination_order INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS participants_session_idx ON participants (session_id)`,
  `CREATE INDEX IF NOT EXISTS shows_session_idx ON shows (session_id, created_at)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS shows_elim_order_unique
    ON shows (session_id, elimination_order)
    WHERE elimination_order IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS sessions_history_idx ON sessions (status, completed_at DESC)`,
];

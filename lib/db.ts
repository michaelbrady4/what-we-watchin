import postgres from "postgres";
import { SCHEMA_STATEMENTS } from "./schema";

type Sql = postgres.Sql;

const globalForSql = globalThis as unknown as { sql?: Sql; schemaReady?: Promise<void> | null };

function connectionString(): string {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Missing POSTGRES_URL or DATABASE_URL");
  }
  return url;
}

export function getSql(): Sql {
  if (!globalForSql.sql) {
    const url = connectionString();
    const local = /localhost|127\.0\.0\.1/.test(url);
    globalForSql.sql = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 20,
      ssl: local ? false : "require",
      onnotice: () => {},
    });
  }
  return globalForSql.sql;
}

export function ensureSchema(): Promise<void> {
  if (!globalForSql.schemaReady) {
    const pending = (async () => {
      const sql = getSql();
      for (const statement of SCHEMA_STATEMENTS) {
        await sql.unsafe(statement);
      }
    })().catch((error) => {
      globalForSql.schemaReady = null;
      throw error;
    });
    globalForSql.schemaReady = pending;
  }
  return globalForSql.schemaReady;
}

export async function closeDb(): Promise<void> {
  const sql = globalForSql.sql;
  globalForSql.sql = undefined;
  globalForSql.schemaReady = null;
  if (sql) await sql.end({ timeout: 5 });
}

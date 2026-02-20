import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export const hasDatabase = !!process.env.DATABASE_URL;

// Lazy-init: don't crash on import when DATABASE_URL is missing.
// Only crash if sql() is actually called without it.
let _sql: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Either provide it or the app will use seed data.",
      );
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export const sql: NeonQueryFunction<false, false> = new Proxy(
  (() => {}) as unknown as NeonQueryFunction<false, false>,
  {
    apply(_target, _thisArg, args) {
      return (getSql() as Function).apply(null, args);
    },
    get(_target, prop) {
      return (getSql() as unknown as Record<string | symbol, unknown>)[prop];
    },
  },
);

/**
 * One pg Pool per server instance, shared by Better Auth and the app's own
 * queries. On Vercel, attachDatabasePool lets Fluid compute close idle
 * connections before an instance is suspended.
 */
import { Pool, types as pgTypes, type CustomTypesConfig } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { serverEnv } from "./env";

/**
 * node-postgres returns bigint (int8) as a string. Better Auth's rate limiter
 * stores `lastRequest` as a bigint millisecond timestamp and adds to it, which
 * concatenates strings and corrupts the X-Retry-After header. Every int8 we
 * use (timestamps, serial ids, counts) is far below 2^53, so a number is exact.
 * Scoped to this pool rather than mutating pg's global parsers.
 */
const types: CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: "text" | "binary") =>
    oid === pgTypes.builtins.INT8 && format !== "binary"
      ? (value: string) => Number(value)
      : pgTypes.getTypeParser(oid, format)) as CustomTypesConfig["getTypeParser"],
};

declare global {
  // Survives Next.js dev hot reloads so we don't leak a pool per edit.
  var __jscPool: Pool | undefined;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: serverEnv().DATABASE_URL,
    types,
    max: 5,
    idleTimeoutMillis: 10_000,
  });
  // An idle client erroring (e.g. the server dropped it) must not crash the process.
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  attachDatabasePool(pool);
  return pool;
}

export const pool: Pool = globalThis.__jscPool ?? (globalThis.__jscPool = createPool());

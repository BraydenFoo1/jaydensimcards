/**
 * Applies db/migrations/*.sql in filename order, once each.
 *
 *   npm run db:migrate                                    the local database
 *   npm run db:migrate -- --confirm-host=<hostname>       any other database
 *
 * DATABASE_URL comes from the shell, or from .env.local when the shell doesn't
 * set it. A database on another machine is touched only when --confirm-host
 * names its host exactly (src/lib/db-target.ts). Nothing here prints the
 * connection string, its host or its credentials.
 *
 * Each file runs in its own transaction and is recorded with a checksum, so
 * editing a migration after it has been applied is caught instead of ignored.
 * An advisory lock stops two deploys migrating at the same time.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import type * as DbTarget from "../src/lib/db-target.ts";

// Node runs this file directly, so the runtime import needs the real .ts path.
// It's loaded dynamically because a static .ts import would need a tsconfig
// change; the type-only import above gives the type checker the same module.
const { assertDatabaseTargetAllowed }: typeof DbTarget = await import(
  new URL("../src/lib/db-target.ts", import.meta.url).href
);

const LOCK_ID = 727_274; // arbitrary, unique to this app
const USAGE = "Usage: npm run db:migrate [-- --confirm-host=<hostname>]";

/** The only option is --confirm-host. Anything else is refused (and never echoed: it may be a URL). */
function parseArgs(args: string[]): { confirmHost?: string } {
  let confirmHost: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--confirm-host=")) confirmHost = arg.slice("--confirm-host=".length);
    else if (arg === "--confirm-host") confirmHost = args[++i];
    else throw new Error(`Unknown option. ${USAGE}`);
  }
  return { confirmHost };
}

/** Connection errors can name the host or user, so only the error code is reported. */
const errorCode = (err: unknown) => {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,32}$/.test(code) ? code : "no error code";
};

const url = process.env.DATABASE_URL;
let target: DbTarget.DatabaseTarget;
try {
  target = assertDatabaseTargetAllowed(url, {
    ...parseArgs(process.argv.slice(2)),
    howToConfirm: "re-run with --confirm-host=<that database's hostname>",
  });
} catch (err) {
  console.error(`Migration refused: ${err instanceof Error ? err.message : USAGE}`);
  process.exit(1);
}
console.log(target.kind === "local" ? "Target: local database." : "Target: remote database (host confirmed).");

const dir = path.join(import.meta.dirname, "..", "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
} catch (err) {
  console.error(`Migration failed: could not connect to the database (${errorCode(err)}).`);
  process.exit(1);
}

try {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const { rows } = await client.query<{ name: string; checksum: string }>("SELECT name, checksum FROM _migrations");
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));
  let ran = 0;

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = applied.get(file);

    if (previous) {
      if (previous !== checksum) {
        throw new Error(`${file} was edited after it was applied. Add a new migration instead.`);
      }
      continue;
    }

    process.stdout.write(`applying ${file} ... `);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name, checksum) VALUES ($1, $2)", [file, checksum]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
    console.log("done");
    ran++;
  }

  console.log(ran === 0 ? "Database is up to date." : `Applied ${ran} migration(s).`);
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
  await client.end();
}

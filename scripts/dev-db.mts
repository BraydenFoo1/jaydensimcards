/**
 * Local-only Postgres for development and tests: PGlite (Postgres compiled to
 * WebAssembly, persisted in .dev-db/) behind a small wire-protocol server.
 *
 *   npm run db:dev
 *
 * Why not the stock `pglite-server` CLI: its multiplexer queues each protocol
 * message separately, so two connections running parameterised queries at
 * the same time interleave Parse/Bind/Execute and corrupt each other
 * (Postgres error 34000, `portal "" does not exist`). Better Auth then fails
 * to find a valid session and the user appears signed out.
 *
 * This server keeps PGlite but schedules whole batches: a connection's
 * messages are buffered up to the message that ends a query (Sync, simple
 * Query, Flush, or an auth reply) and run in one go. A connection inside a
 * transaction keeps the database until the transaction ends, exactly as row
 * locks would make others wait on a real server.
 *
 * Never used in production: deployed environments use Neon (real Postgres).
 */
import net from "node:net";
import { PGlite } from "@electric-sql/pglite";

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const DATA_DIR = process.env.DEV_DB_DIR ?? "./.dev-db/pgdata";

const SSL_REQUEST = 80877103;
const GSSENC_REQUEST = 80877104;
const CANCEL_REQUEST = 80877102;
const code = (c: string) => c.charCodeAt(0);
// Messages after which the client waits for a reply, so the batch must run now.
const BATCH_END = new Set([code("S"), code("Q"), code("H"), code("p"), code("c"), code("f")]);
const TERMINATE = code("X");
const FLUSH = code("H");

type Connection = { id: number; socket: net.Socket; buffer: Buffer; started: boolean; pending: Buffer[]; closed: boolean };
type Job = { conn: Connection; bytes: Uint8Array; last: number; queuedAt: number };

const db = await PGlite.create(DATA_DIR);
const queue: Job[] = [];
/** The connection that holds the database between batches (open transaction or Flush sequence). */
let owner: Connection | null = null;
let ownerSince = 0;
let ownerLastSql = "";

/** Set DEV_DB_DEBUG=1 to log when one connection keeps others waiting. */
const DEBUG = process.env.DEV_DB_DEBUG === "1";

/** The SQL text of the first Parse or simple Query in a batch (placeholders only, never bound values). */
function sqlOf(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  let i = 0;
  while (i + 5 <= buf.length) {
    const type = buf[i];
    const len = buf.readInt32BE(i + 1);
    if (type === code("Q")) return buf.subarray(i + 5, i + len).toString("utf8").replace(/\0[\s\S]*$/, "").slice(0, 120);
    if (type === code("P")) {
      const body = buf.subarray(i + 5, i + 1 + len);
      const nameEnd = body.indexOf(0);
      return body.subarray(nameEnd + 1, body.indexOf(0, nameEnd + 1)).toString("utf8").slice(0, 120);
    }
    i += len + 1;
  }
  return "(no SQL in batch)";
}
let running = false;
let nextId = 1;

async function pump(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      if (owner?.closed) await release(owner);
      const index = owner ? queue.findIndex((job) => job.conn === owner) : queue.length > 0 ? 0 : -1;
      if (index < 0) break;
      const [job] = queue.splice(index, 1);
      if (job.conn.closed) continue;
      try {
        await db.runExclusive(() =>
          db.execProtocolRawStream(job.bytes, {
            onRawData: (chunk) => {
              if (!job.conn.closed) job.conn.socket.write(chunk);
            },
          }),
        );
      } catch (err) {
        console.error(`[dev-db] connection #${job.conn.id}: ${err instanceof Error ? err.message : err}`);
        job.conn.socket.destroy();
        job.conn.closed = true;
      }
      const nextOwner = !job.conn.closed && (db.isInTransaction() || job.last === FLUSH) ? job.conn : null;
      if (DEBUG && nextOwner !== owner) {
        console.log(`[dev-db] owner ${owner?.id ?? "-"} -> ${nextOwner?.id ?? "-"} after: ${sqlOf(job.bytes)}`);
      }
      if (nextOwner && nextOwner !== owner) ownerSince = Date.now();
      if (nextOwner) ownerLastSql = sqlOf(job.bytes);
      owner = nextOwner;
    }
  } finally {
    running = false;
  }
}

/** Frees the database from a connection that went away mid-transaction. */
async function release(conn: Connection): Promise<void> {
  if (owner !== conn) return;
  owner = null;
  if (db.isInTransaction()) {
    await db.runExclusive(() => db.exec("ROLLBACK"));
    console.warn(`[dev-db] connection #${conn.id} closed inside a transaction; rolled back`);
  }
}

function enqueue(conn: Connection, messages: Buffer[], last: number) {
  queue.push({ conn, bytes: new Uint8Array(Buffer.concat(messages)), last, queuedAt: Date.now() });
  void pump();
}

function onData(conn: Connection, chunk: Buffer) {
  conn.buffer = Buffer.concat([conn.buffer, chunk]);
  for (;;) {
    if (!conn.started) {
      // Startup-phase packets have no type byte: int32 length, int32 code.
      if (conn.buffer.length < 8) return;
      const length = conn.buffer.readInt32BE(0);
      if (conn.buffer.length < length) return;
      const requestCode = conn.buffer.readInt32BE(4);
      const packet = Buffer.from(conn.buffer.subarray(0, length));
      conn.buffer = conn.buffer.subarray(length);
      if (requestCode === SSL_REQUEST || requestCode === GSSENC_REQUEST) {
        conn.socket.write("N"); // no TLS on a local socket
        continue;
      }
      if (requestCode === CANCEL_REQUEST) {
        conn.socket.end();
        return;
      }
      conn.started = true;
      enqueue(conn, [packet], 0);
      continue;
    }

    if (conn.buffer.length < 5) return;
    const type = conn.buffer[0];
    const length = conn.buffer.readInt32BE(1) + 1;
    if (conn.buffer.length < length) return;
    const message = Buffer.from(conn.buffer.subarray(0, length));
    conn.buffer = conn.buffer.subarray(length);

    if (type === TERMINATE) {
      conn.socket.end();
      return;
    }
    conn.pending.push(message);
    if (BATCH_END.has(type)) {
      enqueue(conn, conn.pending, type);
      conn.pending = [];
    }
  }
}

if (DEBUG) {
  setInterval(() => {
    const waiting = queue.filter((job) => job.conn !== owner && Date.now() - job.queuedAt > 3000);
    if (owner && waiting.length > 0) {
      console.warn(
        `[dev-db] STALL: connection #${owner.id} has held the database for ${Date.now() - ownerSince}ms ` +
          `(in transaction: ${db.isInTransaction()}, closed: ${owner.closed}); ${waiting.length} batch(es) waiting. ` +
          `Owner's last SQL: ${ownerLastSql}`,
      );
    }
  }, 2000).unref();
}

const server = net.createServer((socket) => {
  socket.setNoDelay(true);
  const conn: Connection = { id: nextId++, socket, buffer: Buffer.alloc(0), started: false, pending: [], closed: false };
  socket.on("data", (chunk) => onData(conn, chunk));
  socket.on("error", () => {});
  socket.on("close", () => {
    conn.closed = true;
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].conn === conn) queue.splice(i, 1);
    void release(conn).then(pump);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[dev-db] PGlite ${DATA_DIR} listening on postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`);
});

async function shutdown() {
  server.close();
  await db.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

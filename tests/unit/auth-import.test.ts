/**
 * Loading the auth module must not open a database connection. `next build`,
 * every server start and every integration test file load it, and the test
 * safety checks (src/lib/db-target.ts) can only protect a database that
 * nothing has connected to yet.
 *
 * A fake Postgres listener on 127.0.0.1 counts connection attempts and closes
 * each at once. DATABASE_URL and the PGHOST/PGPORT fallback both point at it,
 * so no real database can be reached from here.
 */
import { randomBytes } from "node:crypto";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** Long enough for a loopback connection that Better Auth's initialisation would start. */
const SETTLE_MS = 750;
const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

const ENV_KEYS = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "MAIL_TRANSPORT", "PGHOST", "PGPORT"];

let server: net.Server;
let connections = 0;
let savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
  server = net.createServer((socket) => {
    connections++;
    socket.on("error", () => {});
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;

  savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    DATABASE_URL: `postgresql://probe:probe@127.0.0.1:${port}/probe`,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "http://localhost:3000",
    MAIL_TRANSPORT: "outbox",
    PGHOST: "127.0.0.1",
    PGPORT: String(port),
  });
});

afterAll(async () => {
  // The app's pool was created (unconnected) when the auth module loaded.
  const { pool } = await import("@/lib/db");
  await pool.end();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("loading the auth module opens no database connection", () => {
  it("importing @/lib/auth and letting Better Auth finish initialising connects nothing", async () => {
    const { auth } = await import("@/lib/auth");
    await auth.$context;
    await settle();
    expect(connections).toBe(0);
  });

  it("importing the /api/auth route handler connects nothing", async () => {
    await import("@/app/api/auth/[...all]/route");
    await settle();
    expect(connections).toBe(0);
  });

  // Runs last: it is meant to connect.
  it("control: Better Auth with its default schema check does connect, so a regression would be caught", async () => {
    const { betterAuth } = await import("better-auth");
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.on("error", () => {});
    try {
      const withDefaults = betterAuth({
        database: pool,
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL: "http://localhost:3000",
        logger: { disabled: true },
      });
      await withDefaults.$context;
      await settle();
      expect(connections).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }
  });
});

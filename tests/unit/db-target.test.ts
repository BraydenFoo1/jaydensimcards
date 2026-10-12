import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertDatabaseTargetAllowed,
  assertSafeTestEnvironment,
  DatabaseTargetError,
  parseDatabaseTarget,
} from "@/lib/db-target";

// Made-up values. The .invalid top-level domain can never resolve (RFC 2606).
const SECRET = "pw-must-never-print";
const REMOTE_HOST = "ep-made-up-123456-pooler.db.jsc-test.invalid";
const REMOTE_URL = `postgresql://owner:${SECRET}@${REMOTE_HOST}/neondb?sslmode=require`;
const LOCAL_URL = `postgresql://postgres:${SECRET}@127.0.0.1:54329/postgres`;

const HOW = "pass --confirm-host=<host>";

/** Runs `fn`, expects a DatabaseTargetError, and checks the message leaks nothing. */
function refusal(fn: () => unknown): string {
  let caught: unknown;
  try {
    fn();
  } catch (err) {
    caught = err;
  }
  expect(caught, "expected a refusal").toBeInstanceOf(DatabaseTargetError);
  const message = (caught as Error).message;
  expect(message).not.toContain(SECRET);
  expect(message).not.toContain(REMOTE_HOST);
  expect(message).not.toContain("example.com");
  return message;
}

/* ------------------------------------------------------------------ */
/* Classifying a connection string                                     */
/* ------------------------------------------------------------------ */

describe("parseDatabaseTarget: local targets", () => {
  it.each([
    [LOCAL_URL, "127.0.0.1"],
    ["postgres://user:pw@localhost:5432/app", "localhost"],
    ["postgresql://user:pw@[::1]:5432/app", "::1"],
    ["postgresql://user:pw@LocalHost/app", "localhost"],
    ["postgresql://user:pw@localhost/app?sslmode=disable&application_name=tests", "localhost"],
  ])("%s is local", (url, host) => {
    expect(parseDatabaseTarget(url)).toEqual({ kind: "local", host });
  });
});

describe("parseDatabaseTarget: remote targets", () => {
  it.each([
    [REMOTE_URL, REMOTE_HOST],
    ["postgresql://u:p@10.0.0.5:5432/app", "10.0.0.5"],
    ["postgresql://u:p@192.168.1.20/app", "192.168.1.20"],
    ["postgresql://u:p@localhost.example.com/app", "localhost.example.com"],
    ["postgresql://u:p@127.0.0.1.nip.io/app", "127.0.0.1.nip.io"],
    ["postgresql://u:p@localhost./app", "localhost."],
    ["postgresql://u:p@127.1/app", "127.1"],
    ["postgresql://u:p@[2001:db8::5]/app", "2001:db8::5"],
    // The user name is not the host.
    ["postgresql://localhost:pw@db.example.com/app", "db.example.com"],
  ])("%s is remote", (url, host) => {
    expect(parseDatabaseTarget(url)).toEqual({ kind: "remote", host });
  });
});

describe("parseDatabaseTarget: invalid or ambiguous configuration is refused", () => {
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["leading whitespace", ` ${LOCAL_URL}`],
    ["trailing whitespace", `${LOCAL_URL}\n`],
    ["whitespace inside", "postgresql://user:pw@local host/app"],
    ["not a URL", "not a connection string"],
    ["no scheme", "localhost:5432/app"],
    ["MySQL scheme", "mysql://user:pw@localhost/app"],
    ["HTTP scheme", "http://localhost/app"],
    ["socket scheme", "socket:/var/run/postgresql?db=app"],
    ["Unix socket path", "/var/run/postgresql app"],
    ["no host", "postgresql:///app"],
    ["credentials but no host", `postgresql://user:${SECRET}@/app`],
    ["host query parameter", `postgresql://user:${SECRET}@localhost/app?host=${REMOTE_HOST}`],
    ["upper-case HOST parameter", "postgresql://user:pw@localhost/app?HOST=db.example.com"],
    ["percent-encoded host parameter", "postgresql://user:pw@localhost/app?h%6fst=db.example.com"],
    ["hostaddr parameter", "postgresql://user:pw@localhost/app?hostaddr=10.0.0.5"],
    ["several hosts", "postgresql://user:pw@localhost,db.example.com/app"],
    ["several hosts with ports", "postgresql://user:pw@localhost:5432,db.example.com:5432/app"],
    ["percent-encoded host", "postgresql://user:pw@%6c%6fcalhost/app"],
  ])("%s", (_label, url) => {
    refusal(() => parseDatabaseTarget(url));
  });
});

/* ------------------------------------------------------------------ */
/* Host confirmation                                                   */
/* ------------------------------------------------------------------ */

describe("assertDatabaseTargetAllowed", () => {
  it("allows a local database without confirmation", () => {
    expect(assertDatabaseTargetAllowed(LOCAL_URL, { howToConfirm: HOW })).toEqual({ kind: "local", host: "127.0.0.1" });
  });

  it("allows a local database whatever the confirmation says", () => {
    expect(assertDatabaseTargetAllowed(LOCAL_URL, { confirmHost: REMOTE_HOST, howToConfirm: HOW }).kind).toBe("local");
  });

  it("refuses a remote database without confirmation, and says how to confirm", () => {
    const message = refusal(() => assertDatabaseTargetAllowed(REMOTE_URL, { howToConfirm: HOW }));
    expect(message).toContain("another machine");
    expect(message).toContain(HOW);
  });

  it.each(["", "   "])("treats a blank confirmation (%j) as no confirmation", (confirmHost) => {
    expect(refusal(() => assertDatabaseTargetAllowed(REMOTE_URL, { confirmHost, howToConfirm: HOW }))).toContain(HOW);
  });

  it("allows a remote database when the confirmed host matches exactly", () => {
    expect(assertDatabaseTargetAllowed(REMOTE_URL, { confirmHost: REMOTE_HOST, howToConfirm: HOW })).toEqual({
      kind: "remote",
      host: REMOTE_HOST,
    });
  });

  it("ignores case and surrounding spaces in the confirmation", () => {
    const confirmHost = `  ${REMOTE_HOST.toUpperCase()} `;
    expect(assertDatabaseTargetAllowed(REMOTE_URL, { confirmHost, howToConfirm: HOW }).kind).toBe("remote");
  });

  it.each(["[2001:db8::5]", "2001:db8::5"])("accepts an IPv6 confirmation written as %s", (confirmHost) => {
    expect(assertDatabaseTargetAllowed("postgresql://u:p@[2001:db8::5]/app", { confirmHost, howToConfirm: HOW }).kind).toBe(
      "remote",
    );
  });

  it.each([
    ["a different host", "ep-other-654321-pooler.db.jsc-test.invalid"],
    ["the same database without the pooler", REMOTE_HOST.replace("-pooler", "")],
    ["only the domain", "jsc-test.invalid"],
    ["a longer host", `${REMOTE_HOST}.evil.example`],
    ["localhost", "localhost"],
    ["the full connection string", REMOTE_URL],
  ])("refuses a remote database when the confirmation names %s", (_label, confirmHost) => {
    expect(refusal(() => assertDatabaseTargetAllowed(REMOTE_URL, { confirmHost, howToConfirm: HOW }))).toContain("doesn't match");
  });

  it("never lets a confirmation rescue an ambiguous URL", () => {
    const url = `postgresql://u:p@localhost/app?host=${REMOTE_HOST}`;
    for (const confirmHost of [REMOTE_HOST, "localhost"]) {
      expect(refusal(() => assertDatabaseTargetAllowed(url, { confirmHost, howToConfirm: HOW }))).toContain("unclear");
    }
  });
});

describe("assertSafeTestEnvironment", () => {
  it("allows the local database with the dev outbox", () => {
    expect(assertSafeTestEnvironment({ DATABASE_URL: LOCAL_URL, MAIL_TRANSPORT: "outbox" }).kind).toBe("local");
  });

  it.each([
    ["smtp", "smtp"],
    ["unset (the app would default to SMTP)", undefined],
  ])("refuses real email delivery: MAIL_TRANSPORT %s", (_label, MAIL_TRANSPORT) => {
    const message = refusal(() => assertSafeTestEnvironment({ DATABASE_URL: LOCAL_URL, MAIL_TRANSPORT }));
    expect(message).toContain("Tests refused to start");
    expect(message).toContain("MAIL_TRANSPORT=outbox");
  });

  it("refuses a remote database and names TEST_DATABASE_CONFIRM_HOST", () => {
    const message = refusal(() => assertSafeTestEnvironment({ DATABASE_URL: REMOTE_URL, MAIL_TRANSPORT: "outbox" }));
    expect(message).toContain("Tests refused to start");
    expect(message).toContain("TEST_DATABASE_CONFIRM_HOST");
  });

  it("allows a remote database only when TEST_DATABASE_CONFIRM_HOST names it", () => {
    const env = { DATABASE_URL: REMOTE_URL, MAIL_TRANSPORT: "outbox" };
    refusal(() => assertSafeTestEnvironment({ ...env, TEST_DATABASE_CONFIRM_HOST: "db.example.com" }));
    expect(assertSafeTestEnvironment({ ...env, TEST_DATABASE_CONFIRM_HOST: REMOTE_HOST }).kind).toBe("remote");
  });

  it("refuses when DATABASE_URL is missing", () => {
    expect(refusal(() => assertSafeTestEnvironment({ MAIL_TRANSPORT: "outbox" }))).toContain("not set");
  });
});

/* ------------------------------------------------------------------ */
/* The real entry points refuse before any database connection          */
/* ------------------------------------------------------------------ */

/*
 * A fake Postgres listener on 127.0.0.1 counts every connection attempt and
 * closes it at once. Each entry point is given a connection string that would
 * reach the listener, so a connection that slipped past a check is counted, not
 * just guessed at. PGHOST/PGPORT point there too, in case a URL were ignored and
 * node-postgres fell back to its defaults. No real database is involved.
 */
let listener: net.Server;
let listenerPort = 0;
let connections = 0;

beforeAll(async () => {
  listener = net.createServer((socket) => {
    connections++;
    socket.on("error", () => {});
    socket.destroy();
  });
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  listenerPort = (listener.address() as net.AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve) => listener.close(() => resolve())));

// "127.1" counts as another machine (only exact loopback names are local), yet it reaches the listener.
const remoteLooking = () => `postgresql://owner:${SECRET}@127.1:${listenerPort}/neondb`;
const localFake = () => `postgresql://postgres:${SECRET}@127.0.0.1:${listenerPort}/postgres`;

const ROOT = process.cwd();

/**
 * Runs a Node entry point with only the variables given (plus PATH, HOME,
 * NODE_ENV and the PGHOST/PGPORT fallback). It runs asynchronously so the
 * listener keeps answering. Returns the exit status, everything printed, and
 * how many connections reached the listener.
 */
async function runNode(args: string[], env: Record<string, string>) {
  connections = 0;
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: {
      PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
      HOME: process.env.HOME ?? "",
      NODE_ENV: "test",
      PGHOST: "127.0.0.1",
      PGPORT: String(listenerPort),
      ...env,
    },
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const killer = setTimeout(() => child.kill("SIGKILL"), 90_000);
  const status = await new Promise<number | null>((resolve) => child.on("close", resolve));
  clearTimeout(killer);
  // Let any connection still in flight reach the listener before counting.
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Whatever happened, nothing printed may reveal the connection string.
  expect(output).not.toContain(SECRET);
  expect(output).not.toContain(REMOTE_HOST);
  expect(output).not.toContain(`:${listenerPort}`);
  return { status, output, connections };
}

const MIGRATE = ["scripts/migrate.mts"];
const VITEST_INTEGRATION = ["node_modules/vitest/vitest.mjs", "run", "--project", "integration"];
// No --project at all: the safety check must still run. One integration file only, so a broken
// check could never make this run the unit suite (and this file) again.
const VITEST_UNNAMED = ["node_modules/vitest/vitest.mjs", "run", "tests/integration/auth.test.ts"];
const PLAYWRIGHT_TEST = ["node_modules/@playwright/test/cli.js", "test"];

describe("entry points refuse before any database connection", { timeout: 120_000 }, () => {
  it("migrations: a remote database without --confirm-host is refused, with no connection", async () => {
    const run = await runNode(MIGRATE, { DATABASE_URL: remoteLooking() });
    expect(run.status).toBe(1);
    expect(run.output).toContain("Migration refused");
    expect(run.output).toContain("--confirm-host");
    expect(run.output).not.toContain("Target:");
    expect(run.connections).toBe(0);
  });

  it("migrations: a --confirm-host naming a different host is refused, with no connection", async () => {
    const run = await runNode([...MIGRATE, "--confirm-host=db.example.com"], { DATABASE_URL: remoteLooking() });
    expect(run.status).toBe(1);
    expect(run.output).toContain("doesn't match");
    expect(run.connections).toBe(0);
  });

  it("migrations: an ambiguous connection string is refused even when confirmed, with no connection", async () => {
    // node-postgres would follow ?host= to 127.1, which reaches the listener.
    const url = `postgresql://u:${SECRET}@127.0.0.1:${listenerPort}/app?host=127.1`;
    const run = await runNode([...MIGRATE, "--confirm-host=127.1"], { DATABASE_URL: url });
    expect(run.status).toBe(1);
    expect(run.output).toContain("unclear");
    expect(run.connections).toBe(0);
  });

  it("migrations: unknown options are refused without being echoed, with no connection", async () => {
    const run = await runNode([...MIGRATE, "--confirm-hots=127.1"], { DATABASE_URL: remoteLooking() });
    expect(run.status).toBe(1);
    expect(run.output).toContain("Unknown option");
    expect(run.output).not.toContain("confirm-hots");
    expect(run.connections).toBe(0);
  });

  it("migrations: a missing DATABASE_URL is refused, with no connection to the default host", async () => {
    const run = await runNode(MIGRATE, {});
    expect(run.status).toBe(1);
    expect(run.output).toContain("not set");
    expect(run.connections).toBe(0);
  });

  it("control: a matching --confirm-host lets migrations connect, and the listener counts it", async () => {
    const run = await runNode([...MIGRATE, "--confirm-host=127.1"], { DATABASE_URL: remoteLooking() });
    expect(run.status).toBe(1);
    expect(run.output).toContain("Target: remote database (host confirmed).");
    // The listener closes the connection, which the script reports by error code only.
    expect(run.output).toContain("could not connect to the database (");
    expect(run.output).not.toContain("127.1");
    expect(run.connections).toBe(1);
  });

  it("integration tests: a remote database is refused before any test runs, with no connection", async () => {
    const run = await runNode(VITEST_INTEGRATION, { DATABASE_URL: remoteLooking(), MAIL_TRANSPORT: "outbox" });
    expect(run.status).not.toBe(0);
    expect(run.output).toContain("Tests refused to start");
    expect(run.output).not.toMatch(/Test Files|Tests\s+\d/);
    expect(run.connections).toBe(0);
  });

  it("integration tests: a run that names no project is refused too, with no connection", async () => {
    const run = await runNode(VITEST_UNNAMED, { DATABASE_URL: remoteLooking(), MAIL_TRANSPORT: "outbox" });
    expect(run.status).not.toBe(0);
    expect(run.output).toContain("Tests refused to start");
    expect(run.output).not.toMatch(/Test Files|Tests\s+\d/);
    expect(run.connections).toBe(0);
  });

  it("integration tests: real email delivery is refused, with no connection", async () => {
    const run = await runNode(VITEST_INTEGRATION, { DATABASE_URL: localFake(), MAIL_TRANSPORT: "smtp" });
    expect(run.status).not.toBe(0);
    expect(run.output).toContain("MAIL_TRANSPORT=outbox");
    expect(run.connections).toBe(0);
  });

  it("browser tests: a remote database is refused before any build or server start, with no connection", async () => {
    const run = await runNode(PLAYWRIGHT_TEST, { DATABASE_URL: remoteLooking(), MAIL_TRANSPORT: "outbox" });
    expect(run.status).not.toBe(0);
    expect(run.output).toContain("Tests refused to start");
    expect(run.output).not.toMatch(/Creating an optimized production build|Compiled successfully|Collecting page data/);
    expect(run.connections).toBe(0);
  });
});

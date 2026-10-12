/**
 * Where a Postgres connection string really points, so the test suites and
 * the migration script can refuse to touch any database but the local one.
 *
 * Used only by tooling (tests, scripts), never by the app at runtime.
 *
 *  - local:  the host is literally localhost, 127.0.0.1 or ::1
 *  - remote: any other host. Allowed only when the operator names that exact
 *            host as confirmation.
 *  - refused outright as ambiguous: no host (node-postgres would fall back to
 *    PGHOST or a socket), several hosts, a host or hostaddr query parameter
 *    (node-postgres lets ?host= override the host in the URL), a
 *    percent-encoded host, whitespace, and anything that isn't a
 *    postgres:// or postgresql:// URL.
 *
 * The parsing matches node-postgres (pg-connection-string), which also reads
 * the host with the WHATWG URL parser. Error messages never include the
 * connection string, its host or its credentials.
 *
 * Only erasable TypeScript here: scripts/migrate.mts loads this file directly
 * with Node's type stripping.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const HOST_OVERRIDE_PARAMS = new Set(["host", "hostaddr"]);

export type DatabaseTarget = { kind: "local" | "remote"; host: string };

export class DatabaseTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseTargetError";
  }
}

const ambiguous = (why: string) =>
  new DatabaseTargetError(`DATABASE_URL ${why}, so it's unclear which server it reaches. Refusing to use it.`);

/** IPv6 hosts arrive in brackets; DNS names are case-insensitive. */
const normalizeHost = (host: string) => host.replace(/^\[(.*)\]$/, "$1").toLowerCase();

export function parseDatabaseTarget(connectionString: string | undefined): DatabaseTarget {
  if (!connectionString) throw new DatabaseTargetError("DATABASE_URL is not set.");
  // node-postgres re-encodes whitespace before parsing, which can move the host. Never guess.
  if (/\s/.test(connectionString)) throw ambiguous("contains whitespace");

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseTargetError("DATABASE_URL is not a valid connection string.");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseTargetError("DATABASE_URL must start with postgres:// or postgresql://.");
  }
  for (const key of url.searchParams.keys()) {
    if (HOST_OVERRIDE_PARAMS.has(key.toLowerCase())) throw ambiguous("sets its host in a query parameter");
  }

  const host = normalizeHost(url.hostname);
  if (!host) throw ambiguous("has no host");
  if (host.includes(",")) throw ambiguous("lists more than one host");
  if (host.includes("%")) throw ambiguous("percent-encodes its host");

  return { kind: LOCAL_HOSTS.has(host) ? "local" : "remote", host };
}

/**
 * A local target always passes. A remote one passes only when `confirmHost`
 * names exactly the same host; `howToConfirm` tells the operator how to give it.
 */
export function assertDatabaseTargetAllowed(
  connectionString: string | undefined,
  { confirmHost, howToConfirm }: { confirmHost?: string; howToConfirm: string },
): DatabaseTarget {
  const target = parseDatabaseTarget(connectionString);
  if (target.kind === "local") return target;

  const confirmed = confirmHost?.trim();
  if (!confirmed) {
    throw new DatabaseTargetError(
      `DATABASE_URL points at a database on another machine. To use it anyway, ${howToConfirm}.`,
    );
  }
  if (normalizeHost(confirmed) !== target.host) {
    throw new DatabaseTargetError("The confirmed host doesn't match the host in DATABASE_URL.");
  }
  return target;
}

/**
 * Integration and browser tests create and delete accounts and read emails
 * from the local outbox. They run only against the local database (or a host
 * named in TEST_DATABASE_CONFIRM_HOST), and never with real email delivery.
 */
export function assertSafeTestEnvironment(env: Record<string, string | undefined>): DatabaseTarget {
  try {
    const target = assertDatabaseTargetAllowed(env.DATABASE_URL, {
      confirmHost: env.TEST_DATABASE_CONFIRM_HOST,
      howToConfirm: "set TEST_DATABASE_CONFIRM_HOST to that database's hostname",
    });
    // The app falls back to real SMTP when MAIL_TRANSPORT is unset, so only an explicit outbox will do.
    if (env.MAIL_TRANSPORT !== "outbox") {
      throw new DatabaseTargetError("Tests need MAIL_TRANSPORT=outbox, so that no real email is sent.");
    }
    return target;
  } catch (err) {
    if (err instanceof DatabaseTargetError) throw new DatabaseTargetError(`Tests refused to start. ${err.message}`);
    throw err;
  }
}

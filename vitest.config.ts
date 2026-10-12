import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import type * as DbTarget from "./src/lib/db-target.ts";

/**
 * Whether this run can include the named project. Only an explicit list of
 * plain project names that leaves it out (e.g. `--project unit`) means no.
 * No list, wildcards and negations all count as yes.
 */
function runIncludesProject(argv: readonly string[], name: string): boolean {
  const selected: string[] = [];
  argv.forEach((arg, i) => {
    const match = /^(?:--project|-p)(?:=(.*))?$/.exec(arg);
    if (match) selected.push(match[1] ?? argv[i + 1] ?? "");
  });
  return selected.length === 0 || selected.some((p) => p === name || !/^[A-Za-z0-9_-]+$/.test(p));
}

export default defineConfig(async ({ mode }) => {
  // Loads .env.local so the tests use the same database as `npm run dev`.
  // Variables already set in the shell take precedence over the file.
  const integrationEnv = loadEnv(mode, process.cwd(), "");

  // Integration tests create and delete accounts. Before any worker starts,
  // refuse anything but the local database and the dev outbox.
  if (runIncludesProject(process.argv, "integration")) {
    // Imported by its real .ts path (as scripts/migrate.mts does) so Vite's config
    // loader needn't resolve an extensionless path; the type import keeps the types.
    const { assertSafeTestEnvironment }: typeof DbTarget = await import(
      new URL("./src/lib/db-target.ts", import.meta.url).href
    );
    assertSafeTestEnvironment(integrationEnv);
  }

  return {
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    test: {
      environment: "node",
      projects: [
        {
          extends: true,
          test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: ["tests/integration/**/*.test.ts"],
            // Integration tests share one database; run them one file at a time.
            fileParallelism: false,
            testTimeout: 30_000,
            env: integrationEnv,
          },
        },
      ],
    },
  };
});

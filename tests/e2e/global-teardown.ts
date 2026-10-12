import pg from "pg";
import { loadTestEnvironment, TEST_DOMAIN } from "./support";

/** Removes every account the browser tests created. */
export default async function globalTeardown() {
  // Checked again right before the delete: a refusal here leaves the database untouched.
  loadTestEnvironment();
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%@${TEST_DOMAIN}`]);
  } finally {
    await client.end();
  }
}

"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { ac, roles } from "./permissions";

// Same-origin: the client talks to /api/auth on whatever host served the page.
export const authClient = createAuthClient({
  plugins: [adminClient({ ac, roles })],
});

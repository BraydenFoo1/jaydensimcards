/**
 * Data access layer for "who is signed in, and what may they do".
 *
 * Every protected page and server action calls one of these. The proxy only
 * does a cheap cookie-presence redirect; this is the check that actually
 * validates the session against the database on each request.
 */
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordAudit } from "./audit";
import { auth } from "./auth";
import { can, parseRole, type Capability } from "./authz";
import { isStaffRole, type RoleName } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  /** null when the stored role isn't one this app recognises: no capabilities. */
  role: RoleName | null;
  emailVerified: boolean;
  createdAt: Date;
};

export type CurrentSession = { user: CurrentUser; sessionId: string };

/** The signed-in user and their session id, or null. Never throws for a signed-out visitor. */
export async function getCurrentSession(): Promise<CurrentSession | null> {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;
  const { user, session } = result;
  // Banned users cannot hold a session (banning revokes them), but be explicit.
  if (user.banned) return null;
  return {
    sessionId: session.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: parseRole(user.role),
      emailVerified: user.emailVerified,
      createdAt: new Date(user.createdAt),
    },
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await getCurrentSession())?.user ?? null;
}

export async function requireSession(returnTo = "/portal"): Promise<CurrentSession> {
  const current = await getCurrentSession();
  if (!current) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return current;
}

export async function requireUser(returnTo = "/portal"): Promise<CurrentUser> {
  return (await requireSession(returnTo)).user;
}

export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser("/staff");
  if (!isStaffRole(user.role)) redirect("/portal");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireStaff();
  if (user.role !== "admin") redirect("/staff");
  return user;
}

export type ActionGate =
  | ({ ok: true } & CurrentSession)
  | { ok: false; status: 401 | 403; message: string };

/**
 * The gate every server action passes first: a fresh session read plus an
 * explicit capability check. Refusals by a signed-in user are audited.
 */
export async function authorizeAction(capability: Capability): Promise<ActionGate> {
  const current = await getCurrentSession();
  if (!current) {
    return { ok: false, status: 401, message: "Your session has ended. Sign in again to continue." };
  }
  if (!can(current.user.role, capability)) {
    await recordAudit({ actor: current.user, action: "authz.denied", detail: capability });
    return { ok: false, status: 403, message: "That action isn't available for your account." };
  }
  return { ok: true, ...current };
}

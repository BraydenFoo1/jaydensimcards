import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { isExposedAuthPath } from "@/lib/auth-http-surface";
import { serverEnv } from "@/lib/env";

const handlers = toNextJsHandler(auth);
const dashEnabled = Boolean(serverEnv().BETTER_AUTH_API_KEY);

const notFound = () => Response.json({ code: "NOT_FOUND", message: "Not found." }, { status: 404 });

/** Only the endpoints the site's own pages use are reachable (see auth-http-surface.ts). */
function guarded(handler: (request: Request) => Promise<Response>) {
  return (request: Request) => {
    const authPath = new URL(request.url).pathname.replace(/^\/api\/auth/, "");
    return isExposedAuthPath(request.method, authPath, { dashEnabled }) ? handler(request) : notFound();
  };
}

export const GET = guarded(handlers.GET);
export const POST = guarded(handlers.POST);

import { authErrorMessage, NETWORK_ERROR, type AuthAction, type AuthErrorLike } from "./auth-errors";

type FetchOptions = { onError: (ctx: { response: Response }) => void };

export type AuthCallResult<T> = { ok: true; data: T } | { ok: false; error: AuthErrorLike | null; message: string };

/**
 * Runs a Better Auth client call and normalises the outcome into either data
 * or a user-facing message, including the retry-after time on rate limits.
 */
export async function callAuth<T>(
  action: AuthAction,
  run: (fetchOptions: FetchOptions) => Promise<{ data: T | null; error: AuthErrorLike | null }>,
): Promise<AuthCallResult<T>> {
  let retryAfter: number | undefined;
  const fetchOptions: FetchOptions = {
    onError: ({ response }) => {
      const header = response.headers.get("X-Retry-After");
      if (header) retryAfter = Number(header);
    },
  };
  try {
    const { data, error } = await run(fetchOptions);
    if (error) return { ok: false, error, message: authErrorMessage(error, action, retryAfter) };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: null, message: NETWORK_ERROR };
  }
}

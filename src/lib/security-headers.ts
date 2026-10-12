/**
 * Response security headers for every route.
 *
 * Content-Security-Policy trade-off: this app uses Partial Prerendering
 * (cacheComponents), whose static shells cannot carry a per-request nonce, and
 * Next.js streams inline bootstrap scripts. So inline scripts must be allowed
 * ('unsafe-inline'). The policy still blocks scripts, connections, fonts and
 * images from any other origin, eval() in production, plugins, <base>
 * hijacking, forms posting elsewhere, and framing. React's output escaping and
 * the absence of raw-HTML rendering remain the primary XSS defence.
 */
export type HeaderOptions = { dev: boolean; httpsOnly: boolean };

export function contentSecurityPolicy({ dev, httpsOnly }: HeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(dev ? ["ws:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (httpsOnly) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()",
    },
  ];
  if (options.httpsOnly) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}

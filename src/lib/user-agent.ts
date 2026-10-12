/**
 * Just enough user-agent parsing to label a session "Chrome on macOS".
 * Display only: never used for any security decision.
 */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari"
    : /curl\//i.test(ua) ? "curl"
    : "Browser";
  const os =
    /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "macOS"
    : /Windows/.test(ua) ? "Windows"
    : /CrOS/.test(ua) ? "ChromeOS"
    : /Linux/.test(ua) ? "Linux"
    : null;
  return os ? `${browser} on ${os}` : browser;
}

/** Shows enough of an IP for someone to recognise their own network, no more. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "Unknown location";
  if (ip.includes(".")) {
    const octets = ip.split(".");
    return octets.length === 4 ? `${octets[0]}.${octets[1]}.x.x` : "Unknown location";
  }
  const groups = ip.split(":").filter(Boolean);
  return groups.length >= 2 ? `${groups[0]}:${groups[1]}:…` : "Unknown location";
}

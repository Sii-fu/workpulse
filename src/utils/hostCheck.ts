// Host/Origin allow-list for /api (S3, DNS rebinding). A malicious website can make a browser send
// requests to 127.0.0.1 under its own hostname; those carry a foreign Host/Origin and are refused.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

// "localhost:3000" -> "localhost", "[::1]:3000" -> "[::1]"
function hostnameOf(hostHeader: string): string {
  const h = hostHeader.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(0, h.indexOf(']') + 1);
  return h.split(':')[0];
}

export function isAllowedHostHeader(hostHeader: string | undefined, extraHosts: string[] = []): boolean {
  if (!hostHeader) return false;
  const name = hostnameOf(hostHeader);
  return LOCAL_HOSTS.has(name) || extraHosts.map((h) => h.toLowerCase()).includes(name);
}

// Origin is absent on same-origin GET and many non-browser clients; when present it must be local too.
export function isAllowedOrigin(origin: string | undefined, extraHosts: string[] = []): boolean {
  if (!origin) return true;
  try {
    return isAllowedHostHeader(new URL(origin).host, extraHosts);
  } catch {
    return false;
  }
}

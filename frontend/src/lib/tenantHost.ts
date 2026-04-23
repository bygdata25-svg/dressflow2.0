export function getTenantSlugFromHostname(
  hostname = window.location.hostname
): string | null {
  const host = hostname.toLowerCase().trim();

  if (!host) return null;

  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".localhost")
  ) {
    return null;
  }

  const parts = host.split(".").filter(Boolean);

  // ej: gorof.dressflow.ai
  if (parts.length >= 3) {
    const subdomain = parts[0];

    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      return subdomain;
    }
  }

  return null;
}

export function resolveMediaUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const cleanPath = `/${path.replace(/^\/+/, "")}`;

  if (cleanPath.startsWith("/uploads/")) {
    const apiBase =
      (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/api\/v1\/?$/, "");
    return `${apiBase}${cleanPath}`;
  }

  return cleanPath;
}

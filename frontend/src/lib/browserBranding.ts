export function setBrowserTitle(title: string) {
  document.title = title;
}

export function setBrowserFavicon(url?: string | null) {
  const favicon = document.getElementById("app-favicon") as HTMLLinkElement | null;
  if (!favicon) return;

  favicon.href = url && url.trim() ? url : "/logo-icon.png";
}

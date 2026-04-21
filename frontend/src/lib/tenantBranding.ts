import { api } from "./api";

export async function fetchMyTenantBranding(): Promise<TenantBranding | null> {
  const response = await api.get("/tenants/me/branding");
  return response.data ?? null;
}

export type TenantBranding = {
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  accent_color?: string | null;
  surface_color?: string | null;
  sidebar_color?: string | null;
};

const DEFAULT_BRANDING: Required<TenantBranding> = {
  logo_url: "",
  primary_color: "#2f2738",
  secondary_color: "#d9b8a8",
  accent_color: "#b98770",
  surface_color: "#ffffff",
  sidebar_color: "#faf7f3",
};

export function applyTenantBranding(branding?: TenantBranding | null) {
  const root = document.documentElement;
  const merged = {
    ...DEFAULT_BRANDING,
    ...(branding || {}),
  };

  root.style.setProperty("--tenant-primary", merged.primary_color);
  root.style.setProperty("--tenant-secondary", merged.secondary_color);
  root.style.setProperty("--tenant-accent", merged.accent_color);
  root.style.setProperty("--tenant-surface", merged.surface_color);
  root.style.setProperty("--tenant-sidebar", merged.sidebar_color);
  root.style.setProperty("--tenant-logo-url", merged.logo_url ? `url("${merged.logo_url}")` : "");
}

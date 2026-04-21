export const TOKEN_KEY = "access_token";

export type MeResponse = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  is_active?: boolean;
  is_superuser?: boolean;
  must_change_password?: boolean;
  tenant_id: string;
  tenant_name?: string | null;
  tenant_logo_url?: string | null;
  tenant_primary_color?: string | null;
  membership_id: string;
  role: string;
  impersonated: boolean;
  impersonated_by?: string | null;
  original_sub?: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  impersonated: boolean;
};

export type TenantBrandingResponse = {
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
};


function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function fetchMe(): Promise<MeResponse> {
  const token = getToken();

  if (!token) {
    throw new Error("No hay token de sesión");
  }

  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo obtener la sesión");
  }

  return res.json();
}

export async function impersonateMembership(
  membershipId: string
): Promise<TokenResponse> {
  const token = getToken();

  if (!token) {
    throw new Error("No hay token de sesión");
  }

  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/auth/impersonate/${membershipId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo iniciar la impersonación");
  }

  return res.json();
}

export async function exitImpersonation(): Promise<TokenResponse> {
  const token = getToken();

  if (!token) {
    throw new Error("No hay token de sesión");
  }

  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/exit-impersonation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo salir de la impersonación");
  }

  return res.json();
}

export async function fetchTenantBranding(
  slug: string
): Promise<TenantBrandingResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/public/tenant-branding/${slug}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "No se pudo obtener el branding del tenant");
  }

  return res.json();
}

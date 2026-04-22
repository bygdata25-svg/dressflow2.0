import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import {
  fetchTenantBranding,
  setToken,
  type TenantBrandingResponse,
} from "../lib/auth";

import { setBrowserFavicon, setBrowserTitle } from "../lib/browserBranding";
import "../styles/login-premium.css";

type LoginPageProps = {
  onLoginSuccess?: () => Promise<void> | void;
};

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { t } = useTranslation("common");
  const { tenantSlug } = useParams();
  
  useEffect(() => {
    if (branding?.name) {
      setBrowserTitle(`${branding.name} | DressFlow`);
      setBrowserFavicon(branding.logo_url || "/logo-icon.png");
    } else {
      setBrowserTitle("Ingresar | DressFlow");
      setBrowserFavicon("/logo-icon.png");
    }
  }, [branding]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branding, setBranding] = useState<TenantBrandingResponse | null>(null);

  useEffect(() => {
    const loadBranding = async () => {
      if (!tenantSlug) {
        setBranding(null);
        return;
      }

      try {
        const data = await fetchTenantBranding(tenantSlug);
        setBranding(data);
      } catch (err) {
        console.error("No se pudo cargar el branding del tenant:", err);
        setBranding(null);
      }
    };

    void loadBranding();
  }, [tenantSlug]);

  const tenantColor = useMemo(
    () => branding?.primary_color || "#c97f70",
    [branding]
  );

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);

      const response = await api.post("/auth/login", {
        email,
        password,
      });

      setToken(response.data.access_token);

      if (onLoginSuccess) {
        await onLoginSuccess();
      } else {
        window.location.href = "/";
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(t("login.error"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="df-login-page">
      <div className="df-login-shell">
        <div className="df-login-logo-wrap">
          <img
            src="/logo-full.png"
            alt="DressFlow"
            className="df-login-logo-full"
          />
        </div>

        <form
          onSubmit={handleLogin}
          className="df-login-card"
          style={
            {
              "--tenant-primary": tenantColor,
            } as React.CSSProperties
          }
        >
          <div className="df-login-heading">
            <h1 className="df-login-title">Iniciar sesión</h1>
            <p className="df-login-subtitle">
              Ingresá a tu espacio para gestionar vestidos, telas, cápsulas y
              ventas.
            </p>
          </div>

          {branding && (
            <div className="df-login-tenant-card">
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={branding.name}
                  className="df-login-tenant-logo"
                />
              ) : (
                <div
                  className="df-login-tenant-fallback"
                  style={{ background: "var(--tenant-primary)"}}
                >
                  {branding.name?.[0]?.toUpperCase() || "T"}
                </div>
              )}

              <div className="df-login-tenant-meta">
                <strong>{branding.name}</strong>
                <span>Espacio de trabajo</span>
              </div>
            </div>
          )}

          <div className="df-login-field">
            <label htmlFor="login-email" className="df-login-label">
              Usuario
            </label>
            <input
              id="login-email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="df-login-input"
              autoComplete="username"
            />
          </div>

          <div className="df-login-field">
            <label htmlFor="login-password" className="df-login-label">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="df-login-input"
              autoComplete="current-password"
            />
          </div>

          {error && <div className="df-login-error">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="df-login-submit"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <div className="df-login-tagline">FROM CHAOS TO FLOW</div>
        </form>
      </div>
    </section>
  );
}

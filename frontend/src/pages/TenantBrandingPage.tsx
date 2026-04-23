import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { applyTenantBranding } from "../lib/tenantBranding";
import "./DressesPage.css";

type MeResponse = {
  tenant_logo_url?: string | null;
  tenant_primary_color?: string | null;
};

export default function TenantBrandingPage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#3d3648");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loaded, setLoaded] = useState(false);

  const saveTimeout = useRef<number | null>(null);
  const successTimeout = useRef<number | null>(null);

  useEffect(() => {
    void loadBranding();

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
      if (successTimeout.current) {
        clearTimeout(successTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    applyTenantBranding({
      logo_url: logo,
      primary_color: primaryColor,
    });

    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
    }

    saveTimeout.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        setError("");
        setSuccess("");

        await api.put("/tenant-branding", {
          primary_color: primaryColor,
        });

        setSuccess("Color guardado automáticamente.");

        if (successTimeout.current) {
          clearTimeout(successTimeout.current);
        }

        successTimeout.current = window.setTimeout(() => {
          setSuccess("");
        }, 1800);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (typeof detail === "string") setError(detail);
        else if (detail?.message) setError(detail.message);
        else setError("No se pudo guardar el color.");
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
      }
    };
  }, [primaryColor, logo, loaded]);

  const loadBranding = async () => {
    try {
      setError("");
      const res = await api.get<MeResponse>("/auth/me");
      const currentLogo = res.data.tenant_logo_url || null;
      const currentColor = res.data.tenant_primary_color || "#3d3648";

      setLogo(currentLogo);
      setPrimaryColor(currentColor);

      applyTenantBranding({
        logo_url: currentLogo,
        primary_color: currentColor,
      });

      setLoaded(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo cargar el branding.");
    }
  };

  const handleUpload = async (file: File) => {
    try {
      setUploading(true);
      setError("");
      setSuccess("");

      const previewUrl = URL.createObjectURL(file);
      setLogo(previewUrl);

      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/tenant-branding/upload-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const persistedLogo = res.data.logo_url;
      setLogo(persistedLogo);

      applyTenantBranding({
        logo_url: persistedLogo,
        primary_color: primaryColor,
      });

      setSuccess("Logo actualizado correctamente.");

      if (successTimeout.current) {
        clearTimeout(successTimeout.current);
      }

      successTimeout.current = window.setTimeout(() => {
        setSuccess("");
      }, 1800);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo subir el logo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="df-pro-page">
      <header
        className="df-pro-page__hero"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          width: "100%",
        }}
      >
        <div>
          <p className="df-pro-page__eyebrow">Identidad visual</p>
          <h1 className="df-pro-page__title">Branding</h1>
          <p className="df-pro-page__subtitle">
            Personalizá la identidad visual de tu empresa dentro de DressFlow.
          </p>
        </div>
      </header>

      {error && (
        <section className="df-pro-card">
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#fdecec",
              color: "#9a2f2f",
            }}
          >
            {error}
          </div>
        </section>
      )}

      {success && (
        <section className="df-pro-card">
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#ecfdf3",
              color: "#027a48",
            }}
          >
            {success}
          </div>
        </section>
      )}

      <section className="df-pro-card">
        <h3 style={{ marginTop: 0, marginBottom: 18 }}>Logo</h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 18,
              border: "1px solid #eadfd7",
              background: "#fff",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
              padding: 8,
            }}
          >
            {logo ? (
              <img
                src={logo}
                alt="Tenant logo"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 12,
                  color: "#8a7f78",
                  textAlign: "center",
                }}
              >
                Sin logo
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label className="df-pro-label" style={{ marginBottom: 0 }}>
              Subir logo
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  void handleUpload(e.target.files[0]);
                }
              }}
            />

            <span style={{ fontSize: 12, color: "#8a7f78" }}>
              Recomendado: PNG con fondo transparente.
            </span>

            {uploading && (
              <span style={{ fontSize: 13, color: "#8a7f78" }}>
                Subiendo logo...
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="df-pro-card">
        <h3 style={{ marginTop: 0, marginBottom: 18 }}>Color principal</h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => {
              const color = e.target.value;
              setError("");
              setSuccess("");
              setPrimaryColor(color);

              applyTenantBranding({
                logo_url: logo,
                primary_color: color,
              });
            }}
            style={{
              width: 52,
              height: 40,
              border: "1px solid #eadfd7",
              borderRadius: 10,
              background: "#fff",
              padding: 4,
              cursor: "pointer",
            }}
          />

          <span
            style={{
              fontSize: 14,
              color: "#8a7f78",
              fontWeight: 600,
            }}
          >
            {primaryColor}
          </span>

          <span
            style={{
              fontSize: 12,
              color: saving ? "#8a7f78" : "#98a2b3",
              fontWeight: 600,
            }}
          >
            {saving ? "Guardando..." : "Autosave activado"}
          </span>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 16,
            background: primaryColor,
            color: "#fff",
            display: "grid",
            gap: 8,
            boxShadow: "0 10px 24px rgba(61, 54, 72, 0.10)",
            transition: "background 180ms ease",
          }}
        >
          <span style={{ fontSize: 14, opacity: 0.85 }}>Vista previa</span>
          <span style={{ fontSize: 28, fontWeight: 700 }}>Preview de marca</span>
          <span style={{ fontSize: 14, opacity: 0.92 }}>
            Así se verán botones, acentos y elementos principales de la interfaz.
          </span>
        </div>
      </section>
    </section>
  );
}

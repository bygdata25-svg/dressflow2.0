import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { applyTenantBranding } from "../lib/tenantBranding";
import "./DressesPage.css";

type MeResponse = {
  tenant_logo_url?: string | null;
  tenant_primary_color?: string | null;
  tenant_default_language?: "es" | "en" | null;
};

export default function TenantBrandingPage() {
  const { t } = useTranslation("branding");

  const [logo, setLogo] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#3d3648");
  const [defaultLanguage, setDefaultLanguage] = useState<"es" | "en">("es");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const saveTimeout = useRef<number | null>(null);
  const successTimeout = useRef<number | null>(null);

  useEffect(() => {
    void loadBranding();

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (successTimeout.current) clearTimeout(successTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;

    applyTenantBranding({
      logo_url: logo,
      primary_color: primaryColor,
    });

    if (saveTimeout.current) clearTimeout(saveTimeout.current);

    saveTimeout.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        setError("");
        setSuccess("");

        await api.put("/tenant-branding", {
          primary_color: primaryColor,
          default_language: defaultLanguage,
        });

        setSuccess(t("color.saved"));

        if (successTimeout.current) clearTimeout(successTimeout.current);

        successTimeout.current = window.setTimeout(() => {
          setSuccess("");
        }, 1800);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        if (typeof detail === "string") setError(detail);
        else if (detail?.message) setError(detail.message);
        else setError(t("color.saveError"));
      } finally {
        setSaving(false);
      }
    }, 800);

    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [primaryColor, defaultLanguage, logo, loaded, t]);

  const loadBranding = async () => {
    try {
      setError("");
      const res = await api.get<MeResponse>("/auth/me");

      const currentLogo = res.data.tenant_logo_url || null;
      const currentColor = res.data.tenant_primary_color || "#3d3648";
      const currentLanguage = res.data.tenant_default_language || "es";

      setLogo(currentLogo);
      setPrimaryColor(currentColor);
      setDefaultLanguage(currentLanguage);

      applyTenantBranding({
        logo_url: currentLogo,
        primary_color: currentColor,
      });

      setLoaded(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("loadError"));
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

      setSuccess(t("logo.updated"));

      if (successTimeout.current) clearTimeout(successTimeout.current);

      successTimeout.current = window.setTimeout(() => {
        setSuccess("");
      }, 1800);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("logo.uploadError"));
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
          <p className="df-pro-page__eyebrow">{t("eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("subtitle")}</p>
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

      {/* LOGO */}
      <section className="df-pro-card">
        <h3 style={{ marginTop: 0, marginBottom: 18 }}>
          {t("logo.title")}
        </h3>

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
                alt={t("logo.alt")}
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
                {t("logo.noLogo")}
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <label className="df-pro-label" style={{ marginBottom: 0 }}>
              {t("logo.upload")}
            </label>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <label
                htmlFor="tenant-logo-upload"
                style={{
                  background: primaryColor,
                  color: "#fff",
                  padding: "8px 14px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: "0 8px 18px rgba(61, 54, 72, 0.12)",
                }}
              >
                {t("logo.selectFile")}
              </label>

              <span style={{ fontSize: 13, color: "#8a7f78" }}>
                {selectedFileName || t("logo.noFileSelected")}
              </span>

              <input
                id="tenant-logo-upload"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;

                  if (file) {
                    setSelectedFileName(file.name);
                    void handleUpload(file);
                  } else {
                    setSelectedFileName(null);
                  }
                }}
              />
            </div>

            <span style={{ fontSize: 12, color: "#8a7f78" }}>
              {t("logo.recommended")}
            </span>

            {uploading && (
              <span style={{ fontSize: 13, color: "#8a7f78" }}>
                {t("logo.uploading")}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* COLOR */}
      <section className="df-pro-card">
        <h3 style={{ marginTop: 0, marginBottom: 18 }}>
          {t("color.title")}
        </h3>

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
            {saving ? t("color.saving") : t("color.autosave")}
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
          <span style={{ fontSize: 14, opacity: 0.85 }}>
            {t("preview.label")}
          </span>
          <span style={{ fontSize: 28, fontWeight: 700 }}>
            {t("preview.title")}
          </span>
          <span style={{ fontSize: 14, opacity: 0.92 }}>
            {t("preview.description")}
          </span>
        </div>
      </section>

      {/* LANGUAGE */}
      <section className="df-pro-card">
        <h3 style={{ marginTop: 0, marginBottom: 18 }}>
          {t("language.title")}
        </h3>

        <div
          style={{
            display: "grid",
            gap: 10,
            maxWidth: 420,
          }}
        >
          <label className="df-pro-label">
            {t("language.defaultTenantLanguage")}
          </label>

          <select
            className="df-pro-select"
            value={defaultLanguage}
            onChange={(e) => {
              setError("");
              setSuccess("");
              setDefaultLanguage(e.target.value as "es" | "en");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #eadfd7",
              background: "#fff",
              fontWeight: 600,
              color: "#3d3648",
            }}
          >
            <option value="es">{t("language.spanish")}</option>
            <option value="en">{t("language.english")}</option>
          </select>

          <span style={{ fontSize: 12, color: "#8a7f78" }}>
            {t("language.help")}
          </span>
        </div>
      </section>
    </section>
  );
}

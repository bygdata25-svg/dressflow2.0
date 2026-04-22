import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { fetchCapsules, type Capsule } from "../../lib/capsules";
import { resolveMediaUrl } from "../../lib/media";
import { FormActions } from "../common/FormActions";

type DressPayload = {
  code: string;
  name: string;
  description: string | null;
  size: string | null;
  color: string | null;
  status: string;
  sale_price: number | null;
  rental_price: number | null;
  capsule_id: string | null;
};

type DressFormState = {
  code: string;
  name: string;
  description: string;
  size: string;
  color: string;
  status: string;
  sale_price: string;
  rental_price: string;
  capsule_id: string;
};

type DressInitialData = Partial<DressFormState> & {
  id?: string;
  main_image_url?: string | null;
  sale_price?: string | number | null;
  rental_price?: string | number | null;
  status?: string;
};

type DressStatusHistoryItem = {
  from: string;
  to: string;
  date: string;
  user?: string;
};

type DressFormProps = {
  mode?: "create" | "edit";
  initialData?: DressInitialData;
  onCreated?: () => void | Promise<void>;
  onUpdated?: () => void | Promise<void>;
  onCancel?: () => void;
};

const initialState: DressFormState = {
  code: "",
  name: "",
  description: "",
  size: "",
  color: "",
  status: "AVAILABLE",
  sale_price: "",
  rental_price: "",
  capsule_id: "",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontSize: 13,
  fontWeight: 700,
  color: "var(--df-text-strong, #111827)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 14,
  border: "1px solid var(--df-border, #d1d5db)",
  background: "#fff",
  padding: "0 14px",
  fontSize: 14,
  color: "var(--df-text-strong, #111827)",
  outline: "none",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  padding: "12px 14px",
  resize: "vertical",
};

function formatStatus(status: string) {
  switch (String(status || "").toUpperCase()) {
    case "AVAILABLE":
      return "Disponible";
    case "CLEANING":
      return "Limpieza";
    case "MAINTENANCE":
      return "Mantenimiento";
    case "LOANED":
      return "Prestado";
    case "RENTED":
      return "Alquilado";
    case "SOLD":
      return "Vendido";
    case "RETIRED":
      return "Retirado";
    default:
      return status || "—";
  }
}

function statusIcon(status: string) {
  switch (String(status || "").toUpperCase()) {
    case "AVAILABLE":
      return "↺";
    case "CLEANING":
      return "🧼";
    case "MAINTENANCE":
      return "🔧";
    case "LOANED":
      return "📦";
    case "RENTED":
      return "👗";
    case "SOLD":
      return "✦";
    case "RETIRED":
      return "•";
    default:
      return "•";
  }
}

function statusAccent(status: string) {
  switch (String(status || "").toUpperCase()) {
    case "AVAILABLE":
      return "#027a48";
    case "CLEANING":
      return "#0f766e";
    case "MAINTENANCE":
      return "#b45309";
    case "LOANED":
      return "#7a5af8";
    case "RENTED":
      return "#b54708";
    case "SOLD":
      return "#7c3aed";
    case "RETIRED":
      return "#6b7280";
    default:
      return "#7a5af8";
  }
}


function userInitials(user?: string) {
  if (!user) return "?";
  return user
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DressForm({
  mode = "create",
  initialData,
  onCreated,
  onUpdated,
  onCancel,
}: DressFormProps) {
  const { t } = useTranslation(["common", "dresses"]);

  const [form, setForm] = useState<DressFormState>(initialState);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loadingCapsules, setLoadingCapsules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [statusHistory, setStatusHistory] = useState<DressStatusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const existingImageUrl = resolveMediaUrl(initialData?.main_image_url || null);

  useEffect(() => {
    const loadCapsules = async () => {
      try {
        setLoadingCapsules(true);
        const data = await fetchCapsules();
        setCapsules(data.filter((c) => c.is_active));
      } catch (err) {
        console.error("Error cargando cápsulas", err);
      } finally {
        setLoadingCapsules(false);
      }
    };

    void loadCapsules();
  }, []);

  useEffect(() => {
    if (mode === "edit" && initialData) {
      setForm({
        code: initialData.code || "",
        name: initialData.name || "",
        description: initialData.description || "",
        size: initialData.size || "",
        color: initialData.color || "",
        status: initialData.status || "AVAILABLE",
        sale_price:
          initialData.sale_price !== undefined &&
          initialData.sale_price !== null
            ? String(initialData.sale_price)
            : "",
        rental_price:
          initialData.rental_price !== undefined &&
          initialData.rental_price !== null
            ? String(initialData.rental_price)
            : "",
        capsule_id: initialData.capsule_id || "",
      });
    } else {
      setForm(initialState);
    }

    setError("");
    setImageFile(null);
    setImagePreview(null);
  }, [mode, initialData]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    const loadStatusHistory = async () => {
      if (mode !== "edit" || !initialData?.id) {
        setStatusHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);
        const response = await api.get<DressStatusHistoryItem[]>(
          `/dresses/${initialData.id}/status-history`
        );
        setStatusHistory(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Error cargando historial de estado", err);
        setStatusHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    void loadStatusHistory();
  }, [mode, initialData?.id]);

  const payload = useMemo<DressPayload>(() => {
    return {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      size: form.size.trim() || null,
      color: form.color.trim() || null,
      status: form.status,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      rental_price: form.rental_price ? Number(form.rental_price) : null,
      capsule_id: form.capsule_id || null,
    };
  }, [form]);

  const handleChange =
    (field: keyof DressFormState) =>
    (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      setForm((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
      if (error) setError("");
    };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
  };

  const resetForm = () => {
    if (mode === "edit" && initialData) {
      setForm({
        code: initialData.code || "",
        name: initialData.name || "",
        description: initialData.description || "",
        size: initialData.size || "",
        color: initialData.color || "",
        status: initialData.status || "AVAILABLE",
        sale_price:
          initialData.sale_price !== undefined &&
          initialData.sale_price !== null
            ? String(initialData.sale_price)
            : "",
        rental_price:
          initialData.rental_price !== undefined &&
          initialData.rental_price !== null
            ? String(initialData.rental_price)
            : "",
        capsule_id: initialData.capsule_id || "",
      });
    } else {
      setForm(initialState);
    }

    setError("");
    clearImage();
  };

  const uploadImageIfNeeded = async (dressId: string) => {
    if (!imageFile) return;

    const formData = new FormData();
    formData.append("file", imageFile);

    await api.post(`/dresses/${dressId}/images`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!payload.code || !payload.name) {
      setError("Código y nombre son obligatorios.");
      return;
    }

    try {
      setSubmitting(true);

      if (mode === "edit" && initialData?.id) {
        await api.put(`/dresses/${initialData.id}`, payload);
        await uploadImageIfNeeded(initialData.id);

        if (onUpdated) {
          await onUpdated();
        }
      } else {
        const response = await api.post("/dresses", payload);
        const dress = response.data;
        await uploadImageIfNeeded(dress.id);

        if (onCreated) {
          await onCreated();
        }
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("common:errors.savingData"));
    } finally {
      setSubmitting(false);
    }
  };

  const previewUrl = imagePreview || existingImageUrl || null;

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
      <style>{`
        @keyframes dfTimelinePulse {
          0% {
            box-shadow: 0 0 0 0 rgba(122, 90, 248, 0.18);
            transform: scale(1);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(122, 90, 248, 0);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(122, 90, 248, 0);
            transform: scale(1);
          }
        }

        .df-dress-timeline {
          position: relative;
          display: grid;
          gap: 14px;
        }

        .df-dress-timeline::before {
          content: "";
          position: absolute;
          left: 10px;
          top: 10px;
          bottom: 10px;
          width: 2px;
          background: linear-gradient(180deg, #e9e5f3 0%, #ddd6eb 100%);
          border-radius: 999px;
        }

        .df-dress-timeline__item {
          position: relative;
          display: grid;
          grid-template-columns: 22px 38px 1fr;
          gap: 12px;
          align-items: start;
        }

        .df-dress-timeline__node {
          position: relative;
          z-index: 2;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          background: #fff;
          display: grid;
          place-items: center;
          margin-top: 4px;
          font-size: 12px;
          line-height: 1;
          animation: dfTimelinePulse 2.8s ease-in-out infinite;
        }

        .df-dress-timeline__avatar {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 800;
          margin-top: 0;
        }

        .df-dress-timeline__card {
          padding: 12px 14px;
          border-radius: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #faf9fc 100%);
          border: 1px solid #e8e4ee;
          box-shadow: 0 10px 24px rgba(20, 17, 28, 0.04);
        }

        .df-dress-timeline__title {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 14px;
          font-weight: 700;
          color: #111827;
        }

        .df-dress-timeline__arrow {
          color: #94a3b8;
          font-weight: 700;
        }

        .df-dress-timeline__meta {
          margin-top: 6px;
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <label style={labelStyle}>Imagen</label>

          <div
            style={{
              border: "1px dashed var(--df-border, #d1d5db)",
              borderRadius: 18,
              background: "#fafafa",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "3 / 4",
                background: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview vestido"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: "#6b7280",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  Sin imagen
                </div>
              )}
            </div>

            <div
              style={{
                padding: 12,
                display: "grid",
                gap: 10,
                borderTop: "1px solid #e5e7eb",
                background: "#fff",
              }}
            >
              <label
                style={{
                  minHeight: 40,
                  borderRadius: 12,
                  border: "1px solid #d7dce5",
                  background: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  color: "#111827",
                }}
              >
                Seleccionar imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              </label>

              {imageFile && (
                <>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                      wordBreak: "break-word",
                    }}
                  >
                    {imageFile.name}
                  </div>

                  <button
                    type="button"
                    onClick={clearImage}
                    style={{
                      minHeight: 40,
                      borderRadius: 12,
                      border: "1px solid #d7dce5",
                      background: "#ffffff",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      color: "#111827",
                    }}
                  >
                    Quitar imagen
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "span 3" }}>
            <label style={labelStyle}>{t("dresses:fields.code")}</label>
            <input
              className="df-pro-input"
              value={form.code}
              onChange={handleChange("code")}
              placeholder="V-001"
              readOnly={mode === "edit"}
              style={{
                ...inputStyle,
                ...(mode === "edit"
                  ? {
                      background: "#f8fafc",
                      color: "#64748b",
                      cursor: "not-allowed",
                    }
                  : {}),
              }}
            />
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label style={labelStyle}>{t("dresses:fields.name")}</label>
            <input
              className="df-pro-input"
              style={inputStyle}
              value={form.name}
              onChange={handleChange("name")}
              placeholder="Vestido Gala"
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>{t("dresses:fields.size")}</label>
            <input
              className="df-pro-input"
              style={inputStyle}
              value={form.size}
              onChange={handleChange("size")}
              placeholder="M"
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>{t("dresses:fields.color")}</label>
            <input
              className="df-pro-input"
              style={inputStyle}
              value={form.color}
              onChange={handleChange("color")}
              placeholder="Negro"
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Cápsula</label>
            <select
              className="df-pro-select"
              style={inputStyle}
              value={form.capsule_id}
              onChange={handleChange("capsule_id")}
              disabled={loadingCapsules}
            >
              <option value="">Sin cápsula</option>
              {capsules.map((capsule) => (
                <option key={capsule.id} value={capsule.id}>
                  {capsule.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Precio compra</label>
            <input
              className="df-pro-input"
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.sale_price}
              onChange={handleChange("sale_price")}
              placeholder="0.00"
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label style={labelStyle}>Precio alquiler</label>
            <input
              className="df-pro-input"
              style={inputStyle}
              type="number"
              min="0"
              step="0.01"
              value={form.rental_price}
              onChange={handleChange("rental_price")}
              placeholder="0.00"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>{t("dresses:fields.description")}</label>
            <textarea
              className="df-pro-input"
              style={textareaStyle}
              value={form.description}
              onChange={handleChange("description")}
              placeholder="Descripción"
              rows={4}
            />
          </div>
        </div>
      </div>

      {mode === "edit" && (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 20,
            padding: 18,
            background: "#fff",
            display: "grid",
            gap: 14,
          }}
        >
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 800,
                color: "#1f2937",
              }}
            >
              Historial de estado
            </h4>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              Seguimiento operativo del vestido.
            </p>
          </div>

          {loadingHistory ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "#f8fafc",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Cargando historial...
            </div>
          ) : statusHistory.length === 0 ? (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                background: "#f8fafc",
                color: "#64748b",
                fontSize: 13,
              }}
            >
              Todavía no hay cambios de estado registrados.
            </div>
          ) : (
            <div className="df-dress-timeline">
              {statusHistory.map((item, index) => (
                <div
                  key={`${item.date}-${index}`}
                  className="df-dress-timeline__item"
                >
                  <div
                    className="df-dress-timeline__node"
                    style={{
                      border: `2px solid ${statusAccent(item.to)}`,
                      color: statusAccent(item.to),
                    }}
                  >
                    {statusIcon(item.to)}
                  </div>

                  <div
                    className="df-dress-timeline__avatar"
                    style={{
                      background: "transparent",
                      color: "#9ca3af",
                      border: "1px solid #e5e7eb",
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                  >
                    {userInitials(item.user)}
                  </div>

                  <div className="df-dress-timeline__card">
                    <div className="df-dress-timeline__title">
                      <span style={{ color: statusAccent(item.from) }}>
                        {statusIcon(item.from)} {formatStatus(item.from)}
                      </span>
                      <span className="df-dress-timeline__arrow">→</span>
                      <span style={{ color: statusAccent(item.to) }}>
                        {statusIcon(item.to)} {formatStatus(item.to)}
                      </span>
                    </div>
                    <div
                      className="df-dress-timeline__meta"
                      style={{
                        opacity: 0.7,
                        fontSize: 11,
                      }}
                    >
                      {new Date(item.date).toLocaleString("es-AR")}
                      {item.user ? ` · ${item.user}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            background: "#fff1f2",
            color: "#9f1239",
            border: "1px solid #fecdd3",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <FormActions
        saving={submitting}
        submitLabel={
          mode === "edit" ? t("common:actions.update") : t("common:actions.create")
        }
        onClear={resetForm}
        onCancel={onCancel}
      />
    </form>
  );
}

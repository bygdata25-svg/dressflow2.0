import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { fetchCapsules, type Capsule } from "../lib/capsules";

type Dress = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  size?: string | null;
  color?: string | null;
  status: string;
  main_image_url?: string | null;
  capsule_id?: string | null;
  capsule_name?: string | null;
};

type DressImage = {
  id: string;
  dress_id: string;
  file_url: string;
  is_primary: boolean;
  position: number;
};

type DressLoanHistory = {
  id: string;
  start_date: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  status: string;
  customer_name?: string | null;
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

const API_BASE_URL = "http://localhost:8000";

export default function EditDressPage() {
  const { t } = useTranslation(["common", "dresses"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [dress, setDress] = useState<Dress | null>(null);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [images, setImages] = useState<DressImage[]>([]);
  const [loans, setLoans] = useState<DressLoanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState<DressFormState>({
    code: "",
    name: "",
    description: "",
    size: "",
    color: "",
    status: "AVAILABLE",
    sale_price: "",
    rental_price: "",
    capsule_id: "",
  });

  const loadDress = async () => {
    try {
      setLoading(true);
      setError("");

      const [dressResponse, imagesResponse, loansResponse, capsulesData] =
        await Promise.all([
          api.get(`/dresses/${id}`),
          api.get(`/dresses/${id}/images`),
          api.get(`/dresses/${id}/loans`),
          fetchCapsules(),
        ]);

      const d = dressResponse.data;

      setDress(d);
      setImages(Array.isArray(imagesResponse.data) ? imagesResponse.data : []);
      setLoans(Array.isArray(loansResponse.data) ? loansResponse.data : []);
      setCapsules(Array.isArray(capsulesData) ? capsulesData : []);

      setForm({
        code: d.code || "",
        name: d.name || "",
        description: d.description || "",
        size: d.size || "",
        color: d.color || "",
        status: d.status || "AVAILABLE",
        sale_price: d.sale_price != null ? String(d.sale_price) : "",
        rental_price: d.rental_price != null ? String(d.rental_price) : "",
        capsule_id: d.capsule_id || "",
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("dresses:edit.loadError")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      void loadDress();
    }
  }, [id]);

  const updateField = (field: keyof DressFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      status: form.status,
    };

    if (form.description.trim() !== "") {
      payload.description = form.description.trim();
    }

    if (form.size.trim() !== "") {
      payload.size = form.size.trim();
    }

    if (form.color.trim() !== "") {
      payload.color = form.color.trim();
    }

    if (form.sale_price !== "") {
      payload.sale_price = Number(form.sale_price);
    }

    if (form.rental_price !== "") {
      payload.rental_price = Number(form.rental_price);
    }

    if (form.capsule_id !== "") {
      payload.capsule_id = form.capsule_id;
    }

    return payload;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!id) return;

    if (!form.code.trim()) {
      setError("El código es obligatorio.");
      return;
    }

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (form.sale_price !== "" && Number.isNaN(Number(form.sale_price))) {
      setError("El precio de compra no es válido.");
      return;
    }

    if (form.rental_price !== "" && Number.isNaN(Number(form.rental_price))) {
      setError("El precio de alquiler no es válido.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = buildPayload();

      await api.put(`/dresses/${id}`, payload);

      await loadDress();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("dresses:edit.saveError")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      await api.post(`/dresses/${id}/images`, formData);

      await loadDress();
      event.target.value = "";
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("dresses:images.uploadError")
      );
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div>{t("common:status.loading")}</div>;
  if (!dress) return <div>{t("dresses:edit.notFound")}</div>;

  return (
    <section style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>{t("dresses:edit.title")}</h1>
        <button type="button" onClick={() => navigate("/dresses")}>
          {t("common:actions.back")}
        </button>
      </div>

      {error && <div style={{ color: "#b42318" }}>{error}</div>}

      <form onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input
            value={form.code}
            onChange={(e) => updateField("code", e.target.value)}
            placeholder="Código"
          />
          <input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Nombre"
          />
        </div>

        <textarea
          value={form.description}
          onChange={(e) => updateField("description", e.target.value)}
          placeholder="Descripción"
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <input
            value={form.size}
            onChange={(e) => updateField("size", e.target.value)}
            placeholder="Talle"
          />
          <input
            value={form.color}
            onChange={(e) => updateField("color", e.target.value)}
            placeholder="Color"
          />
          <select
            value={form.status}
            onChange={(e) => updateField("status", e.target.value)}
          >
            <option value="AVAILABLE">Disponible</option>
            <option value="LOANED">Prestado</option>
            <option value="CLEANING">Limpieza</option>
            <option value="MAINTENANCE">Mantenimiento</option>
            <option value="RETIRED">Retirado</option>
            <option value="SOLD">Vendido</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.sale_price}
            onChange={(e) => updateField("sale_price", e.target.value)}
            placeholder="Precio de compra"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.rental_price}
            onChange={(e) => updateField("rental_price", e.target.value)}
            placeholder="Precio de alquiler / venta"
          />
        </div>

        <div>
          <label>Cápsula</label>
          <select
            value={form.capsule_id}
            onChange={(e) => updateField("capsule_id", e.target.value)}
          >
            <option value="">Sin cápsula</option>
            {capsules.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <section style={{ display: "grid", gap: 12 }}>
        <h2>Imágenes</h2>

        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
        </div>

        {uploading && <div>Subiendo imagen...</div>}

        {images.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {images.map((image) => (
              <div
                key={image.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                <img
                  src={
                    image.file_url?.startsWith("http")
                      ? image.file_url
                      : `${API_BASE_URL}${image.file_url}`
                  }
                  alt="Vestido"
                  style={{
                    width: "100%",
                    height: 220,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <div style={{ padding: 8, fontSize: 12 }}>
                  {image.is_primary ? "Principal" : `Posición ${image.position}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>No hay imágenes cargadas.</div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h2>Historial de préstamos</h2>

        {loans.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {loans.map((loan) => (
              <div
                key={loan.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div><strong>Cliente:</strong> {loan.customer_name || "—"}</div>
                <div><strong>Inicio:</strong> {loan.start_date}</div>
                <div>
                  <strong>Devolución esperada:</strong> {loan.expected_return_date || "—"}
                </div>
                <div>
                  <strong>Devolución real:</strong> {loan.actual_return_date || "—"}
                </div>
                <div><strong>Estado:</strong> {loan.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div>Este vestido no tiene historial de préstamos.</div>
        )}
      </section>
    </section>
  );
}

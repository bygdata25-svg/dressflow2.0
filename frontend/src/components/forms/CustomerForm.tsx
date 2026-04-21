import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { FormActions } from "../common/FormActions";

type Customer = {
  id: string;
  code?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type Props = {
  customer?: Customer | null;
  onSuccess: () => void;
  onCancel: () => void;
};

export function CustomerForm({ customer, onSuccess, onCancel }: Props) {
  const [form, setForm] = useState({
    code: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!customer?.id;

  useEffect(() => {
    if (customer) {
      setForm({
        code: customer.code || "",
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        notes: customer.notes || "",
      });
    } else {
      setForm({
        code: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        notes: "",
      });
    }

    setError("");
  }, [customer]);

  const handleClear = () => {
    if (customer) {
      setForm({
        code: customer.code || "",
        first_name: customer.first_name || "",
        last_name: customer.last_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        notes: customer.notes || "",
      });
    } else {
      setForm({
        code: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        notes: "",
      });
    }
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.code.trim()) {
      setError("El código es obligatorio.");
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        code: form.code.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (customer?.id) {
        await api.put(`/customers/${customer.id}`, payload);
      } else {
        await api.post("/customers", payload);
      }

      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(customer ? "No se pudo actualizar el cliente." : "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: 16,
      }}
    >
      <div style={{ gridColumn: "span 3" }}>
        <label className="df-pro-label">Código</label>
        <input
          className={`df-pro-input ${isEditing ? "df-pro-input--readonly" : ""}`}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder="CLI-0001"
          readOnly={isEditing}
        />
      </div>

      <div style={{ gridColumn: "span 4" }}>
        <label className="df-pro-label">Nombre</label>
        <input
          className="df-pro-input"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          placeholder="María"
          autoFocus={!isEditing}
        />
      </div>

      <div style={{ gridColumn: "span 5" }}>
        <label className="df-pro-label">Apellido</label>
        <input
          className="df-pro-input"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          placeholder="Gómez"
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">Email</label>
        <input
          className="df-pro-input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="cliente@email.com"
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">Teléfono</label>
        <input
          className="df-pro-input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+54 9 11 5555 5555"
        />
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <label className="df-pro-label">Notas</label>
        <textarea
          className="df-pro-input"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Observaciones internas"
          rows={3}
          style={{ resize: "vertical", minHeight: 92 }}
        />
      </div>

      {error && (
        <div style={{ gridColumn: "1 / -1" }}>
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
        </div>
      )}

      <FormActions
        saving={saving}
        submitLabel={customer ? "Actualizar" : "Crear"}
        onClear={handleClear}
        onCancel={onCancel}
      />
    </form>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("customers");

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
      setError(t("form.validation.codeRequired"));
      return;
    }

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError(t("form.validation.nameRequired"));
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
      else {
        setError(
          customer
            ? t("form.messages.updateError")
            : t("form.messages.createError")
        );
      }
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
        <label className="df-pro-label">{t("form.fields.code")}</label>
        <input
          className={`df-pro-input ${isEditing ? "df-pro-input--readonly" : ""}`}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          placeholder={t("form.placeholders.code")}
          readOnly={isEditing}
        />
      </div>

      <div style={{ gridColumn: "span 4" }}>
        <label className="df-pro-label">{t("form.fields.firstName")}</label>
        <input
          className="df-pro-input"
          value={form.first_name}
          onChange={(e) => setForm({ ...form, first_name: e.target.value })}
          placeholder={t("form.placeholders.firstName")}
          autoFocus={!isEditing}
        />
      </div>

      <div style={{ gridColumn: "span 5" }}>
        <label className="df-pro-label">{t("form.fields.lastName")}</label>
        <input
          className="df-pro-input"
          value={form.last_name}
          onChange={(e) => setForm({ ...form, last_name: e.target.value })}
          placeholder={t("form.placeholders.lastName")}
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">{t("form.fields.email")}</label>
        <input
          className="df-pro-input"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder={t("form.placeholders.email")}
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">{t("form.fields.phone")}</label>
        <input
          className="df-pro-input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={t("form.placeholders.phone")}
        />
      </div>

      <div style={{ gridColumn: "1 / -1" }}>
        <label className="df-pro-label">{t("form.fields.notes")}</label>
        <textarea
          className="df-pro-input"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder={t("form.placeholders.notes")}
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
        submitLabel={customer ? t("common:actions.update") : t("common:actions.create")}
        onClear={handleClear}
        onCancel={onCancel}
      />
    </form>
  );
}

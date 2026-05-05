import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { useFieldConfig } from "../../hooks/useFieldConfig";
import { DynamicForm } from "../dynamic/DynamicForm";
import type { Supplier, SupplierType } from "../../types/supplier";

type SupplierFormProps = {
  supplier?: Supplier | null;
  onSuccess: () => void;
  onCancel: () => void;
};

type SupplierFormState = {
  name: string;
  supplier_code: string;
  origin: string;
  email: string;
  phone: string;
  notes: string;
  supplier_type: SupplierType;
};

const EMPTY_FORM: SupplierFormState = {
  name: "",
  supplier_code: "",
  origin: "",
  email: "",
  phone: "",
  notes: "",
  supplier_type: "FABRIC_SUPPLIER",
};

function normalizeSupplierType(value?: string | null): SupplierType {
  const upper = (value || "").toUpperCase();
  if (upper === "WORKSHOP") return "WORKSHOP";
  if (upper === "BOTH") return "BOTH";
  return "FABRIC_SUPPLIER";
}

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const { t } = useTranslation(["suppliers", "common"]);
  const fieldConfig = useFieldConfig("supplier");

  const [form, setForm] = useState<SupplierFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = useMemo(() => !!supplier?.id, [supplier]);

  useEffect(() => {
    if (supplier) {
      setForm({
        name: supplier.name || "",
        supplier_code: supplier.supplier_code || "",
        origin: supplier.origin || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        notes: supplier.notes || "",
        supplier_type: normalizeSupplierType(supplier.supplier_type),
      });
    } else {
      setForm(EMPTY_FORM);
    }

    setError("");
  }, [supplier]);

  function updateField<K extends keyof SupplierFormState>(
    key: K,
    value: SupplierFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (fieldConfig.isRequired("name") && !form.name.trim()) {
      setError(t("form.validation.nameRequired"));
      return;
    }

    if (fieldConfig.isRequired("supplier_type") && !form.supplier_type) {
      setError(t("form.validation.typeRequired"));
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        supplier_code: form.supplier_code.trim() || null,
        origin: form.origin.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        supplier_type: form.supplier_type,
      };

      if (isEdit && supplier?.id) {
        await api.put(`/suppliers/${supplier.id}`, payload);
      } else {
        await api.post("/suppliers", payload);
      }

      onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("form.messages.saveError")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="gf-form" onSubmit={handleSubmit} noValidate>
      <DynamicForm<SupplierFormState>
        fields={fieldConfig.fields}
        values={form}
        onChange={updateField}
        i18nNamespace="suppliers"
        selectOptions={{
          supplier_type: [
            {
              value: "FABRIC_SUPPLIER",
              label: t("types.FABRIC_SUPPLIER"),
            },
            {
              value: "WORKSHOP",
              label: t("types.WORKSHOP"),
            },
            {
              value: "BOTH",
              label: t("types.BOTH"),
            },
          ],
        }}
      />

      {error ? <div className="gf-alert gf-alert-error">{error}</div> : null}

      <div className="gf-modal-actions">
        <button
          type="button"
          className="gf-btn gf-btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          {t("form.actions.cancel")}
        </button>

        <button type="submit" className="gf-btn gf-btn-primary" disabled={saving}>
          {saving
            ? t("form.actions.saving")
            : isEdit
              ? t("form.actions.update")
              : t("form.actions.create")}
        </button>
      </div>
    </form>
  );
}

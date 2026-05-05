import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { FormActions } from "../components/common/FormActions";
import { DynamicForm } from "../components/dynamic/DynamicForm";
import { useFieldConfig } from "../hooks/useFieldConfig";
import { buildDynamicColumns } from "../lib/buildDynamicColumns";
import "../styles/pro-pages.css";

type Customer = {
  id: string;
  tenant_id: string;
  code: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  tax_id?: string | null;
};

type PaginatedCustomerResponse = {
  items: Customer[];
  page: number;
  page_size: number;
  total: number;
};

type CustomerFormState = {
  code: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  tax_id: string;
};

const PAGE_SIZE = 20;

const initialForm: CustomerFormState = {
  code: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  notes: "",
  tax_id: "",
};

function normalizeTaxId(value?: string | null): string {
  return String(value || "").replace(/\D/g, "");
}

function isValidTaxId(value?: string | null): boolean {
  const digits = normalizeTaxId(value);

  if (!digits) return true;

  // DNI
  if (digits.length === 7 || digits.length === 8) return true;

  // CUIT / CUIL con dígito verificador
  if (digits.length === 11) {
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += Number(digits[i]) * weights[i];
    }

    let checkDigit = 11 - (sum % 11);

    if (checkDigit === 11) checkDigit = 0;
    if (checkDigit === 10) checkDigit = 9;

    return checkDigit === Number(digits[10]);
  }

  return false;
}

function getTaxIdType(value?: string | null): "DNI" | "CUIT / CUIL" | "Documento" {
  const digits = normalizeTaxId(value);

  if (digits.length === 11) return "CUIT / CUIL";
  if (digits.length === 7 || digits.length === 8) return "DNI";

  return "Documento";
}

function formatTaxId(value?: string | null): string {
  const digits = normalizeTaxId(value);

  if (!digits) return "—";

  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }

  return digits;
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function CustomersPage() {
  const { t } = useTranslation(["common", "customers"]);
  const fc = useFieldConfig("customer");

  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(initialForm);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedCustomerResponse>("/customers", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
        },
      });

      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total || 0));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("common:errors.loadingData"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCustomers();
  }, [page, search]);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setError("");
    setForm(initialForm);
    setShowModal(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setError("");
    setForm({
      code: customer.code || "",
      first_name: customer.first_name || "",
      last_name: customer.last_name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      notes: customer.notes || "",
      tax_id: normalizeTaxId(customer.tax_id),
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setForm(initialForm);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const confirmed = window.confirm(t("customers:delete.confirm"));
    if (!confirmed) return;

    try {
      await api.delete(`/customers/${customerId}`);

      if (rows.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await loadCustomers();
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("customers:delete.error"));
    }
  };

  const saveCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (fc.isRequired("first_name") && !form.first_name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (fc.isRequired("last_name") && !form.last_name.trim()) {
      setError("El apellido es obligatorio.");
      return;
    }

    if (!isValidTaxId(form.tax_id)) {
      setError("El documento debe ser un DNI de 7 u 8 números, o un CUIT/CUIL válido.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        code: form.code.trim() || null,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        tax_id: normalizeTaxId(form.tax_id) || null,
      };

      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload);
      } else {
        await api.post("/customers", payload);
      }

      handleCloseModal();
      await loadCustomers();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("customers:form.messages.error", "No se pudo guardar el cliente."));
    } finally {
      setSaving(false);
    }
  };

  const renderers = useMemo(
    () => ({
      code: (row: Customer) => row.code || "—",
      first_name: (row: Customer) => row.first_name || "—",
      last_name: (row: Customer) => row.last_name || "—",
      full_name: (row: Customer) => `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—",
      email: (row: Customer) => row.email || "—",
      phone: (row: Customer) => row.phone || "—",
      notes: (row: Customer) => row.notes || "—",
      tax_id: (row: Customer) => formatTaxId(row.tax_id),
    }),
    []
  );

  const actionColumn: DataGridColumn<Customer> = useMemo(
    () => ({
      key: "actions",
      label: "",
      render: (row) => (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            title={t("common:actions.delete")}
            aria-label={t("common:actions.delete")}
            onClick={(e) => {
              e.stopPropagation();
              void handleDeleteCustomer(row.id);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid #f1c0c0",
              background: "#fff",
              color: "#b42318",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 160ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fee2e2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#fff";
            }}
          >
            <TrashIcon />
          </button>
        </div>
      ),
    }),
    [t]
  );

  const columns = useMemo(() => {
    return buildDynamicColumns<Customer>({
      fields: fc.fields,
      renderers,
      includeActions: actionColumn,
    });
  }, [fc.fields, renderers, actionColumn]);

  const dynamicFormValues = useMemo(
    () => ({
      ...form,
      tax_id: formatTaxId(form.tax_id) === "—" ? "" : formatTaxId(form.tax_id),
    }),
    [form]
  );

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
          <p className="df-pro-page__eyebrow">{t("customers:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("customers:title")}</h1>
          <p className="df-pro-page__subtitle">{t("customers:hero.subtitle")}</p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          {t("customers:actions.create", "Nuevo cliente")}
        </PrimaryButton>
      </header>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--3">
          <div>
            <label className="df-pro-label">{t("customers:filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("customers:filters.searchPlaceholder")}
            />
          </div>

          <button type="submit">{t("common:actions.search")}</button>
          <button type="button" onClick={handleClearFilters}>
            {t("common:actions.clear")}
          </button>
        </form>
      </section>

      {error && !showModal && (
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

      <section className="df-pro-card">
        {loading || fc.loading ? (
          <p>{t("common:status.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("customers:empty")}</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={handleEdit}
          />
        )}
      </section>

      <footer className="df-pro-pagination">
        <div>
          {t("common:pagination.showing")} {rows.length} / {total}
        </div>

        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            {t("common:pagination.previous")}
          </button>
          <span>
            {t("common:pagination.page")} {page} {t("common:pagination.of")} {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            {t("common:pagination.next")}
          </button>
        </div>
      </footer>

      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={
          editingCustomer
            ? t("customers:actions.edit", "Editar cliente")
            : t("customers:actions.create", "Nuevo cliente")
        }
        width="min(960px, 100%)"
      >
        <form className="gf-form" onSubmit={saveCustomer} noValidate>
           <DynamicForm<CustomerFormState>
             fields={fc.fields}
             values={dynamicFormValues}
             isEditing={Boolean(editingCustomer)}
             i18nNamespace="customers"
             onChange={(field, value) => {
              if (field === "tax_id") {
                setForm((prev) => ({
                  ...prev,
                  tax_id: normalizeTaxId(String(value || "")),
                }));
                return;
              }

              setForm((prev) => ({
                ...prev,
                [field]: value,
              }));
            }}
          />

          {form.tax_id ? (
            <div
              style={{
                marginTop: 10,
                padding: "10px 12px",
                borderRadius: 12,
                background: isValidTaxId(form.tax_id) ? "#f2f8f3" : "#fdecec",
                color: isValidTaxId(form.tax_id) ? "#2f6b3f" : "#9a2f2f",
                fontSize: 13,
                border: isValidTaxId(form.tax_id)
                  ? "1px solid #cfe7d4"
                  : "1px solid #f3b8b8",
              }}
            >
              Documento detectado:{" "}
              <strong>{getTaxIdType(form.tax_id)}</strong>
              {" · "}
              {formatTaxId(form.tax_id)}
              {" · "}
              <strong>
                {isValidTaxId(form.tax_id) ? "✔ válido" : "✖ inválido"}
              </strong>
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 12,
                background: "#fdecec",
                color: "#9a2f2f",
              }}
            >
              {error}
            </div>
          ) : null}

          <FormActions
            saving={saving}
            submitLabel={editingCustomer ? t("common:actions.update") : t("common:actions.create")}
            onClear={() => setForm(initialForm)}
            onCancel={handleCloseModal}
          />
        </form>
      </Modal>
    </section>
  );
}

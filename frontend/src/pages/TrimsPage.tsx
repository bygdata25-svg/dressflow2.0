import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { FormActions } from "../components/common/FormActions";
import { PrimaryButton } from "../components/common/buttons";
import "../styles/pro-pages.css";

type Supplier = {
  id: string;
  name: string;
};

type TenantCurrencyOption = {
  currency_code: string;
  symbol: string;
  is_base: boolean;
};

type Trim = {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  unit: string;
  current_stock: string;
  reserved_stock: string;
  min_stock: string;
  supplier_id?: string | null;
  unit_cost?: string | null;
  unit_cost_currency?: string | null;
  photo_url?: string | null;
  photo_public_id?: string | null;
  notes?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

type TrimFormState = {
  code: string;
  name: string;
  category: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  supplier_id: string;
  unit_cost: string;
  unit_cost_currency: string;
  notes: string;
  file: File | null;
};

const PAGE_SIZE = 20;

const initialForm: TrimFormState = {
  code: "",
  name: "",
  category: "",
  unit: "unit",
  current_stock: "",
  min_stock: "",
  supplier_id: "",
  unit_cost: "",
  unit_cost_currency: "ARS",
  notes: "",
  file: null,
};

function currencyLabel(currency: TenantCurrencyOption) {
  if (!currency.symbol || currency.symbol === currency.currency_code) {
    return currency.currency_code;
  }

  return `${currency.currency_code} · ${currency.symbol}`;
}

function fallbackCurrencyOptions(): TenantCurrencyOption[] {
  return [
    {
      currency_code: "ARS",
      symbol: "$",
      is_base: true,
    },
  ];
}

function money(value?: number | string | null, currency = "ARS") {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";

  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
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

export default function TrimsPage() {
  const { t } = useTranslation(["common", "trims"]);

  const [rows, setRows] = useState<Trim[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<TenantCurrencyOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TrimFormState>(initialForm);
  const [imagePreview, setImagePreview] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const safeCurrencyOptions = useMemo(() => {
    return currencyOptions.length > 0 ? currencyOptions : fallbackCurrencyOptions();
  }, [currencyOptions]);

  const defaultCurrency = useMemo(() => {
    return (
      safeCurrencyOptions.find((currency) => currency.is_base)?.currency_code ||
      safeCurrencyOptions[0]?.currency_code ||
      "ARS"
    );
  }, [safeCurrencyOptions]);

  const loadCurrencies = async () => {
    try {
      const response = await api.get<TenantCurrencyOption[]>("/tenant-currencies/options");
      const options = Array.isArray(response.data) ? response.data : [];

      setCurrencyOptions(options);
    } catch (err) {
      console.error("Error loading currencies", err);
      setCurrencyOptions([]);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [trimsRes, suppliersRes] = await Promise.all([
        api.get<PaginatedResponse<Trim>>("/trims", {
          params: {
            page,
            page_size: PAGE_SIZE,
            search: search || undefined,
          },
        }),
        api.get<PaginatedResponse<Supplier>>("/suppliers", {
          params: { page: 1, page_size: 100 },
        }),
      ]);

      setRows(Array.isArray(trimsRes.data.items) ? trimsRes.data.items : []);
      setTotal(Number(trimsRes.data.total || 0));
      setSuppliers(Array.isArray(suppliersRes.data.items) ? suppliersRes.data.items : []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("trims:form.messages.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [page, search]);

  useEffect(() => {
    void loadCurrencies();
  }, []);

  const buildEmptyForm = (): TrimFormState => ({
    ...initialForm,
    unit_cost_currency: defaultCurrency,
  });

  const resetForm = () => {
    setForm(buildEmptyForm());
    setImagePreview("");
    setError("");
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(buildEmptyForm());
    setImagePreview("");
    setError("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    resetForm();
  };

  const handleEdit = (row: Trim) => {
    setEditingId(row.id);
    setError("");
    setForm({
      code: row.code || "",
      name: row.name || "",
      category: row.category || "",
      unit: row.unit || "unit",
      current_stock: row.current_stock ? String(row.current_stock) : "",
      min_stock: row.min_stock ? String(row.min_stock) : "",
      supplier_id: row.supplier_id || "",
      unit_cost: row.unit_cost ? String(row.unit_cost) : "",
      unit_cost_currency: row.unit_cost_currency || defaultCurrency,
      notes: row.notes || "",
      file: null,
    });
    setImagePreview(row.photo_url || "");
    setShowModal(true);
  };

  const saveTrim = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.code.trim() || !form.name.trim()) {
      setError(t("trims:form.validation.required"));
      return;
    }

    try {
      setSaving(true);
      setError("");

      const formData = new FormData();
      formData.append("code", form.code.trim());
      formData.append("name", form.name.trim());
      formData.append("category", form.category || "");
      formData.append("unit", form.unit || "unit");
      formData.append("current_stock", String(Number(form.current_stock || 0)));
      formData.append("min_stock", String(Number(form.min_stock || 0)));
      formData.append("supplier_id", form.supplier_id || "");
      formData.append("unit_cost", form.unit_cost ? String(Number(form.unit_cost)) : "");
      formData.append("unit_cost_currency", form.unit_cost_currency || defaultCurrency);
      formData.append("notes", form.notes || "");

      if (form.file) {
        formData.append("file", form.file);
      }

      if (editingId) {
        await api.patch(`/trims/${editingId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/trims", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      handleCloseModal();
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("trims:form.messages.error"));
    } finally {
      setSaving(false);
    }
  };

  const deleteTrim = async (id: string) => {
    const confirmed = window.confirm(t("trims:delete.confirm"));
    if (!confirmed) return;

    try {
      await api.delete(`/trims/${id}`);
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("trims:delete.error"));
    }
  };

  const columns = useMemo<DataGridColumn<Trim>[]>(() => {
    return [
      {
        key: "photo",
        label: t("trims:fields.photo"),
        render: (row) =>
          row.photo_url ? (
            <img
              src={row.photo_url}
              alt={row.name}
              style={{
                width: 52,
                height: 52,
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid #ece6f1",
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                border: "1px dashed #d8cfe0",
                display: "grid",
                placeItems: "center",
                color: "#9b90a8",
                fontSize: 11,
              }}
            >
              {t("trims:images.noImage")}
            </div>
          ),
      },
      {
        key: "code",
        label: t("trims:fields.code"),
        render: (row) => row.code,
      },
      {
        key: "name",
        label: t("trims:fields.name"),
        render: (row) => row.name,
      },
      {
        key: "category",
        label: t("trims:fields.category"),
        render: (row) => row.category || "-",
      },
      {
        key: "unit",
        label: t("trims:fields.unit"),
        render: (row) => row.unit,
      },
      {
        key: "current_stock",
        label: t("trims:fields.currentStock"),
        render: (row) => row.current_stock,
      },
      {
        key: "reserved_stock",
        label: t("trims:fields.reservedStock"),
        render: (row) => row.reserved_stock,
      },
      {
        key: "min_stock",
        label: t("trims:fields.minStock"),
        render: (row) => row.min_stock,
      },
      {
        key: "unit_cost",
        label: t("trims:fields.unitCost"),
        render: (row) => money(row.unit_cost, row.unit_cost_currency || defaultCurrency),
      },
      {
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
                void deleteTrim(row.id);
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
      },
    ];
  }, [t, defaultCurrency]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-trims-money-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 130px;
          gap: 10px;
        }

        @media (max-width: 720px) {
          .df-trims-money-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
          <p className="df-pro-page__eyebrow">{t("trims:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("trims:title")}</h1>
          <p className="df-pro-page__subtitle">{t("trims:hero.subtitle")}</p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          {t("trims:actions.new")}
        </PrimaryButton>
      </header>

      <section className="df-pro-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="df-pro-filter-grid df-pro-filter-grid--3"
        >
          <div>
            <label className="df-pro-label">{t("trims:filters.search")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:filters.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <button type="submit">{t("common:actions.search")}</button>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            {t("common:actions.clear")}
          </button>
        </form>
      </section>

      {loading && <p>{t("common:status.loading")}</p>}
      {error && !showModal && <p>{error}</p>}
      {!loading && rows.length === 0 && <p>{t("trims:empty")}</p>}

      {!loading && rows.length > 0 && (
        <section className="df-pro-card">
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={handleEdit}
          />
        </section>
      )}

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
        title={editingId ? t("trims:modal.edit") : t("trims:modal.new")}
        onClose={handleCloseModal}
        width="min(900px, 100%)"
      >
        <form
          onSubmit={saveTrim}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("trims:fields.code")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.code")}
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "span 4" }}>
            <label className="df-pro-label">{t("trims:fields.name")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.name")}
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("trims:fields.category")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.category")}
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label className="df-pro-label">{t("trims:fields.unit")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.unit")}
              value={form.unit}
              onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("trims:fields.currentStock")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.currentStock")}
              type="number"
              step="0.01"
              value={form.current_stock}
              onChange={(e) => setForm((prev) => ({ ...prev, current_stock: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("trims:fields.minStock")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.minStock")}
              type="number"
              step="0.01"
              value={form.min_stock}
              onChange={(e) => setForm((prev) => ({ ...prev, min_stock: e.target.value }))}
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("trims:form.placeholders.supplier")}</label>
            <select
              className="df-pro-select"
              value={form.supplier_id}
              onChange={(e) => setForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
            >
              <option value="">{t("trims:form.placeholders.supplier")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("trims:fields.unitCost")}</label>

            <div className="df-trims-money-grid">
              <input
                className="df-pro-input"
                placeholder={t("trims:form.placeholders.unitCost")}
                type="number"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm((prev) => ({ ...prev, unit_cost: e.target.value }))}
              />

              <select
                className="df-pro-select"
                value={form.unit_cost_currency}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    unit_cost_currency: e.target.value,
                  }))
                }
              >
                {safeCurrencyOptions.map((currency) => (
                  <option key={currency.currency_code} value={currency.currency_code}>
                    {currencyLabel(currency)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="df-pro-label">{t("trims:fields.image")}</label>

            <div
              className="df-file-upload"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <input
                id="trim-file-upload"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setForm((prev) => ({ ...prev, file }));

                  if (file) {
                    const previewUrl = URL.createObjectURL(file);
                    setImagePreview(previewUrl);
                  }
                }}
                style={{
                  position: "absolute",
                  opacity: 0,
                  pointerEvents: "none",
                  width: 0,
                  height: 0,
                }}
              />

              <label
                htmlFor="trim-file-upload"
                className="df-file-upload-btn"
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #d0d5dd",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#344054",
                }}
              >
                {t("trims:actions.selectFile")}
              </label>

              <span
                className="df-file-upload-name"
                style={{
                  fontSize: 13,
                  color: "#667085",
                }}
              >
                {form.file ? form.file.name : t("trims:images.noFileSelected")}
              </span>
            </div>
          </div>

          {imagePreview ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="df-pro-label">{t("trims:images.preview")}</label>
              <img
                src={imagePreview}
                alt={t("trims:images.preview")}
                style={{
                  width: 140,
                  height: 140,
                  objectFit: "cover",
                  borderRadius: 18,
                  border: "1px solid #ece6f1",
                }}
              />
            </div>
          ) : null}

          <div style={{ gridColumn: "1 / -1" }}>
            <label className="df-pro-label">{t("trims:fields.notes")}</label>
            <input
              className="df-pro-input"
              placeholder={t("trims:form.placeholders.notes")}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
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
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            </div>
          )}

          <FormActions
            saving={saving}
            submitLabel={editingId ? t("common:actions.update") : t("common:actions.create")}
            onClear={resetForm}
            onCancel={handleCloseModal}
          />
        </form>
      </Modal>
    </section>
  );
}

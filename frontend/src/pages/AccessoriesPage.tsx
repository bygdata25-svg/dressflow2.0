import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import "../styles/pro-pages.css";

type Accessory = {
  id: string;
  tenant_id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  color?: string | null;
  size?: string | null;
  unit_cost: number;
  sale_price: number;
  stock: number;
  min_stock: number;
  status: string;
  photo_url?: string | null;
  photo_public_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type PaginatedAccessoryResponse = {
  items: Accessory[];
  page: number;
  page_size: number;
  total: number;
};

type AccessoryFormState = {
  code: string;
  name: string;
  description: string;
  category: string;
  color: string;
  size: string;
  unit_cost: string;
  sale_price: string;
  stock: string;
  min_stock: string;
  status: string;
  notes: string;
  file: File | null;
};

const PAGE_SIZE = 20;

const initialForm: AccessoryFormState = {
  code: "",
  name: "",
  description: "",
  category: "",
  color: "",
  size: "",
  unit_cost: "0",
  sale_price: "0",
  stock: "0",
  min_stock: "0",
  status: "ACTIVE",
  notes: "",
  file: null,
};

const STATUS_OPTIONS = [
  { value: "", labelKey: "filters.allStatuses" },
  { value: "ACTIVE", labelKey: "status.ACTIVE" },
  { value: "INACTIVE", labelKey: "status.INACTIVE" },
];

function money(value?: number | string | null) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n);
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

function statusLabel(t: any, value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (!raw) return "—";
  return t(`status.${raw}`, value || "—");
}

function stockBadgeClass(row: Accessory) {
  if (row.stock <= 0) return "df-status-badge df-status-badge--late";
  if (row.stock <= row.min_stock) return "df-status-badge df-status-badge--rental";
  return "df-status-badge df-status-badge--active";
}

function stockBadgeLabel(t: any, row: Accessory) {
  if (row.stock <= 0) return t("stock.noStock");
  if (row.stock <= row.min_stock) return t("stock.lowStock");
  return t("stock.available");
}

export default function AccessoriesPage() {
  const { t } = useTranslation("accessories");
  const { t: tc } = useTranslation("common");

  const [rows, setRows] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<AccessoryFormState>(initialForm);
  const [imagePreview, setImagePreview] = useState<string>("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const categoryOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        rows
          .map((row) => (row.category || "").trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return values;
  }, [rows, t, tc]);

  const lowStockCount = useMemo(
    () => rows.filter((row) => row.stock > 0 && row.stock <= row.min_stock).length,
    [rows]
  );

  const noStockCount = useMemo(
    () => rows.filter((row) => row.stock <= 0).length,
    [rows]
  );

  async function loadAccessories() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedAccessoryResponse>("/accessories", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        },
      });

      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total || 0));
    } catch (err: any) {
      console.error("Error loading accessories:", err);
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccessories();
  }, [page, search, statusFilter, categoryFilter]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setCategoryFilter("");
    setPage(1);
  }

  function resetForm() {
    setForm(initialForm);
    setImagePreview("");
    setError("");
  }

  function handleOpenCreate() {
    setEditingAccessory(null);
    resetForm();
    setShowModal(true);
  }

  function handleEdit(accessory: Accessory) {
    setEditingAccessory(accessory);
    setError("");
    setForm({
      code: accessory.code || "",
      name: accessory.name || "",
      description: accessory.description || "",
      category: accessory.category || "",
      color: accessory.color || "",
      size: accessory.size || "",
      unit_cost: String(accessory.unit_cost ?? 0),
      sale_price: String(accessory.sale_price ?? 0),
      stock: String(accessory.stock ?? 0),
      min_stock: String(accessory.min_stock ?? 0),
      status: accessory.status || "ACTIVE",
      notes: accessory.notes || "",
      file: null,
    });
    setImagePreview(accessory.photo_url || "");
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingAccessory(null);
    resetForm();
  }

  async function handleDeleteAccessory(accessoryId: string) {
    const confirmed = window.confirm(t("delete.confirm"));
    if (!confirmed) return;

    try {
      await api.delete(`/accessories/${accessoryId}`);

      if (rows.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await loadAccessories();
      }
    } catch (err: any) {
      console.error("Error deleting accessory:", err);
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("delete.error"));
    }
  }

  async function saveAccessory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.name.trim()) {
      setError(t("validation.nameRequired"));
      return;
    }

    try {
      setSaving(true);
      setError("");

      const formData = new FormData();
      formData.append("code", form.code.trim());
      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("category", form.category.trim());
      formData.append("color", form.color.trim());
      formData.append("size", form.size.trim());
      formData.append("unit_cost", String(Number(form.unit_cost || 0)));
      formData.append("sale_price", String(Number(form.sale_price || 0)));
      formData.append("stock", String(Number(form.stock || 0)));
      formData.append("min_stock", String(Number(form.min_stock || 0)));
      formData.append("status", form.status || "ACTIVE");
      formData.append("notes", form.notes.trim());

      if (form.file) {
        formData.append("file", form.file);
      }

      if (editingAccessory) {
        await api.put(`/accessories/${editingAccessory.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/accessories", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      handleCloseModal();
      await loadAccessories();
    } catch (err: any) {
      console.error("Error saving accessory:", err);
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((item: any) => item.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError(t("messages.saveError"));
      }
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<DataGridColumn<Accessory>[]>(() => {
    return [
      {
        key: "photo",
        label: t("fields.photo"),
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
              {t("images.noImage")}
            </div>
          ),
      },
      {
        key: "code",
        label: t("fields.code"),
        render: (row) => row.code || "—",
      },
      {
        key: "name",
        label: t("fields.accessory"),
        render: (row) => (
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#32273c", fontSize: 14 }}>{row.name}</strong>
            <span style={{ color: "#8b8193", fontSize: 12 }}>
              {[row.category, row.color, row.size].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "stock",
        label: t("fields.stock"),
        render: (row) => (
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ color: "#32273c" }}>{row.stock}</strong>
            <span className={stockBadgeClass(row)}>{stockBadgeLabel(t, row)}</span>
          </div>
        ),
      },
      {
        key: "min_stock",
        label: t("fields.minStock"),
        render: (row) => row.min_stock,
      },
      {
        key: "unit_cost",
        label: t("fields.unitCost"),
        render: (row) => money(row.unit_cost),
      },
      {
        key: "sale_price",
        label: t("fields.salePrice"),
        render: (row) => money(row.sale_price),
      },
      {
        key: "status",
        label: t("fields.status"),
        render: (row) => (
          <span
            className={`df-status-badge ${
              row.status === "ACTIVE"
                ? "df-status-badge--active"
                : "df-status-badge--returned"
            }`}
          >
            {statusLabel(t, row.status)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "",
        render: (row) => (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              title={tc("actions.delete")}
              aria-label={tc("actions.delete")}
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteAccessory(row.id);
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
  }, [rows, t, tc]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-accessories-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .df-accessories-modal-field {
          display: grid;
          gap: 6px;
        }

        .df-accessories-modal-field--full {
          grid-column: 1 / -1;
        }

        .df-accessories-modal-field label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-accessories-modal-field input,
        .df-accessories-modal-field select,
        .df-accessories-modal-field textarea {
          width: 100%;
          border: 1px solid #e7dfd6;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff;
          color: #3d3648;
          outline: none;
        }

        .df-accessories-modal-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .df-accessories-hero-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .df-accessories-kpi-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfafc 100%);
          border: 1px solid #e6e0e8;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 14px 32px rgba(31, 24, 39, 0.06);
          display: grid;
          gap: 8px;
        }

        .df-accessories-kpi-card span {
          font-size: 14px;
          color: #7a7082;
          font-weight: 600;
        }

        .df-accessories-kpi-card strong {
          font-size: 30px;
          color: #35293f;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        @media (max-width: 720px) {
          .df-accessories-modal-grid {
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
          <p className="df-pro-page__eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">
            {t("hero.subtitle")}
          </p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          {t("actions.new")}
        </PrimaryButton>
      </header>

      <section className="df-accessories-hero-kpis">
        <div className="df-accessories-kpi-card">
          <span>{t("kpis.visible")}</span>
          <strong>{rows.length}</strong>
        </div>
        <div className="df-accessories-kpi-card">
          <span>{t("kpis.lowStock")}</span>
          <strong>{lowStockCount}</strong>
        </div>
        <div className="df-accessories-kpi-card">
          <span>{t("kpis.noStock")}</span>
          <strong>{noStockCount}</strong>
        </div>
      </section>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--4">
          <div>
            <label className="df-pro-label">{t("filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("filters.status")}</label>
            <select
              className="df-pro-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("filters.category")}</label>
            <select
              className="df-pro-select"
              value={categoryFilter}
              onChange={(e) => {
                setPage(1);
                setCategoryFilter(e.target.value);
              }}
            >
              <option value="">{t("filters.allCategories")}</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <button type="submit">{tc("actions.search")}</button>
          <button type="button" onClick={handleClearFilters}>
            {tc("actions.clear")}
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
        {loading ? (
          <p>{tc("status.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("empty")}</p>
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
          {tc("pagination.showing")} {rows.length} / {total}
        </div>

        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            {tc("pagination.previous")}
          </button>
          <span>
            {tc("pagination.page")} {page} {tc("pagination.of")} {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            {tc("pagination.next")}
          </button>
        </div>
      </footer>

      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingAccessory ? t("modal.edit") : t("modal.new")}
        width="min(960px, 100%)"
      >
        <form onSubmit={saveAccessory} style={{ display: "grid", gap: 16 }}>
          <div className="df-accessories-modal-grid">
            <div className="df-accessories-modal-field">
              <label>{t("fields.code")}</label>
              <input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder={t("form.placeholders.code")}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.name")}</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t("form.placeholders.name")}
                required
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.category")}</label>
              <input
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder={t("form.placeholders.category")}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.color")}</label>
              <input
                value={form.color}
                onChange={(e) => setForm((prev) => ({ ...prev, color: e.target.value }))}
                placeholder={t("form.placeholders.color")}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.size")}</label>
              <input
                value={form.size}
                onChange={(e) => setForm((prev) => ({ ...prev, size: e.target.value }))}
                placeholder={t("form.placeholders.size")}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.status")}</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="ACTIVE">{t("status.ACTIVE")}</option>
                <option value="INACTIVE">{t("status.INACTIVE")}</option>
              </select>
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.unitCost")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm((prev) => ({ ...prev, unit_cost: e.target.value }))}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.salePrice")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.sale_price}
                onChange={(e) => setForm((prev) => ({ ...prev, sale_price: e.target.value }))}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.stock")}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
              />
            </div>

            <div className="df-accessories-modal-field">
              <label>{t("fields.minStock")}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.min_stock}
                onChange={(e) => setForm((prev) => ({ ...prev, min_stock: e.target.value }))}
              />
            </div>

            <div className="df-accessories-modal-field df-accessories-modal-field--full">
  <label>{t("fields.image")}</label>

  <input
    id="accessory-image-file"
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    onChange={(e) => {
      const file = e.target.files?.[0] || null;
      setForm((prev) => ({ ...prev, file }));

      if (file) {
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
      }
    }}
  />

  <label
    htmlFor="accessory-image-file"
    style={{
      minHeight: 42,
      borderRadius: 14,
      border: "1px solid #e7dfd6",
      background: "#fff",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 16px",
      fontSize: 14,
      fontWeight: 700,
      color: "#3d3648",
      cursor: "pointer",
      width: "fit-content",
    }}
  >
    {t("actions.selectFile")}
  </label>

  {form.file ? (
    <span style={{ fontSize: 12, color: "#7a7082" }}>
      {form.file.name}
    </span>
  ) : null}
</div> 

            {imagePreview ? (
              <div className="df-accessories-modal-field df-accessories-modal-field--full">
                <label>{t("images.preview")}</label>
                <img
                  src={imagePreview}
                  alt={t("images.preview")}
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

            <div className="df-accessories-modal-field df-accessories-modal-field--full">
              <label>{t("fields.description")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t("form.placeholders.description")}
              />
            </div>

            <div className="df-accessories-modal-field df-accessories-modal-field--full">
              <label>{t("fields.notes")}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={t("form.placeholders.notes")}
              />
            </div>
          </div>

          {error ? (
            <div
              style={{
                marginTop: 4,
                padding: "10px 12px",
                borderRadius: 12,
                background: "#fdecec",
                color: "#9a2f2f",
              }}
            >
              {error}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={handleCloseModal}>
              {tc("actions.cancel")}
            </button>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? tc("status.saving") : editingAccessory ? tc("actions.update") : t("actions.create")}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}

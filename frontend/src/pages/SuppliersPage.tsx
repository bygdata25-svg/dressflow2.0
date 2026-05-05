import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { SupplierForm } from "../components/forms/SupplierForm";
import type { Supplier } from "../types/supplier";
import "../styles/pro-pages.css";

type PaginatedSupplierResponse = {
  items: Supplier[];
  page: number;
  page_size: number;
  total: number;
};

const PAGE_SIZE = 20;

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

export default function SuppliersPage() {
  const { t } = useTranslation(["common", "suppliers"]);

  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showModal, setShowModal] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const supplierTypeLabel = (value?: string | null) => {
    const raw = String(value || "").toUpperCase();

    if (raw === "FABRIC_SUPPLIER") return t("suppliers:types.FABRIC_SUPPLIER");
    if (raw === "WORKSHOP") return t("suppliers:types.WORKSHOP");
    if (raw === "BOTH") return t("suppliers:types.BOTH");

    return value || "—";
  };

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedSupplierResponse>("/suppliers", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
        },
      });

      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total || 0));
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("suppliers:messages.loadError"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, [page, search]);

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowModal(true);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm(t("suppliers:delete.confirm"))) return;

    try {
      await api.delete(`/suppliers/${id}`);
      await loadSuppliers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("suppliers:delete.error"));
    }
  };

  const columns = useMemo<DataGridColumn<Supplier>[]>(() => {
    return [
      {
        key: "name",
        label: t("suppliers:fields.name"),
        render: (row) => (
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#32273c", fontSize: 14 }}>{row.name}</strong>
            <span style={{ color: "#8b8193", fontSize: 12 }}>
              {row.supplier_code || t("suppliers:fields.noCode")}
            </span>
          </div>
        ),
      },
      {
        key: "supplier_type",
        label: t("suppliers:fields.supplierType"),
        render: (row) => (
          <span className="df-status-badge df-status-badge--active">
            {supplierTypeLabel(row.supplier_type)}
          </span>
        ),
      },
      {
        key: "origin",
        label: t("suppliers:fields.origin"),
        render: (row) => row.origin || "—",
      },
      {
        key: "email",
        label: t("suppliers:fields.email"),
        render: (row) => row.email || "—",
      },
      {
        key: "phone",
        label: t("suppliers:fields.phone"),
        render: (row) => row.phone || "—",
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
                void handleDelete(row.id);
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
  }, [t]);

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
          <p className="df-pro-page__eyebrow">{t("suppliers:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("suppliers:title")}</h1>
          <p className="df-pro-page__subtitle">
            {t("suppliers:hero.subtitle")}
          </p>
        </div>

        <PrimaryButton
          onClick={() => {
            setEditingSupplier(null);
            setShowModal(true);
          }}
          style={{ flexShrink: 0 }}
        >
          {t("suppliers:actions.new")}
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
            <label className="df-pro-label">{t("suppliers:filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("suppliers:filters.searchPlaceholder")}
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

      {error ? (
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
      ) : null}

      <section className="df-pro-card">
        {loading ? (
          <p>{t("suppliers:states.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("suppliers:empty")}</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(r) => String(r.id || r.name)}
            onRowClick={(supplier) => handleEdit(supplier)}
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
        onClose={() => {
          setShowModal(false);
          setEditingSupplier(null);
        }}
        title={editingSupplier ? t("suppliers:modal.editTitle") : t("suppliers:modal.createTitle")}
        width="min(920px, 100%)"
      >
        <SupplierForm
          supplier={editingSupplier}
          onSuccess={async () => {
            setShowModal(false);
            setEditingSupplier(null);
            await loadSuppliers();
          }}
          onCancel={() => {
            setShowModal(false);
            setEditingSupplier(null);
          }}
        />
      </Modal>
    </section>
  );
}

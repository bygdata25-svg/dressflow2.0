import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { SupplierForm } from "../components/forms/SupplierForm";
import { useFieldConfig } from "../hooks/useFieldConfig";
import "./DressesPage.css";

type Supplier = {
  id: string;
  tenant_id: string;
  name: string;
  supplier_code?: string | null;
  origin?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  supplier_type: string;
};

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

function translateSupplierType(value?: string | null) {
  switch ((value || "").toUpperCase()) {
    case "FABRIC_SUPPLIER":
      return "Proveedor de telas";
    case "WORKSHOP":
      return "Taller";
    case "BOTH":
      return "Ambos";
    default:
      return value || "—";
  }
}

export default function SuppliersPage() {
  const { t } = useTranslation(["common", "suppliers"]);
  const fieldConfig = useFieldConfig("supplier");

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

      setRows(response.data.items || []);
      setTotal(response.data.total || 0);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Error cargando proveedores");
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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar proveedor?")) return;
    try {
      await api.delete(`/suppliers/${id}`);
      await loadSuppliers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo eliminar el proveedor.");
    }
  };

  const allColumns = useMemo<DataGridColumn<Supplier>[]>(() => [
    {
      key: "name",
      label: fieldConfig.getLabel("name", "Nombre"),
      render: (r) => r.name,
    },
    {
      key: "supplier_code",
      label: fieldConfig.getLabel("supplier_code", "Código"),
      render: (r) => r.supplier_code || "—",
    },
    {
      key: "supplier_type",
      label: fieldConfig.getLabel("supplier_type", "Tipo"),
      render: (r) => translateSupplierType(r.supplier_type),
    },
    {
      key: "origin",
      label: fieldConfig.getLabel("origin", "Origen"),
      render: (r) => r.origin || "—",
    },
    {
      key: "email",
      label: fieldConfig.getLabel("email", "Email"),
      render: (r) => r.email || "—",
    },
    {
      key: "phone",
      label: fieldConfig.getLabel("phone", "Teléfono"),
      render: (r) => r.phone || "—",
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
              handleDelete(row.id);
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
  ], [fieldConfig, t]);

  const columns = useMemo(() => {
    return allColumns.filter((col) => {
      if (col.key === "actions") return true;
      return fieldConfig.isListVisible(String(col.key));
    });
  }, [allColumns, fieldConfig]);

  const filteredRows = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) =>
      [
        row.name,
        row.supplier_code || "",
        row.email || "",
        row.phone || "",
        row.supplier_type || "",
        row.origin || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, searchInput]);

  return (
    <section className="df-pro-page">
      <header className="df-pro-page__hero">
        <div>
          <h1>Proveedores</h1>
        </div>

        <PrimaryButton
          onClick={() => {
            setEditingSupplier(null);
            setShowModal(true);
          }}
        >
          Nuevo proveedor
        </PrimaryButton>
      </header>

      <section className="df-pro-card">
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Buscar por nombre, código, email, teléfono o tipo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              minWidth: 280,
              flex: 1,
              maxWidth: 420,
              border: "1px solid #d0d5dd",
              borderRadius: 12,
              padding: "10px 14px",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="gf-btn gf-btn-secondary"
              onClick={() => {
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              Buscar
            </button>

            <button
              type="button"
              className="gf-btn gf-btn-secondary"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setPage(1);
              }}
            >
              Limpiar
            </button>
          </div>
        </div>

        {error ? <div className="gf-alert gf-alert-error">{error}</div> : null}

        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowKey={(r) => r.id}
          onRowClick={handleEdit}
          loading={loading || fieldConfig.loading}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 16,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#667085", fontSize: 14 }}>
            Total: <strong>{total}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="gf-btn gf-btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </button>

            <span style={{ fontSize: 14, color: "#344054" }}>
              Página {page} de {totalPages}
            </span>

            <button
              type="button"
              className="gf-btn gf-btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingSupplier ? "Editar proveedor" : "Nuevo proveedor"}
      >
        <SupplierForm
          supplier={editingSupplier}
          onSuccess={() => {
            setShowModal(false);
            void loadSuppliers();
          }}
          onCancel={() => setShowModal(false)}
        />
      </Modal>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { FormActions } from "../components/common/FormActions";
import { PrimaryButton } from "../components/common/buttons";
import "./DressesPage.css";

type Capsule = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  dresses_count?: number;
};

type CapsuleForm = {
  name: string;
  description: string;
  is_active: boolean;
};

const initialForm: CapsuleForm = {
  name: "",
  description: "",
  is_active: true,
};

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

export default function CapsulesPage() {
  const [rows, setRows] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CapsuleForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadCapsules = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<Capsule[]>("/capsules");
      setRows(response.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudieron cargar las cápsulas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCapsules();
  }, []);

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      is_active: form.is_active,
    };

    try {
      setSaving(true);

      if (editingId) {
        await api.patch(`/capsules/${editingId}`, payload);
      } else {
        await api.post("/capsules", payload);
      }

      handleCloseModal();
      await loadCapsules();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo guardar la cápsula.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: Capsule) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description || "",
      is_active: row.is_active,
    });
    setError("");
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("¿Querés eliminar esta cápsula?");
    if (!confirmed) return;

    try {
      await api.delete(`/capsules/${id}`);
      await loadCapsules();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo eliminar la cápsula.");
    }
  };

  const columns = useMemo<DataGridColumn<Capsule>[]>(() => {
    return [
      {
        key: "name",
        label: "Nombre",
        render: (row) => row.name,
      },
      {
        key: "description",
        label: "Descripción",
        render: (row) => row.description || "—",
      },
      {
        key: "is_active",
        label: "Estado",
        render: (row) => (
          <span
            className={`df-status-badge ${
              row.is_active ? "df-status-badge--active" : "df-status-badge--draft"
            }`}
          >
            {row.is_active ? "Activa" : "Inactiva"}
          </span>
        ),
      },
      {
        key: "dresses_count",
        label: "Vestidos",
        render: (row) => row.dresses_count ?? 0,
      },
      {
        key: "actions",
        label: "",
        render: (row) => (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              title="Eliminar"
              aria-label="Eliminar"
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
  }, []);

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
          <p className="df-pro-page__eyebrow">Organización comercial</p>
          <h1 className="df-pro-page__title">Cápsulas</h1>
          <p className="df-pro-page__subtitle">
            Agrupá vestidos por colección, temporada o línea.
          </p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          Nueva cápsula
        </PrimaryButton>
      </header>

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
          <p>Cargando cápsulas...</p>
        ) : rows.length === 0 ? (
          <p>No hay cápsulas cargadas.</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={handleEdit}
          />
        )}
      </section>

      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={editingId ? "Editar cápsula" : "Nueva cápsula"}
        width="min(760px, 100%)"
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "span 4" }}>
            <label className="df-pro-label">Nombre</label>
            <input
              className="df-pro-input"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Invierno 2026"
            />
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label className="df-pro-label">Descripción</label>
            <input
              className="df-pro-input"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Vestidos de temporada"
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">Estado</label>
            <select
              className="df-pro-select"
              value={form.is_active ? "true" : "false"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  is_active: e.target.value === "true",
                }))
              }
            >
              <option value="true">Activa</option>
              <option value="false">Inactiva</option>
            </select>
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
            submitLabel={editingId ? "Actualizar" : "Crear"}
            onClear={resetForm}
            onCancel={handleCloseModal}
          />
        </form>
      </Modal>
    </section>
  );
}

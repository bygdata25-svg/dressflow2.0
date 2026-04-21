import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import "../styles/pro-pages.css";

type Accessory = {
  id: string;
  code?: string | null;
  name: string;
  stock: number;
  status: string;
};

type AccessoryMovement = {
  id: string;
  tenant_id: string;
  accessory_id: string;
  type: string;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
  accessory_code?: string | null;
  accessory_name?: string | null;
};

type PaginatedAccessoryResponse = {
  items: Accessory[];
  page: number;
  page_size: number;
  total: number;
};

type PaginatedAccessoryMovementResponse = {
  items: AccessoryMovement[];
  page: number;
  page_size: number;
  total: number;
};

type MovementFormState = {
  accessory_id: string;
  type: string;
  quantity: string;
  reference: string;
  notes: string;
};

const PAGE_SIZE = 20;

const initialForm: MovementFormState = {
  accessory_id: "",
  type: "IN",
  quantity: "",
  reference: "",
  notes: "",
};

const MOVEMENT_TYPES = [
  { value: "", label: "Todos los tipos" },
  { value: "IN", label: "Entrada" },
  { value: "OUT", label: "Salida" },
  { value: "ADJUST", label: "Ajuste" },
];

function movementTypeLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "IN") return "Entrada";
  if (raw === "OUT") return "Salida";
  if (raw === "ADJUST") return "Ajuste";
  return value || "—";
}

function movementBadgeClass(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "IN") return "df-status-badge df-status-badge--active";
  if (raw === "OUT") return "df-status-badge df-status-badge--late";
  if (raw === "ADJUST") return "df-status-badge df-status-badge--returned";
  return "df-status-badge";
}

export default function AccessoryMovementsPage() {
  const [rows, setRows] = useState<AccessoryMovement[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<MovementFormState>(initialForm);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const availableAccessories = useMemo(
    () => accessories.filter((item) => item.status === "ACTIVE"),
    [accessories]
  );

  const movementCounters = useMemo(() => {
    return {
      inCount: rows.filter((row) => row.type === "IN").length,
      outCount: rows.filter((row) => row.type === "OUT").length,
      adjustCount: rows.filter((row) => row.type === "ADJUST").length,
    };
  }, [rows]);

  async function loadAccessories() {
    try {
      const response = await api.get<PaginatedAccessoryResponse>("/accessories", {
        params: {
          page: 1,
          page_size: 200,
          status: "ACTIVE",
        },
      });

      setAccessories(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      console.error("Error loading accessories:", err);
      setAccessories([]);
    }
  }

  async function loadMovements() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedAccessoryMovementResponse>("/accessory-movements", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          type: typeFilter || undefined,
        },
      });

      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total || 0));
    } catch (err: any) {
      console.error("Error loading accessory movements:", err);
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudieron cargar los movimientos de accesorios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccessories();
  }, []);

  useEffect(() => {
    void loadMovements();
  }, [page, search, typeFilter]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput("");
    setSearch("");
    setTypeFilter("");
    setPage(1);
  }

  function handleOpenCreate() {
    setError("");
    setForm(initialForm);
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setForm(initialForm);
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.accessory_id) {
      setError("Seleccioná un accesorio.");
      return;
    }

    if (!form.quantity || Number(form.quantity) <= 0) {
      setError("Ingresá una cantidad mayor a cero.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.post("/accessory-movements", {
        accessory_id: form.accessory_id,
        type: form.type,
        quantity: Number(form.quantity),
        reference: form.reference.trim() || null,
        notes: form.notes.trim() || null,
      });

      handleCloseModal();
      await Promise.all([loadMovements(), loadAccessories()]);
    } catch (err: any) {
      console.error("Error saving accessory movement:", err);
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((item: any) => item.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudo guardar el movimiento.");
      }
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<DataGridColumn<AccessoryMovement>[]>(() => {
    return [
      {
        key: "created_at",
        label: "Fecha",
        render: (row) =>
          row.created_at ? new Date(row.created_at).toLocaleString("es-AR") : "—",
      },
      {
        key: "type",
        label: "Tipo",
        render: (row) => (
          <span className={movementBadgeClass(row.type)}>
            {movementTypeLabel(row.type)}
          </span>
        ),
      },
      {
        key: "accessory",
        label: "Accesorio",
        render: (row) => (
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#32273c", fontSize: 14 }}>
              {row.accessory_name || "—"}
            </strong>
            <span style={{ color: "#8b8193", fontSize: 12 }}>
              {row.accessory_code || "—"}
            </span>
          </div>
        ),
      },
      {
        key: "quantity",
        label: "Cantidad",
        render: (row) => row.quantity,
      },
      {
        key: "reference",
        label: "Referencia",
        render: (row) => row.reference || "—",
      },
      {
        key: "notes",
        label: "Notas",
        render: (row) => row.notes || "—",
      },
    ];
  }, []);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-accessory-movements-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .df-accessory-movements-modal-field {
          display: grid;
          gap: 6px;
        }

        .df-accessory-movements-modal-field--full {
          grid-column: 1 / -1;
        }

        .df-accessory-movements-modal-field label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-accessory-movements-modal-field input,
        .df-accessory-movements-modal-field select,
        .df-accessory-movements-modal-field textarea {
          width: 100%;
          border: 1px solid #e7dfd6;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff;
          color: #3d3648;
          outline: none;
        }

        .df-accessory-movements-modal-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .df-accessory-movements-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .df-accessory-movements-kpi-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfafc 100%);
          border: 1px solid #e6e0e8;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 14px 32px rgba(31, 24, 39, 0.06);
          display: grid;
          gap: 8px;
        }

        .df-accessory-movements-kpi-card span {
          font-size: 14px;
          color: #7a7082;
          font-weight: 600;
        }

        .df-accessory-movements-kpi-card strong {
          font-size: 30px;
          color: #35293f;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        @media (max-width: 720px) {
          .df-accessory-movements-modal-grid {
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
          <p className="df-pro-page__eyebrow">Inventario</p>
          <h1 className="df-pro-page__title">Movimientos de accesorios</h1>
          <p className="df-pro-page__subtitle">
            Registrá entradas, salidas y ajustes para mantener el stock de accesorios siempre actualizado.
          </p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          Nuevo movimiento
        </PrimaryButton>
      </header>

      <section className="df-accessory-movements-kpis">
        <div className="df-accessory-movements-kpi-card">
          <span>Entradas visibles</span>
          <strong>{movementCounters.inCount}</strong>
        </div>
        <div className="df-accessory-movements-kpi-card">
          <span>Salidas visibles</span>
          <strong>{movementCounters.outCount}</strong>
        </div>
        <div className="df-accessory-movements-kpi-card">
          <span>Ajustes visibles</span>
          <strong>{movementCounters.adjustCount}</strong>
        </div>
      </section>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--3">
          <div>
            <label className="df-pro-label">Buscar</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Código, accesorio, referencia..."
            />
          </div>

          <div>
            <label className="df-pro-label">Tipo</label>
            <select
              className="df-pro-select"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
            >
              {MOVEMENT_TYPES.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit">Buscar</button>
          <button type="button" onClick={handleClearFilters}>
            Limpiar
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
          <p>Cargando movimientos...</p>
        ) : rows.length === 0 ? (
          <p>No hay movimientos de accesorios para mostrar.</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
          />
        )}
      </section>

      <footer className="df-pro-pagination">
        <div>
          Mostrando {rows.length} / {total}
        </div>

        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            Anterior
          </button>
          <span>
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            Siguiente
          </button>
        </div>
      </footer>

      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title="Nuevo movimiento de accesorio"
        width="min(860px, 100%)"
      >
        <form onSubmit={saveMovement} style={{ display: "grid", gap: 16 }}>
          <div className="df-accessory-movements-modal-grid">
            <div className="df-accessory-movements-modal-field">
              <label>Accesorio</label>
              <select
                value={form.accessory_id}
                onChange={(e) => setForm((prev) => ({ ...prev, accessory_id: e.target.value }))}
              >
                <option value="">Seleccionar accesorio</option>
                {availableAccessories.map((accessory) => (
                  <option key={accessory.id} value={accessory.id}>
                    {(accessory.code ? `${accessory.code} · ` : "") + accessory.name}
                    {typeof accessory.stock === "number" ? ` · Stock ${accessory.stock}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-accessory-movements-modal-field">
              <label>Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="IN">Entrada</option>
                <option value="OUT">Salida</option>
                <option value="ADJUST">Ajuste</option>
              </select>
            </div>

            <div className="df-accessory-movements-modal-field">
              <label>
                {form.type === "ADJUST" ? "Nuevo stock" : "Cantidad"}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                placeholder={form.type === "ADJUST" ? "Ej: 15" : "Ej: 3"}
              />
            </div>

            <div className="df-accessory-movements-modal-field">
              <label>Referencia</label>
              <input
                value={form.reference}
                onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="Ej: Compra, venta, conteo..."
              />
            </div>

            <div className="df-accessory-movements-modal-field df-accessory-movements-modal-field--full">
              <label>Notas</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Observaciones del movimiento"
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
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Crear movimiento"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}

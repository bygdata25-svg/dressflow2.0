import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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

const MOVEMENT_TYPE_VALUES = ["", "IN", "OUT", "ADJUST"] as const;

function movementBadgeClass(value?: string | null) {
  const raw = String(value || "").toUpperCase();

  if (raw === "IN") return "df-status-badge df-status-badge--active";
  if (raw === "OUT") return "df-status-badge df-status-badge--late";
  if (raw === "ADJUST") return "df-status-badge df-status-badge--returned";

  return "df-status-badge";
}

function movementTypeKey(value?: string | null) {
  const raw = String(value || "").toUpperCase();

  if (raw === "IN") return "in";
  if (raw === "OUT") return "out";
  if (raw === "ADJUST") return "adjust";

  return "";
}

export default function AccessoryMovementsPage() {
  const { t, i18n } = useTranslation("accessoryMovements");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

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

  const movementTypes = useMemo(() => {
    return MOVEMENT_TYPE_VALUES.map((value) => {
      if (!value) {
        return {
          value,
          label: t("types.all"),
        };
      }

      return {
        value,
        label: t(`types.${movementTypeKey(value)}`),
      };
    });
  }, [t]);

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

  function getMovementTypeLabel(value?: string | null) {
    const key = movementTypeKey(value);

    if (!key) return value || "—";

    return t(`types.${key}`, { defaultValue: value || "—" });
  }

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

      const response = await api.get<PaginatedAccessoryMovementResponse>(
        "/accessory-movements",
        {
          params: {
            page,
            page_size: PAGE_SIZE,
            search: search || undefined,
            type: typeFilter || undefined,
          },
        }
      );

      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total || 0));
    } catch (err: any) {
      console.error("Error loading accessory movements:", err);

      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("messages.errorLoad"));
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
    setError("");
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.accessory_id) {
      setError(t("messages.selectAccessory"));
      return;
    }

    if (!form.quantity || Number(form.quantity) <= 0) {
      setError(t("messages.invalidQuantity"));
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
        setError(t("messages.errorSave"));
      }
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo<DataGridColumn<AccessoryMovement>[]>(() => {
    return [
      {
        key: "created_at",
        label: t("table.date"),
        render: (row) =>
          row.created_at ? new Date(row.created_at).toLocaleString(locale) : "—",
      },
      {
        key: "type",
        label: t("table.type"),
        render: (row) => (
          <span className={movementBadgeClass(row.type)}>
            {getMovementTypeLabel(row.type)}
          </span>
        ),
      },
      {
        key: "accessory",
        label: t("table.accessory"),
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
        label: t("table.quantity"),
        render: (row) => row.quantity,
      },
      {
        key: "reference",
        label: t("table.reference"),
        render: (row) => row.reference || "—",
      },
      {
        key: "notes",
        label: t("table.notes"),
        render: (row) => row.notes || "—",
      },
    ];
  }, [t, locale]);

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
          <p className="df-pro-page__eyebrow">{t("eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("subtitle")}</p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          {t("new")}
        </PrimaryButton>
      </header>

      <section className="df-accessory-movements-kpis">
        <div className="df-accessory-movements-kpi-card">
          <span>{t("kpis.in")}</span>
          <strong>{movementCounters.inCount}</strong>
        </div>

        <div className="df-accessory-movements-kpi-card">
          <span>{t("kpis.out")}</span>
          <strong>{movementCounters.outCount}</strong>
        </div>

        <div className="df-accessory-movements-kpi-card">
          <span>{t("kpis.adjust")}</span>
          <strong>{movementCounters.adjustCount}</strong>
        </div>
      </section>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--3">
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
            <label className="df-pro-label">{t("filters.type")}</label>
            <select
              className="df-pro-select"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
            >
              {movementTypes.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit">{t("filters.searchButton")}</button>

          <button type="button" onClick={handleClearFilters}>
            {t("filters.clear")}
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
          <p>{t("messages.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("messages.empty")}</p>
        ) : (
          <DataGrid rows={rows} columns={columns} getRowKey={(row) => row.id} />
        )}
      </section>

      <footer className="df-pro-pagination">
        <div>
          {t("pagination.showing", {
            count: rows.length,
            total,
          })}
        </div>

        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            {t("pagination.previous")}
          </button>

          <span>
            {t("pagination.page", {
              page,
              totalPages,
            })}
          </span>

          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            {t("pagination.next")}
          </button>
        </div>
      </footer>

      <Modal
        open={showModal}
        onClose={handleCloseModal}
        title={t("modal.title")}
        width="min(860px, 100%)"
      >
        <form onSubmit={saveMovement} style={{ display: "grid", gap: 16 }}>
          <div className="df-accessory-movements-modal-grid">
            <div className="df-accessory-movements-modal-field">
              <label>{t("modal.accessory")}</label>

              <select
                value={form.accessory_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    accessory_id: e.target.value,
                  }))
                }
              >
                <option value="">{t("modal.selectAccessory")}</option>

                {availableAccessories.map((accessory) => (
                  <option key={accessory.id} value={accessory.id}>
                    {(accessory.code ? `${accessory.code} · ` : "") + accessory.name}
                    {typeof accessory.stock === "number"
                      ? ` · ${t("modal.stock")} ${accessory.stock}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-accessory-movements-modal-field">
              <label>{t("modal.type")}</label>

              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value,
                  }))
                }
              >
                <option value="IN">{t("types.in")}</option>
                <option value="OUT">{t("types.out")}</option>
                <option value="ADJUST">{t("types.adjust")}</option>
              </select>
            </div>

            <div className="df-accessory-movements-modal-field">
              <label>{form.type === "ADJUST" ? t("modal.newStock") : t("modal.quantity")}</label>

              <input
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    quantity: e.target.value,
                  }))
                }
                placeholder={
                  form.type === "ADJUST"
                    ? t("modal.adjustPlaceholder")
                    : t("modal.quantityPlaceholder")
                }
              />
            </div>

            <div className="df-accessory-movements-modal-field">
              <label>{t("modal.reference")}</label>

              <input
                value={form.reference}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    reference: e.target.value,
                  }))
                }
                placeholder={t("modal.referencePlaceholder")}
              />
            </div>

            <div className="df-accessory-movements-modal-field df-accessory-movements-modal-field--full">
              <label>{t("modal.notes")}</label>

              <textarea
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder={t("modal.notesPlaceholder")}
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
              {t("actions.cancel")}
            </button>

            <PrimaryButton type="submit" disabled={saving}>
              {saving ? t("actions.saving") : t("actions.save")}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}

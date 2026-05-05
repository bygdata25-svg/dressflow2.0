import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("capsules");

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
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("messages.errorLoad"));
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
      setError(t("messages.nameRequired"));
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
      else setError(t("messages.errorSave"));
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
    const confirmed = window.confirm(t("messages.deleteConfirm"));
    if (!confirmed) return;

    try {
      await api.delete(`/capsules/${id}`);
      await loadCapsules();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("messages.errorDelete"));
    }
  };

  const columns = useMemo<DataGridColumn<Capsule>[]>(() => {
    return [
      {
        key: "name",
        label: t("table.name"),
        render: (row) => row.name,
      },
      {
        key: "description",
        label: t("table.description"),
        render: (row) => row.description || "—",
      },
      {
        key: "is_active",
        label: t("table.status"),
        render: (row) => (
          <span
            className={`df-status-badge ${
              row.is_active ? "df-status-badge--active" : "df-status-badge--draft"
            }`}
          >
            {row.is_active ? t("status.active") : t("status.inactive")}
          </span>
        ),
      },
      {
        key: "dresses_count",
        label: t("table.dresses"),
        render: (row) => row.dresses_count ?? 0,
      },
      {
        key: "actions",
        label: t("table.actions"),
        render: (row) => (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              title={t("actions.delete")}
              aria-label={t("actions.delete")}
              onClick={(event) => {
                event.stopPropagation();
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#fee2e2";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = "#fff";
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
          <p className="df-pro-page__eyebrow">{t("eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("subtitle")}</p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          {t("new")}
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
          <p>{t("messages.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("messages.empty")}</p>
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
        title={editingId ? t("modal.editTitle") : t("modal.createTitle")}
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
            <label className="df-pro-label">{t("modal.name")}</label>
            <input
              className="df-pro-input"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder={t("modal.namePlaceholder")}
            />
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label className="df-pro-label">{t("modal.description")}</label>
            <input
              className="df-pro-input"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder={t("modal.descriptionPlaceholder")}
            />
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">{t("modal.status")}</label>
            <select
              className="df-pro-select"
              value={form.is_active ? "true" : "false"}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  is_active: event.target.value === "true",
                }))
              }
            >
              <option value="true">{t("status.active")}</option>
              <option value="false">{t("status.inactive")}</option>
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
            submitLabel={editingId ? t("actions.update") : t("actions.create")}
            onClear={resetForm}
            onCancel={handleCloseModal}
          />
        </form>
      </Modal>
    </section>
  );
}

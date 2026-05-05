import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { UserForm } from "../components/forms/UserForm";
import "./DressesPage.css";

type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

type MeResponse = {
  id: string;
  preferred_language?: "es" | "en" | null;
  tenant_default_language?: "es" | "en" | null;
  effective_language?: "es" | "en" | null;
};

export default function UsersPage() {
  const { t } = useTranslation(["users", "common"]);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tenantDefaultLanguage, setTenantDefaultLanguage] = useState<"es" | "en">("es");
  const [preferredLanguage, setPreferredLanguage] = useState<"es" | "en" | null>(null);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageSuccess, setLanguageSuccess] = useState("");

  const statusLabel = (isActive: boolean) => {
    return isActive ? t("status.active") : t("status.inactive");
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return t("roles.admin");
      case "manager":
        return t("roles.manager");
      case "staff":
        return t("roles.staff");
      default:
        return role;
    }
  };

  const loadCurrentSession = async () => {
    try {
      const response = await api.get<MeResponse>("/auth/me");

      setCurrentUserId(response.data.id);
      setTenantDefaultLanguage(response.data.tenant_default_language || "es");
      setPreferredLanguage(response.data.preferred_language || null);
    } catch {
      setCurrentUserId(null);
      setTenantDefaultLanguage("es");
      setPreferredLanguage(null);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<UserRow[]>("/users");
      setRows(response.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
    void loadCurrentSession();
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setError("");
    setLanguageSuccess("");
    setShowModal(true);
  };

  const handleEdit = (user: UserRow) => {
    setEditingUser(user);
    setError("");
    setLanguageSuccess("");
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setLanguageSuccess("");
  };

  const handleSaveLanguage = async () => {
    try {
      setSavingLanguage(true);
      setError("");
      setLanguageSuccess("");

      await api.patch("/users/me/preferences", {
        preferred_language: preferredLanguage,
      });

      const nextLanguage = preferredLanguage || tenantDefaultLanguage || "es";
      await i18n.changeLanguage(nextLanguage);

      setLanguageSuccess(t("language.saved", { defaultValue: "Preferencia guardada correctamente." }));
      await loadCurrentSession();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("language.saveError", { defaultValue: "No se pudo guardar la preferencia de idioma." }));
    } finally {
      setSavingLanguage(false);
    }
  };

  const columns = useMemo<DataGridColumn<UserRow>[]>(() => {
    return [
      {
        key: "full_name",
        label: t("columns.user"),
        render: (row) => `${row.first_name} ${row.last_name}`,
      },
      {
        key: "email",
        label: t("columns.email"),
        render: (row) => row.email,
      },
      {
        key: "role",
        label: t("columns.role"),
        render: (row) => roleLabel(row.role),
      },
      {
        key: "status",
        label: t("columns.status"),
        render: (row) => (
          <span
            className={`df-status-badge ${
              row.is_active
                ? "df-status-badge--active"
                : "df-status-badge--draft"
            }`}
          >
            {statusLabel(row.is_active)}
          </span>
        ),
      },
    ];
  }, [t]);

  const isEditingCurrentUser = Boolean(
    editingUser?.id && currentUserId && editingUser.id === currentUserId
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
          <p className="df-pro-page__eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("hero.subtitle")}</p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          {t("actions.new")}
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
          <p>{t("states.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("states.empty")}</p>
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
        title={editingUser ? t("modal.editTitle") : t("modal.createTitle")}
        width="min(860px, 100%)"
      >
        <UserForm
          user={editingUser}
          onSuccess={() => {
            handleCloseModal();
            void loadUsers();
            void loadCurrentSession();
          }}
          onCancel={handleCloseModal}
        />

        {isEditingCurrentUser && (
          <section
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: "1px solid #eadfd7",
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: "#32273c" }}>
                {t("language.title", { defaultValue: "Idioma" })}
              </h3>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: "#8a7f78" }}>
                {t("language.description", {
                  defaultValue:
                    "Definí tu idioma personal o usá el idioma por defecto de la empresa.",
                })}
              </p>
            </div>

            <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
              <label className="df-pro-label">
                {t("language.preferredLanguage")}
              </label>

              <select
                className="df-pro-select"
                value={preferredLanguage ?? ""}
                onChange={(e) => {
                  const value = e.target.value || null;
                  setPreferredLanguage(value as "es" | "en" | null);
                  setLanguageSuccess("");
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #eadfd7",
                  background: "#fff",
                  fontWeight: 600,
                  color: "#3d3648",
                }}
              >
                <option value="">{t("language.useTenantDefault")}</option>
                <option value="es">{t("language.spanish")}</option>
                <option value="en">{t("language.english")}</option>
              </select>

              <span style={{ fontSize: 12, color: "#8a7f78" }}>
                {t("language.tenantDefault", {
                  defaultValue: "Idioma de empresa: {{language}}",
                  language:
                    tenantDefaultLanguage === "en"
                      ? t("language.english")
                      : t("language.spanish"),
                })}
              </span>
            </div>

            {languageSuccess && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: "#ecfdf3",
                  color: "#027a48",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {languageSuccess}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="df-button-primary"
                onClick={handleSaveLanguage}
                disabled={savingLanguage}
              >
                {savingLanguage
                  ? t("language.saving", { defaultValue: "Guardando..." })
                  : t("common:actions.save", { defaultValue: "Guardar" })}
              </button>
            </div>
          </section>
        )}
      </Modal>
    </section>
  );
}

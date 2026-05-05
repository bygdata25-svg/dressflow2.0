import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { FormActions } from "../common/FormActions";

type UserRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

type UserFormProps = {
  user?: UserRow | null;
  onSuccess: () => void;
  onCancel: () => void;
};

type UserFormState = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
};

const initialForm: UserFormState = {
  email: "",
  password: "",
  first_name: "",
  last_name: "",
  role: "admin",
  is_active: true,
};

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const { t } = useTranslation("users");

  const [form, setForm] = useState<UserFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const isEditing = !!user?.id;

  useEffect(() => {
    if (user) {
      setForm({
        email: user.email || "",
        password: "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        role: user.role || "admin",
        is_active: user.is_active ?? true,
      });
    } else {
      setForm(initialForm);
    }

    setError("");
    setShowPasswordReset(false);
    setResetError("");
    setResetSuccess("");
  }, [user]);

  const setField = (field: keyof UserFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleClear = () => {
    if (user) {
      setForm({
        email: user.email || "",
        password: "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        role: user.role || "admin",
        is_active: user.is_active ?? true,
      });
    } else {
      setForm(initialForm);
    }

    setError("");
  };

  const validate = () => {
    if (!form.email.trim()) return t("form.validation.emailRequired");
    if (!form.first_name.trim()) return t("form.validation.firstNameRequired");
    if (!form.last_name.trim()) return t("form.validation.lastNameRequired");
    if (!isEditing && !form.password.trim()) return t("form.validation.passwordRequired");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) return t("form.validation.invalidEmail");

    return "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);

      if (isEditing && user?.id) {
        await api.put(`/users/${user.id}`, {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
          is_active: form.is_active,
        });
      } else {
        await api.post("/users", {
          email: form.email.trim(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
        });
      }

      onSuccess();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else {
        setError(
          isEditing
            ? t("form.messages.updateError")
            : t("form.messages.createError")
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    setResetError("");
    setResetSuccess("");

    if (!user?.id) return;

    try {
      setResetSaving(true);

      const response = await api.post(`/users/${user.id}/reset-password`);
      const temporaryPassword = response?.data?.temporary_password || "123456";

      setResetSuccess(
        t("form.security.resetSuccess", { password: temporaryPassword })
      );
      setShowPasswordReset(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setResetError(detail);
      else if (detail?.message) setResetError(detail.message);
      else setResetError(t("form.security.resetError"));
    } finally {
      setResetSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
        gap: 16,
      }}
    >
      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">{t("form.fields.firstName")}</label>
        <input
          className="df-pro-input"
          value={form.first_name}
          onChange={(e) => setField("first_name", e.target.value)}
          placeholder={t("form.placeholders.firstName")}
          autoFocus
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">{t("form.fields.lastName")}</label>
        <input
          className="df-pro-input"
          value={form.last_name}
          onChange={(e) => setField("last_name", e.target.value)}
          placeholder={t("form.placeholders.lastName")}
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">{t("form.fields.email")}</label>
        <input
          className={`df-pro-input ${isEditing ? "df-pro-input--readonly" : ""}`}
          type="email"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder={t("form.placeholders.email")}
          readOnly={isEditing}
        />
      </div>

      {!isEditing && (
        <div style={{ gridColumn: "span 6" }}>
          <label className="df-pro-label">{t("form.fields.password")}</label>
          <input
            className="df-pro-input"
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder={t("form.placeholders.password")}
          />
        </div>
      )}

      <div style={{ gridColumn: isEditing ? "span 6" : "span 4" }}>
        <label className="df-pro-label">{t("form.fields.role")}</label>
        <select
          className="df-pro-select"
          value={form.role}
          onChange={(e) => setField("role", e.target.value)}
        >
          <option value="admin">{t("roles.admin")}</option>
          <option value="manager">{t("roles.manager")}</option>
          <option value="staff">{t("roles.staff")}</option>
        </select>
      </div>

      {isEditing && (
        <div style={{ gridColumn: "span 6" }}>
          <label className="df-pro-label">{t("form.fields.status")}</label>
          <select
            className="df-pro-select"
            value={form.is_active ? "true" : "false"}
            onChange={(e) => setField("is_active", e.target.value === "true")}
          >
            <option value="true">{t("status.active")}</option>
            <option value="false">{t("status.inactive")}</option>
          </select>
        </div>
      )}

      {isEditing && (
        <div style={{ gridColumn: "1 / -1" }}>
          <div
            style={{
              border: "1px solid #eadfd7",
              borderRadius: 16,
              padding: 16,
              background: "#fcfaf8",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: showPasswordReset ? 16 : 0,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {t("form.security.title")}
                </div>
                <div style={{ fontSize: 13, color: "#8a7f78" }}>
                  {t("form.security.description")}
                </div>
              </div>

              <button
                type="button"
                className="df-ghost-btn"
                onClick={() => {
                  setShowPasswordReset((prev) => !prev);
                  setResetError("");
                  setResetSuccess("");
                }}
              >
                {showPasswordReset
                  ? t("form.security.cancelReset")
                  : t("form.security.resetPassword")}
              </button>
            </div>

            {showPasswordReset && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "#fff7ed",
                      color: "#9a3412",
                      border: "1px solid #fed7aa",
                    }}
                  >
                    {t("form.security.warningPrefix")}{" "}
                    <strong>123456</strong>.{" "}
                    {t("form.security.warningSuffix")}
                  </div>
                </div>

                {(resetError || resetSuccess) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: resetError ? "#fdecec" : "#ecfdf3",
                        color: resetError ? "#9a2f2f" : "#027a48",
                      }}
                    >
                      {resetError || resetSuccess}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    className="df-button-primary"
                    onClick={handleResetPassword}
                    disabled={resetSaving}
                  >
                    {resetSaving
                      ? t("form.security.resetting")
                      : t("form.security.confirmReset")}
                  </button>
                </div>
              </div>
            )}

            {!showPasswordReset && resetSuccess && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#ecfdf3",
                    color: "#027a48",
                  }}
                >
                  {resetSuccess}
                </div>
              </div>
            )}

            {!showPasswordReset && resetError && (
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#fdecec",
                    color: "#9a2f2f",
                  }}
                >
                  {resetError}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
        submitLabel={isEditing ? t("form.actions.update") : t("form.actions.create")}
        onClear={handleClear}
        onCancel={onCancel}
      />
    </form>
  );
}

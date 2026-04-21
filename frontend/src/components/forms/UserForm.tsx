import { useEffect, useState } from "react";
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
    if (!form.email.trim()) return "El email es obligatorio.";
    if (!form.first_name.trim()) return "El nombre es obligatorio.";
    if (!form.last_name.trim()) return "El apellido es obligatorio.";
    if (!isEditing && !form.password.trim()) return "La contraseña es obligatoria.";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) return "Ingresá un email válido.";

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
            ? "No se pudo actualizar el usuario."
            : "No se pudo crear el usuario."
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
        `Contraseña temporal generada: ${temporaryPassword}. El usuario deberá cambiarla al ingresar.`
      );
      setShowPasswordReset(false);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setResetError(detail);
      else if (detail?.message) setResetError(detail.message);
      else setResetError("No se pudo resetear la contraseña.");
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
        <label className="df-pro-label">Nombre</label>
        <input
          className="df-pro-input"
          value={form.first_name}
          onChange={(e) => setField("first_name", e.target.value)}
          placeholder="Juan"
          autoFocus
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">Apellido</label>
        <input
          className="df-pro-input"
          value={form.last_name}
          onChange={(e) => setField("last_name", e.target.value)}
          placeholder="Pérez"
        />
      </div>

      <div style={{ gridColumn: "span 6" }}>
        <label className="df-pro-label">Email</label>
        <input
          className={`df-pro-input ${isEditing ? "df-pro-input--readonly" : ""}`}
          type="email"
          value={form.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="usuario@empresa.com"
          readOnly={isEditing}
        />
      </div>

      {!isEditing && (
        <div style={{ gridColumn: "span 6" }}>
          <label className="df-pro-label">Contraseña</label>
          <input
            className="df-pro-input"
            type="password"
            value={form.password}
            onChange={(e) => setField("password", e.target.value)}
            placeholder="••••••••"
          />
        </div>
      )}

      <div style={{ gridColumn: isEditing ? "span 6" : "span 4" }}>
        <label className="df-pro-label">Rol</label>
        <select
          className="df-pro-select"
          value={form.role}
          onChange={(e) => setField("role", e.target.value)}
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      {isEditing && (
        <div style={{ gridColumn: "span 6" }}>
          <label className="df-pro-label">Estado</label>
          <select
            className="df-pro-select"
            value={form.is_active ? "true" : "false"}
            onChange={(e) => setField("is_active", e.target.value === "true")}
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
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
                <div style={{ fontWeight: 700, fontSize: 14 }}>Seguridad</div>
                <div style={{ fontSize: 13, color: "#8a7f78" }}>
                  Generá una contraseña temporal para este usuario.
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
                {showPasswordReset ? "Cancelar reset" : "Reset password"}
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
                    Se generará una contraseña temporal <strong>123456</strong>. El
                    usuario deberá cambiarla al ingresar.
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
                    {resetSaving ? "Reseteando..." : "Confirmar reset password"}
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
        submitLabel={isEditing ? "Actualizar" : "Crear"}
        onClear={handleClear}
        onCancel={onCancel}
      />
    </form>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type ChangePasswordForm = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

function getPasswordStrength(password: string) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (!password.length) {
    return {
      score: 0,
      label: "",
      color: "#e5e7eb",
      width: "0%",
    };
  }

  if (score <= 2) {
    return {
      score,
      label: "Débil",
      color: "#dc2626",
      width: "40%",
    };
  }

  if (score <= 4) {
    return {
      score,
      label: "Media",
      color: "#d97706",
      width: "70%",
    };
  }

  return {
    score,
    label: "Fuerte",
    color: "#16a34a",
    width: "100%",
  };
}

const initialForm: ChangePasswordForm = {
  current_password: "",
  new_password: "",
  confirm_password: "",
};

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<ChangePasswordForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength = useMemo(
    () => getPasswordStrength(form.new_password),
    [form.new_password]
  );

  const updateField = (field: keyof ChangePasswordForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!form.current_password.trim()) {
      return "La contraseña actual es obligatoria.";
    }

    if (!form.new_password.trim()) {
      return "La nueva contraseña es obligatoria.";
    }

    if (form.new_password.length < 8) {
      return "La nueva contraseña debe tener al menos 8 caracteres.";
    }

    if (!/[A-Z]/.test(form.new_password)) {
      return "La nueva contraseña debe incluir al menos una mayúscula.";
    }

    if (!/\d/.test(form.new_password)) {
      return "La nueva contraseña debe incluir al menos un número.";
    }

    if (form.new_password !== form.confirm_password) {
      return "Las contraseñas no coinciden.";
    }

    if (form.current_password === form.new_password) {
      return "La nueva contraseña debe ser distinta de la actual.";
    }

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

      await api.post("/auth/change-password", {
        current_password: form.current_password,
        new_password: form.new_password,
      });

      navigate("/", { replace: true });
      window.location.reload();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo actualizar la contraseña.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(180deg, rgba(248,244,240,1) 0%, rgba(255,255,255,1) 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          background: "#fff",
          border: "1px solid #eadfd7",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 10px 30px rgba(61, 54, 72, 0.08)",
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#8a7f78",
              marginBottom: 8,
            }}
          >
            Seguridad de acceso
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.1,
              color: "#3d3648",
            }}
          >
            Cambiar contraseña
          </h1>

          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              color: "#8a7f78",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            Ingresaste con una contraseña temporal. Antes de continuar,
            necesitás definir una nueva contraseña personal.
          </p>
        </div>

        <div
          style={{
            marginBottom: 18,
            padding: "12px 14px",
            borderRadius: 14,
            background: "#fff7ed",
            color: "#9a3412",
            border: "1px solid #fed7aa",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Estás ingresando con una contraseña temporal. Debés cambiarla antes de
          continuar.
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          <div style={{ gridColumn: "1 / -1" }}>
            <label className="df-pro-label">Contraseña actual</label>
            <input
              className="df-pro-input"
              type="password"
              value={form.current_password}
              onChange={(e) =>
                updateField("current_password", e.target.value)
              }
              placeholder="123456"
              autoFocus
            />
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label className="df-pro-label">Nueva contraseña</label>
            <input
              className="df-pro-input"
              type="password"
              value={form.new_password}
              onChange={(e) => updateField("new_password", e.target.value)}
              placeholder="••••••••"
            />

            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  height: 8,
                  width: "100%",
                  borderRadius: 999,
                  background: "#f1f5f9",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: passwordStrength.width,
                    background: passwordStrength.color,
                    transition: "all 180ms ease",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  color: passwordStrength.color,
                  fontWeight: 600,
                  minHeight: 18,
                }}
              >
                {passwordStrength.label}
              </div>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#8a7f78",
                marginTop: 6,
                lineHeight: 1.4,
              }}
            >
              Usá al menos 8 caracteres, una mayúscula y un número.
            </div>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <label className="df-pro-label">Confirmar nueva contraseña</label>
            <input
              className="df-pro-input"
              type="password"
              value={form.confirm_password}
              onChange={(e) =>
                updateField("confirm_password", e.target.value)
              }
              placeholder="••••••••"
            />
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

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="submit"
              className="df-button-primary"
              disabled={saving}
            >
              {saving ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

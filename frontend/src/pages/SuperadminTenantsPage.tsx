import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { impersonateMembership, setToken } from "../lib/auth";
import "../styles/pro-pages.css";

type Tenant = {
  id: string;
  name: string;
  slug?: string | null;
  status: string;
  email?: string | null;
  phone?: string | null;
  currency: string;
  timezone: string;
  admin_membership_id?: string | null;
  admin_user_name?: string | null;
  admin_user_email?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

export default function SuperadminTenantsPage() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tenant_name: "",
    tenant_slug: "",
    tenant_email: "",
    tenant_phone: "",
    tenant_currency: "USD",
    tenant_timezone: "America/Argentina/Buenos_Aires",
    admin_first_name: "",
    admin_last_name: "",
    admin_email: "",
    admin_password: "",
  });

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<PaginatedResponse<Tenant>>("/superadmin/tenants", {
        params: { page: 1, page_size: 100 },
      });
      setRows(response.data.items);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTenants();
  }, []);

  const createTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");

      await api.post("/superadmin/tenants", {
        tenant: {
          name: form.tenant_name,
          slug: form.tenant_slug,
          email: form.tenant_email || null,
          phone: form.tenant_phone || null,
          currency: form.tenant_currency,
          timezone: form.tenant_timezone,
        },
        admin_user: {
          first_name: form.admin_first_name,
          last_name: form.admin_last_name,
          email: form.admin_email,
          password: form.admin_password,
        },
      });

      setForm({
        tenant_name: "",
        tenant_slug: "",
        tenant_email: "",
        tenant_phone: "",
        tenant_currency: "USD",
        tenant_timezone: "America/Argentina/Buenos_Aires",
        admin_first_name: "",
        admin_last_name: "",
        admin_email: "",
        admin_password: "",
      });

      await loadTenants();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo crear la empresa.");
    }
  };

  const handleImpersonate = async (tenant: Tenant) => {
    if (!tenant.admin_membership_id) {
      setError(
        `La empresa "${tenant.name}" no tiene admin_membership_id disponible para impersonar.`
      );
      return;
    }

    try {
      setError("");
      setImpersonatingId(tenant.id);

      const data = await impersonateMembership(tenant.admin_membership_id);
      setToken(data.access_token);

      window.location.href = "/";
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "No se pudo iniciar la impersonación.";
      setError(detail);
    } finally {
      setImpersonatingId(null);
    }
  };

  return (
    <section className="df-pro-page">
      <header className="df-pro-page__hero">
        <div>
          <p className="df-pro-page__eyebrow">Superadmin</p>
          <h1 className="df-pro-page__title">Empresas</h1>
          <p className="df-pro-page__subtitle">
            Creá nuevos tenants, el admin inicial de cada empresa e ingresá como ese
            usuario para soporte o validación.
          </p>
        </div>
      </header>

      <section className="df-pro-card">
        <form onSubmit={createTenant} className="df-pro-form-grid df-pro-form-grid--6">
          <input
            className="df-pro-input"
            placeholder="Nombre empresa"
            value={form.tenant_name}
            onChange={(e) => setForm((p) => ({ ...p, tenant_name: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Slug"
            value={form.tenant_slug}
            onChange={(e) => setForm((p) => ({ ...p, tenant_slug: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Email empresa"
            value={form.tenant_email}
            onChange={(e) => setForm((p) => ({ ...p, tenant_email: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Teléfono empresa"
            value={form.tenant_phone}
            onChange={(e) => setForm((p) => ({ ...p, tenant_phone: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Moneda"
            value={form.tenant_currency}
            onChange={(e) => setForm((p) => ({ ...p, tenant_currency: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Timezone"
            value={form.tenant_timezone}
            onChange={(e) => setForm((p) => ({ ...p, tenant_timezone: e.target.value }))}
          />

          <input
            className="df-pro-input"
            placeholder="Nombre admin"
            value={form.admin_first_name}
            onChange={(e) => setForm((p) => ({ ...p, admin_first_name: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Apellido admin"
            value={form.admin_last_name}
            onChange={(e) => setForm((p) => ({ ...p, admin_last_name: e.target.value }))}
          />
          <input
            className="df-pro-input"
            placeholder="Email admin"
            value={form.admin_email}
            onChange={(e) => setForm((p) => ({ ...p, admin_email: e.target.value }))}
          />
          <input
            className="df-pro-input"
            type="password"
            placeholder="Password admin"
            value={form.admin_password}
            onChange={(e) => setForm((p) => ({ ...p, admin_password: e.target.value }))}
          />

          <button type="submit">Crear empresa</button>
        </form>
      </section>

      {loading && <p>Cargando...</p>}
      {error && <p>{error}</p>}

      <section className="df-pro-card">
        <h2 style={{ marginTop: 0 }}>Empresas existentes</h2>

        {rows.length === 0 && !loading && <p>No hay empresas cargadas.</p>}

        {rows.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((tenant) => {
              const canImpersonate = Boolean(tenant.admin_membership_id);
              const isBusy = impersonatingId === tenant.id;

              return (
                <div
                  key={tenant.id}
                  style={{
                    border: "1px solid var(--df-border)",
                    borderRadius: 16,
                    padding: 14,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong>{tenant.name}</strong>
                      <div>Slug: {tenant.slug || "-"}</div>
                      <div>Status: {tenant.status}</div>
                      <div>Email: {tenant.email || "-"}</div>
                      <div>Moneda: {tenant.currency}</div>
                      <div>Timezone: {tenant.timezone}</div>

                      {(tenant.admin_user_name || tenant.admin_user_email) && (
                        <div style={{ marginTop: 4 }}>
                          Admin: {tenant.admin_user_name || "-"}
                          {tenant.admin_user_email ? ` · ${tenant.admin_user_email}` : ""}
                        </div>
                      )}

                      {tenant.admin_membership_id && (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          Membership: {tenant.admin_membership_id}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                      <button
                        type="button"
                        onClick={() => void handleImpersonate(tenant)}
                        disabled={!canImpersonate || isBusy}
                        title={
                          canImpersonate
                            ? "Ingresar como el admin de esta empresa"
                            : "Falta admin_membership_id en la respuesta del backend"
                        }
                        style={{
                          minWidth: 150,
                          height: 40,
                          borderRadius: 10,
                          border: "1px solid var(--df-border)",
                          cursor: canImpersonate && !isBusy ? "pointer" : "not-allowed",
                          opacity: canImpersonate ? 1 : 0.5,
                        }}
                      >
                        {isBusy ? "Impersonando..." : "Impersonar admin"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
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

type TenantFeature = {
  feature_key: string;
  enabled: boolean;
};

type FeatureDefinition = {
  key: string;
  label: string;
  description: string;
  group: "Core" | "Inventario" | "Operación" | "Reportes" | "Comercial" | "Premium";
};

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: "dresses",
    label: "Vestidos",
    description: "Alta, edición y consulta del inventario de vestidos.",
    group: "Core",
  },
  {
    key: "customers",
    label: "Clientes",
    description: "Base de clientes, contacto y documento fiscal.",
    group: "Core",
  },
  {
    key: "suppliers",
    label: "Proveedores",
    description: "Gestión de proveedores y talleres.",
    group: "Core",
  },
  {
    key: "loans",
    label: "Préstamos / Alquileres",
    description: "Circuito de préstamos, alquileres y vencimientos.",
    group: "Comercial",
  },
  {
    key: "sales",
    label: "Ventas",
    description: "Ventas unificadas, multipago y multimoneda.",
    group: "Comercial",
  },
  {
    key: "accessories",
    label: "Accesorios",
    description: "Inventario y gestión de accesorios.",
    group: "Inventario",
  },
  {
    key: "accessory_movements",
    label: "Movimientos accesorios",
    description: "Movimientos de stock de accesorios.",
    group: "Inventario",
  },
  {
    key: "fabric_inventory",
    label: "Inventario textil",
    description: "Telas, rollos, avíos y movimientos de tela.",
    group: "Inventario",
  },
  {
    key: "production_orders",
    label: "Órdenes de producción",
    description: "Producción, materiales, costos e impresión de fichas.",
    group: "Operación",
  },
  {
    key: "reports",
    label: "Reportes",
    description: "Reportes operativos, stock valorizado, costos y ventas.",
    group: "Reportes",
  },
  {
    key: "financial_dashboard",
    label: "Dashboard financiero",
    description: "Dashboard financiero con KPIs y gráficos.",
    group: "Premium",
  },
  {
    key: "field_config",
    label: "Configuración de campos",
    description: "Campos dinámicos por tenant.",
    group: "Premium",
  },
  {
    key: "electronic_billing",
    label: "Facturación electrónica",
    description: "Módulo futuro de comprobantes electrónicos.",
    group: "Premium",
  },
];

const FEATURES_BY_GROUP = FEATURE_DEFINITIONS.reduce<Record<string, FeatureDefinition[]>>(
  (acc, feature) => {
    if (!acc[feature.group]) acc[feature.group] = [];
    acc[feature.group].push(feature);
    return acc;
  },
  {}
);

const GROUP_ORDER: FeatureDefinition["group"][] = [
  "Core",
  "Comercial",
  "Inventario",
  "Operación",
  "Reportes",
  "Premium",
];

function featureLabel(featureKey: string) {
  return FEATURE_DEFINITIONS.find((item) => item.key === featureKey)?.label || featureKey;
}

export default function SuperadminTenantsPage() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [featureRows, setFeatureRows] = useState<TenantFeature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [featuresSavingKey, setFeaturesSavingKey] = useState<string | null>(null);

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

  const selectedTenant = useMemo(
    () => rows.find((tenant) => tenant.id === selectedTenantId) || null,
    [rows, selectedTenantId]
  );

  const featureMap = useMemo(() => {
    const map = new Map<string, boolean>();
    featureRows.forEach((feature) => map.set(feature.feature_key, Boolean(feature.enabled)));
    return map;
  }, [featureRows]);

  const enabledCount = useMemo(
    () => FEATURE_DEFINITIONS.filter((feature) => featureMap.get(feature.key)).length,
    [featureMap]
  );

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get<PaginatedResponse<Tenant>>("/superadmin/tenants", {
        params: { page: 1, page_size: 100 },
      });

      const items = Array.isArray(response.data.items) ? response.data.items : [];
      setRows(items);

      setSelectedTenantId((prev) => {
        if (prev && items.some((tenant) => tenant.id === prev)) return prev;
        return items[0]?.id || null;
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudieron cargar las empresas.");
    } finally {
      setLoading(false);
    }
  };

  const loadTenantFeatures = async (tenantId: string) => {
    try {
      setFeaturesLoading(true);
      setError("");

      const response = await api.get<TenantFeature[]>(`/superadmin/tenants/${tenantId}/features`);
      const incoming = Array.isArray(response.data) ? response.data : [];
      const incomingMap = new Map(incoming.map((item) => [item.feature_key, Boolean(item.enabled)]));

      setFeatureRows(
        FEATURE_DEFINITIONS.map((feature) => ({
          feature_key: feature.key,
          enabled: incomingMap.has(feature.key) ? Boolean(incomingMap.get(feature.key)) : true,
        }))
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudieron cargar los módulos del tenant. Verificá que exista el endpoint de tenant features."
      );
      setFeatureRows(
        FEATURE_DEFINITIONS.map((feature) => ({
          feature_key: feature.key,
          enabled: true,
        }))
      );
    } finally {
      setFeaturesLoading(false);
    }
  };

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      void loadTenantFeatures(selectedTenantId);
    } else {
      setFeatureRows([]);
    }
  }, [selectedTenantId]);

  const createTenant = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");
      setSuccess("");

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

      setSuccess("Empresa creada correctamente.");
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
      setSuccess("");
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

  const toggleFeature = async (featureKey: string, enabled: boolean) => {
    if (!selectedTenantId) return;

    const previousRows = featureRows;

    setFeatureRows((prev) =>
      prev.map((item) =>
        item.feature_key === featureKey ? { ...item, enabled } : item
      )
    );

    try {
      setError("");
      setSuccess("");
      setFeaturesSavingKey(featureKey);

      await api.put(`/superadmin/tenants/${selectedTenantId}/features/${featureKey}`, {
        enabled,
      });

      setSuccess(
        `${featureLabel(featureKey)} ${enabled ? "habilitado" : "deshabilitado"} para ${
          selectedTenant?.name || "el tenant"
        }.`
      );
    } catch (err: any) {
      setFeatureRows(previousRows);
      setError(err?.response?.data?.detail || "No se pudo actualizar el módulo.");
    } finally {
      setFeaturesSavingKey(null);
    }
  };

  const enableAllFeatures = async () => {
    if (!selectedTenantId) return;

    try {
      setFeaturesLoading(true);
      setError("");
      setSuccess("");

      await api.put(`/superadmin/tenants/${selectedTenantId}/features`, {
        items: FEATURE_DEFINITIONS.map((feature) => ({
          feature_key: feature.key,
          enabled: true,
        })),
      });

      setSuccess(`Todos los módulos quedaron habilitados para ${selectedTenant?.name || "el tenant"}.`);
      await loadTenantFeatures(selectedTenantId);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudieron habilitar todos los módulos.");
    } finally {
      setFeaturesLoading(false);
    }
  };

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
          <p className="df-pro-page__eyebrow">Superadmin</p>
          <h1 className="df-pro-page__title">Empresas</h1>
          <p className="df-pro-page__subtitle">
            Creá tenants, impersoná usuarios admin y activá módulos contratados por empresa.
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
      {error && (
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
      {success && (
        <section className="df-pro-card">
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#ecfdf3",
              color: "#027a48",
            }}
          >
            {success}
          </div>
        </section>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 0.9fr) minmax(0, 1.25fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <section className="df-pro-card">
          <h2 style={{ marginTop: 0 }}>Empresas existentes</h2>

          {rows.length === 0 && !loading && <p>No hay empresas cargadas.</p>}

          {rows.length > 0 && (
            <div style={{ display: "grid", gap: 12 }}>
              {rows.map((tenant) => {
                const canImpersonate = Boolean(tenant.admin_membership_id);
                const isBusy = impersonatingId === tenant.id;
                const isSelected = selectedTenantId === tenant.id;

                return (
                  <div
                    key={tenant.id}
                    onClick={() => setSelectedTenantId(tenant.id)}
                    style={{
                      border: isSelected
                        ? "1px solid var(--tenant-primary, #3d3648)"
                        : "1px solid var(--df-border)",
                      borderRadius: 16,
                      padding: 14,
                      display: "grid",
                      gap: 8,
                      cursor: "pointer",
                      background: isSelected ? "#fbf7f3" : "#fff",
                      boxShadow: isSelected ? "0 14px 28px rgba(64, 52, 42, 0.08)" : undefined,
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
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleImpersonate(tenant);
                          }}
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

        <section className="df-pro-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <p className="df-pro-page__eyebrow" style={{ marginBottom: 4 }}>
                Módulos por tenant
              </p>
              <h2 style={{ margin: 0 }}>{selectedTenant?.name || "Seleccioná una empresa"}</h2>
              <p style={{ margin: "6px 0 0", color: "#8a7f78" }}>
                Activá o desactivá opciones del menú principal según el plan contratado.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "#f8f4ef",
                  border: "1px solid #eadfd7",
                  fontSize: 13,
                }}
              >
                Activos: <strong>{enabledCount}</strong> / {FEATURE_DEFINITIONS.length}
              </div>

              <button
                type="button"
                className="gf-btn gf-btn-secondary"
                onClick={enableAllFeatures}
                disabled={!selectedTenantId || featuresLoading}
              >
                Habilitar todos
              </button>
            </div>
          </div>

          {!selectedTenantId ? (
            <p>Seleccioná una empresa para configurar sus módulos.</p>
          ) : featuresLoading ? (
            <p>Cargando módulos...</p>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {GROUP_ORDER.map((group) => {
                const groupFeatures = FEATURES_BY_GROUP[group] || [];
                if (groupFeatures.length === 0) return null;

                return (
                  <div key={group} style={{ display: "grid", gap: 10 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 13,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#8a7f78",
                      }}
                    >
                      {group}
                    </h3>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 12,
                      }}
                    >
                      {groupFeatures.map((feature) => {
                        const enabled = featureMap.get(feature.key) ?? true;
                        const savingThis = featuresSavingKey === feature.key;

                        return (
                          <label
                            key={feature.key}
                            style={{
                              border: enabled ? "1px solid #d9c7b9" : "1px solid #e5e7eb",
                              borderRadius: 16,
                              padding: 14,
                              background: enabled ? "#fffaf5" : "#fff",
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 14,
                              alignItems: "flex-start",
                              cursor: savingThis ? "wait" : "pointer",
                              opacity: savingThis ? 0.7 : 1,
                            }}
                          >
                            <span style={{ display: "grid", gap: 4 }}>
                              <strong>{feature.label}</strong>
                              <small style={{ color: "#8a7f78", lineHeight: 1.35 }}>
                                {feature.description}
                              </small>
                              <small style={{ color: "#b08a5a", fontWeight: 700 }}>
                                {feature.key}
                              </small>
                            </span>

                            <input
                              type="checkbox"
                              checked={enabled}
                              disabled={savingThis}
                              onChange={(e) => void toggleFeature(feature.key, e.target.checked)}
                              style={{ width: 20, height: 20, marginTop: 2 }}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

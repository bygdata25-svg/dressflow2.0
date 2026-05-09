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
  plan_code?: string | null;

  max_users?: number;
  active_users?: number;
  available_users?: number;

  admin_membership_id?: string | null;
  admin_user_name?: string | null;
  admin_user_email?: string | null;
};

type TenantCurrency = {
  id: string;
  tenant_id: string;
  currency_code: string;
  symbol: string;
  is_base: boolean;
  is_enabled: boolean;
  display_order: number;
};

type TenantCurrencyRule = {
  id: string;
  tenant_id: string;

  module: string;
  price_type: string;

  default_currency: string;

  allow_override: boolean;
};

type TenantFeature = {
  id: string;
  tenant_id: string;
  feature_key: string;
  enabled: boolean;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

const FEATURE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  dresses: "Vestidos",
  accessories: "Accesorios",
  accessory_movements: "Movimientos de accesorios",
  capsules: "Cápsulas",
  loans: "Préstamos / Alquileres",
  sales: "Ventas",
  production_orders: "Órdenes de producción",
  fabrics: "Telas",
  fabric_rolls: "Rollos",
  trims: "Avíos",
  fabric_movements: "Movimientos de tela",
  reports: "Reportes",
  reports_stock_valuation: "Valuación de stock",
  reports_dress_stock: "Stock de vestidos",
  reports_fabric_movements: "Reporte de movimientos de tela",
  reports_loans: "Reporte de préstamos",
  reports_production_costs: "Reporte de costos de producción",
  reports_sales: "Reporte de ventas",
  financial_dashboard: "Dashboard financiero",
  branding: "Branding",
  users: "Usuarios",
  suppliers: "Proveedores",
  customers: "Clientes",
  imports: "Importaciones",
  production_process_types: "Procesos de producción",
};

export default function SuperadminTenantsPage() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedTenantId, setSelectedTenantId] =
    useState<string | null>(null);

  const [impersonatingId, setImpersonatingId] =
    useState<string | null>(null);

  const [currencies, setCurrencies] = useState<
    TenantCurrency[]
  >([]);

  const [currenciesLoading, setCurrenciesLoading] =
    useState(false);

  const [currencyRules, setCurrencyRules] =
    useState<TenantCurrencyRule[]>([]);

  const [currencyRulesLoading, setCurrencyRulesLoading] =
    useState(false);

  const [features, setFeatures] = useState<
    TenantFeature[]
  >([]);

  const [featuresLoading, setFeaturesLoading] =
    useState(false);

  const [limitSaving, setLimitSaving] =
    useState(false);

  const [maxUsers, setMaxUsers] = useState(3);

  const [selectedPlan, setSelectedPlan] =
    useState("PRO");

  const [planSaving, setPlanSaving] =
    useState(false);

  const [newCurrency, setNewCurrency] = useState({
    currency_code: "USD",
    symbol: "U$S",
  });

  const [form, setForm] = useState({
    tenant_name: "",
    tenant_slug: "",
    tenant_email: "",
    tenant_phone: "",
    tenant_currency: "USD",
    tenant_timezone:
      "America/Argentina/Buenos_Aires",

    admin_first_name: "",
    admin_last_name: "",
    admin_email: "",
    admin_password: "",
  });

  const selectedTenant = useMemo(
    () =>
      rows.find(
        (tenant) => tenant.id === selectedTenantId
      ) || null,
    [rows, selectedTenantId]
  );

  useEffect(() => {
    if (selectedTenant?.max_users) {
      setMaxUsers(
        selectedTenant.max_users
      );
    }

    setSelectedPlan(
      selectedTenant?.plan_code ||
        "PRO"
    );
  }, [selectedTenant]);

  const loadTenants = async () => {
    try {
      setLoading(true);

      const response =
        await api.get<PaginatedResponse<Tenant>>(
          "/superadmin/tenants",
          {
            params: {
              page: 1,
              page_size: 100,
            },
          }
        );

      const items = Array.isArray(response.data.items)
        ? response.data.items
        : [];

      setRows(items);

      setSelectedTenantId((prev) => {
        if (
          prev &&
          items.some(
            (tenant) => tenant.id === prev
          )
        ) {
          return prev;
        }

        return items[0]?.id || null;
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudieron cargar las empresas."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencies = async (
    tenantId: string
  ) => {
    try {
      setCurrenciesLoading(true);

      const response =
        await api.get<TenantCurrency[]>(
          `/tenant-currencies/${tenantId}`
        );

      setCurrencies(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudieron cargar las monedas."
      );
    } finally {
      setCurrenciesLoading(false);
    }
  };

  const loadCurrencyRules = async (
    tenantId: string
  ) => {
    try {
      setCurrencyRulesLoading(true);

      const response =
        await api.get<TenantCurrencyRule[]>(
          `/superadmin/tenants/${tenantId}/currency-rules`
        );

      setCurrencyRules(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudieron cargar las reglas financieras."
      );
    } finally {
      setCurrencyRulesLoading(false);
    }
  };

  const loadFeatures = async (
    tenantId: string
  ) => {
    try {
      setFeaturesLoading(true);

      const response =
        await api.get<TenantFeature[]>(
          `/superadmin/tenants/${tenantId}/features`
        );

      setFeatures(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudieron cargar los módulos."
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
      void loadCurrencies(selectedTenantId);
      void loadCurrencyRules(selectedTenantId);
      void loadFeatures(selectedTenantId);
    }
  }, [selectedTenantId]);

  const createTenant = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    try {
      setError("");
      setSuccess("");

      await api.post("/superadmin/tenants", {
        tenant: {
          name: form.tenant_name,
          slug: form.tenant_slug,
          email:
            form.tenant_email || null,
          phone:
            form.tenant_phone || null,
          currency:
            form.tenant_currency,
          timezone:
            form.tenant_timezone,
        },

        admin_user: {
          first_name:
            form.admin_first_name,
          last_name:
            form.admin_last_name,
          email: form.admin_email,
          password:
            form.admin_password,
        },
      });

      setSuccess(
        "Empresa creada correctamente."
      );

      setForm({
        tenant_name: "",
        tenant_slug: "",
        tenant_email: "",
        tenant_phone: "",
        tenant_currency: "USD",
        tenant_timezone:
          "America/Argentina/Buenos_Aires",

        admin_first_name: "",
        admin_last_name: "",
        admin_email: "",
        admin_password: "",
      });

      await loadTenants();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo crear la empresa."
      );
    }
  };

  const handleImpersonate = async (
    tenant: Tenant
  ) => {
    if (!tenant.admin_membership_id) {
      return;
    }

    try {
      setImpersonatingId(tenant.id);

      const data =
        await impersonateMembership(
          tenant.admin_membership_id
        );

      setToken(data.access_token);

      window.location.href = "/";
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo impersonar."
      );
    } finally {
      setImpersonatingId(null);
    }
  };

  const updateUserLimit = async () => {
    if (!selectedTenantId) return;

    try {
      setLimitSaving(true);

      await api.put(
        `/superadmin/tenant-limits/${selectedTenantId}`,
        {
          max_users: maxUsers,
        }
      );

      setSuccess(
        "Límite de usuarios actualizado."
      );

      await loadTenants();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo actualizar el límite."
      );
    } finally {
      setLimitSaving(false);
    }
  };

  const addCurrency = async () => {
    if (!selectedTenantId) return;

    try {
      await api.post(
        `/tenant-currencies/${selectedTenantId}`,
        {
          currency_code:
            newCurrency.currency_code,
          symbol: newCurrency.symbol,
          is_base:
            currencies.length === 0,
          is_enabled: true,
          display_order:
            currencies.length,
        }
      );

      setSuccess("Moneda agregada.");

      await loadCurrencies(
        selectedTenantId
      );

      await loadCurrencyRules(
        selectedTenantId
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo agregar la moneda."
      );
    }
  };

  const setBaseCurrency = async (
    currency: TenantCurrency
  ) => {
    if (!selectedTenantId) return;

    try {
      await api.put(
        `/tenant-currencies/${selectedTenantId}/${currency.id}`,
        {
          is_base: true,
        }
      );

      setSuccess(
        "Moneda base actualizada."
      );

      await loadCurrencies(
        selectedTenantId
      );

      await loadCurrencyRules(
        selectedTenantId
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo actualizar la moneda base."
      );
    }
  };

  const deleteCurrency = async (
    currency: TenantCurrency
  ) => {
    if (!selectedTenantId) return;

    try {
      await api.delete(
        `/tenant-currencies/${selectedTenantId}/${currency.id}`
      );

      setSuccess("Moneda eliminada.");

      await loadCurrencies(
        selectedTenantId
      );

      await loadCurrencyRules(
        selectedTenantId
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo eliminar la moneda."
      );
    }
  };

  const updateCurrencyRule = async (
    ruleId: string,
    payload: {
      default_currency?: string;
      allow_override?: boolean;
    }
  ) => {
    if (!selectedTenantId) return;

    try {
      await api.put(
        `/superadmin/tenants/${selectedTenantId}/currency-rules/${ruleId}`,
        payload
      );

      setSuccess(
        "Regla financiera actualizada."
      );

      await loadCurrencyRules(
        selectedTenantId
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo actualizar la regla."
      );
    }
  };

  const updateFeature = async (
    featureId: string,
    enabled: boolean
  ) => {
    if (!selectedTenantId) return;

    try {
      await api.put(
        `/superadmin/tenants/${selectedTenantId}/features/${featureId}`,
        {
          enabled,
        }
      );

      setSuccess(
        "Módulo actualizado."
      );

      await loadFeatures(
        selectedTenantId
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo actualizar el módulo."
      );
    }
  };

  const updateTenantPlan = async () => {
    if (!selectedTenantId) return;

    try {
      setPlanSaving(true);

      await api.put(
        `/superadmin/tenants/${selectedTenantId}/plan`,
        {
          plan_code: selectedPlan,
        }
      );

      setSuccess(
        "Plan actualizado."
      );

      await loadFeatures(
        selectedTenantId
      );

      await loadTenants();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "No se pudo actualizar el plan."
      );
    } finally {
      setPlanSaving(false);
    }
  };

  return (
    <section className="df-pro-page">
      <header className="df-pro-page__hero">
        <div>
          <p className="df-pro-page__eyebrow">
            Superadmin
          </p>

          <h1 className="df-pro-page__title">
            Empresas
          </h1>

          <p className="df-pro-page__subtitle">
            Administración SaaS
            multi-tenant.
          </p>
        </div>
      </header>

      <section className="df-pro-card">
        <form
          onSubmit={createTenant}
          className="df-pro-form-grid df-pro-form-grid--6"
        >
          <input
            className="df-pro-input"
            placeholder="Nombre empresa"
            value={form.tenant_name}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                tenant_name:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            placeholder="Slug"
            value={form.tenant_slug}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                tenant_slug:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            placeholder="Email empresa"
            value={form.tenant_email}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                tenant_email:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            placeholder="Teléfono"
            value={form.tenant_phone}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                tenant_phone:
                  e.target.value,
              }))
            }
          />

          <select
            className="df-pro-input"
            value={form.tenant_currency}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                tenant_currency:
                  e.target.value,
              }))
            }
          >
            <option value="USD">
              USD
            </option>
            <option value="ARS">
              ARS
            </option>
            <option value="EUR">
              EUR
            </option>
          </select>

          <input
            className="df-pro-input"
            placeholder="Timezone"
            value={form.tenant_timezone}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                tenant_timezone:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            placeholder="Nombre admin"
            value={form.admin_first_name}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                admin_first_name:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            placeholder="Apellido admin"
            value={form.admin_last_name}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                admin_last_name:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            placeholder="Email admin"
            value={form.admin_email}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                admin_email:
                  e.target.value,
              }))
            }
          />

          <input
            className="df-pro-input"
            type="password"
            placeholder="Password admin"
            value={form.admin_password}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                admin_password:
                  e.target.value,
              }))
            }
          />

          <button type="submit">
            Crear empresa
          </button>
        </form>
      </section>

      {error && (
        <section className="df-pro-card">
          <div
            style={{
              color: "#b42318",
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
          gridTemplateColumns:
            "minmax(340px, 0.8fr) minmax(0, 1.2fr)",
          gap: 20,
        }}
      >
        <section className="df-pro-card">
          <h2>Empresas</h2>

          {loading && <p>Cargando...</p>}

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {rows.map((tenant) => (
              <div
                key={tenant.id}
                onClick={() =>
                  setSelectedTenantId(
                    tenant.id
                  )
                }
                style={{
                  border:
                    selectedTenantId ===
                    tenant.id
                      ? "1px solid #b08a5a"
                      : "1px solid #e5e7eb",

                  borderRadius: 16,
                  padding: 14,
                  cursor: "pointer",

                  background:
                    selectedTenantId ===
                    tenant.id
                      ? "#fffaf5"
                      : "#fff",
                }}
              >
                <strong>
                  {tenant.name}
                </strong>

                <div>
                  Slug: {tenant.slug}
                </div>

                <div>
                  Moneda base:
                  {" "}
                  {tenant.currency}
                </div>

                <div>
                  Usuarios:
                  {" "}
                  <strong>
                    {tenant.active_users ||
                      0}
                    {" / "}
                    {tenant.max_users ||
                      0}
                  </strong>
                </div>

                <div>
                  Status:
                  {" "}
                  {tenant.status}
                </div>

                <button
                  type="button"
                  style={{
                    marginTop: 10,
                  }}
                  disabled={
                    impersonatingId ===
                    tenant.id
                  }
                  onClick={(e) => {
                    e.stopPropagation();

                    void handleImpersonate(
                      tenant
                    );
                  }}
                >
                  {impersonatingId ===
                  tenant.id
                    ? "Impersonando..."
                    : "Impersonar"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="df-pro-card">
          {!selectedTenant ? (
            <p>
              Seleccioná una empresa.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 24,
              }}
            >
              <div>
                <h2
                  style={{
                    marginTop: 0,
                  }}
                >
                  {selectedTenant.name}
                </h2>

                <p>
                  Configuración SaaS y
                  financiera.
                </p>
              </div>

              <section
                style={{
                  border:
                    "1px solid #e5e7eb",

                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h3>
                  Plan comercial
                </h3>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    marginTop: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <select
                    className="df-pro-input"
                    value={selectedPlan}
                    onChange={(e) =>
                      setSelectedPlan(
                        e.target.value
                      )
                    }
                    style={{
                      maxWidth: 260,
                    }}
                  >
                    <option value="BASIC">
                      DressFlow Basic
                    </option>

                    <option value="PRO">
                      DressFlow Pro
                    </option>

                    <option value="PREMIUM">
                      DressFlow Premium
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={
                      updateTenantPlan
                    }
                    disabled={planSaving}
                  >
                    {planSaving
                      ? "Guardando..."
                      : "Aplicar plan"}
                  </button>
                </div>

                <p
                  style={{
                    marginTop: 14,
                    color: "#6b7280",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  El plan activa y desactiva
                  automáticamente los módulos
                  SaaS disponibles para el
                  tenant. Luego podés ajustar
                  módulos manualmente desde
                  Módulos habilitados.
                </p>
              </section>

              <section
                style={{
                  border:
                    "1px solid #e5e7eb",

                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h3>
                  Límite de usuarios
                </h3>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems:
                      "center",
                  }}
                >
                  <input
                    className="df-pro-input"
                    type="number"
                    value={maxUsers}
                    onChange={(e) =>
                      setMaxUsers(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    style={{
                      maxWidth: 140,
                    }}
                  />

                  <button
                    type="button"
                    onClick={
                      updateUserLimit
                    }
                    disabled={
                      limitSaving
                    }
                  >
                    {limitSaving
                      ? "Guardando..."
                      : "Guardar"}
                  </button>
                </div>
              </section>

              <section
                style={{
                  border:
                    "1px solid #e5e7eb",

                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h3>
                  Monedas habilitadas
                </h3>

                {currenciesLoading ? (
                  <p>
                    Cargando monedas...
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {currencies.map(
                      (currency) => (
                        <div
                          key={
                            currency.id
                          }
                          style={{
                            border:
                              "1px solid #ececec",

                            borderRadius: 12,
                            padding: 12,

                            display:
                              "flex",

                            justifyContent:
                              "space-between",

                            alignItems:
                              "center",
                          }}
                        >
                          <div>
                            <strong>
                              {
                                currency.currency_code
                              }
                            </strong>

                            {" · "}

                            {
                              currency.symbol
                            }

                            {currency.is_base && (
                              <span>
                                {" "}
                                ·
                                BASE
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display:
                                "flex",

                              gap: 10,
                            }}
                          >
                            {!currency.is_base && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void setBaseCurrency(
                                      currency
                                    )
                                  }
                                >
                                  Base
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteCurrency(
                                      currency
                                    )
                                  }
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 12,
                      }}
                    >
                      <select
                        className="df-pro-input"
                        value={
                          newCurrency.currency_code
                        }
                        onChange={(e) => {
                          const value =
                            e.target
                              .value;

                          setNewCurrency(
                            {
                              currency_code:
                                value,

                              symbol:
                                value ===
                                "USD"
                                  ? "U$S"
                                  : value ===
                                    "ARS"
                                  ? "$"
                                  : value ===
                                    "EUR"
                                  ? "€"
                                  : value,
                            }
                          );
                        }}
                      >
                        <option value="USD">
                          USD
                        </option>

                        <option value="ARS">
                          ARS
                        </option>

                        <option value="EUR">
                          EUR
                        </option>
                      </select>

                      <button
                        type="button"
                        onClick={
                          addCurrency
                        }
                      >
                        Agregar moneda
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section
                style={{
                  border:
                    "1px solid #e5e7eb",

                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h3>
                  Reglas financieras
                </h3>

                {currencyRulesLoading ? (
                  <p>
                    Cargando reglas...
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    {currencyRules.map(
                      (rule) => (
                        <div
                          key={rule.id}
                          style={{
                            border:
                              "1px solid #ececec",

                            borderRadius: 14,
                            padding: 14,

                            display:
                              "grid",

                            gridTemplateColumns:
                              "1fr 1fr 180px 160px",

                            gap: 14,

                            alignItems:
                              "center",
                          }}
                        >
                          <div>
                            <strong>
                              {
                                rule.module
                              }
                            </strong>
                          </div>

                          <div>
                            {
                              rule.price_type
                            }
                          </div>

                          <select
                            className="df-pro-input"
                            value={
                              rule.default_currency
                            }
                            onChange={(
                              e
                            ) =>
                              void updateCurrencyRule(
                                rule.id,
                                {
                                  default_currency:
                                    e
                                      .target
                                      .value,
                                }
                              )
                            }
                          >
                            {currencies.map(
                              (
                                currency
                              ) => (
                                <option
                                  key={
                                    currency.id
                                  }
                                  value={
                                    currency.currency_code
                                  }
                                >
                                  {
                                    currency.currency_code
                                  }
                                </option>
                              )
                            )}
                          </select>

                          <label
                            style={{
                              display:
                                "flex",

                              gap: 10,

                              alignItems:
                                "center",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                rule.allow_override
                              }
                              onChange={(
                                e
                              ) =>
                                void updateCurrencyRule(
                                  rule.id,
                                  {
                                    allow_override:
                                      e
                                        .target
                                        .checked,
                                  }
                                )
                              }
                            />

                            Override
                          </label>
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              <section
                style={{
                  border:
                    "1px solid #e5e7eb",

                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <h3>
                  Módulos habilitados
                </h3>

                <p
                  style={{
                    marginTop: -6,
                    marginBottom: 16,
                    color: "#6b7280",
                    fontSize: 13,
                  }}
                >
                  Activá o desactivá módulos según el plan comercial del tenant.
                </p>

                {featuresLoading ? (
                  <p>
                    Cargando módulos...
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {features.map((feature) => (
                      <label
                        key={feature.id}
                        style={{
                          border:
                            feature.enabled
                              ? "1px solid #d6b98c"
                              : "1px solid #ececec",

                          borderRadius: 14,
                          padding: 14,

                          display: "flex",

                          justifyContent:
                            "space-between",

                          alignItems: "center",

                          gap: 14,

                          background:
                            feature.enabled
                              ? "#fffaf5"
                              : "#fff",

                          cursor: "pointer",
                        }}
                      >
                        <div>
                          <strong>
                            {FEATURE_LABELS[
                              feature.feature_key
                            ] ||
                              feature.feature_key}
                          </strong>

                          <div
                            style={{
                              marginTop: 4,
                              color: "#8a7f78",
                              fontSize: 12,
                            }}
                          >
                            {feature.feature_key}
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={feature.enabled}
                          onChange={(e) =>
                            void updateFeature(
                              feature.feature_key,
                              e.target.checked
                            )
                          }
                        />
                      </label>
                    ))}

                    {features.length === 0 && (
                      <div
                        style={{
                          border: "1px dashed #d1d5db",
                          borderRadius: 14,
                          padding: 16,
                          color: "#6b7280",
                        }}
                      >
                        No hay módulos configurados para este tenant.
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

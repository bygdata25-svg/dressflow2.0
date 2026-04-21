import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import "../styles/pro-pages.css";

type AccessoryOption = {
  id: string;
  code?: string | null;
  name: string;
  stock: number;
  sale_price?: number | null;
  status: string;
};

type CustomerOption = {
  id: string;
  code?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type AccessorySaleItem = {
  id: string;
  sale_number?: string | null;
  accessory_id: string;
  customer_id?: string | null;
  sale_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  payment_method?: string | null;
  notes?: string | null;
  status: string;
  accessory_code?: string | null;
  accessory_name?: string | null;
  customer_full_name?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page?: number;
  page_size?: number;
  total?: number;
};

const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "MERCADOPAGO"];

function paymentMethodLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase().trim();

  if (raw === "CASH" || raw === "EFECTIVO") return "EFECTIVO";
  if (raw === "TRANSFER" || raw === "TRANSFERENCIA") return "TRANSFERENCIA";
  if (raw === "CARD" || raw === "TARJETA DE CREDITO") return "TARJETA DE CREDITO";
  if (raw === "MERCADOPAGO" || raw === "MERCADO PAGO") return "MERCADO PAGO";

  return value || "-";
}

function formatCustomerName(customer: CustomerOption) {
  return (
    customer.full_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Cliente sin nombre"
  );
}

function money(value?: number | string | null, currency = "ARS") {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function buildNextCustomerCode(customers: CustomerOption[]) {
  const numbers = customers
    .map((customer) => {
      const code = String(customer.code || "").trim().toUpperCase();
      const match = code.match(/^C-(\d+)$/);
      return match ? Number(match[1]) : null;
    })
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `C-${String(next).padStart(4, "0")}`;
}

export default function AccessorySalesPage() {
  const [items, setItems] = useState<AccessorySaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [error, setError] = useState("");

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const [accessories, setAccessories] = useState<AccessoryOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    payment_method: "",
  });

  const [saleForm, setSaleForm] = useState({
    accessory_id: "",
    customer_id: "",
    quantity: "1",
    unit_price: "",
    currency: "ARS",
    payment_method: "",
    notes: "",
  });

  const [customerForm, setCustomerForm] = useState({
    code: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const resetSaleForm = () => {
    setSaleForm({
      accessory_id: "",
      customer_id: "",
      quantity: "1",
      unit_price: "",
      currency: "ARS",
      payment_method: "",
      notes: "",
    });
  };

  const resetCustomerForm = (suggestedCode = "") => {
    setCustomerForm({
      code: suggestedCode,
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      notes: "",
    });
  };

  const closeSaleModal = () => {
    setShowSaleModal(false);
    resetSaleForm();
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    resetCustomerForm(buildNextCustomerCode(customers));
  };

  async function loadSales() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string> = {};
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.payment_method) params.payment_method = filters.payment_method;

      const { data } = await api.get<PaginatedResponse<AccessorySaleItem>>("/accessory-sales", {
        params,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      console.error("Error loading accessory sales:", err);
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudieron cargar las ventas de accesorios.");
      }

      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccessories() {
    try {
      const { data } = await api.get<PaginatedResponse<AccessoryOption>>("/accessories", {
        params: {
          page: 1,
          page_size: 200,
          status: "ACTIVE",
        },
      });

      const raw = Array.isArray(data) ? data : data.items || [];
      const available = raw.filter(
        (item: AccessoryOption) =>
          item.status === "ACTIVE" && Number(item.stock || 0) > 0
      );

      setAccessories(available);
    } catch (err: any) {
      console.error("Error loading accessories:", err);
      console.error("Accessory load detail:", err?.response?.data);
      setAccessories([]);
    }
  }

  async function loadCustomers() {
    try {
      const { data } = await api.get<PaginatedResponse<CustomerOption>>("/customers", {
        params: {
          page: 1,
          page_size: 200,
        },
      });

      const raw = Array.isArray(data) ? data : data.items || [];
      setCustomers(raw);
      return raw;
    } catch (err) {
      console.error("Error loading customers:", err);
      setCustomers([]);
      return [];
    }
  }

  async function loadAllReferences() {
    const [, loadedCustomers] = await Promise.all([loadAccessories(), loadCustomers()]);
    return loadedCustomers;
  }

  useEffect(() => {
    void loadSales();
  }, [filters.q, filters.status, filters.payment_method]);

  useEffect(() => {
    void loadAllReferences();
  }, []);

  async function openCreateSaleModal() {
    setError("");
    await loadAllReferences();
    setShowSaleModal(true);
  }

  async function openCreateCustomerModal() {
    setError("");
    const loadedCustomers = await loadCustomers();
    resetCustomerForm(buildNextCustomerCode(loadedCustomers));
    setShowCustomerModal(true);
  }

  function handleAccessoryChange(accessoryId: string) {
    const selected = accessories.find((item) => item.id === accessoryId);

    setSaleForm((prev) => ({
      ...prev,
      accessory_id: accessoryId,
      unit_price:
        selected && selected.sale_price != null
          ? String(selected.sale_price)
          : prev.unit_price,
    }));
  }

  async function handleCreateSale(event: React.FormEvent) {
    event.preventDefault();

    if (!saleForm.accessory_id) {
      setError("Seleccioná un accesorio.");
      return;
    }

    if (!saleForm.quantity || Number(saleForm.quantity) <= 0) {
      setError("Ingresá una cantidad mayor a cero.");
      return;
    }

    if (!saleForm.unit_price || Number(saleForm.unit_price) < 0) {
      setError("Ingresá un precio unitario válido.");
      return;
    }

    try {
      setSavingSale(true);
      setError("");

      await api.post("/accessory-sales", {
        accessory_id: saleForm.accessory_id,
        customer_id: saleForm.customer_id || null,
        quantity: Number(saleForm.quantity),
        unit_price: Number(saleForm.unit_price),
        currency: saleForm.currency || "ARS",
        payment_method: saleForm.payment_method || null,
        notes: saleForm.notes.trim() || null,
      });

      closeSaleModal();
      await Promise.all([loadSales(), loadAccessories()]);
    } catch (err: any) {
      console.error("Error creating accessory sale:", err);
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((item: any) => item.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudo registrar la venta del accesorio.");
      }
    } finally {
      setSavingSale(false);
    }
  }

  async function handleCreateCustomer(event: React.FormEvent) {
    event.preventDefault();

    if (!customerForm.first_name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (!customerForm.last_name.trim()) {
      setError("El apellido es obligatorio.");
      return;
    }

    try {
      setSavingCustomer(true);
      setError("");

      const payload = {
        code: customerForm.code.trim() || null,
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim(),
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        notes: customerForm.notes.trim() || null,
      };

      const { data } = await api.post("/customers", payload);
      const refreshedCustomers = await loadCustomers();

      if (data?.id) {
        setSaleForm((prev) => ({
          ...prev,
          customer_id: data.id,
        }));
      } else {
        const created = refreshedCustomers.find(
          (customer) =>
            customer.first_name?.trim().toLowerCase() === payload.first_name.toLowerCase() &&
            customer.last_name?.trim().toLowerCase() === payload.last_name.toLowerCase() &&
            (customer.email || null) === payload.email
        );

        if (created?.id) {
          setSaleForm((prev) => ({
            ...prev,
            customer_id: created.id,
          }));
        }
      }

      closeCustomerModal();
    } catch (err: any) {
      console.error("Error creating customer:", err);
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudo crear el cliente.");
      }
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleCancelSale(id: string) {
    const reason = window.prompt("Motivo de cancelación:");
    if (reason === null) return;

    try {
      setError("");
      await api.post(`/accessory-sales/${id}/cancel`, { reason });
      await Promise.all([loadSales(), loadAccessories()]);
    } catch (err: any) {
      console.error("Error cancelling accessory sale:", err);
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudo cancelar la venta.");
      }
    }
  }

  const metrics = useMemo(() => {
    const completed = items.filter((item) => item.status === "COMPLETED");
    const totalAmount = completed.reduce(
      (acc, item) => acc + Number(item.total_price || 0),
      0
    );
    const totalUnits = completed.reduce(
      (acc, item) => acc + Number(item.quantity || 0),
      0
    );

    return {
      count: completed.length,
      totalAmount,
      totalUnits,
    };
  }, [items]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-accessory-sales-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .df-accessory-sales-kpi-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfafc 100%);
          border: 1px solid #e6e0e8;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 14px 32px rgba(31, 24, 39, 0.06);
          display: grid;
          gap: 8px;
        }

        .df-accessory-sales-kpi-card span {
          font-size: 14px;
          color: #7a7082;
          font-weight: 600;
        }

        .df-accessory-sales-kpi-card strong {
          font-size: 30px;
          color: #35293f;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .df-accessory-sales-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .df-accessory-sales-modal-field {
          display: grid;
          gap: 6px;
        }

        .df-accessory-sales-modal-field--full {
          grid-column: 1 / -1;
        }

        .df-accessory-sales-modal-field label,
        .df-accessory-sales-modal-label-row label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-accessory-sales-modal-field input,
        .df-accessory-sales-modal-field select,
        .df-accessory-sales-modal-field textarea {
          width: 100%;
          border: 1px solid #e7dfd6;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff;
          color: #3d3648;
          outline: none;
        }

        .df-accessory-sales-modal-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .df-accessory-sales-modal-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .df-accessory-sales-link-btn {
          border: none;
          background: transparent;
          color: #5b233f;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }

        .df-accessory-sales-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 0 12px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12px;
          border: 1px solid transparent;
        }

        .df-accessory-sales-status--completed {
          background: #e8f7ee;
          color: #157347;
          border-color: #cdebd9;
        }

        .df-accessory-sales-status--cancelled {
          background: #f4f1f5;
          color: #6f6478;
          border-color: #e1d9e5;
        }

        .df-accessory-sales-danger-btn {
          height: 36px;
          border-radius: 12px;
          border: 1px solid #f0c9c9;
          background: #fff5f5;
          color: #b42318;
          font-weight: 700;
          padding: 0 12px;
          cursor: pointer;
        }

        .df-accessory-sales-meta {
          display: grid;
          gap: 4px;
        }

        .df-accessory-sales-meta strong {
          font-size: 14px;
          color: #32273c;
        }

        .df-accessory-sales-meta span {
          font-size: 12px;
          color: #8b8193;
        }

        @media (max-width: 720px) {
          .df-accessory-sales-modal-grid {
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
          <p className="df-pro-page__eyebrow">Comercial</p>
          <h1 className="df-pro-page__title">Ventas de accesorios</h1>
          <p className="df-pro-page__subtitle">
            Registrá ventas, controlá cantidades vendidas y mantené el stock sincronizado automáticamente.
          </p>
        </div>

        <PrimaryButton type="button" onClick={() => void openCreateSaleModal()}>
          Nueva venta
        </PrimaryButton>
      </header>

      <section className="df-accessory-sales-kpis">
        <div className="df-accessory-sales-kpi-card">
          <span>Ventas completadas</span>
          <strong>{metrics.count}</strong>
        </div>

        <div className="df-accessory-sales-kpi-card">
          <span>Unidades vendidas</span>
          <strong>{metrics.totalUnits}</strong>
        </div>

        <div className="df-accessory-sales-kpi-card">
          <span>Total vendido</span>
          <strong>{money(metrics.totalAmount, "ARS")}</strong>
        </div>
      </section>

      <section className="df-pro-card">
        <div className="df-pro-filter-grid df-pro-filter-grid--3">
          <div>
            <label className="df-pro-label">Buscar</label>
            <input
              className="df-pro-input"
              type="text"
              placeholder="Buscar por N° venta, accesorio o cliente..."
              value={filters.q}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, q: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="df-pro-label">Estado</label>
            <select
              className="df-pro-select"
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value }))
              }
            >
              <option value="">Todos los estados</option>
              <option value="COMPLETED">Completadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">Medio de pago</label>
            <select
              className="df-pro-select"
              value={filters.payment_method}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, payment_method: e.target.value }))
              }
            >
              <option value="">Todos los medios de pago</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabel(method)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

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

      <section className="df-pro-card">
        {loading ? (
          <p>Cargando ventas de accesorios...</p>
        ) : items.length === 0 ? (
          <p>No hay ventas de accesorios registradas.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1120 }}>
              <thead>
                <tr>
                  <th className="df-pro-table__th">N° Venta</th>
                  <th className="df-pro-table__th">Fecha</th>
                  <th className="df-pro-table__th">Accesorio</th>
                  <th className="df-pro-table__th">Cliente</th>
                  <th className="df-pro-table__th">Cantidad</th>
                  <th className="df-pro-table__th">Precio unit.</th>
                  <th className="df-pro-table__th">Total</th>
                  <th className="df-pro-table__th">Pago</th>
                  <th className="df-pro-table__th">Estado</th>
                  <th className="df-pro-table__th">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((sale) => (
                  <tr key={sale.id}>
                    <td className="df-pro-table__td">
                      {sale.sale_number || "-"}
                    </td>

                    <td className="df-pro-table__td">
                      {sale.sale_date ? new Date(sale.sale_date).toLocaleString("es-AR") : "—"}
                    </td>

                    <td className="df-pro-table__td">
                      <div className="df-accessory-sales-meta">
                        <strong>{sale.accessory_name || "-"}</strong>
                        <span>{sale.accessory_code || "-"}</span>
                      </div>
                    </td>

                    <td className="df-pro-table__td">
                      {sale.customer_full_name || "-"}
                    </td>

                    <td className="df-pro-table__td">{sale.quantity}</td>

                    <td className="df-pro-table__td">
                      {money(sale.unit_price, sale.currency || "ARS")}
                    </td>

                    <td className="df-pro-table__td">
                      {money(sale.total_price, sale.currency || "ARS")}
                    </td>

                    <td className="df-pro-table__td">
                      {paymentMethodLabel(sale.payment_method)}
                    </td>

                    <td className="df-pro-table__td">
                      <span
                        className={`df-accessory-sales-status ${
                          sale.status === "COMPLETED"
                            ? "df-accessory-sales-status--completed"
                            : "df-accessory-sales-status--cancelled"
                        }`}
                      >
                        {sale.status === "COMPLETED" ? "Completada" : "Cancelada"}
                      </span>
                    </td>

                    <td className="df-pro-table__td">
                      {sale.status === "COMPLETED" ? (
                        <button
                          type="button"
                          className="df-accessory-sales-danger-btn"
                          onClick={() => void handleCancelSale(sale.id)}
                        >
                          Cancelar
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={showSaleModal}
        onClose={closeSaleModal}
        title="Nueva venta de accesorio"
        width="min(900px, 100%)"
      >
        <form onSubmit={handleCreateSale} style={{ display: "grid", gap: 16 }}>
          <div className="df-accessory-sales-modal-grid">
            <div className="df-accessory-sales-modal-field">
              <label>Accesorio</label>
              <select
                value={saleForm.accessory_id}
                onChange={(e) => handleAccessoryChange(e.target.value)}
              >
                <option value="">Seleccionar accesorio</option>
                {accessories.map((accessory) => (
                  <option key={accessory.id} value={accessory.id}>
                    {(accessory.code ? `${accessory.code} · ` : "") + accessory.name}
                    {typeof accessory.stock === "number" ? ` · Stock ${accessory.stock}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-accessory-sales-modal-field">
              <div className="df-accessory-sales-modal-label-row">
                <label>Cliente</label>
                <button
                  type="button"
                  className="df-accessory-sales-link-btn"
                  onClick={() => void openCreateCustomerModal()}
                >
                  + Nuevo cliente
                </button>
              </div>

              <select
                value={saleForm.customer_id}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, customer_id: e.target.value }))
                }
              >
                <option value="">Sin cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code ? `${customer.code} · ` : ""}
                    {formatCustomerName(customer)}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Cantidad</label>
              <input
                type="number"
                min="1"
                step="1"
                value={saleForm.quantity}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, quantity: e.target.value }))
                }
              />
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Precio unitario</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={saleForm.unit_price}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, unit_price: e.target.value }))
                }
              />
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Moneda</label>
              <select
                value={saleForm.currency}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, currency: e.target.value }))
                }
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Método de pago</label>
              <select
                value={saleForm.payment_method}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, payment_method: e.target.value }))
                }
              >
                <option value="">Seleccionar</option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {paymentMethodLabel(method)}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-accessory-sales-modal-field df-accessory-sales-modal-field--full">
              <label>Notas</label>
              <textarea
                value={saleForm.notes}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Observaciones de la venta"
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
            <button type="button" onClick={closeSaleModal}>
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={savingSale}>
              {savingSale ? "Guardando..." : "Confirmar venta"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      <Modal
        open={showCustomerModal}
        onClose={closeCustomerModal}
        title="Nuevo cliente"
        width="min(760px, 100%)"
      >
        <form onSubmit={handleCreateCustomer} style={{ display: "grid", gap: 16 }}>
          <div className="df-accessory-sales-modal-grid">
            <div className="df-accessory-sales-modal-field">
              <label>Código</label>
              <input
                value={customerForm.code}
                onChange={(e) =>
                  setCustomerForm((prev) => ({
                    ...prev,
                    code: e.target.value,
                  }))
                }
                placeholder="Ej: C-0001"
              />
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Nombre</label>
              <input
                value={customerForm.first_name}
                onChange={(e) =>
                  setCustomerForm((prev) => ({
                    ...prev,
                    first_name: e.target.value,
                  }))
                }
                placeholder="Nombre"
              />
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Apellido</label>
              <input
                value={customerForm.last_name}
                onChange={(e) =>
                  setCustomerForm((prev) => ({
                    ...prev,
                    last_name: e.target.value,
                  }))
                }
                placeholder="Apellido"
              />
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Email</label>
              <input
                type="email"
                value={customerForm.email}
                onChange={(e) =>
                  setCustomerForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="cliente@email.com"
              />
            </div>

            <div className="df-accessory-sales-modal-field">
              <label>Teléfono</label>
              <input
                value={customerForm.phone}
                onChange={(e) =>
                  setCustomerForm((prev) => ({
                    ...prev,
                    phone: e.target.value,
                  }))
                }
                placeholder="Teléfono"
              />
            </div>

            <div className="df-accessory-sales-modal-field df-accessory-sales-modal-field--full">
              <label>Notas</label>
              <textarea
                value={customerForm.notes}
                onChange={(e) =>
                  setCustomerForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
                placeholder="Observaciones internas del cliente"
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
            <button type="button" onClick={closeCustomerModal}>
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={savingCustomer}>
              {savingCustomer ? "Guardando..." : "Crear cliente"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}

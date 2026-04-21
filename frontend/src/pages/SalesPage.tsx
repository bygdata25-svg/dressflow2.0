import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import "../styles/pro-pages.css";

type DressOption = {
  id: string;
  code?: string;
  name?: string;
  status?: string;
  size?: string;
  color?: string;
};

type CustomerOption = {
  id: string;
  tenant_id?: string;
  code?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type SaleItem = {
  id: string;
  sale_number?: string | null;
  dress_id: string;
  customer_id?: string | null;
  sale_date: string;
  sale_price: number;
  currency: string;
  payment_method?: string | null;
  notes?: string | null;
  status: string;
  dress_code?: string | null;
  dress_name?: string | null;
  dress_size?: string | null;
  dress_color?: string | null;
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

  if (raw === "CASH") return "EFECTIVO";
  if (raw === "TRANSFER") return "TRANSFERENCIA";
  if (raw === "CARD") return "TARJETA DE CREDITO";
  if (raw === "MERCADOPAGO") return "MERCADO PAGO";

  return value || "-";
}

function formatCustomerName(customer: CustomerOption) {
  return (
    customer.full_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Cliente sin nombre"
  );
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

export default function SalesPage() {
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [error, setError] = useState("");

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const [dresses, setDresses] = useState<DressOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [filters, setFilters] = useState({
    q: "",
    status: "",
    payment_method: "",
  });

  const [saleForm, setSaleForm] = useState({
    dress_id: "",
    customer_id: "",
    sale_price: "",
    currency: "USD",
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
      dress_id: "",
      customer_id: "",
      sale_price: "",
      currency: "USD",
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

      const params: Record<string, string> = {};
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.payment_method) params.payment_method = filters.payment_method;

      const { data } = await api.get<PaginatedResponse<SaleItem>>("/sales", { params });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      console.error("Error loading sales:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDresses() {
    try {
      const { data } = await api.get<PaginatedResponse<DressOption>>("/dresses");
      const raw = Array.isArray(data) ? data : data.items || [];

      const available = raw.filter(
        (dress: DressOption) =>
          String(dress.status || "").toUpperCase() === "AVAILABLE"
      );

      setDresses(available);
    } catch (err) {
      console.error("Error loading dresses:", err);
      setDresses([]);
    }
  }

  async function loadCustomers() {
    try {
      const { data } = await api.get<PaginatedResponse<CustomerOption>>("/customers");
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
    const [, loadedCustomers] = await Promise.all([loadDresses(), loadCustomers()]);
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

  async function handleCreateSale(event: React.FormEvent) {
    event.preventDefault();

    if (!saleForm.dress_id) {
      setError("Seleccioná un vestido.");
      return;
    }

    if (!saleForm.sale_price || Number(saleForm.sale_price) <= 0) {
      setError("Ingresá un precio de venta mayor a cero.");
      return;
    }

    try {
      setSavingSale(true);
      setError("");

      await api.post("/sales", {
        dress_id: saleForm.dress_id,
        customer_id: saleForm.customer_id || null,
        sale_price: Number(saleForm.sale_price),
        currency: saleForm.currency,
        payment_method: saleForm.payment_method || null,
        notes: saleForm.notes.trim() || null,
      });

      closeSaleModal();
      await Promise.all([loadSales(), loadDresses()]);
    } catch (err: any) {
      console.error("Error creating sale:", err);
      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        setError(detail.map((item: any) => item.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudo registrar la venta.");
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
      await api.post(`/sales/${id}/cancel`, { reason });
      await Promise.all([loadSales(), loadDresses()]);
    } catch (err: any) {
      console.error("Error cancelling sale:", err);
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

  function exportExcel() {
    const params = new URLSearchParams();
    if (filters.q) params.append("q", filters.q);
    if (filters.status) params.append("status", filters.status);
    if (filters.payment_method) params.append("payment_method", filters.payment_method);

    const qs = params.toString();
    const url = `/api/v1/reports/dress-sales/export${qs ? `?${qs}` : ""}`;
    window.open(url, "_blank");
  }

  const totals = useMemo(() => {
    const completed = items.filter((item) => item.status === "COMPLETED");
    const totalAmount = completed.reduce(
      (acc, item) => acc + Number(item.sale_price || 0),
      0
    );

    return {
      count: completed.length,
      totalAmount,
    };
  }, [items]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-sales-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .df-sales-kpi-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfafc 100%);
          border: 1px solid #e6e0e8;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 14px 32px rgba(31, 24, 39, 0.06);
          display: grid;
          gap: 8px;
        }

        .df-sales-kpi-card span {
          font-size: 14px;
          color: #7a7082;
          font-weight: 600;
        }

        .df-sales-kpi-card strong {
          font-size: 30px;
          color: #35293f;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .df-sales-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .df-sales-modal-field {
          display: grid;
          gap: 6px;
        }

        .df-sales-modal-field--full {
          grid-column: 1 / -1;
        }

        .df-sales-modal-field label,
        .df-sales-modal-label-row label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-sales-modal-field input,
        .df-sales-modal-field select,
        .df-sales-modal-field textarea {
          width: 100%;
          border: 1px solid #e7dfd6;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff;
          color: #3d3648;
          outline: none;
        }

        .df-sales-modal-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .df-sales-modal-note {
          padding: 14px 16px;
          border-radius: 16px;
          background: #faf7f3;
          border: 1px solid #ece2d9;
          color: #51495d;
          line-height: 1.5;
        }

        .df-sales-modal-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .df-sales-link-btn {
          border: none;
          background: transparent;
          color: #5b233f;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }

        .df-sales-status {
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

        .df-sales-status--completed {
          background: #e8f7ee;
          color: #157347;
          border-color: #cdebd9;
        }

        .df-sales-status--cancelled {
          background: #f4f1f5;
          color: #6f6478;
          border-color: #e1d9e5;
        }

        .df-sales-danger-btn {
          height: 36px;
          border-radius: 12px;
          border: 1px solid #f0c9c9;
          background: #fff5f5;
          color: #b42318;
          font-weight: 700;
          padding: 0 12px;
          cursor: pointer;
        }

        .df-sales-meta {
          display: grid;
          gap: 4px;
        }

        .df-sales-meta strong {
          font-size: 14px;
          color: #32273c;
        }

        .df-sales-meta span {
          font-size: 12px;
          color: #8b8193;
        }

        @media (max-width: 720px) {
          .df-sales-modal-grid {
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
          <h1 className="df-pro-page__title">Ventas de Vestidos</h1>
          <p className="df-pro-page__subtitle">
            Registrá ventas, visualizá historial y controlá el cierre comercial con un flujo limpio y consistente.
          </p>
        </div>
        <div className="df-pro-actions-row">
          <PrimaryButton type="button" onClick={() => void openCreateSaleModal()}>
            Nueva venta
          </PrimaryButton>
        </div>
      </header>

      <section className="df-sales-kpis">
        <div className="df-sales-kpi-card">
          <span>Ventas completadas</span>
          <strong>{totals.count}</strong>
        </div>

        <div className="df-sales-kpi-card">
          <span>Total vendido</span>
          <strong>
            USD{" "}
            {totals.totalAmount.toLocaleString("es-AR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>
      </section>

      <section className="df-pro-card">
        <div className="df-pro-filter-grid df-pro-filter-grid--3">
          <div>
            <label className="df-pro-label">Buscar</label>
            <input
              className="df-pro-input"
              type="text"
              placeholder="Buscar por vestido o cliente..."
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

      {loading ? (
        <section className="df-pro-card">
          <p>Cargando ventas...</p>
        </section>
      ) : items.length === 0 ? (
        <section className="df-pro-card">
          <p>No hay ventas registradas.</p>
        </section>
      ) : (
        <section className="df-pro-card">
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr>
                  <th className="df-pro-table__th">N° Venta</th>
                  <th className="df-pro-table__th">Fecha</th>
                  <th className="df-pro-table__th">Vestido</th>
                  <th className="df-pro-table__th">Cliente</th>
                  <th className="df-pro-table__th">Precio</th>
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
                      {new Date(sale.sale_date).toLocaleString("es-AR")}
                    </td>

                    <td className="df-pro-table__td">
                      <div className="df-sales-meta">
                        <strong>{sale.dress_name || "-"}</strong>
                        <span>
                          {sale.dress_code || "-"}
                          {sale.dress_size ? ` · Talle ${sale.dress_size}` : ""}
                          {sale.dress_color ? ` · ${sale.dress_color}` : ""}
                        </span>
                      </div>
                    </td>

                    <td className="df-pro-table__td">
                      {sale.customer_full_name || "-"}
                    </td>

                    <td className="df-pro-table__td">
                      {sale.currency}{" "}
                      {Number(sale.sale_price).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    <td className="df-pro-table__td">
                      {paymentMethodLabel(sale.payment_method)}
                    </td>

                    <td className="df-pro-table__td">
                      <span
                        className={`df-sales-status ${
                          sale.status === "COMPLETED"
                            ? "df-sales-status--completed"
                            : "df-sales-status--cancelled"
                        }`}
                      >
                        {sale.status === "COMPLETED" ? "Completada" : "Cancelada"}
                      </span>
                    </td>

                    <td className="df-pro-table__td">
                      {sale.status === "COMPLETED" ? (
                        <button
                          type="button"
                          className="df-sales-danger-btn"
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
        </section>
      )}

      <Modal
        open={showSaleModal}
        onClose={closeSaleModal}
        title="Nueva venta"
        width="min(860px, 100%)"
      >
        <form onSubmit={handleCreateSale} style={{ display: "grid", gap: 16 }}>
          <div className="df-sales-modal-note">
            Registrá la venta de un vestido disponible y asociála a un cliente existente o creá uno nuevo sin salir del flujo.
          </div>

          <div className="df-sales-modal-grid">
            <div className="df-sales-modal-field">
              <label>Vestido</label>
              <select
                value={saleForm.dress_id}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, dress_id: e.target.value }))
                }
              >
                <option value="">Seleccionar vestido</option>
                {dresses.map((dress) => (
                  <option key={dress.id} value={dress.id}>
                    {(dress.code ? `${dress.code} · ` : "") + (dress.name || "Sin nombre")}
                    {dress.size ? ` · Talle ${dress.size}` : ""}
                    {dress.color ? ` · ${dress.color}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-sales-modal-field">
              <div className="df-sales-modal-label-row">
                <label>Cliente</label>
                <button
                  type="button"
                  className="df-sales-link-btn"
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

            <div className="df-sales-modal-field">
              <label>Precio</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={saleForm.sale_price}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, sale_price: e.target.value }))
                }
                placeholder="Ej: 350.00"
              />
            </div>

            <div className="df-sales-modal-field">
              <label>Moneda</label>
              <select
                value={saleForm.currency}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, currency: e.target.value }))
                }
              >
                <option value="USD">USD</option>
                <option value="ARS">ARS</option>
              </select>
            </div>

            <div className="df-sales-modal-field">
              <label>Método de pago</label>
              <select
                value={saleForm.payment_method}
                onChange={(e) =>
                  setSaleForm((prev) => ({
                    ...prev,
                    payment_method: e.target.value,
                  }))
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

            <div className="df-sales-modal-field df-sales-modal-field--full">
              <label>Notas</label>
              <textarea
                value={saleForm.notes}
                onChange={(e) =>
                  setSaleForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Observaciones internas de la venta"
              />
            </div>
          </div>

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
          <div className="df-sales-modal-note">
            Creá un cliente nuevo sin salir de la venta. Al guardar, quedará seleccionado automáticamente.
          </div>

          <div className="df-sales-modal-grid">
            <div className="df-sales-modal-field">
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

            <div className="df-sales-modal-field">
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

            <div className="df-sales-modal-field">
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

            <div className="df-sales-modal-field">
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

            <div className="df-sales-modal-field">
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

            <div className="df-sales-modal-field df-sales-modal-field--full">
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

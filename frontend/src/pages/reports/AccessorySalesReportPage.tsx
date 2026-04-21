import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { PrimaryButton } from "../../components/common/buttons";
import "../../styles/pro-pages.css";

type ReportItem = {
  id: string;
  sale_number?: string | null;
  sale_date: string;
  accessory_code?: string | null;
  accessory_name?: string | null;
  customer_full_name?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency: string;
  payment_method?: string | null;
  status: string;
  notes?: string | null;
};

type AccessorySalesReportResponse = {
  items: ReportItem[];
  total: number;
  total_amount: number;
};

type FiltersState = {
  q: string;
  status: string;
  payment_method: string;
  date_from: string;
  date_to: string;
};

const initialFilters: FiltersState = {
  q: "",
  status: "",
  payment_method: "",
  date_from: "",
  date_to: "",
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

function money(value?: number | string | null, currency = "ARS") {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return "—";

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export default function AccessorySalesReportPage() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string> = {};

      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.payment_method) params.payment_method = filters.payment_method;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const { data } = await api.get<AccessorySalesReportResponse>("/reports/accessory-sales", {
        params,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      console.error("Error loading accessory sales report:", err);
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError("No se pudo cargar el reporte.");
      }

      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filters.q, filters.status, filters.payment_method, filters.date_from, filters.date_to]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((prev) => ({
      ...prev,
      q: searchDraft.trim(),
    }));
  }

  function handleClearFilters() {
    setSearchDraft("");
    setFilters(initialFilters);
  }

  async function exportExcel() {
    try {
      const params: Record<string, string> = {};

      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.payment_method) params.payment_method = filters.payment_method;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const response = await api.get("/reports/accessory-sales/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ventas_accesorios.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting accessory sales report:", err);
      window.alert("No se pudo exportar el Excel.");
    }
  }

  const metrics = useMemo(() => {
    const completed = items.filter((item) => item.status === "COMPLETED");
    const totalAmount = completed.reduce((acc, item) => acc + Number(item.total_price || 0), 0);
    const totalUnits = completed.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    const averageTicket = completed.length > 0 ? totalAmount / completed.length : 0;

    const byAccessory = new Map<string, number>();
    for (const item of completed) {
      const key = item.accessory_name?.trim() || item.accessory_code?.trim() || "—";
      byAccessory.set(key, (byAccessory.get(key) || 0) + Number(item.quantity || 0));
    }

    let topAccessory = "—";
    let topAccessoryCount = 0;
    for (const [name, count] of byAccessory.entries()) {
      if (count > topAccessoryCount) {
        topAccessory = name;
        topAccessoryCount = count;
      }
    }

    return {
      count: completed.length,
      totalUnits,
      totalAmount,
      averageTicket,
      topAccessory,
    };
  }, [items]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-accessory-sales-report-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .df-accessory-sales-report-kpi-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfafc 100%);
          border: 1px solid #e6e0e8;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 14px 32px rgba(31, 24, 39, 0.06);
          display: grid;
          gap: 8px;
        }

        .df-accessory-sales-report-kpi-card span {
          font-size: 14px;
          color: #7a7082;
          font-weight: 600;
        }

        .df-accessory-sales-report-kpi-card strong {
          font-size: 30px;
          color: #35293f;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .df-accessory-sales-report-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.8fr) repeat(4, minmax(160px, 1fr));
          gap: 14px;
          align-items: end;
        }

        .df-accessory-sales-report-cell {
          display: grid;
          gap: 6px;
        }

        .df-accessory-sales-report-cell label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-accessory-sales-report-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .df-accessory-sales-report-total-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 16px;
          border-radius: 14px;
          background: #faf7f3;
          border: 1px solid #ece2d9;
          color: #51495d;
          font-weight: 700;
        }

        .df-accessory-sales-report-status {
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

        .df-accessory-sales-report-status--completed {
          background: #e8f7ee;
          color: #157347;
          border-color: #cdebd9;
        }

        .df-accessory-sales-report-status--cancelled {
          background: #f4f1f5;
          color: #6f6478;
          border-color: #e1d9e5;
        }

        .df-accessory-sales-report-meta {
          display: grid;
          gap: 4px;
        }

        .df-accessory-sales-report-meta strong {
          font-size: 14px;
          color: #32273c;
        }

        .df-accessory-sales-report-meta span {
          font-size: 12px;
          color: #8b8193;
        }

        @media (max-width: 1100px) {
          .df-accessory-sales-report-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .df-accessory-sales-report-grid {
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
          <p className="df-pro-page__eyebrow">Reportes</p>
          <h1 className="df-pro-page__title">Ventas de accesorios</h1>
          <p className="df-pro-page__subtitle">
            Consultá ventas realizadas, unidades vendidas, ingreso total y performance comercial de accesorios.
          </p>
        </div>

        <div className="df-pro-actions-row">
          <PrimaryButton type="button" onClick={() => void exportExcel()}>
            Exportar Excel
          </PrimaryButton>
        </div>
      </header>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-accessory-sales-report-grid">
          <div className="df-accessory-sales-report-cell">
            <label>Buscar</label>
            <input
              className="df-pro-input"
              placeholder="N° venta, código, accesorio, cliente"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

          <div className="df-accessory-sales-report-cell">
            <label>Estado</label>
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

          <div className="df-accessory-sales-report-cell">
            <label>Medio de pago</label>
            <select
              className="df-pro-select"
              value={filters.payment_method}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, payment_method: e.target.value }))
              }
            >
              <option value="">Todos los pagos</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {paymentMethodLabel(method)}
                </option>
              ))}
            </select>
          </div>

          <div className="df-accessory-sales-report-cell">
            <label>Desde</label>
            <input
              className="df-pro-input"
              type="date"
              value={filters.date_from}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, date_from: e.target.value }))
              }
            />
          </div>

          <div className="df-accessory-sales-report-cell">
            <label>Hasta</label>
            <input
              className="df-pro-input"
              type="date"
              value={filters.date_to}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, date_to: e.target.value }))
              }
            />
          </div>

          <div className="df-pro-actions-row" style={{ gridColumn: "1 / -1" }}>
            <button type="submit">Buscar</button>
            <button type="button" onClick={handleClearFilters}>
              Limpiar
            </button>
          </div>
        </form>
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

      <section className="df-accessory-sales-report-kpis">
        <div className="df-accessory-sales-report-kpi-card">
          <span>Ventas</span>
          <strong>{metrics.count}</strong>
        </div>

        <div className="df-accessory-sales-report-kpi-card">
          <span>Unidades vendidas</span>
          <strong>{metrics.totalUnits}</strong>
        </div>

        <div className="df-accessory-sales-report-kpi-card">
          <span>Ingreso total</span>
          <strong>{money(metrics.totalAmount, "ARS")}</strong>
        </div>

        <div className="df-accessory-sales-report-kpi-card">
          <span>Ticket promedio</span>
          <strong>{money(metrics.averageTicket, "ARS")}</strong>
        </div>

        <div className="df-accessory-sales-report-kpi-card">
          <span>Accesorio más vendido</span>
          <strong>{metrics.topAccessory}</strong>
        </div>
      </section>

      <section className="df-pro-card">
        <div className="df-accessory-sales-report-summary">
          <div>
            <strong>Registros:</strong> {items.length}
          </div>
          <div className="df-accessory-sales-report-total-chip">
            Ingreso acumulado: {money(metrics.totalAmount, "ARS")}
          </div>
        </div>
      </section>

      <section className="df-pro-card">
        {loading ? (
          <p>Cargando reporte...</p>
        ) : items.length === 0 ? (
          <p>No hay ventas de accesorios para mostrar.</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
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
                  <th className="df-pro-table__th">Notas</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="df-pro-table__td">
                      {row.sale_number || "-"}
                    </td>

                    <td className="df-pro-table__td">
                      {row.sale_date ? new Date(row.sale_date).toLocaleString("es-AR") : "—"}
                    </td>

                    <td className="df-pro-table__td">
                      <div className="df-accessory-sales-report-meta">
                        <strong>{row.accessory_name || "-"}</strong>
                        <span>{row.accessory_code || "-"}</span>
                      </div>
                    </td>

                    <td className="df-pro-table__td">
                      {row.customer_full_name || "-"}
                    </td>

                    <td className="df-pro-table__td">{row.quantity}</td>

                    <td className="df-pro-table__td">
                      {money(row.unit_price, row.currency || "ARS")}
                    </td>

                    <td className="df-pro-table__td">
                      {money(row.total_price, row.currency || "ARS")}
                    </td>

                    <td className="df-pro-table__td">
                      {paymentMethodLabel(row.payment_method)}
                    </td>

                    <td className="df-pro-table__td">
                      <span
                        className={`df-accessory-sales-report-status ${
                          row.status === "COMPLETED"
                            ? "df-accessory-sales-report-status--completed"
                            : "df-accessory-sales-report-status--cancelled"
                        }`}
                      >
                        {row.status === "COMPLETED" ? "Completada" : "Cancelada"}
                      </span>
                    </td>

                    <td className="df-pro-table__td">
                      {row.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

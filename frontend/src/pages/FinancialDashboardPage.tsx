import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { api } from "../lib/api";
import "../styles/pro-pages.css";

type MonthlyRow = {
  month: string;
  total_ars: number;
  total_usd: number;
  sales_count: number;
};

type PaymentMethodRow = {
  payment_method: string;
  operations_count: number;
  total_ars: number;
  total_usd: number;
};

type FinancialDashboardResponse = {
  sales_count: number;
  total_ars: number;
  total_usd: number;
  avg_ticket_ars: number;
  avg_ticket_usd: number;
  sales_count_ars: number;
  sales_count_usd: number;
  monthly: MonthlyRow[];
  payment_methods: PaymentMethodRow[];
};

function formatMoney(value: number, currency: "ARS" | "USD") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function compactMoney(value: number, currency: "ARS" | "USD") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function monthLabel(value: string) {
  if (!value) return "";
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
}

function paymentMethodLabel(value?: string) {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "cash") return "Efectivo";
  if (raw === "transfer") return "Transferencia";
  if (raw === "debit") return "Débito";
  if (raw === "credit") return "Crédito";
  if (raw === "mercadopago") return "Mercado Pago";
  if (raw === "other") return "Otro";
  return value || "Sin definir";
}

function totalHeadline(data: FinancialDashboardResponse) {
  const hasARS = Number(data.total_ars || 0) > 0;
  const hasUSD = Number(data.total_usd || 0) > 0;

  if (hasARS && hasUSD) {
    return {
      label: "TOTAL MIXTO",
      value: `${formatMoney(data.total_usd, "USD")} + ${formatMoney(data.total_ars, "ARS")}`,
      subtitle: "Ingresos consolidados por moneda",
    };
  }

  if (hasUSD) {
    return {
      label: "TOTAL USD",
      value: formatMoney(data.total_usd, "USD"),
      subtitle: "Ingresos expresados en dólares",
    };
  }

  return {
    label: "TOTAL ARS",
    value: formatMoney(data.total_ars, "ARS"),
    subtitle: "Ingresos expresados en moneda local",
  };
}

const PAYMENT_COLORS = [
  "#c38c7a",
  "#b08ad4",
  "#8ab9c9",
  "#d3b173",
  "#9db28b",
  "#d99aa2",
];

export default function FinancialDashboardPage() {
  const [data, setData] = useState<FinancialDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get<FinancialDashboardResponse>(
        "/dashboard/financial-summary"
      );
      setData(response.data);
    } catch (error) {
      console.error("Error cargando dashboard financiero", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const paymentChartData = useMemo(() => {
    if (!data) return [];
    return data.payment_methods.map((row) => ({
      name: paymentMethodLabel(row.payment_method),
      value: row.operations_count,
    }));
  }, [data]);

  const headline = useMemo(() => {
    if (!data) {
      return {
        label: "TOTAL",
        value: formatMoney(0, "ARS"),
        subtitle: "",
      };
    }
    return totalHeadline(data);
  }, [data]);

  const hasEnoughMonthlyData = useMemo(() => {
    return (data?.monthly?.length || 0) >= 2;
  }, [data]);

  if (loading) {
    return (
      <section className="df-pro-page">
        <div className="df-pro-card">Cargando dashboard financiero...</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="df-pro-page">
        <div className="df-pro-card">
          No se pudo cargar el dashboard financiero.
        </div>
      </section>
    );
  }

  return (
    <section className="df-pro-page">
      <header className="df-pro-page__hero">
        <div>
          <p className="df-pro-page__eyebrow">Análisis</p>
          <h1 className="df-pro-page__title">Dashboard financiero</h1>
          <p className="df-pro-page__subtitle">
            Ingresos, ticket promedio y evolución de ventas con lectura
            separada por moneda.
          </p>
        </div>
      </header>

      <section className="df-fin-hero-card">
        <div className="df-fin-hero-card__meta">
          <span>{headline.label}</span>
          <strong>{headline.value}</strong>
          <small>{headline.subtitle}</small>
        </div>

        <div className="df-fin-hero-card__side">
          <div className="df-fin-hero-pill">
            {data.sales_count} operación{data.sales_count === 1 ? "" : "es"}
          </div>

          <div className="df-fin-hero-inline">
            <span>ARS</span>
            <strong>{compactMoney(data.total_ars, "ARS")}</strong>
          </div>

          <div className="df-fin-hero-inline">
            <span>USD</span>
            <strong>{compactMoney(data.total_usd, "USD")}</strong>
          </div>
        </div>
      </section>

      <div className="df-financial-grid">
        <div className="df-fin-card">
          <span>Ventas ARS</span>
          <strong>{formatMoney(data.total_ars, "ARS")}</strong>
          <small>{data.sales_count_ars} operación(es) en ARS</small>
        </div>

        <div className="df-fin-card">
          <span>Ventas USD</span>
          <strong>{formatMoney(data.total_usd, "USD")}</strong>
          <small>{data.sales_count_usd} operación(es) en USD</small>
        </div>

        <div className="df-fin-card">
          <span>Ventas</span>
          <strong>{data.sales_count}</strong>
          <small>Operaciones totales</small>
        </div>

        <div className="df-fin-card highlight">
          <span>Ticket promedio ARS</span>
          <strong>{formatMoney(data.avg_ticket_ars, "ARS")}</strong>
          <small>Promedio en moneda local</small>
        </div>

        <div className="df-fin-card">
          <span>Ticket promedio USD</span>
          <strong>{formatMoney(data.avg_ticket_usd, "USD")}</strong>
          <small>Promedio en dólares</small>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(320px, 1fr)",
          gap: 20,
          marginTop: 24,
        }}
      >
        <section className="df-pro-card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#32273c" }}>Evolución de ventas</h3>
            <p style={{ margin: "6px 0 0", color: "#8b8193" }}>
              Tendencia mensual en ARS y USD.
            </p>
          </div>

          {hasEnoughMonthlyData ? (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.monthly}
                  margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e9e1ee"
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={monthLabel}
                    tick={{ fill: "#8b8193", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8b8193", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 14,
                      border: "1px solid #e7deef",
                      boxShadow: "0 18px 34px rgba(44, 28, 58, 0.12)",
                      background: "#ffffff",
                    }}
                    labelStyle={{ color: "#35293f", fontWeight: 700 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_ars"
                    name="ARS"
                    stroke="#8a63d2"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total_usd"
                    name="USD"
                    stroke="#c38c7a"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="df-fin-single-period">
              {data.monthly.map((row) => (
                <div key={row.month} className="df-fin-single-period-card">
                  <strong>{monthLabel(row.month)}</strong>
                  <div>ARS: {formatMoney(row.total_ars, "ARS")}</div>
                  <div>USD: {formatMoney(row.total_usd, "USD")}</div>
                  <small>
                    {row.sales_count} operación
                    {row.sales_count === 1 ? "" : "es"}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="df-pro-card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#32273c" }}>Métodos de pago</h3>
            <p style={{ margin: "6px 0 0", color: "#8b8193" }}>
              Participación por cantidad de operaciones.
            </p>
          </div>

          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={paymentChartData}
                layout="vertical"
                margin={{ left: 12, right: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip />
                <Bar dataKey="value" radius={[10, 10, 10, 10]}>
                  {paymentChartData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="df-fin-methods-list">
            {data.payment_methods.map((row) => (
              <div key={row.payment_method} className="df-fin-method-row">
                <div>
                  <strong>{paymentMethodLabel(row.payment_method)}</strong>
                  <small>
                    {row.operations_count} operación
                    {row.operations_count === 1 ? "" : "es"}
                  </small>
                </div>

                <div className="df-fin-method-row__totals">
                  <span>{formatMoney(row.total_ars, "ARS")}</span>
                  <span>{formatMoney(row.total_usd, "USD")}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

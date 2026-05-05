import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

const PAYMENT_COLORS = [
  "#c38c7a",
  "#b08ad4",
  "#8ab9c9",
  "#d3b173",
  "#9db28b",
  "#d99aa2",
];

export default function FinancialDashboardPage() {
  const { t, i18n } = useTranslation("financial-dashboard");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [data, setData] = useState<FinancialDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function formatMoney(value: number, currency: "ARS" | "USD") {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  function compactMoney(value: number, currency: "ARS" | "USD") {
    return new Intl.NumberFormat(locale, {
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
    const raw = String(value || "").toUpperCase().trim();
    return t(`payments.${raw}`, { defaultValue: value || "—" });
  }

  function operationLabel(count: number) {
    return t("labels.operations", { count });
  }

  function totalHeadline(currentData: FinancialDashboardResponse) {
    const hasARS = Number(currentData.total_ars || 0) > 0;
    const hasUSD = Number(currentData.total_usd || 0) > 0;

    if (hasARS && hasUSD) {
      return {
        label: t("headline.mixedTotal"),
        value: `${formatMoney(currentData.total_usd, "USD")} + ${formatMoney(
          currentData.total_ars,
          "ARS"
        )}`,
        subtitle: t("headline.mixedSubtitle"),
      };
    }

    if (hasUSD) {
      return {
        label: t("headline.usdTotal"),
        value: formatMoney(currentData.total_usd, "USD"),
        subtitle: t("headline.usdSubtitle"),
      };
    }

    return {
      label: t("headline.arsTotal"),
      value: formatMoney(currentData.total_ars, "ARS"),
      subtitle: t("headline.arsSubtitle"),
    };
  }

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get<FinancialDashboardResponse>(
        "/dashboard/financial-summary"
      );
      setData(response.data);
    } catch (error) {
      console.error("Error loading financial dashboard", error);
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
  }, [data, t]);

  const headline = useMemo(() => {
    if (!data) {
      return {
        label: t("headline.arsTotal"),
        value: formatMoney(0, "ARS"),
        subtitle: "",
      };
    }

    return totalHeadline(data);
  }, [data, t, locale]);

  const hasEnoughMonthlyData = useMemo(() => {
    return (data?.monthly?.length || 0) >= 2;
  }, [data]);

  if (loading) {
    return (
      <section className="df-pro-page">
        <div className="df-pro-card">{t("messages.loading")}</div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="df-pro-page">
        <div className="df-pro-card">{t("errors.load")}</div>
      </section>
    );
  }

  return (
    <section className="df-pro-page">
      <header className="df-pro-page__hero">
        <div>
          <p className="df-pro-page__eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("hero.subtitle")}</p>
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
            {operationLabel(data.sales_count)}
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
          <span>{t("kpis.salesARS")}</span>
          <strong>{formatMoney(data.total_ars, "ARS")}</strong>
          <small>{t("kpis.salesARSSubtitle", { count: data.sales_count_ars })}</small>
        </div>

        <div className="df-fin-card">
          <span>{t("kpis.salesUSD")}</span>
          <strong>{formatMoney(data.total_usd, "USD")}</strong>
          <small>{t("kpis.salesUSDSubtitle", { count: data.sales_count_usd })}</small>
        </div>

        <div className="df-fin-card">
          <span>{t("kpis.sales")}</span>
          <strong>{data.sales_count}</strong>
          <small>{t("kpis.salesSubtitle")}</small>
        </div>

        <div className="df-fin-card highlight">
          <span>{t("kpis.avgTicketARS")}</span>
          <strong>{formatMoney(data.avg_ticket_ars, "ARS")}</strong>
          <small>{t("kpis.avgTicketARSSubtitle")}</small>
        </div>

        <div className="df-fin-card">
          <span>{t("kpis.avgTicketUSD")}</span>
          <strong>{formatMoney(data.avg_ticket_usd, "USD")}</strong>
          <small>{t("kpis.avgTicketUSDSubtitle")}</small>
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
            <h3 style={{ margin: 0, color: "#32273c" }}>
              {t("sections.evolution")}
            </h3>
            <p style={{ margin: "6px 0 0", color: "#8b8193" }}>
              {t("sections.evolutionSubtitle")}
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
                  <small>{operationLabel(row.sales_count)}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="df-pro-card">
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#32273c" }}>
              {t("sections.paymentMethods")}
            </h3>
            <p style={{ margin: "6px 0 0", color: "#8b8193" }}>
              {t("sections.paymentMethodsSubtitle")}
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
                  <small>{operationLabel(row.operations_count)}</small>
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

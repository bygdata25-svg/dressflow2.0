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
} from "recharts";
import { api } from "../lib/api";
import { formatCurrencyAmount, getCurrencySymbol } from "../utils/currency";
import "../styles/pro-pages.css";

type CurrencyCode = string;

type MonthlyRow = {
  month: string;
  total_ars?: number;
  total_usd?: number;
  sales_count: number;
  totals_by_currency?: Record<string, number>;
};

type PaymentMethodRow = {
  payment_method: string;
  operations_count: number;
  total_ars?: number;
  total_usd?: number;
  totals_by_currency?: Record<string, number>;
};

type FinancialDashboardResponse = {
  sales_count: number;

  totals_by_currency?: Record<string, number>;
  avg_ticket_by_currency?: Record<string, number>;
  sales_count_by_currency?: Record<string, number>;

  total_ars?: number;
  total_usd?: number;
  avg_ticket_ars?: number;
  avg_ticket_usd?: number;
  sales_count_ars?: number;
  sales_count_usd?: number;

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
  "#8a63d2",
  "#b7791f",
];

const DEFAULT_BASE_CURRENCY = "ARS";
const LEGACY_SECONDARY_CURRENCY = "USD";
const DEFAULT_CURRENCY_PRIORITY = [
  LEGACY_SECONDARY_CURRENCY,
  "EUR",
  DEFAULT_BASE_CURRENCY,
  "CLP",
  "MXN",
];

function normalizeCurrency(value?: string | null) {
  return String(value || DEFAULT_BASE_CURRENCY).toUpperCase();
}

function currencyOrder(currencies: string[]) {
  const unique = Array.from(new Set(currencies.map(normalizeCurrency).filter(Boolean)));

  return [
    ...DEFAULT_CURRENCY_PRIORITY.filter((currency) => unique.includes(currency)),
    ...unique.filter((currency) => !DEFAULT_CURRENCY_PRIORITY.includes(currency)).sort(),
  ];
}

function legacyTotals(data: FinancialDashboardResponse | null) {
  if (!data) return {} as Record<string, number>;

  const dynamic = data.totals_by_currency || {};
  const result: Record<string, number> = { ...dynamic };

  if (data.total_ars !== undefined && result[DEFAULT_BASE_CURRENCY] === undefined) {
    result[DEFAULT_BASE_CURRENCY] = Number(data.total_ars || 0);
  }

  if (data.total_usd !== undefined && result[LEGACY_SECONDARY_CURRENCY] === undefined) {
    result[LEGACY_SECONDARY_CURRENCY] = Number(data.total_usd || 0);
  }

  return result;
}

function legacyAverageTickets(data: FinancialDashboardResponse | null) {
  if (!data) return {} as Record<string, number>;

  const dynamic = data.avg_ticket_by_currency || {};
  const result: Record<string, number> = { ...dynamic };

  if (data.avg_ticket_ars !== undefined && result[DEFAULT_BASE_CURRENCY] === undefined) {
    result[DEFAULT_BASE_CURRENCY] = Number(data.avg_ticket_ars || 0);
  }

  if (data.avg_ticket_usd !== undefined && result[LEGACY_SECONDARY_CURRENCY] === undefined) {
    result[LEGACY_SECONDARY_CURRENCY] = Number(data.avg_ticket_usd || 0);
  }

  return result;
}

function legacySalesCountByCurrency(data: FinancialDashboardResponse | null) {
  if (!data) return {} as Record<string, number>;

  const dynamic = data.sales_count_by_currency || {};
  const result: Record<string, number> = { ...dynamic };

  if (data.sales_count_ars !== undefined && result[DEFAULT_BASE_CURRENCY] === undefined) {
    result[DEFAULT_BASE_CURRENCY] = Number(data.sales_count_ars || 0);
  }

  if (data.sales_count_usd !== undefined && result[LEGACY_SECONDARY_CURRENCY] === undefined) {
    result[LEGACY_SECONDARY_CURRENCY] = Number(data.sales_count_usd || 0);
  }

  return result;
}


type CurrencyTooltipPayloadItem = {
  value?: number | string;
  dataKey?: string | number;
  name?: string | number;
};

function CurrencyTooltip({
  active,
  payload,
  label,
  formatMoney,
}: {
  active?: boolean;
  payload?: CurrencyTooltipPayloadItem[];
  label?: string | number;
  formatMoney: (value: number, currency: CurrencyCode) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid #e7deef",
        boxShadow: "0 18px 34px rgba(44, 28, 58, 0.12)",
        background: "#ffffff",
        padding: "12px 14px",
        display: "grid",
        gap: 8,
      }}
    >
      {label ? (
        <strong style={{ color: "#35293f", fontWeight: 800 }}>{label}</strong>
      ) : null}

      {payload
        .filter((item) => Number(item.value || 0) !== 0)
        .map((item, index) => {
          const dataKey = String(item.dataKey || item.name || "");
          const currency = dataKey.replace("currency_", "");
          return (
            <div
              key={`${dataKey}-${index}`}
              style={{
                color: "#6f4f70",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {formatMoney(Number(item.value || 0), currency)}
            </div>
          );
        })}
    </div>
  );
}

export default function FinancialDashboardPage() {
  const { t, i18n } = useTranslation("financial-dashboard");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [data, setData] = useState<FinancialDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  function formatMoney(value: number, currency: CurrencyCode) {
    const currencyCode = normalizeCurrency(currency);

    return formatCurrencyAmount(value, {
      locale,
      currencyCode,
      symbol: getCurrencySymbol(currencyCode),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function compactMoney(value: number, currency: CurrencyCode) {
    const currencyCode = normalizeCurrency(currency);

    return formatCurrencyAmount(value, {
      locale,
      currencyCode,
      symbol: getCurrencySymbol(currencyCode),
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
  }

  function currencyLabel(currency?: CurrencyCode | null) {
    const currencyCode = normalizeCurrency(currency);
    return getCurrencySymbol(currencyCode);
  }

  function monthLabel(value: string) {
    if (!value) return "";
    const [year, month] = value.split("-");
    return `${month}/${year.slice(2)}`;
  }

  function paymentMethodLabel(value?: string) {
    const raw = String(value || "").toUpperCase().trim();

    const fallbackMap: Record<string, string> = {
      CASH: "Efectivo",
      EFECTIVO: "Efectivo",
      TRANSFER: "Transferencia",
      TRANSFERENCIA: "Transferencia",
      MERCADO_PAGO: "Mercado Pago",
      CREDIT_CARD: "Tarjeta crédito",
      TARJETA_CREDITO: "Tarjeta crédito",
      DEBIT_CARD: "Tarjeta débito",
      TARJETA_DEBITO: "Tarjeta débito",
    };

    return t(`payments.${raw}`, {
      defaultValue:
        fallbackMap[raw] ||
        raw
          .replaceAll("_", " ")
          .toLowerCase()
          .replace(/\b\w/g, (char) => char.toUpperCase()) ||
        "—",
    });
  }

  function operationLabel(count: number) {
    return t("labels.operations", { count });
  }

  const totalsByCurrency = useMemo(() => legacyTotals(data), [data]);
  const avgTicketByCurrency = useMemo(() => legacyAverageTickets(data), [data]);
  const salesCountByCurrency = useMemo(() => legacySalesCountByCurrency(data), [data]);

  const activeCurrencies = useMemo(() => {
    const fromTotals = Object.entries(totalsByCurrency)
      .filter(([, value]) => Number(value || 0) > 0)
      .map(([currency]) => currency);

    const fromMonthly = (data?.monthly || []).flatMap((row) =>
      Object.entries(row.totals_by_currency || {})
        .filter(([, value]) => Number(value || 0) > 0)
        .map(([currency]) => currency)
    );

    const fromPayments = (data?.payment_methods || []).flatMap((row) =>
      Object.entries(row.totals_by_currency || {})
        .filter(([, value]) => Number(value || 0) > 0)
        .map(([currency]) => currency)
    );

    return currencyOrder([...fromTotals, ...fromMonthly, ...fromPayments]);
  }, [data, totalsByCurrency]);

  function totalHeadline(currentData: FinancialDashboardResponse) {
    const entries = activeCurrencies
      .map((currency) => [currency, Number(totalsByCurrency[currency] || 0)] as const)
      .filter(([, amount]) => amount > 0);

    if (entries.length > 1) {
      return {
        label: t("headline.mixedTotal"),
        value: entries
          .map(([currency, amount]) => formatMoney(amount, currency))
          .join(" + "),
        subtitle: t("headline.mixedSubtitle"),
      };
    }

    if (entries.length === 1) {
      const [currency, amount] = entries[0];

      return {
        label: t(`headline.${currency.toLowerCase()}Total`, {
          currency: currencyLabel(currency),
          defaultValue: t("headline.totalByCurrency", {
            currency: currencyLabel(currency),
            defaultValue: currencyLabel(currency),
          }),
        }),
        value: formatMoney(amount, currency),
        subtitle: t(`headline.${currency.toLowerCase()}Subtitle`, {
          currency: currencyLabel(currency),
          defaultValue: currencyLabel(currency),
        }),
      };
    }

    return {
      label: t("headline.baseTotal", {
        currency: currencyLabel(DEFAULT_BASE_CURRENCY),
        defaultValue: currencyLabel(DEFAULT_BASE_CURRENCY),
      }),
      value: formatMoney(Number(currentData.total_ars || 0), DEFAULT_BASE_CURRENCY),
      subtitle: t("headline.baseSubtitle", {
        currency: currencyLabel(DEFAULT_BASE_CURRENCY),
        defaultValue: currencyLabel(DEFAULT_BASE_CURRENCY),
      }),
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

  const monthlyChartData = useMemo(() => {
    if (!data) return [];

    return data.monthly.map((row) => {
      const totals = {
        ...(row.totals_by_currency || {}),
      } as Record<string, number>;

      if (row.total_ars !== undefined && totals[DEFAULT_BASE_CURRENCY] === undefined) {
        totals[DEFAULT_BASE_CURRENCY] = Number(row.total_ars || 0);
      }

      if (row.total_usd !== undefined && totals[LEGACY_SECONDARY_CURRENCY] === undefined) {
        totals[LEGACY_SECONDARY_CURRENCY] = Number(row.total_usd || 0);
      }

      return {
        ...row,
        ...Object.fromEntries(
          Object.entries(totals).map(([currency, amount]) => [
            `currency_${currency}`,
            Number(amount || 0),
          ])
        ),
      };
    });
  }, [data]);

  const paymentChartData = useMemo(() => {
    if (!data) return [];

    return data.payment_methods.map((row) => {
      const totals = {
        ...(row.totals_by_currency || {}),
      } as Record<string, number>;

      if (row.total_ars !== undefined && totals[DEFAULT_BASE_CURRENCY] === undefined) {
        totals[DEFAULT_BASE_CURRENCY] = Number(row.total_ars || 0);
      }

      if (row.total_usd !== undefined && totals[LEGACY_SECONDARY_CURRENCY] === undefined) {
        totals[LEGACY_SECONDARY_CURRENCY] = Number(row.total_usd || 0);
      }

      return {
        name: paymentMethodLabel(row.payment_method),
        operations_count: Number(row.operations_count || 0),
        ...Object.fromEntries(
          Object.entries(totals).map(([currency, amount]) => [
            `currency_${currency}`,
            Number(amount || 0),
          ])
        ),
      };
    });
  }, [data, t]);

  const headline = useMemo(() => {
    if (!data) {
      return {
        label: t("headline.baseTotal", {
          currency: currencyLabel(DEFAULT_BASE_CURRENCY),
          defaultValue: currencyLabel(DEFAULT_BASE_CURRENCY),
        }),
        value: formatMoney(0, DEFAULT_BASE_CURRENCY),
        subtitle: "",
      };
    }

    return totalHeadline(data);
  }, [data, t, locale, activeCurrencies, totalsByCurrency]);

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

          {activeCurrencies.length === 0 ? (
            <div className="df-fin-hero-inline">
              <span>{currencyLabel(DEFAULT_BASE_CURRENCY)}</span>
              <strong>{compactMoney(0, DEFAULT_BASE_CURRENCY)}</strong>
            </div>
          ) : (
            activeCurrencies.map((currency) => (
              <div key={currency} className="df-fin-hero-inline">
                <span>{currencyLabel(currency)}</span>
                <strong>{compactMoney(Number(totalsByCurrency[currency] || 0), currency)}</strong>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="df-financial-grid">
        {activeCurrencies.map((currency, index) => (
          <div
            key={currency}
            className={`df-fin-card ${index === 0 ? "highlight" : ""}`}
          >
            <span>
              {t("kpis.salesCurrency", {
                currency: currencyLabel(currency),
                defaultValue: t("kpis.sales"),
              })}
            </span>
            <strong>{formatMoney(Number(totalsByCurrency[currency] || 0), currency)}</strong>
            <small>
              {t("kpis.salesCurrencySubtitle", {
                currency: currencyLabel(currency),
                count: Number(salesCountByCurrency[currency] || 0),
                defaultValue: operationLabel(Number(salesCountByCurrency[currency] || 0)),
              })}
            </small>
          </div>
        ))}

        <div className="df-fin-card">
          <span>{t("kpis.sales")}</span>
          <strong>{data.sales_count}</strong>
          <small>{t("kpis.salesSubtitle")}</small>
        </div>

        {activeCurrencies.map((currency) => (
          <div key={`avg-${currency}`} className="df-fin-card">
            <span>
              {t("kpis.avgTicket", {
                defaultValue: t("kpis.avgTicketCurrency", {
                  currency: "",
                  defaultValue: t("kpis.avgTicketARS", { defaultValue: "Ticket promedio" }),
                }).replace(/ARS|USD|EUR|CLP|MXN|\$|US\$|€/g, "").trim(),
              })}
            </span>
            <strong>{formatMoney(Number(avgTicketByCurrency[currency] || 0), currency)}</strong>
            <small>{t("kpis.avgTicketSubtitle", { defaultValue: t("kpis.avgTicketARSSubtitle") })}</small>
          </div>
        ))}
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
              {t("sections.evolutionSubtitle", { defaultValue: t("sections.evolutionSubtitleNeutral", { defaultValue: "Evolución financiera mensual" }) })}
            </p>
          </div>

          {hasEnoughMonthlyData ? (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyChartData}
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
                    content={(props) => (
                      <CurrencyTooltip
                        active={props.active}
                        payload={props.payload as unknown as CurrencyTooltipPayloadItem[]}
                        label={props.label}
                        formatMoney={formatMoney}
                      />
                    )}
                  />

                  {activeCurrencies.map((currency, index) => (
                    <Line
                      key={currency}
                      type="monotone"
                      dataKey={`currency_${currency}`}
                      name=""
                      stroke={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="df-fin-single-period">
              {monthlyChartData.map((row: any) => (
                <div key={row.month} className="df-fin-single-period-card">
                  <strong>{monthLabel(row.month)}</strong>
                  {activeCurrencies.map((currency) => (
                    <div key={`${row.month}-${currency}`}>
                      {formatMoney(Number(row[`currency_${currency}`] || 0), currency)}
                    </div>
                  ))}
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
                <XAxis
                  type="number"
                  tickFormatter={(value) => Number(value || 0).toLocaleString(locale)}
                />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip
                  content={(props) => (
                    <CurrencyTooltip
                      active={props.active}
                      payload={props.payload as unknown as CurrencyTooltipPayloadItem[]}
                      label={props.label}
                      formatMoney={formatMoney}
                    />
                  )}
                />

                {activeCurrencies.map((currency, index) => (
                  <Bar
                    key={currency}
                    dataKey={`currency_${currency}`}
                    name=""
                    stackId="currency"
                    radius={[10, 10, 10, 10]}
                    fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="df-fin-methods-list">
            {data.payment_methods.map((row) => {
              const totals = {
                ...(row.totals_by_currency || {}),
              } as Record<string, number>;

              if (row.total_ars !== undefined && totals[DEFAULT_BASE_CURRENCY] === undefined) {
                totals[DEFAULT_BASE_CURRENCY] = Number(row.total_ars || 0);
              }

              if (row.total_usd !== undefined && totals[LEGACY_SECONDARY_CURRENCY] === undefined) {
                totals[LEGACY_SECONDARY_CURRENCY] = Number(row.total_usd || 0);
              }

              return (
                <div key={row.payment_method} className="df-fin-method-row">
                  <div>
                    <strong>{paymentMethodLabel(row.payment_method)}</strong>
                    <small>{operationLabel(row.operations_count)}</small>
                  </div>

                  <div className="df-fin-method-row__totals">
                    {activeCurrencies.map((currency) => (
                      <span key={`${row.payment_method}-${currency}`}>
                        {formatMoney(Number(totals[currency] || 0), currency)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

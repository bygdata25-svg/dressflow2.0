import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { PrimaryButton } from "../../components/common/buttons";
import "../../styles/pro-pages.css";

type CurrencyCode = "USD" | "ARS";

type SaleReportItemLine = {
  id: string;
  item_type: string;
  description_snapshot?: string;
  quantity: number;
  unit_price: number;
  currency: CurrencyCode;
  line_total: number;
};

type SaleReportPaymentLine = {
  id: string;
  payment_method: string;
  amount: number;
  currency: CurrencyCode;
  reference?: string | null;
  notes?: string | null;
};

type SaleReportRow = {
  id: string;
  sale_number?: string | null;
  sale_date?: string | null;
  customer_full_name?: string | null;
  currency?: string | null;
  status: string;
  subtotal_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  notes?: string | null;
  items_total_ars: number;
  items_total_usd: number;
  paid_total_ars: number;
  paid_total_usd: number;
  items: SaleReportItemLine[];
  payments: SaleReportPaymentLine[];
};

type SalesUnifiedReportResponse = {
  items: SaleReportRow[];
  total: number;
  total_ars: number;
  total_usd: number;
  mixed_count: number;
};

type FiltersState = {
  q: string;
  status: string;
  currency: string;
  date_from: string;
  date_to: string;
};

const initialFilters: FiltersState = {
  q: "",
  status: "",
  currency: "",
  date_from: "",
  date_to: "",
};

function statusClass(value?: string | null) {
  const raw = String(value || "").toUpperCase().trim();
  if (raw === "COMPLETED" || raw === "PAID") return "df-sales-report-status--completed";
  if (raw === "PARTIAL") return "df-sales-report-status--partial";
  if (raw === "PENDING") return "df-sales-report-status--pending";
  return "df-sales-report-status--cancelled";
}

export default function SalesReportPage() {
  const { t, i18n } = useTranslation("sales-report");
  const { t: tc } = useTranslation("common");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [items, setItems] = useState<SaleReportRow[]>([]);
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleReportRow | null>(null);

  function formatMoney(value: number, currency: CurrencyCode) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function formatDateTime(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  function paymentMethodLabel(value?: string | null) {
    const raw = String(value || "").toUpperCase().trim();
    return t(`payments.${raw}`, { defaultValue: value || "—" });
  }

  function statusLabel(value?: string | null) {
    const raw = String(value || "").toUpperCase().trim();
    return t(`status.${raw}`, { defaultValue: value || "—" });
  }

  function currencyLabel(value?: string | null) {
    const raw = String(value || "").toUpperCase().trim();
    return t(`currency.${raw}`, { defaultValue: value || "—" });
  }

  function itemTypeLabel(value?: string | null) {
    const raw = String(value || "").toUpperCase().trim();
    return t(`itemTypes.${raw}`, { defaultValue: value || t("itemTypes.ITEM") });
  }

  function saleTotalLabel(row: SaleReportRow) {
    const hasUSD = Number(row.items_total_usd || 0) > 0;
    const hasARS = Number(row.items_total_ars || 0) > 0;

    if (hasUSD && hasARS) {
      return `${formatMoney(row.items_total_usd, "USD")} + ${formatMoney(row.items_total_ars, "ARS")}`;
    }

    if (hasUSD) return formatMoney(row.items_total_usd, "USD");
    if (hasARS) return formatMoney(row.items_total_ars, "ARS");

    return "—";
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const params: Record<string, string> = {};
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.currency) params.currency = filters.currency;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const { data } = await api.get<SalesUnifiedReportResponse>("/reports/sales-unified", {
        params,
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err: any) {
      console.error("Error loading unified sales report:", err);
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("errors.load"));

      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [filters.q, filters.status, filters.currency, filters.date_from, filters.date_to]);

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, q: searchDraft.trim() }));
  }

  function handleClearFilters() {
    setSearchDraft("");
    setFilters(initialFilters);
  }

  async function exportExcel() {
    try {
      setExporting(true);
      setError("");

      const lang = i18n.language?.startsWith("en") ? "en" : "es";

      const params: Record<string, string> = { lang };
      if (filters.q) params.q = filters.q;
      if (filters.status) params.status = filters.status;
      if (filters.currency) params.currency = filters.currency;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const response = await api.get("/reports/sales-unified/export", {
        params,
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = lang === "en" ? "unified_sales.xlsx" : "ventas_unificadas.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Error exporting unified sales report:", err);
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("errors.export"));
    } finally {
      setExporting(false);
    }
  }

  const metrics = useMemo(() => {
    const validRows = items.filter(
      (item) => String(item.status || "").toUpperCase() !== "CANCELLED"
    );

    const totalARS = validRows.reduce(
      (acc, item) => acc + Number(item.items_total_ars || 0),
      0
    );
    const totalUSD = validRows.reduce(
      (acc, item) => acc + Number(item.items_total_usd || 0),
      0
    );
    const mixedCount = validRows.filter(
      (item) => item.items_total_ars > 0 && item.items_total_usd > 0
    ).length;
    const averageTicketARS = validRows.length > 0 ? totalARS / validRows.length : 0;
    const averageTicketUSD = validRows.length > 0 ? totalUSD / validRows.length : 0;

    return {
      count: validRows.length,
      totalARS,
      totalUSD,
      mixedCount,
      averageTicketARS,
      averageTicketUSD,
    };
  }, [items]);

  const headline = useMemo(() => {
    const hasUSD = metrics.totalUSD > 0;
    const hasARS = metrics.totalARS > 0;

    if (hasUSD && hasARS) {
      return {
        label: t("headline.mixedTotal"),
        value: `${formatMoney(metrics.totalUSD, "USD")} + ${formatMoney(metrics.totalARS, "ARS")}`,
        subtitle: t("headline.mixedSubtitle", {
          count: metrics.mixedCount,
          operationLabel:
            metrics.mixedCount === 1
              ? t("headline.operationSingular")
              : t("headline.operationPlural"),
        }),
      };
    }

    if (hasUSD) {
      return {
        label: t("headline.total"),
        value: formatMoney(metrics.totalUSD, "USD"),
        subtitle: t("headline.usdSubtitle"),
      };
    }

    return {
      label: t("headline.total"),
      value: formatMoney(metrics.totalARS, "ARS"),
      subtitle: t("headline.arsSubtitle"),
    };
  }, [metrics, t, locale]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-sales-report-hero-total {
          display: grid;
          gap: 8px;
          padding: 24px;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(61, 38, 72, 0.98) 0%, rgba(92, 49, 121, 0.96) 52%, rgba(123, 74, 181, 0.92) 100%);
          color: #fff;
          box-shadow: 0 22px 44px rgba(55, 31, 68, 0.18);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .df-sales-report-hero-total span {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: .82;
        }

        .df-sales-report-hero-total strong {
          font-size: clamp(30px, 4vw, 40px);
          line-height: 1.02;
          letter-spacing: -0.04em;
          font-weight: 800;
        }

        .df-sales-report-hero-total small {
          font-size: 13px;
          opacity: .88;
        }

        .df-sales-report-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .df-sales-report-kpi-card {
          background: linear-gradient(180deg, #ffffff 0%, #fcfafc 100%);
          border: 1px solid #e6e0e8;
          border-radius: 22px;
          padding: 20px;
          box-shadow: 0 14px 32px rgba(31, 24, 39, 0.06);
          display: grid;
          gap: 8px;
        }

        .df-sales-report-kpi-card span {
          font-size: 14px;
          color: #7a7082;
          font-weight: 600;
        }

        .df-sales-report-kpi-card strong {
          font-size: 30px;
          color: #35293f;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .df-sales-report-kpi-card small {
          font-size: 12px;
          color: #8b8193;
        }

        .df-sales-report-grid {
          display: grid;
          grid-template-columns: minmax(280px, 1.8fr) repeat(4, minmax(160px, 1fr));
          gap: 14px;
          align-items: end;
        }

        .df-sales-report-cell {
          display: grid;
          gap: 6px;
        }

        .df-sales-report-cell label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-sales-report-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .df-sales-report-total-chip {
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

        .df-sales-report-status {
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

        .df-sales-report-status--completed {
          background: #e8f7ee;
          color: #157347;
          border-color: #cdebd9;
        }

        .df-sales-report-status--partial {
          background: #fff6df;
          color: #9b6700;
          border-color: #f6e3a7;
        }

        .df-sales-report-status--pending {
          background: #eef4ff;
          color: #315ea8;
          border-color: #d6e2ff;
        }

        .df-sales-report-status--cancelled {
          background: #f4f1f5;
          color: #6f6478;
          border-color: #e1d9e5;
        }

        .df-sales-report-meta {
          display: grid;
          gap: 4px;
        }

        .df-sales-report-meta strong {
          font-size: 14px;
          color: #32273c;
        }

        .df-sales-report-meta span {
          font-size: 12px;
          color: #8b8193;
        }

        .df-sales-report-row-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid #e4daf1;
          background: linear-gradient(180deg, #fcf8ff 0%, #f7f0ff 100%);
          color: #6a35c1;
          font-weight: 700;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
        }

        .df-sales-report-row-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(101, 57, 160, 0.12);
        }

        .df-drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(22, 16, 29, 0.38);
          backdrop-filter: blur(3px);
          z-index: 999;
        }

        .df-drawer {
          position: absolute;
          top: 0;
          right: 0;
          width: min(460px, 100%);
          height: 100%;
          background: #ffffff;
          box-shadow: -24px 0 60px rgba(26, 17, 36, 0.18);
          display: flex;
          flex-direction: column;
        }

        .df-drawer-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding: 22px 22px 18px;
          border-bottom: 1px solid #ece6f1;
        }

        .df-drawer-header h3 {
          margin: 0;
          font-size: 22px;
          color: #2f2438;
        }

        .df-drawer-header small {
          display: block;
          margin-top: 6px;
          color: #8b8193;
          font-size: 13px;
        }

        .df-drawer-header button {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid #e7deef;
          background: #faf7fd;
          color: #6a35c1;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }

        .df-drawer-body {
          padding: 22px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          overflow-y: auto;
        }

        .df-drawer-body section {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid #ece6f1;
          background: #fcfbfd;
        }

        .df-drawer-body h4 {
          margin: 0;
          font-size: 15px;
          color: #33293d;
        }

        .df-line {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
          color: #463b52;
        }

        .df-line small {
          color: #857a8f;
          display: block;
          margin-top: 4px;
        }

        .df-summary {
          display: grid;
          gap: 10px;
        }

        .df-summary div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: #f7f2fb;
          color: #473954;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .df-sales-report-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .df-sales-report-grid {
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
          <p className="df-pro-page__eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("hero.subtitle")}</p>
        </div>

        <div className="df-pro-actions-row">
          <PrimaryButton type="button" onClick={exportExcel} disabled={exporting}>
            {exporting ? tc("status.exporting") : tc("actions.exportExcel")}
          </PrimaryButton>
        </div>
      </header>

      <section className="df-pro-card">
        <div className="df-sales-report-hero-total">
          <span>{headline.label}</span>
          <strong>{headline.value}</strong>
          <small>{headline.subtitle}</small>
        </div>
      </section>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-sales-report-grid">
          <div className="df-sales-report-cell">
            <label>{t("filters.search")}</label>
            <input
              className="df-pro-input"
              placeholder={t("filters.searchPlaceholder")}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>

          <div className="df-sales-report-cell">
            <label>{t("filters.status")}</label>
            <select
              className="df-pro-select"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="">{t("filters.allStatuses")}</option>
              <option value="COMPLETED">{t("status.COMPLETED")}</option>
              <option value="CANCELLED">{t("status.CANCELLED")}</option>
            </select>
          </div>

          <div className="df-sales-report-cell">
            <label>{t("filters.currency")}</label>
            <select
              className="df-pro-select"
              value={filters.currency}
              onChange={(e) => setFilters((prev) => ({ ...prev, currency: e.target.value }))}
            >
              <option value="">{t("filters.allCurrencies")}</option>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>

          <div className="df-sales-report-cell">
            <label>{t("filters.from")}</label>
            <input
              className="df-pro-input"
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
            />
          </div>

          <div className="df-sales-report-cell">
            <label>{t("filters.to")}</label>
            <input
              className="df-pro-input"
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
            />
          </div>

          <div className="df-pro-actions-row" style={{ gridColumn: "1 / -1" }}>
            <button type="submit">{tc("actions.search")}</button>
            <button type="button" onClick={handleClearFilters}>
              {tc("actions.clear")}
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

      <section className="df-sales-report-kpis">
        <div className="df-sales-report-kpi-card">
          <span>{t("kpis.sales")}</span>
          <strong>{metrics.count}</strong>
          <small>{t("kpis.salesSubtitle")}</small>
        </div>

        <div className="df-sales-report-kpi-card">
          <span>{t("kpis.totalARS")}</span>
          <strong>{formatMoney(metrics.totalARS, "ARS")}</strong>
          <small>{t("kpis.totalARSSubtitle")}</small>
        </div>

        <div className="df-sales-report-kpi-card">
          <span>{t("kpis.totalUSD")}</span>
          <strong>{formatMoney(metrics.totalUSD, "USD")}</strong>
          <small>{t("kpis.totalUSDSubtitle")}</small>
        </div>

        <div className="df-sales-report-kpi-card">
          <span>{t("kpis.mixed")}</span>
          <strong>{metrics.mixedCount}</strong>
          <small>{t("kpis.mixedSubtitle")}</small>
        </div>
      </section>

      <section className="df-pro-card">
        <div className="df-sales-report-summary">
          <div>
            <strong>{t("summary.records")}:</strong> {items.length}
          </div>

          <div className="df-sales-report-total-chip">
            {t("summary.totals")}: {formatMoney(metrics.totalUSD, "USD")} +{" "}
            {formatMoney(metrics.totalARS, "ARS")}
          </div>
        </div>
      </section>

      <section className="df-pro-card">
        {loading ? (
          <p>{t("messages.loading")}</p>
        ) : items.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr>
                  <th className="df-pro-table__th">{t("fields.sale")}</th>
                  <th className="df-pro-table__th">{t("fields.date")}</th>
                  <th className="df-pro-table__th">{t("fields.customer")}</th>
                  <th className="df-pro-table__th">{t("fields.currency")}</th>
                  <th className="df-pro-table__th">{t("fields.total")}</th>
                  <th className="df-pro-table__th">{t("fields.payments")}</th>
                  <th className="df-pro-table__th">{t("fields.status")}</th>
                  <th className="df-pro-table__th">{t("fields.detail")}</th>
                </tr>
              </thead>

              <tbody>
                {items.map((row) => {
                  const isMixed = row.items_total_ars > 0 && row.items_total_usd > 0;

                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td className="df-pro-table__td">{row.sale_number || "—"}</td>
                        <td className="df-pro-table__td">{formatDateTime(row.sale_date)}</td>
                        <td className="df-pro-table__td">{row.customer_full_name || "—"}</td>
                        <td className="df-pro-table__td">{row.currency || "—"}</td>
                        <td className="df-pro-table__td">
                          <strong>{saleTotalLabel(row)}</strong>
                          {isMixed ? (
                            <div style={{ marginTop: 4, fontSize: 12, color: "#8b8193" }}>
                              {t("labels.mixedSale")}
                            </div>
                          ) : null}
                        </td>
                        <td className="df-pro-table__td">
                          <div className="df-sales-report-meta">
                            {row.paid_total_usd > 0 && (
                              <span>{formatMoney(row.paid_total_usd, "USD")}</span>
                            )}
                            {row.paid_total_ars > 0 && (
                              <span>{formatMoney(row.paid_total_ars, "ARS")}</span>
                            )}
                            {row.paid_total_usd === 0 && row.paid_total_ars === 0 && (
                              <span>—</span>
                            )}
                          </div>
                        </td>
                        <td className="df-pro-table__td">
                          <span className={`df-sales-report-status ${statusClass(row.status)}`}>
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td className="df-pro-table__td">
                          <button
                            type="button"
                            className="df-sales-report-row-button"
                            onClick={() => setSelectedSale(row)}
                          >
                            {t("actions.viewDetail")}
                          </button>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {selectedSale && (
          <div className="df-drawer-overlay" onClick={() => setSelectedSale(null)}>
            <div className="df-drawer" onClick={(e) => e.stopPropagation()}>
              <header className="df-drawer-header">
                <div>
                  <h3>{selectedSale.sale_number || "—"}</h3>
                  <small>{selectedSale.customer_full_name || "—"}</small>
                </div>
                <button onClick={() => setSelectedSale(null)}>✕</button>
              </header>

              <div className="df-drawer-body">
                <section>
                  <h4>{t("sections.items")}</h4>
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="df-line">
                      <span>
                        {itemTypeLabel(item.item_type)} · {item.description_snapshot || "—"} · x
                        {item.quantity}
                        <small>
                          {formatMoney(item.unit_price, item.currency)} / {item.currency}
                        </small>
                      </span>
                      <strong>{formatMoney(item.line_total, item.currency)}</strong>
                    </div>
                  ))}
                </section>

                <section>
                  <h4>{t("sections.payments")}</h4>
                  {selectedSale.payments.length === 0 ? (
                    <div className="df-line">
                      <span>—</span>
                    </div>
                  ) : (
                    selectedSale.payments.map((payment) => (
                      <div key={payment.id} className="df-line">
                        <span>
                          {paymentMethodLabel(payment.payment_method)}
                          {payment.reference ? <small>{payment.reference}</small> : null}
                        </span>
                        <strong>{formatMoney(payment.amount, payment.currency)}</strong>
                      </div>
                    ))
                  )}
                </section>

                <section>
                  <h4>{t("sections.summary")}</h4>
                  <div className="df-summary">
                    <div>
                      <span>ARS</span>
                      <strong>{formatMoney(selectedSale.items_total_ars, "ARS")}</strong>
                    </div>
                    <div>
                      <span>USD</span>
                      <strong>{formatMoney(selectedSale.items_total_usd, "USD")}</strong>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "../styles/pro-pages.css";

type DressStockRow = {
  id: string;
  code: string;
  name: string;
  capsule?: string | null;
  size?: string | null;
  color?: string | null;
  status: string;
  sale_price: number;
  rental_price: number;
};

type DressStockKpis = {
  total_items: number;
  available_items: number;
  total_sale_value: number;
  total_rental_value: number;
};

type DressStockResponse = {
  items: DressStockRow[];
  total: number;
  kpis: DressStockKpis;
};

function money(value: number | string | null | undefined, locale: string) {
  const parsed = Number(value ?? 0);
  const safe = Number.isFinite(parsed) ? parsed : 0;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function statusClass(value?: string | null) {
  const raw = String(value || "").toLowerCase();
  return `df-dress-stock-status df-dress-stock-status--${raw || "default"}`;
}

export default function DressStockValuationReportPage() {
  const { t, i18n } = useTranslation("dress-stock-report");
  const { t: tc } = useTranslation("common");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [rows, setRows] = useState<DressStockRow[]>([]);
  const [kpis, setKpis] = useState<DressStockKpis>({
    total_items: 0,
    available_items: 0,
    total_sale_value: 0,
    total_rental_value: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");


  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get<DressStockResponse>("/reports/dress-stock-valuation", {
        params: {
          search: search || undefined,
        },
      });

      setRows(Array.isArray(res.data.items) ? res.data.items : []);
      setKpis({
        total_items: Number(res.data.kpis?.total_items || 0),
        available_items: Number(res.data.kpis?.available_items || 0),
        total_sale_value: Number(res.data.kpis?.total_sale_value || 0),
        total_rental_value: Number(res.data.kpis?.total_rental_value || 0),
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("errors.load"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, [search]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleClear = () => {
    setSearchInput("");
    setSearch("");
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");

      const lang = i18n.language?.startsWith("en") ? "en" : "es";

      const response = await api.get("/reports/dress-stock-valuation/export", {
        params: {
          search: search || undefined,
          lang,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = lang === "en" ? "dress_stock_valuation.xlsx" : "stock_valorizado_vestidos.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("errors.export"));
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo<DataGridColumn<DressStockRow>[]>(() => {
    return [
      {
        key: "code",
        label: t("fields.code"),
        render: (row: DressStockRow) => <strong>{row.code}</strong>,
      },
      {
        key: "name",
        label: t("fields.name"),
        render: (row: DressStockRow) => row.name,
      },
      {
        key: "capsule",
        label: t("fields.capsule"),
        render: (row: DressStockRow) => row.capsule || "—",
      },
      {
        key: "size",
        label: t("fields.size"),
        render: (row: DressStockRow) => row.size || "—",
      },
      {
        key: "color",
        label: t("fields.color"),
        render: (row: DressStockRow) => row.color || "—",
      },
      {
        key: "status",
        label: t("fields.status"),
        render: (row: DressStockRow) => (
          <span className={statusClass(row.status)}>{t(`status.${String(row.status || "").toUpperCase()}`, { defaultValue: row.status || "—" })}</span>
        ),
      },
      {
        key: "sale_price",
        label: t("fields.salePrice"),
        render: (row: DressStockRow) => <strong>{money(row.sale_price, locale)}</strong>,
      },
      {
        key: "rental_price",
        label: t("fields.rentalPrice"),
        render: (row: DressStockRow) => <strong>{money(row.rental_price, locale)}</strong>,
      },
    ];
  }, [t, locale]);

  return (
    <section className="df-pro-page df-dress-stock-page">
      <style>{`
        .df-dress-stock-page {
          display: grid;
          gap: 22px;
        }

        .df-dress-stock-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          width: 100%;
        }

        .df-dress-stock-header__actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          padding-top: 2px;
        }

        .df-dress-stock-export {
          border: 0;
          border-radius: 16px;
          padding: 13px 22px;
          background: #141a27;
          color: #ffffff;
          font-weight: 800;
          font-size: 14px;
          cursor: pointer;
          box-shadow: 0 16px 32px rgba(20, 26, 39, 0.18);
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .df-dress-stock-export:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 20px 38px rgba(20, 26, 39, 0.22);
        }

        .df-dress-stock-export:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .df-dress-stock-hero {
          border: 1px solid #e1d3ca;
          border-radius: 28px;
          padding: 24px;
          background: #ffffff;
          box-shadow: 0 22px 50px rgba(64, 52, 42, 0.08);
        }

        .df-dress-stock-hero__inner {
          min-height: 132px;
          border-radius: 24px;
          padding: 28px 30px;
          background:
            radial-gradient(circle at 12% 20%, rgba(255,255,255,0.18), transparent 28%),
            linear-gradient(135deg, #3d254e 0%, #5b3472 45%, #8457c7 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          overflow: hidden;
          position: relative;
        }

        .df-dress-stock-hero__inner::after {
          content: "";
          position: absolute;
          right: -80px;
          top: -100px;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
        }

        .df-dress-stock-hero__label {
          display: block;
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.76);
          font-weight: 800;
          margin-bottom: 12px;
        }

        .df-dress-stock-hero__value {
          margin: 0;
          font-size: clamp(34px, 4vw, 54px);
          line-height: 0.95;
          letter-spacing: -0.07em;
          color: #ffffff;
          font-weight: 900;
        }

        .df-dress-stock-hero__subtitle {
          margin: 12px 0 0;
          font-size: 14px;
          color: rgba(255,255,255,0.82);
        }

        .df-dress-stock-hero__side {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 10px;
          min-width: 240px;
        }

        .df-dress-stock-hero-mini {
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.10);
          border-radius: 18px;
          padding: 13px 15px;
          backdrop-filter: blur(8px);
        }

        .df-dress-stock-hero-mini span {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.68);
          font-weight: 800;
          margin-bottom: 5px;
        }

        .df-dress-stock-hero-mini strong {
          color: #ffffff;
          font-size: 20px;
        }

        .df-dress-stock-filter-card,
        .df-dress-stock-table-card {
          border: 1px solid #e1d3ca;
          border-radius: 28px;
          background: #ffffff;
          box-shadow: 0 22px 50px rgba(64, 52, 42, 0.07);
        }

        .df-dress-stock-filter-card {
          padding: 22px 24px;
        }

        .df-dress-stock-filter-grid {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) auto auto;
          gap: 14px;
          align-items: end;
        }

        .df-dress-stock-filter-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .df-dress-stock-btn-primary,
        .df-dress-stock-btn-secondary {
          border-radius: 14px;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          min-height: 44px;
        }

        .df-dress-stock-btn-primary {
          border: 1px solid #141a27;
          background: #141a27;
          color: #ffffff;
        }

        .df-dress-stock-btn-secondary {
          border: 1px solid #e0d3c9;
          background: #ffffff;
          color: #3d3648;
        }

        .df-dress-stock-kpis {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .df-dress-stock-kpi {
          border: 1px solid #e1d3ca;
          border-radius: 22px;
          padding: 18px 20px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%);
          box-shadow: 0 16px 34px rgba(64, 52, 42, 0.06);
          min-height: 104px;
          display: grid;
          align-content: center;
          gap: 8px;
        }

        .df-dress-stock-kpi span {
          font-size: 12px;
          color: #8a7f78;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 800;
        }

        .df-dress-stock-kpi strong {
          font-size: 26px;
          line-height: 1;
          letter-spacing: -0.04em;
          color: #332d3d;
        }

        .df-dress-stock-table-card {
          padding: 22px 24px;
          overflow: hidden;
        }

        .df-dress-stock-table-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 18px;
          color: #8a7f78;
          font-size: 14px;
        }

        .df-dress-stock-chip {
          border: 1px solid #e1d3ca;
          border-radius: 14px;
          padding: 10px 14px;
          background: #fbf7f3;
          color: #6f6478;
        }

        .df-dress-stock-status {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          background: #f4f4f5;
          color: #52525b;
        }

        .df-dress-stock-status--available {
          background: #ecfdf3;
          color: #027a48;
        }

        .df-dress-stock-status--loaned,
        .df-dress-stock-status--rented {
          background: #fff7ed;
          color: #b54708;
        }

        .df-dress-stock-status--cleaning {
          background: #e6fffa;
          color: #0f766e;
        }

        .df-dress-stock-status--maintenance {
          background: #fff4e5;
          color: #b45309;
        }

        .df-dress-stock-status--sold,
        .df-dress-stock-status--retired {
          background: #f4f4f5;
          color: #52525b;
        }

        .df-dress-stock-error {
          padding: 12px 14px;
          border-radius: 16px;
          background: #fdecec;
          color: #9a2f2f;
          border: 1px solid #f4c7c7;
        }

        .df-dress-stock-empty,
        .df-dress-stock-loading {
          padding: 26px;
          text-align: center;
          color: #8a7f78;
        }

        @media (max-width: 1100px) {
          .df-dress-stock-kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .df-dress-stock-hero__inner {
            align-items: flex-start;
            flex-direction: column;
          }

          .df-dress-stock-hero__side {
            width: 100%;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .df-dress-stock-header {
            flex-direction: column;
          }

          .df-dress-stock-header__actions {
            width: 100%;
          }

          .df-dress-stock-export {
            width: 100%;
          }

          .df-dress-stock-filter-grid {
            grid-template-columns: 1fr;
          }

          .df-dress-stock-filter-actions {
            width: 100%;
          }

          .df-dress-stock-btn-primary,
          .df-dress-stock-btn-secondary {
            flex: 1;
          }

          .df-dress-stock-kpis,
          .df-dress-stock-hero__side {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="df-dress-stock-header">
        <div>
          <p className="df-pro-page__eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("hero.subtitle")}</p>
        </div>

        <div className="df-dress-stock-header__actions">
          <button
            type="button"
            className="df-dress-stock-export"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? tc("status.exporting") : tc("actions.exportExcel")}
          </button>
        </div>
      </header>

      <section className="df-dress-stock-hero">
        <div className="df-dress-stock-hero__inner">
          <div>
            <span className="df-dress-stock-hero__label">{t("hero.saleValuation")}</span>
            <h2 className="df-dress-stock-hero__value">{money(kpis.total_sale_value, locale)}</h2>
            <p className="df-dress-stock-hero__subtitle">{t("hero.saleValuationSubtitle")}</p>
          </div>

          <div className="df-dress-stock-hero__side">
            <div className="df-dress-stock-hero-mini">
              <span>{t("kpis.saleValue")}</span>
              <strong>{money(kpis.total_sale_value, locale)}</strong>
            </div>
            <div className="df-dress-stock-hero-mini">
              <span>{t("kpis.rentalValue")}</span>
              <strong>{money(kpis.total_rental_value, locale)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="df-dress-stock-filter-card">
        <form onSubmit={handleSearchSubmit} className="df-dress-stock-filter-grid">
          <div>
            <label className="df-pro-label">{t("filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
            />
          </div>

          <div className="df-dress-stock-filter-actions">
            <button type="submit" className="df-dress-stock-btn-primary">
              {tc("actions.search")}
            </button>
            <button type="button" className="df-dress-stock-btn-secondary" onClick={handleClear}>
              {tc("actions.clear")}
            </button>
          </div>
        </form>
      </section>

      {error ? <div className="df-dress-stock-error">{error}</div> : null}

      <section className="df-dress-stock-kpis">
        <article className="df-dress-stock-kpi">
          <span>{t("kpis.total")}</span>
          <strong>{kpis.total_items}</strong>
        </article>

        <article className="df-dress-stock-kpi">
          <span>{t("kpis.available")}</span>
          <strong>{kpis.available_items}</strong>
        </article>

        <article className="df-dress-stock-kpi">
          <span>{t("kpis.saleValue")}</span>
          <strong>{money(kpis.total_sale_value, locale)}</strong>
        </article>

        <article className="df-dress-stock-kpi">
          <span>{t("kpis.rentalValue")}</span>
          <strong>{money(kpis.total_rental_value, locale)}</strong>
        </article>
      </section>

      <section className="df-dress-stock-table-card">
        <div className="df-dress-stock-table-head">
          <div>
            {t("summary.records")}: <strong>{rows.length}</strong>
          </div>
          <div className="df-dress-stock-chip">
            {t("summary.currency")}: <strong>USD</strong>
          </div>
        </div>

        {loading ? (
          <div className="df-dress-stock-loading">{t("messages.loading")}</div>
        ) : rows.length === 0 ? (
          <div className="df-dress-stock-empty">{t("empty")}</div>
        ) : (
          <DataGrid rows={rows} columns={columns} getRowKey={(row) => row.id} />
        )}
      </section>
    </section>
  );
}

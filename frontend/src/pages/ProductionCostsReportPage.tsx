import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "./DressesPage.css";

type ProductionCostsRow = {
  id: string;
  order_number: string;
  dress: string;
  workshop?: string | null;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  planned_quantity: number;
  produced_quantity: number;
  estimated_material_cost: number;
  actual_material_cost: number;
  labor_cost: number;
  additional_cost: number;
  total_estimated: number;
  total_actual: number;
  unit_estimated?: number | null;
  unit_actual?: number | null;
  currency: string;
};

type ProductionCostsResponse = {
  items: ProductionCostsRow[];
  total: number;
};

function toNumber(value?: number | string | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function visibleMaterialCost(row: ProductionCostsRow) {
  const actual = toNumber(row.actual_material_cost);
  const estimated = toNumber(row.estimated_material_cost);
  return actual > 0 ? actual : estimated;
}

function laborAndOtherCost(row: ProductionCostsRow) {
  return toNumber(row.labor_cost) + toNumber(row.additional_cost);
}

function estimatedTotal(row: ProductionCostsRow) {
  return toNumber(row.estimated_material_cost) + laborAndOtherCost(row);
}

export default function ProductionCostsReportPage() {
  const { t, i18n } = useTranslation("production-costs-report");
  const { t: tc } = useTranslation("common");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [rows, setRows] = useState<ProductionCostsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [statusInput, setStatusInput] = useState("");
  const [status, setStatus] = useState("");

  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [exporting, setExporting] = useState(false);

  function money(value?: number | string | null) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNumber(value));
  }

  function number(value: number) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  function formatDate(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
  }

  function statusLabel(value?: string | null) {
    const raw = String(value || "").toUpperCase();
    return t(`status.${raw}`, { defaultValue: value || "—" });
  }

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<ProductionCostsResponse>("/reports/production-costs", {
        params: {
          search: search || undefined,
          status: status || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });

      setRows(Array.isArray(response.data.items) ? response.data.items : []);
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
  }, [search, status, dateFrom, dateTo]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setStatus(statusInput);
    setDateFrom(dateFromInput);
    setDateTo(dateToInput);
  };

  const handleClear = () => {
    setSearchInput("");
    setSearch("");
    setStatusInput("");
    setStatus("");
    setDateFromInput("");
    setDateToInput("");
    setDateFrom("");
    setDateTo("");
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");

      const lang = i18n.language?.startsWith("en") ? "en" : "es";

      const response = await api.get("/reports/production-costs/export", {
        params: {
          search: search || undefined,
          status: status || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
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
      link.download = lang === "en" ? "production_costs.xlsx" : "costos_produccion.xlsx";
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

  const totals = useMemo(() => {
    const totalMaterial = rows.reduce((acc, row) => acc + visibleMaterialCost(row), 0);
    const totalLaborAndOther = rows.reduce((acc, row) => acc + laborAndOtherCost(row), 0);
    const totalEstimated = rows.reduce((acc, row) => acc + estimatedTotal(row), 0);
    const totalOrders = rows.length;

    return {
      totalOrders,
      totalMaterial,
      totalLaborAndOther,
      totalEstimated,
    };
  }, [rows]);

  const columns = useMemo<DataGridColumn<ProductionCostsRow>[]>(() => {
    return [
      {
        key: "order_number",
        label: t("fields.order"),
        render: (row: ProductionCostsRow) => <strong>{row.order_number}</strong>,
      },
      {
        key: "dress",
        label: t("fields.dress"),
        render: (row: ProductionCostsRow) => row.dress,
      },
      {
        key: "workshop",
        label: t("fields.workshop"),
        render: (row: ProductionCostsRow) => row.workshop || "—",
      },
      {
        key: "status",
        label: t("fields.status"),
        render: (row: ProductionCostsRow) => statusLabel(row.status),
      },
      {
        key: "due_date",
        label: t("fields.dueDate"),
        render: (row: ProductionCostsRow) => formatDate(row.due_date),
      },
      {
        key: "planned_quantity",
        label: t("fields.planned"),
        render: (row: ProductionCostsRow) => number(row.planned_quantity),
      },
      {
        key: "produced_quantity",
        label: t("fields.produced"),
        render: (row: ProductionCostsRow) => number(row.produced_quantity),
      },
      {
        key: "material_cost",
        label: t("fields.material"),
        render: (row: ProductionCostsRow) => money(visibleMaterialCost(row)),
      },
      {
        key: "labor_other",
        label: t("fields.laborOther"),
        render: (row: ProductionCostsRow) => money(laborAndOtherCost(row)),
      },
      {
        key: "total_estimated",
        label: t("fields.totalEstimated"),
        render: (row: ProductionCostsRow) => <strong>{money(estimatedTotal(row))}</strong>,
      },
    ];
  }, [t, locale]);

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
          <p className="df-pro-page__eyebrow">{t("hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("title")}</h1>
          <p className="df-pro-page__subtitle">{t("hero.subtitle")}</p>
        </div>

        <button
          className="df-button-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? tc("status.exporting") : tc("actions.exportExcel")}
        </button>
      </header>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--4">
          <div>
            <label className="df-pro-label">{t("filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("filters.status")}</label>
            <select
              className="df-pro-input"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
            >
              <option value="">{t("filters.all")}</option>
              <option value="DRAFT">{t("status.DRAFT")}</option>
              <option value="MATERIALS_RESERVED">{t("status.MATERIALS_RESERVED")}</option>
              <option value="IN_PRODUCTION">{t("status.IN_PRODUCTION")}</option>
              <option value="COMPLETED">{t("status.COMPLETED")}</option>
              <option value="CANCELLED">{t("status.CANCELLED")}</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("filters.from")}</label>
            <input
              type="date"
              className="df-pro-input"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("filters.to")}</label>
            <input
              type="date"
              className="df-pro-input"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
            />
          </div>

          <button type="submit">{tc("actions.search")}</button>
          <button type="button" onClick={handleClear}>
            {tc("actions.clear")}
          </button>
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          width: "100%",
        }}
      >
        <div className="df-pro-card">
          <div className="df-pro-label">{t("kpis.orders")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.totalOrders}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">{t("kpis.material")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {money(totals.totalMaterial)}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">{t("kpis.labor")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {money(totals.totalLaborAndOther)}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">{t("kpis.total")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {money(totals.totalEstimated)}
          </div>
        </div>
      </section>

      <section className="df-pro-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#8a7f78", fontSize: 14 }}>
            {t("summary.records")}: <strong>{rows.length}</strong>
          </div>

          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "#f8f4ef",
              border: "1px solid #eadfd7",
              fontSize: 14,
            }}
          >
            {t("summary.simplifiedView")}: <strong>{t("summary.simplifiedViewDetail")}</strong>
          </div>
        </div>

        {loading ? (
          <p>{t("messages.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("empty")}</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row: ProductionCostsRow) => row.id}
          />
        )}
      </section>
    </section>
  );
}

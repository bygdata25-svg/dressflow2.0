import { useEffect, useMemo, useState } from "react";
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

function money(value?: number | string | null, currency = "USD") {
  const safeCurrency = currency || "USD";

  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNumber(value));
  } catch {
    return `${new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toNumber(value))} ${safeCurrency}`;
  }
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date);
}

function statusLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "DRAFT") return "Borrador";
  if (raw === "MATERIALS_RESERVED") return "Materiales reservados";
  if (raw === "IN_PRODUCTION") return "En producción";
  if (raw === "COMPLETED") return "Completada";
  if (raw === "CANCELLED") return "Cancelada";
  return value || "—";
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

      setRows(response.data.items || []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo cargar el reporte.");
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

      const response = await api.get("/reports/production-costs/export", {
        params: {
          search: search || undefined,
          status: status || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "costos_produccion.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError("No se pudo exportar el reporte.");
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
        label: "Orden",
        render: (row: ProductionCostsRow) => <strong>{row.order_number}</strong>,
      },
      {
        key: "dress",
        label: "Vestido",
        render: (row: ProductionCostsRow) => row.dress,
      },
      {
        key: "workshop",
        label: "Taller",
        render: (row: ProductionCostsRow) => row.workshop || "—",
      },
      {
        key: "status",
        label: "Estado",
        render: (row: ProductionCostsRow) => statusLabel(row.status),
      },
      {
        key: "due_date",
        label: "Entrega",
        render: (row: ProductionCostsRow) => formatDate(row.due_date),
      },
      {
        key: "planned_quantity",
        label: "Planificado",
        render: (row: ProductionCostsRow) => number(row.planned_quantity),
      },
      {
        key: "produced_quantity",
        label: "Producido",
        render: (row: ProductionCostsRow) => number(row.produced_quantity),
      },
      {
        key: "material_cost",
        label: "Material",
        render: (row: ProductionCostsRow) => money(visibleMaterialCost(row), row.currency),
      },
      {
        key: "labor_other",
        label: "Mano de obra / otros",
        render: (row: ProductionCostsRow) => money(laborAndOtherCost(row), row.currency),
      },
      {
        key: "total_estimated",
        label: "Total estimado",
        render: (row: ProductionCostsRow) => (
          <strong>{money(estimatedTotal(row), row.currency)}</strong>
        ),
      },
    ];
  }, []);

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
          <p className="df-pro-page__eyebrow">Reportes</p>
          <h1 className="df-pro-page__title">Costos de producción</h1>
          <p className="df-pro-page__subtitle">
            Resumen económico alineado con la pantalla de costos de cada orden.
          </p>
        </div>

        <button
          className="df-button-primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? "Exportando..." : "Exportar a Excel"}
        </button>
      </header>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--4">
          <div>
            <label className="df-pro-label">Buscar</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Orden, vestido o taller"
            />
          </div>

          <div>
            <label className="df-pro-label">Estado</label>
            <select
              className="df-pro-input"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="DRAFT">Borrador</option>
              <option value="MATERIALS_RESERVED">Materiales reservados</option>
              <option value="IN_PRODUCTION">En producción</option>
              <option value="COMPLETED">Completada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">Desde</label>
            <input
              type="date"
              className="df-pro-input"
              value={dateFromInput}
              onChange={(e) => setDateFromInput(e.target.value)}
            />
          </div>

          <div>
            <label className="df-pro-label">Hasta</label>
            <input
              type="date"
              className="df-pro-input"
              value={dateToInput}
              onChange={(e) => setDateToInput(e.target.value)}
            />
          </div>

          <button type="submit">Buscar</button>
          <button type="button" onClick={handleClear}>
            Limpiar
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
          <div className="df-pro-label">Órdenes</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.totalOrders}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Costo material</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {money(totals.totalMaterial)}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Mano de obra / otros</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {money(totals.totalLaborAndOther)}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Total estimado</div>
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
            Registros: <strong>{rows.length}</strong>
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
            Vista simplificada: <strong>Material + Mano de obra / otros + Total estimado</strong>
          </div>
        </div>

        {loading ? (
          <p>Cargando reporte...</p>
        ) : rows.length === 0 ? (
          <p>No hay datos para mostrar.</p>
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

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { DataGrid, type DataGridColumn } from "../../components/data-grid/DataGrid";
import "../../styles/pro-pages.css";

type ProductionCostItem = {
  id: string;
  order_number: string;
  dress: string;
  workshop: string;
  status: string;
  priority: string;
  due_date?: string | null;
  planned_quantity: number;
  produced_quantity: number;

  actual_material_cost: number;
  labor_cost: number;
  additional_cost: number;
  total_estimated: number;

  currency: string;
};

function formatMoney(value?: number, currency = "ARS") {
  const n = Number(value ?? 0);

  return (
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n) + ` ${currency}`
  );
}

export default function ProductionCostsReportPage() {
  const [rows, setRows] = useState<ProductionCostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/reports/production-costs");

      setRows(res.data.items || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          "Error al cargar el reporte de costos"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const columns = useMemo<DataGridColumn<ProductionCostItem>[]>(() => {
    return [
      {
        key: "order_number",
        label: "Orden",
      },
      {
        key: "dress",
        label: "Vestido",
      },
      {
        key: "workshop",
        label: "Taller",
      },
      {
        key: "actual_material_cost",
        label: "Material",
        render: (row) =>
          formatMoney(row.actual_material_cost, row.currency),
      },
      {
        key: "labor",
        label: "Mano de obra / otros",
        render: (row) =>
          formatMoney(
            (row.labor_cost || 0) + (row.additional_cost || 0),
            row.currency
          ),
      },
      {
        key: "total_estimated",
        label: "Total estimado",
        render: (row) => (
          <strong>
            {formatMoney(row.total_estimated, row.currency)}
          </strong>
        ),
      },
    ];
  }, []);

  return (
    <section className="df-pro-page">
      <div className="df-pro-page__header">
        <div>
          <p className="df-pro-page__eyebrow">Reportes</p>
          <h1 className="df-pro-page__title">Costos de producción</h1>
          <p className="df-pro-page__subtitle">
            Resumen económico simplificado alineado con la orden.
          </p>
        </div>

        <button
          className="df-pro-btn"
          onClick={() =>
            window.open("/api/v1/reports/production-costs/export", "_blank")
          }
        >
          Exportar Excel
        </button>
      </div>

      {error && <div className="df-pro-error">{error}</div>}

      <div className="df-pro-card">
        {loading ? (
          <div className="df-pro-loading">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="df-pro-empty">Sin datos</div>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
          />
        )}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { DataGrid } from "../components/data-grid/DataGrid";
import "../styles/pro-pages.css";

function money(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v || 0);
}

export default function DressStockValuationReportPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/dress-stock-valuation");
      setRows(res.data.items || []);
      setKpis(res.data.kpis || {});
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    window.open("/api/v1/reports/dress-stock-valuation/export", "_blank");
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="df-pro-page">

      {/* HEADER */}
      <div className="df-pro-page__header">
        <div>
          <p className="df-pro-page__eyebrow">REPORTES</p>
          <h1 className="df-pro-page__title">Stock valorizado de vestidos</h1>
          <p className="df-pro-page__subtitle">
            Valor del inventario de vestidos disponible para venta y alquiler.
          </p>
        </div>

        <button className="df-pro-btn" onClick={exportExcel}>
          Exportar Excel
        </button>
      </div>

      {/* HERO CARD */}
      <div className="df-pro-hero">
        <div className="df-pro-hero__content">
          <span className="df-pro-hero__label">TOTAL INVENTARIO</span>
          <h2 className="df-pro-hero__value">
            {money((kpis.total_sale_value || 0) + (kpis.total_rental_value || 0))}
          </h2>
          <p className="df-pro-hero__subtitle">
            Suma de valor de venta + alquiler
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="df-pro-kpis">
        <div className="df-pro-kpi">
          <span>Total vestidos</span>
          <strong>{kpis.total_items || 0}</strong>
        </div>

        <div className="df-pro-kpi">
          <span>Disponibles</span>
          <strong>{kpis.available_items || 0}</strong>
        </div>

        <div className="df-pro-kpi">
          <span>Valor venta</span>
          <strong>{money(kpis.total_sale_value)}</strong>
        </div>

        <div className="df-pro-kpi">
          <span>Valor alquiler</span>
          <strong>{money(kpis.total_rental_value)}</strong>
        </div>
      </div>

      {/* GRID */}
      <div className="df-pro-card">
        {loading ? (
          <div className="df-pro-loading">Cargando...</div>
        ) : rows.length === 0 ? (
          <div className="df-pro-empty">Sin datos</div>
        ) : (
          <DataGrid
            rows={rows}
            getRowKey={(r) => r.id}
            columns={[
              { key: "code", label: "Código" },
              { key: "name", label: "Vestido" },
              { key: "capsule", label: "Cápsula" },
              { key: "size", label: "Talle" },
              { key: "color", label: "Color" },
              { key: "status", label: "Estado" },

              {
                key: "sale_price",
                label: "Precio venta",
                render: (r) => money(r.sale_price),
              },
              {
                key: "rental_price",
                label: "Precio alquiler",
                render: (r) => money(r.rental_price),
              },

              {
                key: "sale_value",
                label: "Valor venta",
                render: (r) => money(r.sale_price),
              },
              {
                key: "rental_value",
                label: "Valor alquiler",
                render: (r) => money(r.rental_price),
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}

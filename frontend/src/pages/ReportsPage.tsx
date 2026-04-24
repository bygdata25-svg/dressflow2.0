import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "./DressesPage.css";

type StockValuationRow = {
  id: string;
  name: string;
  color?: string | null;
  total_stock_meters: number;
  average_price_per_meter: number;
  total_value: number;
};

type StockValuationResponse = {
  items: StockValuationRow[];
  total: number;
  grand_total: number;
};

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export default function ReportsPage() {
  const [rows, setRows] = useState<StockValuationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [grandTotal, setGrandTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<StockValuationResponse>("/reports/stock-valuation", {
        params: {
          search: search || undefined,
        },
      });

      setRows(response.data.items || []);
      setGrandTotal(response.data.grand_total || 0);
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

      const response = await api.get("/reports/stock-valuation/export", {
        params: {
          search: search || undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "stock_valorizado.xlsx";
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

  const columns = useMemo<DataGridColumn<StockValuationRow>[]>(() => {
    return [
      {
        key: "name",
        label: "Tela",
        render: (row) => row.name,
      },
      {
        key: "color",
        label: "Color",
        render: (row) => row.color || "—",
      },
      {
        key: "total_stock_meters",
        label: "Stock (mts)",
        render: (row) => number(row.total_stock_meters),
      },
      {
        key: "average_price_per_meter",
        label: "Precio x metro",
        render: (row) =>
          row.average_price_per_meter > 0
            ? money(row.average_price_per_meter)
            : "—",
      },
      {
        key: "total_value",
        label: "Valor total",
        render: (row) => <strong>{money(row.total_value)}</strong>,
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
          <h1 className="df-pro-page__title">Stock valorizado</h1>
          <p className="df-pro-page__subtitle">
            Visualizá el stock actual de telas valorizado por precio por metro.
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
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--3">
          <div>
            <label className="df-pro-label">Buscar</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tela o color"
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
            Total valorizado: <strong>{money(grandTotal)}</strong>
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
            getRowKey={(row) => row.id}
          />
        )}
      </section>
    </section>
  );
}

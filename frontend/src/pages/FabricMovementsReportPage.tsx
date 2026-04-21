import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "./DressesPage.css";

type FabricMovementRow = {
  id: string;
  created_at: string | null;
  type: string;
  quantity: number;
  reference?: string | null;
  notes?: string | null;
  movement_reason?: string | null;
  fabric_name?: string | null;
  fabric_color?: string | null;
  roll_code?: string | null;
};

type FabricMovementsResponse = {
  items: FabricMovementRow[];
  total: number;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function movementLabel(value: string) {
  switch ((value || "").toUpperCase()) {
    case "IN":
      return "Entrada";
    case "OUT":
      return "Salida";
    case "ADJUST":
      return "Ajuste";
    default:
      return value || "—";
  }
}

function movementStyles(value: string) {
  switch ((value || "").toUpperCase()) {
    case "IN":
      return {
        background: "#ecfdf3",
        color: "#027a48",
      };
    case "OUT":
      return {
        background: "#fdecec",
        color: "#b42318",
      };
    case "ADJUST":
      return {
        background: "#f4ede3",
        color: "#8b5e34",
      };
    default:
      return {
        background: "#f4f4f5",
        color: "#52525b",
      };
  }
}

export default function FabricMovementsReportPage() {
  const [rows, setRows] = useState<FabricMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<FabricMovementsResponse>("/reports/fabric-movements", {
        params: {
          search: search || undefined,
          movement_type: movementType || undefined,
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
  }, [search, movementType, dateFrom, dateTo]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleClear = () => {
    setSearchInput("");
    setSearch("");
    setMovementType("");
    setDateFrom("");
    setDateTo("");
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");

      const response = await api.get("/reports/fabric-movements/export", {
        params: {
          search: search || undefined,
          movement_type: movementType || undefined,
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
      link.download = "movimientos_tela.xlsx";
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

  const columns = useMemo<DataGridColumn<FabricMovementRow>[]>(() => {
    return [
      {
        key: "created_at",
        label: "Fecha",
        render: (row) => formatDate(row.created_at),
      },
      {
        key: "type",
        label: "Tipo",
        render: (row) => {
          const styles = movementStyles(row.type);
          return (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                background: styles.background,
                color: styles.color,
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {movementLabel(row.type)}
            </span>
          );
        },
      },
      {
        key: "fabric_name",
        label: "Tela",
        render: (row) => row.fabric_name || "—",
      },
      {
        key: "fabric_color",
        label: "Color",
        render: (row) => row.fabric_color || "—",
      },
      {
        key: "roll_code",
        label: "Rollo",
        render: (row) => row.roll_code || "—",
      },
      {
        key: "quantity",
        label: "Cantidad",
        render: (row) => formatNumber(row.quantity),
      },
      {
        key: "notes",
        label: "Notas",
        render: (row) => row.notes || "—",
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
          <h1 className="df-pro-page__title">Movimientos de tela</h1>
          <p className="df-pro-page__subtitle">
            Consultá entradas, salidas y ajustes de rollos, con exportación a Excel.
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
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "380px 180px 180px 180px auto",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div>
            <label className="df-pro-label">Buscar</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tela, color, rollo o nota"
            />
          </div>

          <div>
            <label className="df-pro-label">Tipo</label>
            <select
              className="df-pro-select"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="ADJUST">Ajuste</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">Desde</label>
            <input
              className="df-pro-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="df-pro-label">Hasta</label>
            <input
              className="df-pro-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button type="submit">Buscar</button>
            <button type="button" onClick={handleClear}>
              Limpiar
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

      <section className="df-pro-card">
        <div style={{ color: "#8a7f78", fontSize: 14, marginBottom: 16 }}>
          Registros: <strong>{rows.length}</strong>
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

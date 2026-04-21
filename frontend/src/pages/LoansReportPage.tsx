import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "./DressesPage.css";

type LoansReportRow = {
  id: string;
  start_date?: string | null;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  status: string;
  effective_status?: string | null;
  loan_type?: string | null;
  amount?: number | null;
  customer_name?: string | null;
  notes?: string | null;
  dress_code?: string | null;
  dress_name?: string | null;
};

type LoansReportResponse = {
  items: LoansReportRow[];
  total: number;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(date);
}

function money(value?: number | null) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n) || value == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function statusLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "ACTIVE") return "Activo";
  if (raw === "LATE") return "Vencido";
  if (raw === "RETURNED") return "Devuelto";
  return value || "—";
}

function typeLabel(value?: string | null) {
  return String(value || "").toUpperCase() === "RENTAL" ? "Alquiler" : "Préstamo";
}

export default function LoansReportPage() {
  const [rows, setRows] = useState<LoansReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [statusInput, setStatusInput] = useState("");
  const [status, setStatus] = useState("");

  const [loanTypeInput, setLoanTypeInput] = useState("");
  const [loanType, setLoanType] = useState("");

  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [exporting, setExporting] = useState(false);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<LoansReportResponse>("/reports/loans", {
        params: {
          search: search || undefined,
          status: status || undefined,
          loan_type: loanType || undefined,
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
  }, [search, status, loanType, dateFrom, dateTo]);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSearch(searchInput.trim());
    setStatus(statusInput);
    setLoanType(loanTypeInput);
    setDateFrom(dateFromInput);
    setDateTo(dateToInput);
  };

  const handleClear = () => {
    setSearchInput("");
    setSearch("");
    setStatusInput("");
    setStatus("");
    setLoanTypeInput("");
    setLoanType("");
    setDateFromInput("");
    setDateToInput("");
    setDateFrom("");
    setDateTo("");
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      setError("");

      const response = await api.get("/reports/loans/export", {
        params: {
          search: search || undefined,
          status: status || undefined,
          loan_type: loanType || undefined,
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
      link.download = "prestamos_alquileres.xlsx";
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
    const rentals = rows.filter((row) => String(row.loan_type || "").toUpperCase() === "RENTAL");
    const loans = rows.filter((row) => String(row.loan_type || "").toUpperCase() !== "RENTAL");
    const active = rows.filter((row) => String(row.effective_status || row.status).toUpperCase() === "ACTIVE");
    const late = rows.filter((row) => String(row.effective_status || row.status).toUpperCase() === "LATE");
    const rentalRevenue = rentals.reduce((acc, row) => acc + Number(row.amount || 0), 0);

    return {
      total: rows.length,
      loans: loans.length,
      rentals: rentals.length,
      active: active.length,
      late: late.length,
      rentalRevenue,
    };
  }, [rows]);

  const columns = useMemo<DataGridColumn<LoansReportRow>[]>(() => {
    return [
      {
        key: "loan_type",
        label: "Tipo",
        render: (row) => typeLabel(row.loan_type),
      },
      {
        key: "dress",
        label: "Vestido",
        render: (row) =>
          row.dress_code ? (
            <strong>{`${row.dress_code} - ${row.dress_name || ""}`}</strong>
          ) : (
            "—"
          ),
      },
      {
        key: "customer_name",
        label: "Cliente",
        render: (row) => row.customer_name || "—",
      },
      {
        key: "start_date",
        label: "Inicio",
        render: (row) => formatDate(row.start_date),
      },
      {
        key: "expected_return_date",
        label: "Vencimiento",
        render: (row) => formatDate(row.expected_return_date),
      },
      {
        key: "actual_return_date",
        label: "Devolución",
        render: (row) => formatDate(row.actual_return_date),
      },
      {
        key: "amount",
        label: "Valor",
        render: (row) =>
          String(row.loan_type || "").toUpperCase() === "RENTAL" ? money(row.amount) : "—",
      },
      {
        key: "effective_status",
        label: "Estado",
        render: (row) => statusLabel(row.effective_status || row.status),
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
          <h1 className="df-pro-page__title">Préstamos / Alquileres</h1>
          <p className="df-pro-page__subtitle">
            Consultá préstamos activos, vencidos y devueltos, incluyendo alquileres y valor acumulado.
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
              placeholder="Vestido, cliente o nota"
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
              <option value="ACTIVE">Activos</option>
              <option value="LATE">Vencidos</option>
              <option value="RETURNED">Devueltos</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">Tipo</label>
            <select
              className="df-pro-input"
              value={loanTypeInput}
              onChange={(e) => setLoanTypeInput(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="LOAN">Préstamos</option>
              <option value="RENTAL">Alquileres</option>
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
          <div className="df-pro-label">Registros</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.total}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Préstamos</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.loans}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Alquileres</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.rentals}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Activos</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.active}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Vencidos</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {totals.late}
          </div>
        </div>

        <div className="df-pro-card">
          <div className="df-pro-label">Ingresos por alquiler</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#3d3648" }}>
            {money(totals.rentalRevenue)}
          </div>
        </div>
      </section>

      <section className="df-pro-card">
        {loading ? (
          <p>Cargando reporte...</p>
        ) : rows.length === 0 ? (
          <p>No hay datos para mostrar.</p>
        ) : (
          <DataGrid rows={rows} columns={columns} getRowKey={(row) => row.id} />
        )}
      </section>
    </section>
  );
}

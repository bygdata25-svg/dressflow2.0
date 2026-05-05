import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
    case "ADJUSTMENT":
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
  const { t, i18n } = useTranslation("fabric-movements-report");
  const { t: tc } = useTranslation("common");

  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [rows, setRows] = useState<FabricMovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [movementType, setMovementType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  function formatDate(value: string | null) {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }

  function formatNumber(value: number) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0);
  }

  function movementLabel(value: string) {
    const raw = String(value || "").toUpperCase();
    return t(`types.${raw}`, { defaultValue: value || "—" });
  }

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

      const lang = i18n.language?.startsWith("en") ? "en" : "es";

      const response = await api.get("/reports/fabric-movements/export", {
        params: {
          search: search || undefined,
          movement_type: movementType || undefined,
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
      link.download = lang === "en" ? "fabric_movements.xlsx" : "movimientos_tela.xlsx";
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

  const columns = useMemo<DataGridColumn<FabricMovementRow>[]>(() => {
    return [
      {
        key: "created_at",
        label: t("fields.date"),
        render: (row) => formatDate(row.created_at),
      },
      {
        key: "type",
        label: t("fields.type"),
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
        label: t("fields.fabric"),
        render: (row) => row.fabric_name || "—",
      },
      {
        key: "fabric_color",
        label: t("fields.color"),
        render: (row) => row.fabric_color || "—",
      },
      {
        key: "roll_code",
        label: t("fields.roll"),
        render: (row) => row.roll_code || "—",
      },
      {
        key: "quantity",
        label: t("fields.quantity"),
        render: (row) => formatNumber(row.quantity),
      },
      {
        key: "reference",
        label: t("fields.reference"),
        render: (row) => row.reference || "—",
      },
      {
        key: "notes",
        label: t("fields.notes"),
        render: (row) => row.notes || "—",
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
            <label className="df-pro-label">{t("filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("filters.searchPlaceholder")}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("filters.type")}</label>
            <select
              className="df-pro-select"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="">{t("filters.all")}</option>
              <option value="IN">{t("types.IN")}</option>
              <option value="OUT">{t("types.OUT")}</option>
              <option value="ADJUST">{t("types.ADJUST")}</option>
              <option value="ADJUSTMENT">{t("types.ADJUSTMENT")}</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("filters.from")}</label>
            <input
              className="df-pro-input"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("filters.to")}</label>
            <input
              className="df-pro-input"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <button type="submit">{tc("actions.search")}</button>
            <button type="button" onClick={handleClear}>
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

      <section className="df-pro-card">
        <div style={{ color: "#8a7f78", fontSize: 14, marginBottom: 16 }}>
          {t("summary.records")}: <strong>{rows.length}</strong>
        </div>

        {loading ? (
          <p>{t("messages.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("empty")}</p>
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

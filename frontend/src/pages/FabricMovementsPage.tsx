import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "../styles/pro-pages.css";

type Roll = {
  id: string;
  roll_code: string;
  fabric_name?: string | null;
  status: string;
  current_length?: number | string | null;
  reserved_length?: number | string | null;
};

type Movement = {
  id: string;
  fabric_roll_id: string;
  type: string;
  quantity: string;
  reference?: string | null;
  notes?: string | null;
  roll_code?: string | null;
  fabric_name?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

const PAGE_SIZE = 20;

export default function FabricMovementsPage() {
  const { t } = useTranslation(["common", "fabric-movements"]);

  const [rows, setRows] = useState<Movement[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [form, setForm] = useState({
    fabric_roll_id: "",
    type: "OUT",
    quantity: "",
    reference: "",
    notes: "",
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectableRolls = useMemo(() => {
    return rolls.filter((roll) => {
      const status = String(roll.status || "").toUpperCase();
      const current = Number(roll.current_length || 0);

      if (!["AVAILABLE", "LOW_STOCK", "RESERVED", "DEPLETED"].includes(status)) {
        return false;
      }

      if (form.type === "OUT" && current <= 0) {
        return false;
      }

      return true;
    });
  }, [rolls, form.type]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [movementsResponse, rollsResponse] = await Promise.all([
        api.get<PaginatedResponse<Movement>>("/fabric-movements", {
          params: {
            page,
            page_size: PAGE_SIZE,
            search: search || undefined,
            type: typeFilter || undefined,
          },
        }),
        api.get<PaginatedResponse<Roll>>("/fabric-rolls", {
          params: {
            page: 1,
            page_size: 100,
          },
        }),
      ]);

      setRows(Array.isArray(movementsResponse.data.items) ? movementsResponse.data.items : []);
      setTotal(Number(movementsResponse.data.total || 0));
      setRolls(Array.isArray(rollsResponse.data.items) ? rollsResponse.data.items : []);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("fabric-movements:form.messages.error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [page, search, typeFilter]);

  const createMovement = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setError("");

      await api.post("/fabric-movements", {
        fabric_roll_id: form.fabric_roll_id,
        type: form.type,
        quantity: Number(form.quantity),
        reference: form.reference || null,
        notes: form.notes || null,
      });

      setForm({
        fabric_roll_id: "",
        type: "OUT",
        quantity: "",
        reference: "",
        notes: "",
      });

      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("fabric-movements:form.messages.error"));
    }
  };

  const columns = useMemo<DataGridColumn<Movement>[]>(() => {
    return [
      {
        key: "roll_code",
        label: t("fabric-movements:fields.roll"),
        render: (row) => row.roll_code || "-",
      },
      {
        key: "fabric_name",
        label: t("fabric-movements:fields.fabric"),
        render: (row) => row.fabric_name || "-",
      },
      {
        key: "type",
        label: t("fabric-movements:fields.type"),
        render: (row) => (
          <span className={`df-status-badge df-status-badge--${row.type.toLowerCase()}`}>
            {t(`fabric-movements:types.${row.type}`, { defaultValue: row.type })}
          </span>
        ),
      },
      {
        key: "quantity",
        label: t("fabric-movements:fields.quantity"),
        render: (row) => row.quantity,
      },
      {
        key: "reference",
        label: t("fabric-movements:fields.reference"),
        render: (row) => row.reference || "-",
      },
      {
        key: "notes",
        label: t("fabric-movements:fields.notes"),
        render: (row) => row.notes || "-",
      },
    ];
  }, [t]);

  return (
    <section className="df-pro-page">
      <header className="df-pro-page__hero">
        <div>
          <p className="df-pro-page__eyebrow">{t("fabric-movements:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("fabric-movements:title")}</h1>
          <p className="df-pro-page__subtitle">{t("fabric-movements:hero.subtitle")}</p>
        </div>
      </header>

      <section className="df-pro-card">
        <form onSubmit={createMovement} className="df-pro-form-grid df-pro-form-grid--6">
          <div>
            <label className="df-pro-label">{t("fabric-movements:fields.roll")}</label>
            <select
              className="df-pro-select"
              value={form.fabric_roll_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, fabric_roll_id: e.target.value }))
              }
            >
              <option value="">{t("fabric-movements:form.placeholders.roll")}</option>
              {selectableRolls.map((roll) => (
                <option key={roll.id} value={roll.id}>
                  {roll.roll_code} - {roll.fabric_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("fabric-movements:fields.type")}</label>
            <select
              className="df-pro-select"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            >
              <option value="IN">{t("fabric-movements:types.IN")}</option>
              <option value="OUT">{t("fabric-movements:types.OUT")}</option>
              <option value="ADJUSTMENT">{t("fabric-movements:types.ADJUSTMENT")}</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("fabric-movements:fields.quantity")}</label>
            <input
              className="df-pro-input"
              placeholder={t("fabric-movements:form.placeholders.quantity")}
              type="number"
              step="0.01"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("fabric-movements:fields.reference")}</label>
            <input
              className="df-pro-input"
              placeholder={t("fabric-movements:form.placeholders.reference")}
              value={form.reference}
              onChange={(e) => setForm((prev) => ({ ...prev, reference: e.target.value }))}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("fabric-movements:fields.notes")}</label>
            <input
              className="df-pro-input"
              placeholder={t("fabric-movements:form.placeholders.notes")}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <button type="submit">{t("common:actions.create")}</button>
        </form>
      </section>

      <section className="df-pro-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="df-pro-filter-grid df-pro-filter-grid--4"
        >
          <div>
            <label className="df-pro-label">{t("fabric-movements:filters.search")}</label>
            <input
              className="df-pro-input"
              placeholder={t("fabric-movements:filters.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("fabric-movements:filters.type")}</label>
            <select
              className="df-pro-select"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
            >
              <option value="">{t("fabric-movements:filters.allTypes")}</option>
              <option value="IN">{t("fabric-movements:types.IN")}</option>
              <option value="OUT">{t("fabric-movements:types.OUT")}</option>
              <option value="ADJUSTMENT">{t("fabric-movements:types.ADJUSTMENT")}</option>
            </select>
          </div>

          <button type="submit">{t("common:actions.search")}</button>

          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setTypeFilter("");
              setPage(1);
            }}
          >
            {t("common:actions.clear")}
          </button>
        </form>
      </section>

      {loading && <p>{t("common:status.loading")}</p>}

      {error && <p>{error}</p>}

      {!loading && rows.length > 0 && (
        <section className="df-pro-card">
          <DataGrid rows={rows} columns={columns} getRowKey={(row) => row.id} />
        </section>
      )}

      {!loading && rows.length === 0 && <p>{t("fabric-movements:empty")}</p>}

      <footer className="df-pro-pagination">
        <div>
          {t("common:pagination.showing")} {rows.length} / {total}
        </div>

        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            {t("common:pagination.previous")}
          </button>

          <span>
            {t("common:pagination.page")} {page} {t("common:pagination.of")} {totalPages}
          </span>

          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            {t("common:pagination.next")}
          </button>
        </div>
      </footer>
    </section>
  );
}

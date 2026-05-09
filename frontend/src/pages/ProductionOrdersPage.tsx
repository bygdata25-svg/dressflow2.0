import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { Modal } from "../components/common/Modal";
import ProductionOrderDetailPanel from "../components/production-orders/ProductionOrderDetailPanel";
import "../styles/pro-pages.css";
import "../styles/production-orders.css";

type Supplier = {
  id: string;
  name: string;
  supplier_type: string;
};

type ProductionOrderListItem = {
  id: string;
  order_number: string;
  workshop_supplier_id: string;
  workshop_supplier_name?: string | null;
  target_dress_name: string;
  target_dress_code?: string | null;
  target_size?: string | null;
  target_color?: string | null;
  planned_quantity: number;
  produced_quantity: number;
  status: string;
  priority: string;
  due_date?: string | null;
  notes?: string | null;
  design_photo_url?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

const PAGE_SIZE = 20;

const INITIAL_FORM = {
  order_number: "",
  workshop_supplier_id: "",
  target_dress_name: "",
  target_dress_code: "",
  target_size: "",
  target_color: "",
  planned_quantity: "1",
  priority: "NORMAL",
  due_date: "",
  notes: "",
  design_photo_url: "",
};

function formatDate(value?: string | null, locale = "es-AR") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatShortDate(value?: string | null, locale = "es-AR") {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function isOverdue(row: ProductionOrderListItem) {
  if (!row.due_date) return false;
  if (row.status === "COMPLETED" || row.status === "CANCELLED") return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(`${row.due_date}T00:00:00`);
  if (Number.isNaN(due.getTime())) return false;

  return due < today;
}

function getProgressPercent(row: {
  planned_quantity: number;
  produced_quantity: number;
}) {
  if (!row.planned_quantity || row.planned_quantity <= 0) return 0;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round((row.produced_quantity / row.planned_quantity) * 100)
    )
  );
}

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "LOW":
      return "df-status-badge df-status-badge--available";
    case "NORMAL":
      return "df-status-badge df-status-badge--draft";
    case "HIGH":
      return "df-status-badge df-status-badge--maintenance";
    case "URGENT":
      return "df-status-badge df-status-badge--cancelled";
    default:
      return "df-status-badge df-status-badge--draft";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT":
      return "df-status-badge df-status-badge--draft";
    case "MATERIALS_RESERVED":
      return "df-status-badge df-status-badge--materials_reserved";
    case "IN_PRODUCTION":
      return "df-status-badge df-status-badge--in_production";
    case "COMPLETED":
      return "df-status-badge df-status-badge--completed";
    case "CANCELLED":
      return "df-status-badge df-status-badge--cancelled";
    default:
      return "df-status-badge df-status-badge--draft";
  }
}

function getOperationalIcon(status: string) {
  switch (status) {
    case "DRAFT":
      return "✦";
    case "MATERIALS_RESERVED":
      return "◈";
    case "IN_PRODUCTION":
      return "✂";
    case "COMPLETED":
      return "✓";
    case "CANCELLED":
      return "×";
    default:
      return "•";
  }
}

function getOperationalHint(t: any, row: ProductionOrderListItem) {
  return t(`production-orders:operationalHints.${row.status}`, {
    defaultValue: row.status || "-",
  });
}

function translateStatus(t: any, status: string) {
  return t(`production-orders:status.${status}`, {
    defaultValue: status,
  });
}

function translatePriority(t: any, priority: string) {
  return t(`production-orders:priority.${priority}`, {
    defaultValue: priority,
  });
}

function resolveDesignPhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("blob:") || photoUrl.startsWith("data:")) return photoUrl;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;

  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "")?.replace(/\/$/, "") || "";

  return `${apiBaseUrl}/${photoUrl.replace(/^\/+/, "")}`;
}

function ProductionOrderWorkflowCard({
  row,
  selected,
  locale,
  t,
  onSelect,
}: {
  row: ProductionOrderListItem;
  selected: boolean;
  locale: string;
  t: any;
  onSelect: () => void;
}) {
  const percent = getProgressPercent(row);
  const overdue = isOverdue(row);
  const photoUrl = resolveDesignPhotoUrl(row.design_photo_url);

  const metaParts = [
    row.target_dress_code
      ? `${t("production-orders:fields.codeShort", "Cód.")} ${row.target_dress_code}`
      : null,
    row.target_size
      ? `${t("production-orders:fields.size", "Talle")} ${row.target_size}`
      : null,
    row.target_color || null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className={`po-workflow-card ${selected ? "po-workflow-card--active" : ""}`}
      onClick={onSelect}
    >
      <div className="po-workflow-card__main">
        <div className="po-workflow-card__visual">
          {photoUrl ? (
            <img src={photoUrl} alt={row.target_dress_name} />
          ) : (
            <span>{getOperationalIcon(row.status)}</span>
          )}
        </div>

        <div className="po-workflow-card__content">
          <div className="po-workflow-card__top">
            <div>
              <div className="po-workflow-card__number">{row.order_number}</div>
              <h3 className="po-workflow-card__title">{row.target_dress_name}</h3>

              <div className="po-workflow-card__meta">
                {metaParts.length > 0 ? (
                  metaParts.map((item) => <span key={String(item)}>{item}</span>)
                ) : (
                  <span>{t("production-orders:fields.noGarmentDetails", "Sin detalles de prenda")}</span>
                )}
              </div>
            </div>

            <div className="po-workflow-card__badges">
              {overdue ? (
                <span className="df-status-badge df-status-badge--cancelled">
                  {t("production-orders:date.overdue", "Atrasada")}
                </span>
              ) : null}

              <span className={getStatusBadgeClass(row.status)}>
                {translateStatus(t, row.status)}
              </span>
            </div>
          </div>

          <div className="po-workflow-card__middle">
            <div className="po-workflow-card__stage">
              <span className="po-workflow-card__stage-icon">
                {getOperationalIcon(row.status)}
              </span>

              <div>
                <strong>{getOperationalHint(t, row)}</strong>
                <small>
                  {row.workshop_supplier_name ||
                    t("production-orders:fields.noWorkshopAssigned", "Sin taller asignado")}
                </small>
              </div>
            </div>

            <div className="po-workflow-card__date">
              <span>{t("production-orders:fields.dueDate", "Entrega")}</span>
              <strong>
                {row.due_date
                  ? formatShortDate(row.due_date, locale)
                  : t("production-orders:date.noDate", "Sin fecha")}
              </strong>
            </div>
          </div>

          <div className="po-workflow-card__progress">
            <div className="po-workflow-card__progress-top">
              <span>
                {row.produced_quantity} / {row.planned_quantity}{" "}
                {t("production-orders:fields.units", "unidades")}
              </span>
              <strong>{percent}%</strong>
            </div>

            <div className="po-progress-track">
              <div className="po-progress-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="po-workflow-card__footer">
            <span className={getPriorityBadgeClass(row.priority)}>
              {translatePriority(t, row.priority)}
            </span>

            <span className="po-workflow-card__soft">
              {row.due_date
                ? formatDate(row.due_date, locale)
                : t("production-orders:date.noDate", "Sin fecha")}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function ProductionOrdersPage() {
  const { t, i18n } = useTranslation(["common", "production-orders"]);
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<ProductionOrderListItem[]>([]);
  const [workshops, setWorkshops] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const selectedOrderId = searchParams.get("order");
  const locale = i18n.language === "en" ? "en-US" : "es-AR";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const setSelectedOrderId = (orderId: string | null) => {
    const next = new URLSearchParams(searchParams);

    if (orderId) {
      next.set("order", orderId);
      if (!next.get("tab")) next.set("tab", "operation");
    } else {
      next.delete("order");
      next.delete("tab");
    }

    setSearchParams(next, { replace: true });
  };

  const closeCreateModal = () => {
    if (creating) return;
    setIsCreateOpen(false);
    setForm(INITIAL_FORM);
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const [ordersResponse, suppliersResponse] = await Promise.all([
        api.get<PaginatedResponse<ProductionOrderListItem>>("/production-orders", {
          params: {
            page,
            page_size: PAGE_SIZE,
            search: search || undefined,
            status: statusFilter || undefined,
          },
        }),
        api.get<PaginatedResponse<Supplier>>("/suppliers", {
          params: { page: 1, page_size: 100 },
        }),
      ]);

      const nextRows = Array.isArray(ordersResponse.data.items)
        ? ordersResponse.data.items
        : [];

      setRows(nextRows);
      setTotal(Number(ordersResponse.data.total || 0));

      const supplierItems = Array.isArray(suppliersResponse.data.items)
        ? suppliersResponse.data.items
        : [];

      setWorkshops(
        supplierItems.filter(
          (item) => item.supplier_type === "WORKSHOP" || item.supplier_type === "BOTH"
        )
      );

      if (!selectedOrderId && nextRows.length > 0) {
        setSelectedOrderId(nextRows[0].id);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          t(
            "production-orders:messages.loadError",
            "No se pudieron cargar las órdenes."
          )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setCreating(true);
      setError("");

      const res = await api.post("/production-orders", {
        order_number: form.order_number.trim() || null,
        workshop_supplier_id: form.workshop_supplier_id,
        target_dress_name: form.target_dress_name,
        target_dress_code: form.target_dress_code || null,
        target_size: form.target_size || null,
        target_color: form.target_color || null,
        planned_quantity: Number(form.planned_quantity),
        priority: form.priority,
        due_date: form.due_date || null,
        notes: form.notes || null,
        design_photo_url: form.design_photo_url || null,
      });

      setForm(INITIAL_FORM);
      setIsCreateOpen(false);

      if (page !== 1) {
        setPage(1);
      } else {
        await loadOrders();
      }

      if (res?.data?.id) {
        setSelectedOrderId(res.data.id);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          t("production-orders:form.messages.error", "No se pudo crear la orden.")
      );
    } finally {
      setCreating(false);
    }
  };

  const summary = useMemo(() => {
    const draft = rows.filter((row) => row.status === "DRAFT").length;
    const reserved = rows.filter((row) => row.status === "MATERIALS_RESERVED").length;
    const inProduction = rows.filter((row) => row.status === "IN_PRODUCTION").length;
    const completed = rows.filter((row) => row.status === "COMPLETED").length;
    const overdue = rows.filter((row) => isOverdue(row)).length;

    return {
      draft,
      reserved,
      inProduction,
      completed,
      overdue,
    };
  }, [rows]);

  return (
    <section className="df-pro-page po-orders-page">
      <div className="po-orders-shell">
        <div className="po-orders-master">
          <section className="po-orders-hero df-pro-card">
            <div className="po-orders-hero__top">
              <div>
                <p className="df-pro-page__eyebrow">
                  {t("production-orders:page.eyebrow", "Producción")}
                </p>

                <h1 className="df-pro-page__title">
                  {t("production-orders:page.title", "Órdenes de producción")}
                </h1>

                <p className="df-pro-page__subtitle">
                  {t(
                    "production-orders:page.subtitle",
                    "Seguimiento operativo y financiero en una sola vista de trabajo."
                  )}
                </p>
              </div>

              <div className="po-orders-hero__actions">
                <button
                  type="button"
                  className="po-secondary-btn"
                  onClick={() => loadOrders()}
                >
                  {t("production-orders:actions.refresh", "Actualizar")}
                </button>

                <button
                  type="button"
                  className="po-primary-btn"
                  onClick={() => setIsCreateOpen(true)}
                >
                  {t("production-orders:actions.new", "Nueva orden")}
                </button>
              </div>
            </div>

            <div className="po-orders-kpis">
              <div className="po-orders-kpi">
                <span className="po-orders-kpi__label">
                  {t("production-orders:kpis.draft", "Borrador")}
                </span>
                <strong className="po-orders-kpi__value">{summary.draft}</strong>
              </div>

              <div className="po-orders-kpi">
                <span className="po-orders-kpi__label">
                  {t("production-orders:kpis.reserved", "Reservadas")}
                </span>
                <strong className="po-orders-kpi__value">{summary.reserved}</strong>
              </div>

              <div className="po-orders-kpi">
                <span className="po-orders-kpi__label">
                  {t("production-orders:kpis.inProduction", "En producción")}
                </span>
                <strong className="po-orders-kpi__value">{summary.inProduction}</strong>
              </div>

              <div className="po-orders-kpi">
                <span className="po-orders-kpi__label">
                  {t("production-orders:kpis.completed", "Completadas")}
                </span>
                <strong className="po-orders-kpi__value">{summary.completed}</strong>
              </div>

              <div className="po-orders-kpi po-orders-kpi--alert">
                <span className="po-orders-kpi__label">
                  {t("production-orders:kpis.overdue", "Vencidas")}
                </span>
                <strong className="po-orders-kpi__value">{summary.overdue}</strong>
              </div>
            </div>
          </section>

          {error && !isCreateOpen ? <div className="po-inline-error">{error}</div> : null}

          <section className="po-filters-card">
            <div className="po-filters-card__top">
              <div>
                <h2 className="po-filters-card__title">
                  {t("production-orders:filters.title", "Listado de órdenes")}
                </h2>

                <p className="po-filters-card__subtitle">
                  {t(
                    "production-orders:filters.subtitle",
                    "Filtrá por número, taller, vestido, talle o código."
                  )}
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
              className="po-orders-filter-grid"
            >
              <div>
                <label className="df-pro-label">
                  {t("production-orders:filters.search", "Buscar")}
                </label>

                <input
                  className="df-pro-input"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t(
                    "production-orders:filters.searchPlaceholder",
                    "Buscar por orden o vestido"
                  )}
                />
              </div>

              <div>
                <label className="df-pro-label">
                  {t("production-orders:filters.status", "Estado")}
                </label>

                <select
                  className="df-pro-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setPage(1);
                    setStatusFilter(e.target.value);
                  }}
                >
                  <option value="">
                    {t("production-orders:filters.allStatuses", "Todos los estados")}
                  </option>
                  <option value="DRAFT">{t("production-orders:status.DRAFT")}</option>
                  <option value="MATERIALS_RESERVED">
                    {t("production-orders:status.MATERIALS_RESERVED")}
                  </option>
                  <option value="IN_PRODUCTION">
                    {t("production-orders:status.IN_PRODUCTION")}
                  </option>
                  <option value="COMPLETED">
                    {t("production-orders:status.COMPLETED")}
                  </option>
                  <option value="CANCELLED">
                    {t("production-orders:status.CANCELLED")}
                  </option>
                </select>
              </div>

              <button type="submit" className="po-primary-btn">
                {t("common:actions.search", "Buscar")}
              </button>

              <button
                type="button"
                className="po-secondary-btn"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setStatusFilter("");
                  setPage(1);
                }}
              >
                {t("common:actions.clear", "Limpiar")}
              </button>
            </form>
          </section>

          <section className="po-workflow-list-card">
            {loading ? (
              <div className="po-loading-state">
                <p>{t("common:status.loading", "Cargando...")}</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="po-empty-state">
                <h3>{t("production-orders:empty", "No hay órdenes")}</h3>
                <p>
                  {t(
                    "production-orders:messages.emptyFiltered",
                    "No hay órdenes para los filtros actuales."
                  )}
                </p>
              </div>
            ) : (
              <div className="po-workflow-list">
                {rows.map((row) => (
                  <ProductionOrderWorkflowCard
                    key={row.id}
                    row={row}
                    selected={selectedOrderId === row.id}
                    locale={locale}
                    t={t}
                    onSelect={() => setSelectedOrderId(row.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <footer className="df-pro-pagination">
            <div>
              {t("common:pagination.showing", "Mostrando")} {rows.length} / {total}
            </div>

            <div className="df-pro-actions-row">
              <button
                type="button"
                className="po-secondary-btn"
                onClick={() => setPage((prev) => prev - 1)}
                disabled={page <= 1}
              >
                {t("common:pagination.previous", "Anterior")}
              </button>

              <span>
                {t("common:pagination.page", "Página")} {page}{" "}
                {t("common:pagination.of", "de")} {totalPages}
              </span>

              <button
                type="button"
                className="po-secondary-btn"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= totalPages}
              >
                {t("common:pagination.next", "Siguiente")}
              </button>
            </div>
          </footer>
        </div>

        <aside className="po-orders-detail">
          {selectedOrderId ? <ProductionOrderDetailPanel orderId={selectedOrderId} /> : null}
        </aside>
      </div>

      <Modal
        open={isCreateOpen}
        onClose={closeCreateModal}
        title={t("production-orders:form.title", "Nueva orden de producción")}
        width="min(1080px, 100%)"
      >
        <form onSubmit={createOrder}>
          <div style={{ display: "grid", gap: 20 }}>
            <section>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div style={{ gridColumn: "span 4" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.orderNumber", "Número de orden")}
                  </label>

                  <input
                    className="df-pro-input"
                    value={form.order_number}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, order_number: e.target.value }))
                    }
                    placeholder={t(
                      "production-orders:form.autoPlaceholder",
                      "Automático"
                    )}
                  />

                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12,
                      color: "var(--df-text-muted, #6b7280)",
                    }}
                  >
                    {t(
                      "production-orders:form.autoHint",
                      "Dejalo vacío para generar automáticamente el próximo número OP."
                    )}
                  </p>
                </div>

                <div style={{ gridColumn: "span 4" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.workshop", "Taller")}
                  </label>

                  <select
                    className="df-pro-select"
                    value={form.workshop_supplier_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        workshop_supplier_id: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">
                      {t("production-orders:form.selectWorkshop", "Seleccionar taller")}
                    </option>

                    {workshops.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: "span 4" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.priority", "Prioridad")}
                  </label>

                  <select
                    className="df-pro-select"
                    value={form.priority}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, priority: e.target.value }))
                    }
                  >
                    <option value="LOW">{t("production-orders:priority.LOW")}</option>
                    <option value="NORMAL">
                      {t("production-orders:priority.NORMAL")}
                    </option>
                    <option value="HIGH">{t("production-orders:priority.HIGH")}</option>
                    <option value="URGENT">
                      {t("production-orders:priority.URGENT")}
                    </option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 18,
                  color: "var(--df-text-strong, #111827)",
                }}
              >
                {t("production-orders:form.targetDress", "Vestido objetivo")}
              </h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div style={{ gridColumn: "span 6" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.targetDressName", "Vestido")}
                  </label>

                  <input
                    className="df-pro-input"
                    value={form.target_dress_name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        target_dress_name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div style={{ gridColumn: "span 3" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.code", "Código")}
                  </label>

                  <input
                    className="df-pro-input"
                    value={form.target_dress_code}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        target_dress_code: e.target.value,
                      }))
                    }
                  />
                </div>

                <div style={{ gridColumn: "span 3" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.size", "Talle")}
                  </label>

                  <input
                    className="df-pro-input"
                    value={form.target_size}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, target_size: e.target.value }))
                    }
                  />
                </div>

                <div style={{ gridColumn: "span 3" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.color", "Color")}
                  </label>

                  <input
                    className="df-pro-input"
                    value={form.target_color}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, target_color: e.target.value }))
                    }
                  />
                </div>

                <div style={{ gridColumn: "span 3" }}>
                  <label className="df-pro-label">
                    {t(
                      "production-orders:fields.plannedQuantity",
                      "Cantidad planificada"
                    )}
                  </label>

                  <input
                    className="df-pro-input"
                    type="number"
                    min={1}
                    value={form.planned_quantity}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        planned_quantity: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div style={{ gridColumn: "span 3" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.dueDate", "Entrega")}
                  </label>

                  <input
                    className="df-pro-input"
                    type="date"
                    value={form.due_date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, due_date: e.target.value }))
                    }
                  />
                </div>

                <div style={{ gridColumn: "span 6" }}>
                  <label className="df-pro-label">
                    {t("production-orders:fields.designImage", "Imagen diseño")}
                  </label>

                  <input
                    className="df-pro-input"
                    value={form.design_photo_url}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        design_photo_url: e.target.value,
                      }))
                    }
                    placeholder={t(
                      "production-orders:form.imageUrlPlaceholder",
                      "URL de imagen"
                    )}
                  />

                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 12,
                      color: "var(--df-text-muted, #6b7280)",
                    }}
                  >
                    {t(
                      "production-orders:form.imageUrlHint",
                      "Podés pegar una URL de imagen del diseño o referencia de la orden."
                    )}
                  </p>
                </div>

                {form.design_photo_url ? (
                  <div style={{ gridColumn: "span 6" }}>
                    <div
                      style={{
                        border: "1px solid rgba(148, 163, 184, 0.35)",
                        borderRadius: 18,
                        padding: 10,
                        background: "rgba(248, 250, 252, 0.8)",
                      }}
                    >
                      <img
                        src={form.design_photo_url}
                        alt={t(
                          "production-orders:form.designPreview",
                          "Vista previa del diseño"
                        )}
                        style={{
                          width: "100%",
                          maxHeight: 180,
                          objectFit: "cover",
                          borderRadius: 14,
                          display: "block",
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <section>
              <h3
                style={{
                  margin: "0 0 14px",
                  fontSize: 18,
                  color: "var(--df-text-strong, #111827)",
                }}
              >
                {t("production-orders:fields.notes", "Observaciones")}
              </h3>

              <div>
                <label className="df-pro-label">
                  {t("production-orders:fields.notes", "Notas")}
                </label>

                <textarea
                  className="df-pro-input"
                  rows={4}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </section>

            {error ? <div className="po-inline-error">{error}</div> : null}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 12,
                paddingTop: 8,
              }}
            >
              <button
                type="button"
                className="po-secondary-btn"
                onClick={closeCreateModal}
                disabled={creating}
              >
                {t("common:actions.cancel", "Cancelar")}
              </button>

              <button type="submit" className="po-primary-btn" disabled={creating}>
                {creating
                  ? t("production-orders:form.creating", "Creando...")
                  : t("common:actions.create", "Crear")}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
}

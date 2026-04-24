import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import "../styles/pro-pages.css";
import ProductionOrderOperationTab from "../components/production-orders/ProductionOrderOperationTab";
import ProductionOrderFinanceTab from "../components/production-orders/ProductionOrderFinanceTab";

type ProductionOrder = {
  id: string;
  order_number: string;
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
  received_notes?: string | null;
  labor_cost: string;
  additional_cost: string;
  estimated_total_cost: string;
  actual_total_cost: string;
  currency: string;
  design_photo_url?: string | null;
  tenant_name?: string | null;
  tenant_logo_url?: string | null;
  tenant_primary_color?: string | null;
};

type CostSummary = {
  estimated_material_cost: string;
  actual_material_cost: string;
  labor_cost: string;
  additional_cost: string;
  estimated_total_cost: string;
  actual_total_cost: string;
  estimated_unit_cost: string;
  actual_unit_cost: string;
  currency: string;
};

type Material = {
  id: string;
  production_order_id: string;
  material_type: string;
  description_snapshot?: string | null;
  planned_quantity: string;
  delivered_quantity: string;
  consumed_quantity: string;
  returned_quantity: string;
  waste_quantity: string;
  unit: string;
  unit_cost_snapshot?: string | null;
  notes?: string | null;
  roll_code?: string | null;
  roll_current_length?: string | null;
  roll_reserved_length?: string | null;
  issued_at?: string | null;
  returned_at?: string | null;
};

type EventItem = {
  id: string;
  event_type: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

type OutputItem = {
  id: string;
  production_order_id: string;
  dress_id?: string | null;
  name: string;
  code?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unit_cost?: string | null;
  notes?: string | null;
};

type Roll = {
  id: string;
  roll_code: string;
  fabric_id?: string | null;
  fabric_name?: string | null;
  current_length?: string | null;
  reserved_length?: string | null;
  status?: string | null;
};

type Trim = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

type Fabric = {
  id: string;
  name: string;
  color?: string | null;
};

type FabricAvailabilityRoll = {
  id: string;
  roll_code: string;
  available_length: string;
  current_length: string;
  reserved_length: string;
  status: string;
};

type FabricAvailability = {
  fabric_id: string;
  fabric_name: string;
  status: "ok" | "warning" | "error";
  message: string;
  required_meters: string;
  total_available: string;
  largest_roll: string;
  matching_rolls: FabricAvailabilityRoll[];
  all_rolls: FabricAvailabilityRoll[];
};

function toNumber(value?: string | null) {
  return Number(value ?? 0);
}

function formatMoney(value?: string | number | null, currency = "USD") {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return `0.00 ${currency}`;
  return `${n.toFixed(2)} ${currency}`;
}

function calculateSuggestedPrice(
  unitCost?: string | number | null,
  multiplier?: string | number | null
) {
  const cost = Number(unitCost ?? 0);
  const factor = Number(multiplier ?? 0);
  if (Number.isNaN(cost) || Number.isNaN(factor)) return 0;
  return cost * factor;
}

function formatDate(value?: string | null, locale = "es-AR") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function formatDateTime(value?: string | null, locale = "es-AR") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventTone(eventType: string) {
  switch (eventType) {
    case "CREATED":
      return "draft";
    case "FABRIC_ASSIGNED":
    case "TRIM_ASSIGNED":
    case "MATERIAL_ASSIGNED":
    case "MATERIAL_RESERVED":
      return "materials_reserved";
    case "MATERIAL_ISSUED":
      return "in_production";
    case "MATERIAL_RETURNED":
      return "available";
    case "ORDER_RECEIVED":
      return "completed";
    case "OUTPUT_CREATED":
      return "sold";
    case "COSTS_UPDATED":
    case "DESIGN_IMAGE_UPDATED":
      return "maintenance";
    default:
      return "draft";
  }
}

function summarizeEvent(t: any, event: EventItem) {
  const summaryKey = `production-orders:events.summaries.${event.event_type}`;
  const fallback = t(`production-orders:events.types.${event.event_type}`, {
    defaultValue: event.event_type,
  });

  return t(summaryKey, {
    ...(event.payload || {}),
    defaultValue: fallback,
  });
}

function resolvePhoto(photoUrl?: string | null) {
  if (!photoUrl) return null;

  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) {
    return photoUrl;
  }

  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "")?.replace(/\/$/, "") || "";

  return `${apiBaseUrl}/${photoUrl.replace(/^\/+/, "")}`;
}

function payloadEntries(t: any, payload?: Record<string, unknown> | null) {
  if (!payload) return [];
  return Object.entries(payload).map(([key, value]) => {
    const label = t(`production-orders:events.payload.${key}`, {
      defaultValue: key,
    });
    return { key, label, value: String(value) };
  });
}

function materialStatusClass(status: string) {
  switch (status) {
    case "ENTREGADO":
      return "df-status-badge df-status-badge--completed";
    case "RESERVADO":
      return "df-status-badge df-status-badge--materials_reserved";
    default:
      return "df-status-badge df-status-badge--draft";
  }
}

function ProductionOrderEventsTab({
  t,
  i18n,
  latestEvents,
  expandedEvents,
  setExpandedEvents,
  formatDateTime,
  eventTone,
  summarizeEvent,
  payloadEntries,
}: {
  t: any;
  i18n: any;
  latestEvents: EventItem[];
  expandedEvents: Record<string, boolean>;
  setExpandedEvents: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  formatDateTime: (value?: string | null, locale?: string) => string;
  eventTone: (eventType: string) => string;
  summarizeEvent: (t: any, event: EventItem) => string;
  payloadEntries: (t: any, payload?: Record<string, unknown> | null) => Array<{
    key: string;
    label: string;
    value: string;
  }>;
}) {
  return (
    <section className="po-section-card">
      <div className="po-section-head">
        <h3>Movimientos de la orden</h3>
        <p>Historial completo de acciones operativas y financieras.</p>
      </div>

      <div className="po-events-list">
        {latestEvents.length === 0 ? (
          <div className="po-empty-state">Todavía no hay movimientos registrados.</div>
        ) : (
          latestEvents.map((event) => {
            const entries = payloadEntries(t, event.payload);
            const expanded = !!expandedEvents[event.id];

            return (
              <article key={event.id} className="po-event-card">
                <div className="po-event-card__top">
                  <div className="po-event-card__main">
                    <span className={`df-status-badge df-status-badge--${eventTone(event.event_type)}`}>
                      {t(`production-orders:events.types.${event.event_type}`, {
                        defaultValue: event.event_type,
                      })}
                    </span>

                    <strong className="po-event-card__summary">
                      {summarizeEvent(t, event)}
                    </strong>

                    <span className="po-soft-text">
                      {formatDateTime(
                        event.created_at,
                        i18n.language === "en" ? "en-US" : "es-AR"
                      )}
                    </span>
                  </div>

                  {entries.length > 0 ? (
                    <button
                      type="button"
                      className="po-ghost-btn"
                      onClick={() =>
                        setExpandedEvents((prev) => ({
                          ...prev,
                          [event.id]: !prev[event.id],
                        }))
                      }
                    >
                      {expanded ? "Ocultar detalle" : "Ver detalle"}
                    </button>
                  ) : null}
                </div>

                {expanded && entries.length > 0 ? (
                  <div className="po-event-card__payload">
                    {entries.map((entry) => (
                      <div key={`${event.id}-${entry.key}`} className="po-event-card__payload-row">
                        <span>{entry.label}</span>
                        <strong>{entry.value}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function ProductionOrderDetailPage() {
  const { t, i18n } = useTranslation(["common", "production-orders"]);
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [trims, setTrims] = useState<Trim[]>([]);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [issuingAll, setIssuingAll] = useState(false);

  const [fabricForm, setFabricForm] = useState({
    fabric_id: "",
    fabric_roll_id: "",
    planned_quantity: "",
    unit: "meters",
    notes: "",
  });

  const [trimForm, setTrimForm] = useState({
    trim_id: "",
    planned_quantity: "",
    notes: "",
  });

  const [receiveForm, setReceiveForm] = useState({
    produced_quantity: "",
    status: "PARTIALLY_RECEIVED",
    received_notes: "",
  });

  const [costForm, setCostForm] = useState({
    labor_cost: "0",
    additional_cost: "0",
    currency: "USD",
    price_multiplier: "2.5",
  });

  const [outputForm, setOutputForm] = useState({
    name: "",
    code: "",
    size: "",
    color: "",
    quantity: "1",
    unit_cost: "",
    notes: "",
    create_dress_records: false,
  });

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [fabricAvailability, setFabricAvailability] = useState<FabricAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [uploadingDesignImage, setUploadingDesignImage] = useState(false);
  const [designImageError, setDesignImageError] = useState("");

  const activeTab = useMemo<"operation" | "finance" | "events">(() => {
    const tab = searchParams.get("tab");
    if (tab === "finance") return "finance";
    if (tab === "events") return "events";
    return "operation";
  }, [searchParams]);

  const changeTab = (tab: "operation" | "finance" | "events") => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const [tabAnimationClass, setTabAnimationClass] = useState("po-tab-anim-enter");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab !== "operation" && tab !== "finance" && tab !== "events") {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "operation");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setTabAnimationClass("po-tab-anim-enter");
    const frame = requestAnimationFrame(() => {
      setTabAnimationClass("po-tab-anim-enter po-tab-anim-enter-active");
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        orderRes,
        costRes,
        fabricsRes,
        materialsRes,
        eventsRes,
        rollsRes,
        trimsRes,
        outputsRes,
      ] = await Promise.all([
        api.get<ProductionOrder>(`/production-orders/${id}`),
        api.get<CostSummary>(`/production-orders/${id}/cost-summary`),
        api.get<Fabric[]>("/fabrics"),
        api.get<Material[]>(`/production-orders/${id}/materials`),
        api.get<EventItem[]>(`/production-orders/${id}/events`),
        api.get<PaginatedResponse<Roll>>("/fabric-rolls", { params: { page: 1, page_size: 100 } }),
        api.get<PaginatedResponse<Trim>>("/trims", { params: { page: 1, page_size: 100 } }),
        api.get<OutputItem[]>(`/production-orders/${id}/outputs`),
      ]);

      setOrder(orderRes.data);
      setCostSummary(costRes.data);
      setFabrics(Array.isArray(fabricsRes.data) ? fabricsRes.data : []);
      setMaterials(materialsRes.data);
      setEvents(eventsRes.data);
      setRolls(Array.isArray(rollsRes.data?.items) ? rollsRes.data.items : []);
      setTrims(Array.isArray(trimsRes.data?.items) ? trimsRes.data.items : []);
      setOutputs(Array.isArray(outputsRes.data) ? outputsRes.data : []);

      setReceiveForm({
        produced_quantity: String(orderRes.data.produced_quantity ?? ""),
        status: orderRes.data.status === "COMPLETED" ? "COMPLETED" : "PARTIALLY_RECEIVED",
        received_notes: orderRes.data.received_notes || "",
      });

      setCostForm({
        labor_cost: String(orderRes.data.labor_cost ?? "0"),
        additional_cost: String(orderRes.data.additional_cost ?? "0"),
        currency: orderRes.data.currency || "USD",
        price_multiplier: "2.5",
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          t("production-orders:messages.detailLoadError")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const checkFabricAvailability = async (fabricId: string, plannedQuantity: string) => {
    if (!fabricId || !plannedQuantity) {
      setFabricAvailability(null);
      return;
    }

    try {
      setCheckingAvailability(true);

      const res = await api.get<FabricAvailability>("/production-orders/fabric-availability", {
        params: {
          fabric_id: fabricId,
          required_meters: Number(plannedQuantity),
        },
      });

      setFabricAvailability(res.data);
    } catch (err: any) {
      setFabricAvailability(null);
      setError(String(err?.response?.data?.detail || "No se pudo validar disponibilidad"));
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (!fabricForm.fabric_id || !fabricForm.planned_quantity) {
      setFabricAvailability(null);
      return;
    }
    checkFabricAvailability(fabricForm.fabric_id, fabricForm.planned_quantity);
  }, [fabricForm.fabric_id, fabricForm.planned_quantity]);

  const saveCosts = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");
      await api.post(`/production-orders/${id}/costs`, {
        labor_cost: Number(costForm.labor_cost || 0),
        additional_cost: Number(costForm.additional_cost || 0),
        currency: costForm.currency || "USD",
      });
      await loadAll();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          t("production-orders:costs.saveError")
      );
    }
  };

  const addFabricMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");

      if (!fabricForm.fabric_roll_id) {
        setError("Seleccioná un rollo");
        return;
      }

      await api.post(`/production-orders/${id}/materials/fabric`, {
        fabric_roll_id: fabricForm.fabric_roll_id,
        planned_quantity: Number(fabricForm.planned_quantity),
        unit: fabricForm.unit,
        notes: fabricForm.notes || null,
      });

      setFabricForm({
        fabric_id: "",
        fabric_roll_id: "",
        planned_quantity: "",
        unit: "meters",
        notes: "",
      });

      setFabricAvailability(null);
      await loadAll();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          t("production-orders:materials.addError")
      );
    }
  };

  const addTrimMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");
      await api.post(`/production-orders/${id}/materials/trim`, null, {
        params: {
          trim_id: trimForm.trim_id,
          planned_quantity: Number(trimForm.planned_quantity),
          notes: trimForm.notes || undefined,
        },
      });
      setTrimForm({ trim_id: "", planned_quantity: "", notes: "" });
      await loadAll();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          t("production-orders:materials.addError")
      );
    }
  };

  const reserveMaterial = async (materialId: string) => {
    try {
      setError("");
      await api.post(`/production-orders/${id}/materials/${materialId}/reserve`);
      await loadAll();
    } catch (err: any) {
      setError(
        String(err?.response?.data?.detail || t("production-orders:materials.reserveError"))
      );
    }
  };

  const removeMaterial = async (materialId: string) => {
    const confirmed = window.confirm("¿Querés quitar este material de la orden?");
    if (!confirmed) return;

    try {
      setError("");
      await api.delete(`/production-orders/${id}/materials/${materialId}`);
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudo eliminar el material."));
    }
  };

  const issueMaterial = async (materialId: string) => {
    try {
      setError("");
      await api.post(`/production-orders/${id}/materials/${materialId}/issue`);
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudo entregar el material."));
    }
  };

  const issueAllMaterials = async () => {
    const pending = materialCards.filter((m) => m.canIssue);
    if (pending.length === 0) {
      setError("No hay materiales reservados listos para entregar.");
      return;
    }

    const confirmed = window.confirm("¿Entregar todos los materiales reservados al taller?");
    if (!confirmed) return;

    try {
      setIssuingAll(true);
      setError("");

      for (const material of pending) {
        await api.post(`/production-orders/${id}/materials/${material.id}/issue`);
      }

      await loadAll();
    } catch (err: any) {
      setError(
        String(err?.response?.data?.detail || "No se pudieron entregar todos los materiales.")
      );
    } finally {
      setIssuingAll(false);
    }
  };

  const receiveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");
      await api.post(`/production-orders/${id}/receive`, {
        produced_quantity: Number(receiveForm.produced_quantity || 0),
        status: receiveForm.status,
        received_notes: receiveForm.received_notes || null,
      });
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || t("production-orders:receive.error")));
    }
  };

  const uploadDesignImage = async (file: File) => {
    if (!order) return;

    try {
      setUploadingDesignImage(true);
      setDesignImageError("");

      const formData = new FormData();
      formData.append("file", file);

      await api.post(`/production-orders/${order.id}/design-image`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      await loadAll();
    } catch (err: any) {
      setDesignImageError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          "No se pudo subir la imagen."
      );
    } finally {
      setUploadingDesignImage(false);
    }
  };

  const createOutput = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");
      await api.post(`/production-orders/${id}/outputs`, {
        name: outputForm.name,
        code: outputForm.code || null,
        size: outputForm.size || null,
        color: outputForm.color || null,
        quantity: Number(outputForm.quantity || 1),
        unit_cost: outputForm.unit_cost ? Number(outputForm.unit_cost) : null,
        notes: outputForm.notes || null,
        create_dress_records: outputForm.create_dress_records,
      });
      setOutputForm({
        name: "",
        code: "",
        size: "",
        color: "",
        quantity: "1",
        unit_cost: "",
        notes: "",
        create_dress_records: false,
      });
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudo crear el output."));
    }
  };

  const materialCards = useMemo(() => {
    return materials.map((material) => {
      const planned = toNumber(material.planned_quantity);
      const delivered = toNumber(material.delivered_quantity);
      const current = toNumber(material.roll_current_length);
      const reserved = toNumber(material.roll_reserved_length);
      const free = current - reserved;
      const isIssued = delivered > 0;
      const isReserved = !isIssued && planned > 0 && reserved >= planned;
      const totalCost = planned * toNumber(material.unit_cost_snapshot);

      return {
        ...material,
        planned,
        delivered,
        current,
        reserved,
        free,
        isIssued,
        isReserved,
        totalCost,
        canReserve: !isIssued && !isReserved,
        canIssue: !isIssued && isReserved,
        badgeLabel: isIssued ? "ENTREGADO" : isReserved ? "RESERVADO" : "PENDIENTE",
      };
    });
  }, [materials]);

  const fabricMaterials = useMemo(
    () => materialCards.filter((item) => item.material_type === "FABRIC_ROLL"),
    [materialCards]
  );

  const trimMaterials = useMemo(
    () => materialCards.filter((item) => item.material_type === "TRIM"),
    [materialCards]
  );

  const availableRollOptions = useMemo(() => {
    if (fabricAvailability?.all_rolls?.length) {
      return fabricAvailability.all_rolls.map((roll) => ({
        id: roll.id,
        roll_code: roll.roll_code,
        current_length: roll.current_length,
        reserved_length: roll.reserved_length,
        free_length: String(toNumber(roll.current_length) - toNumber(roll.reserved_length)),
        status: roll.status,
      }));
    }

    return rolls
      .filter((roll) => !fabricForm.fabric_id || roll.fabric_id === fabricForm.fabric_id)
      .map((roll) => ({
        id: roll.id,
        roll_code: roll.roll_code,
        current_length: roll.current_length || "0",
        reserved_length: roll.reserved_length || "0",
        free_length: String(
          toNumber(roll.current_length || "0") - toNumber(roll.reserved_length || "0")
        ),
        status: roll.status || "AVAILABLE",
      }));
  }, [rolls, fabricAvailability, fabricForm.fabric_id]);

  const latestEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return db - da;
      }),
    [events]
  );

  const designPhoto = resolvePhoto(order?.design_photo_url);

  if (loading) {
    return (
      <section className="df-pro-page">
        <div className="po-loading-state">Cargando orden...</div>
      </section>
    );
  }

  if (error && !order) {
    return (
      <section className="df-pro-page">
        <div className="po-inline-error">{error}</div>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="df-pro-page">
        <div className="po-empty-state">
          <h3>Orden no encontrada</h3>
        </div>
      </section>
    );
  }

  return (
    <section className="df-pro-page">
      <div className="po-shell">
        <section className="po-header-card">
          <div className="po-header-top">
            <div className="po-header-copy">
              <p className="df-pro-page__eyebrow" style={{ margin: 0 }}>
                {t("production-orders:hero.eyebrow")}
              </p>
              <h1 className="po-header-title">{order.order_number}</h1>
              <p className="po-header-subtitle">
                {order.target_dress_name} · {order.workshop_supplier_name || "Sin taller asignado"}
              </p>
            </div>

            <div className="po-top-actions">
              <button type="button" className="po-secondary-btn" onClick={() => navigate(-1)}>
                Volver
              </button>
              <button
                type="button"
                className="po-primary-btn"
                onClick={() => window.open(`/production-orders/${order.id}/print`, "_blank")}
              >
                Print
              </button>
            </div>
          </div>

          <div className="po-header-meta">
            <div className="po-meta-card">
              <span className="po-meta-card__label">Estado</span>
              <span className={`df-status-badge df-status-badge--${eventTone(order.status)}`}>
                {t(`production-orders:status.${order.status}`, { defaultValue: order.status })}
              </span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">Prioridad</span>
              <span className="po-meta-card__value">
                {t(`production-orders:priority.${order.priority}`, { defaultValue: order.priority })}
              </span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">Entrega</span>
              <span className="po-meta-card__value">
                {formatDate(order.due_date, i18n.language === "en" ? "en-US" : "es-AR")}
              </span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">Cantidad</span>
              <span className="po-meta-card__value">{order.planned_quantity}</span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">Producido</span>
              <span className="po-meta-card__value">{order.produced_quantity}</span>
            </div>
          </div>

          <div className="po-detail-tabs">
            <button
              type="button"
              className={`po-detail-tab ${activeTab === "operation" ? "po-detail-tab--active" : ""}`}
              onClick={() => changeTab("operation")}
            >
              Operación
            </button>

            <button
              type="button"
              className={`po-detail-tab ${activeTab === "finance" ? "po-detail-tab--active" : ""}`}
              onClick={() => changeTab("finance")}
            >
              Costos
            </button>

            <button
              type="button"
              className={`po-detail-tab ${activeTab === "events" ? "po-detail-tab--active" : ""}`}
              onClick={() => changeTab("events")}
            >
              Movimientos
            </button>
          </div>
        </section>

        {error ? <div className="po-inline-error">{error}</div> : null}

        <div className={tabAnimationClass} key={activeTab}>
          {activeTab === "operation" ? (
            <ProductionOrderOperationTab
              t={t}
              i18n={i18n}
              order={order}
              designPhoto={designPhoto}
              uploadingDesignImage={uploadingDesignImage}
              designImageError={designImageError}
              uploadDesignImage={uploadDesignImage}
              fabrics={fabrics}
              fabricForm={fabricForm}
              setFabricForm={setFabricForm}
              trimForm={trimForm}
              setTrimForm={setTrimForm}
              outputForm={outputForm}
              setOutputForm={setOutputForm}
              receiveForm={receiveForm}
              setReceiveForm={setReceiveForm}
              fabricAvailability={fabricAvailability}
              checkingAvailability={checkingAvailability}
              availableRollOptions={availableRollOptions}
              trims={trims}
              fabricMaterials={fabricMaterials}
              trimMaterials={trimMaterials}
              outputs={outputs}
              addFabricMaterial={addFabricMaterial}
              addTrimMaterial={addTrimMaterial}
              reserveMaterial={reserveMaterial}
              removeMaterial={removeMaterial}
              issueMaterial={issueMaterial}
              issueAllMaterials={issueAllMaterials}
              issuingAll={issuingAll}
              createOutput={createOutput}
              receiveOrder={receiveOrder}
              formatMoney={formatMoney}
              materialStatusClass={materialStatusClass}
            />
          ) : activeTab === "finance" ? (
            <ProductionOrderFinanceTab
              t={t}
              order={order}
              costSummary={costSummary}
              costForm={costForm}
              setCostForm={setCostForm}
              saveCosts={saveCosts}
              formatMoney={formatMoney}
              calculateSuggestedPrice={calculateSuggestedPrice}
            />
          ) : (
            <ProductionOrderEventsTab
              t={t}
              i18n={i18n}
              latestEvents={latestEvents}
              expandedEvents={expandedEvents}
              setExpandedEvents={setExpandedEvents}
              formatDateTime={formatDateTime}
              eventTone={eventTone}
              summarizeEvent={summarizeEvent}
              payloadEntries={payloadEntries}
            />
          )}
        </div>
      </div>
    </section>
  );
}

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

function normalizeEnum(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

function tr(t: any, key: string, fallback: string, options?: Record<string, unknown>) {
  if (typeof t !== "function") return fallback;
  return t(key, {
    defaultValue: fallback,
    ...(options || {}),
  });
}


function currentLang(t: any) {
  return String(t?.i18n?.language || "").toLowerCase().startsWith("en") ? "en" : "es";
}

function eventTypeFallback(t: any, key: string) {
  const lang = currentLang(t);

  const es: Record<string, string> = {
    CREATED: "Orden creada",
    FABRIC_ASSIGNED: "Tela asignada",
    TRIM_ASSIGNED: "Avío asignado",
    MATERIAL_ASSIGNED: "Material asignado",
    MATERIAL_RESERVED: "Material reservado",
    MATERIAL_ISSUED: "Material entregado",
    MATERIAL_RETURNED: "Material devuelto",
    ORDER_RECEIVED: "Recepción registrada",
    OUTPUT_CREATED: "Producción registrada",
    COSTS_UPDATED: "Costos actualizados",
    DESIGN_IMAGE_UPDATED: "Imagen de diseño actualizada",
  };

  const en: Record<string, string> = {
    CREATED: "Order created",
    FABRIC_ASSIGNED: "Fabric assigned",
    TRIM_ASSIGNED: "Trim assigned",
    MATERIAL_ASSIGNED: "Material assigned",
    MATERIAL_RESERVED: "Material reserved",
    MATERIAL_ISSUED: "Material issued",
    MATERIAL_RETURNED: "Material returned",
    ORDER_RECEIVED: "Receipt registered",
    OUTPUT_CREATED: "Production output registered",
    COSTS_UPDATED: "Costs updated",
    DESIGN_IMAGE_UPDATED: "Design image updated",
  };

  return (lang === "en" ? en : es)[key] || key || "Movimiento";
}

function eventSummaryFallback(t: any, key: string) {
  const lang = currentLang(t);

  const es: Record<string, string> = {
    CREATED: "Se creó la orden.",
    FABRIC_ASSIGNED: "Se asignó una tela a la orden.",
    TRIM_ASSIGNED: "Se asignó un avío a la orden.",
    MATERIAL_ASSIGNED: "Se asignó un material a la orden.",
    MATERIAL_RESERVED: "Se reservó material para producción.",
    MATERIAL_ISSUED: "Se entregó material al taller.",
    MATERIAL_RETURNED: "Se registró devolución o merma de material.",
    ORDER_RECEIVED: "Se registró la recepción de producción.",
    OUTPUT_CREATED: "Se registró la producción generada.",
    COSTS_UPDATED: "Se actualizaron los costos de la orden.",
    DESIGN_IMAGE_UPDATED: "Se actualizó la imagen de diseño.",
  };

  const en: Record<string, string> = {
    CREATED: "The order was created.",
    FABRIC_ASSIGNED: "A fabric was assigned to the order.",
    TRIM_ASSIGNED: "A trim was assigned to the order.",
    MATERIAL_ASSIGNED: "A material was assigned to the order.",
    MATERIAL_RESERVED: "Material was reserved for production.",
    MATERIAL_ISSUED: "Material was issued to the workshop.",
    MATERIAL_RETURNED: "Material return or waste was recorded.",
    ORDER_RECEIVED: "Production receipt was registered.",
    OUTPUT_CREATED: "Production output was registered.",
    COSTS_UPDATED: "Order costs were updated.",
    DESIGN_IMAGE_UPDATED: "The design image was updated.",
  };

  return (lang === "en" ? en : es)[key] || eventTypeFallback(t, key);
}

function payloadKeyFallback(t: any, key: string) {
  const normalized = key.replace(/[_\s-]/g, "").toLowerCase();
  const lang = currentLang(t);

  const es: Record<string, string> = {
    ordernumber: "Orden",
    rollcode: "Rollo",
    trimcode: "Avío",
    materialid: "Material",
    materialtype: "Tipo de material",
    reservedquantity: "Cantidad reservada",
    issuedquantity: "Cantidad entregada",
    returnedquantity: "Cantidad devuelta",
    wastequantity: "Merma",
    consumedquantity: "Consumido",
    producedquantity: "Cantidad producida",
    status: "Estado",
    name: "Nombre",
    quantity: "Cantidad",
    laborcost: "Mano de obra",
    additionalcost: "Costo adicional",
    currency: "Moneda",
    unitcostsnapshot: "Costo unitario",
    designphotourl: "Imagen de diseño",
  };

  const en: Record<string, string> = {
    ordernumber: "Order",
    rollcode: "Roll",
    trimcode: "Trim",
    materialid: "Material",
    materialtype: "Material type",
    reservedquantity: "Reserved quantity",
    issuedquantity: "Issued quantity",
    returnedquantity: "Returned quantity",
    wastequantity: "Waste",
    consumedquantity: "Consumed",
    producedquantity: "Produced quantity",
    status: "Status",
    name: "Name",
    quantity: "Quantity",
    laborcost: "Labor cost",
    additionalcost: "Additional cost",
    currency: "Currency",
    unitcostsnapshot: "Unit cost",
    designphotourl: "Design image",
  };

  return (lang === "en" ? en : es)[normalized] || key;
}

function translateOrderStatus(t: any, value?: string | null) {
  const key = normalizeEnum(value);
  return tr(t, `production-orders:status.${key}`, value || "—");
}

function translatePriority(t: any, value?: string | null) {
  const key = normalizeEnum(value);
  return tr(t, `production-orders:priority.${key}`, value || "—");
}

function translateEventType(t: any, value?: string | null) {
  const key = normalizeEnum(value);
  return tr(t, `production-orders:events.types.${key}`, eventTypeFallback(t, key));
}

function summarizeProductionEvent(t: any, event: EventItem) {
  const key = normalizeEnum(event.event_type);
  const payload = event.payload || {};

  return tr(
    t,
    `production-orders:events.summaries.${key}`,
    eventSummaryFallback(t, key),
    payload
  );
}

function toCamelPayloadKey(value?: string | null) {
  const key = String(value || "").trim();
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function translatePayloadKey(t: any, value?: string | null) {
  const key = String(value || "").trim();
  const camelKey = toCamelPayloadKey(key);

  return tr(
    t,
    `production-orders:events.payload.${camelKey}`,
    payloadKeyFallback(t, key)
  );
}

function translatePayloadValue(t: any, key: string, value: unknown) {
  if (value === null || value === undefined) return "—";

  const normalizedKey = String(key || "").trim();

  if (normalizedKey === "status") {
    return translateOrderStatus(t, String(value));
  }

  if (normalizedKey === "material_type" || normalizedKey === "materialType") {
    const raw = normalizeEnum(String(value));
    if (raw === "FABRIC_ROLL") return tr(t, "production-orders:materials.fabric", "Tela");
    if (raw === "TRIM") return tr(t, "production-orders:materials.trim", "Avío");
  }

  return String(value);
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
  return summarizeProductionEvent(t, event);
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
    return {
      key,
      label: translatePayloadKey(t, key),
      value: translatePayloadValue(t, key, value),
    };
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
        <h3>{tr(t, "production-orders:events.title", "Movimientos de la orden")}</h3>
        <p>{tr(t, "production-orders:events.subtitle", "Historial completo de acciones operativas y financieras.")}</p>
      </div>

      <div className="po-events-list">
        {latestEvents.length === 0 ? (
          <div className="po-empty-state">{tr(t, "production-orders:events.empty", "Todavía no hay movimientos registrados.")}</div>
        ) : (
          latestEvents.map((event) => {
            const entries = payloadEntries(t, event.payload);
            const expanded = !!expandedEvents[event.id];

            return (
              <article key={event.id} className="po-event-card">
                <div className="po-event-card__top">
                  <div className="po-event-card__main">
                    <span className={`df-status-badge df-status-badge--${eventTone(event.event_type)}`}>
                      {translateEventType(t, event.event_type)}
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
                      {expanded ? tr(t, "production-orders:events.hideDetails", currentLang(t) === "en" ? "Hide details" : "Ocultar detalle") : tr(t, "production-orders:events.showDetails", currentLang(t) === "en" ? "Show details" : "Ver detalle")}
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


  const [costForm, setCostForm] = useState({
    labor_cost: "0",
    additional_cost: "0",
    currency: "ARS",
    price_multiplier: "2.5",
    exchange_rate: "1000",
  });

  const [outputForm, setOutputForm] = useState({
    name: "",
    code: "",
    size: "",
    color: "",
    quantity: "1",
    unit_cost: "",
    notes: "",
    create_dress_records: true,
  });

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [fabricAvailability, setFabricAvailability] = useState<FabricAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);


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
      setCostForm({
        labor_cost: String(orderRes.data.labor_cost ?? "0"),
        additional_cost: String(orderRes.data.additional_cost ?? "0"),
        currency: orderRes.data.currency || "ARS",
        price_multiplier: "2.5",
        exchange_rate: "1000",
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
      setError(String(err?.response?.data?.detail || tr(t, "production-orders:materials.availabilityError", "No se pudo validar disponibilidad")));
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
        setError(tr(t, "production-orders:materials.selectRollRequired", "Seleccioná un rollo"));
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
      setError(String(err?.response?.data?.detail || tr(t, "production-orders:materials.removeError", "No se pudo eliminar el material.")));
    }
  };

  const issueMaterial = async (materialId: string) => {
    try {
      setError("");
      await api.post(`/production-orders/${id}/materials/${materialId}/issue`);
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || tr(t, "production-orders:materials.issueError", "No se pudo entregar el material.")));
    }
  };

  const issueAllMaterials = async () => {
    const pending = materialCards.filter((m) => m.canIssue);
    if (pending.length === 0) {
      setError(tr(t, "production-orders:operation.quickActions.noneReady", "No hay materiales reservados listos para entregar."));
      return;
    }

    const confirmed = window.confirm(tr(t, "production-orders:confirm.issueAll", "¿Entregar todos los materiales reservados al taller?"));
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
        String(err?.response?.data?.detail || tr(t, "production-orders:materials.issueAllError", "No se pudieron entregar todos los materiales."))
      );
    } finally {
      setIssuingAll(false);
    }
  };


  const createOutput = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!order) return;

    try {
      setError("");

      const quantity = Number(outputForm.quantity || 1);

      await api.post(`/production-orders/${id}/receive`, {
        produced_quantity: quantity,
        status: "COMPLETED",
        received_notes: outputForm.notes || null,
      });

      setOutputForm({
        name: "",
        code: "",
        size: "",
        color: "",
        quantity: "1",
        unit_cost: "",
        notes: "",
        create_dress_records: true,
      });

      await loadAll();

      setError(
        `✔ Se registró la producción y se generaron ${quantity} vestido${quantity === 1 ? "" : "s"} disponibles para la venta.`
      );
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      const message =
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((item: any) => item.msg).join(" · ")
            : tr(t, "production-orders:output.createError", "No se pudo registrar la producción.");

      setError(message);
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


  if (loading) {
    return (
      <section className="df-pro-page">
        <div className="po-loading-state">{tr(t, "production-orders:messages.loading", "Cargando orden...")}</div>
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
          <h3>{tr(t, "production-orders:messages.notFound", "Orden no encontrada")}</h3>
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
                {order.target_dress_name} · {order.workshop_supplier_name || tr(t, "production-orders:fields.noWorkshop", "Sin taller asignado")}
              </p>
            </div>

            <div className="po-top-actions">
              <button type="button" className="po-secondary-btn" onClick={() => navigate(-1)}>
                {tr(t, "common:actions.back", "Volver")}
              </button>
              <button
                type="button"
                className="po-primary-btn"
                onClick={() => window.open(`/production-orders/${order.id}/print`, "_blank")}
              >
                {tr(t, "common:actions.print", "Imprimir")}
              </button>
            </div>
          </div>

          <div className="po-header-meta">
            <div className="po-meta-card">
              <span className="po-meta-card__label">{tr(t, "production-orders:fields.status", "Estado")}</span>
              <span className={`df-status-badge df-status-badge--${eventTone(order.status)}`}>
                {translateOrderStatus(t, order.status)}
              </span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">{tr(t, "production-orders:fields.priority", "Prioridad")}</span>
              <span className="po-meta-card__value">
                {translatePriority(t, order.priority)}
              </span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">{tr(t, "production-orders:fields.dueDate", "Entrega")}</span>
              <span className="po-meta-card__value">
                {formatDate(order.due_date, i18n.language === "en" ? "en-US" : "es-AR")}
              </span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">{tr(t, "production-orders:fields.quantity", "Cantidad")}</span>
              <span className="po-meta-card__value">{order.planned_quantity}</span>
            </div>

            <div className="po-meta-card">
              <span className="po-meta-card__label">{tr(t, "production-orders:fields.producedQuantity", "Producido")}</span>
              <span className="po-meta-card__value">{order.produced_quantity}</span>
            </div>
          </div>

          <div className="po-detail-tabs">
            <button
              type="button"
              className={`po-detail-tab ${activeTab === "operation" ? "po-detail-tab--active" : ""}`}
              onClick={() => changeTab("operation")}
            >
              {tr(t, "production-orders:tabs.operation", "Operación")}
            </button>

            <button
              type="button"
              className={`po-detail-tab ${activeTab === "finance" ? "po-detail-tab--active" : ""}`}
              onClick={() => changeTab("finance")}
            >
              {tr(t, "production-orders:tabs.finance", "Costos")}
            </button>

            <button
              type="button"
              className={`po-detail-tab ${activeTab === "events" ? "po-detail-tab--active" : ""}`}
              onClick={() => changeTab("events")}
            >
              {tr(t, "production-orders:tabs.events", "Movimientos")}
            </button>
          </div>
        </section>

        {error ? <div className="po-inline-error">{error}</div> : null}

        <div className={tabAnimationClass} key={activeTab}>
          {activeTab === "operation" ? (
            <ProductionOrderOperationTab
              t={t}
              order={order}
              fabrics={fabrics}
              fabricForm={fabricForm}
              setFabricForm={setFabricForm}
              trimForm={trimForm}
              setTrimForm={setTrimForm}
              outputForm={outputForm}
              setOutputForm={setOutputForm}
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

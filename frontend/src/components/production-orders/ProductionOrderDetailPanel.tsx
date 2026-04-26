import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import ProductionOrderOperationTab from "./ProductionOrderOperationTab";
import ProductionOrderFinanceTab from "./ProductionOrderFinanceTab";

type Props = {
  orderId: string;
};

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

type DetailTab = "operation" | "finance" | "events";
type PdfMode = "operation" | "finance";

function toNumber(value?: string | null) {
  return Number(value ?? 0);
}

function formatMoney(value?: string | number | null, currency = "USD") {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)} ${currency}`;
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

function translateEventType(value?: string | null) {
  const key = String(value || "").trim().toUpperCase();

  const map: Record<string, string> = {
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

  return map[key] || value || "Movimiento";
}

function eventIcon(eventType?: string | null) {
  const key = String(eventType || "").trim().toUpperCase();

  const map: Record<string, string> = {
    CREATED: "✦",
    FABRIC_ASSIGNED: "🧵",
    TRIM_ASSIGNED: "✂️",
    MATERIAL_ASSIGNED: "🧩",
    MATERIAL_RESERVED: "📦",
    MATERIAL_ISSUED: "🏭",
    MATERIAL_RETURNED: "↩",
    ORDER_RECEIVED: "✓",
    OUTPUT_CREATED: "👗",
    COSTS_UPDATED: "💰",
    DESIGN_IMAGE_UPDATED: "🖼️",
  };

  return map[key] || "•";
}

function eventVisualTone(eventType?: string | null) {
  const key = String(eventType || "").trim().toUpperCase();

  if (key === "COSTS_UPDATED") return "finance";
  if (key === "DESIGN_IMAGE_UPDATED") return "image";
  if (key === "MATERIAL_RESERVED" || key === "MATERIAL_ASSIGNED" || key === "FABRIC_ASSIGNED" || key === "TRIM_ASSIGNED") {
    return "materials";
  }
  if (key === "MATERIAL_ISSUED" || key === "ORDER_RECEIVED" || key === "OUTPUT_CREATED") {
    return "production";
  }
  if (key === "MATERIAL_RETURNED") return "return";

  return "default";
}

function summarizeEvent(event: EventItem) {
  return translateEventType(event.event_type);
}

function translateOrderStatus(value?: string | null) {
  const key = String(value || "").trim().toUpperCase();

  const map: Record<string, string> = {
    DRAFT: "Borrador",
    APPROVED: "Aprobada",
    MATERIALS_RESERVED: "Materiales reservados",
    IN_PROGRESS: "En producción",
    IN_PRODUCTION: "En producción",
    PARTIALLY_RECEIVED: "Recepción parcial",
    COMPLETED: "Completada",
    CANCELLED: "Cancelada",
  };

  return map[key] || value || "-";
}

function translatePriority(value?: string | null) {
  const key = String(value || "").trim().toUpperCase();

  const map: Record<string, string> = {
    LOW: "Baja",
    NORMAL: "Normal",
    HIGH: "Alta",
    URGENT: "Urgente",
  };

  return map[key] || value || "-";
}

function translatePayloadKey(value?: string | null) {
  const key = String(value || "").trim();

  const map: Record<string, string> = {
    order_number: "Orden",
    orderNumber: "Orden",
    roll_code: "Rollo",
    rollCode: "Rollo",
    trim_code: "Avío",
    trimCode: "Avío",
    material_id: "Material",
    materialId: "Material",
    material_type: "Tipo de material",
    materialType: "Tipo de material",
    reserved_quantity: "Cantidad reservada",
    reservedQuantity: "Cantidad reservada",
    issued_quantity: "Cantidad entregada",
    issuedQuantity: "Cantidad entregada",
    returned_quantity: "Cantidad devuelta",
    returnedQuantity: "Cantidad devuelta",
    waste_quantity: "Merma",
    wasteQuantity: "Merma",
    consumed_quantity: "Consumido",
    consumedQuantity: "Consumido",
    produced_quantity: "Cantidad producida",
    producedQuantity: "Cantidad producida",
    status: "Estado",
    name: "Nombre",
    quantity: "Cantidad",
    labor_cost: "Mano de obra",
    laborCost: "Mano de obra",
    additional_cost: "Costo adicional",
    additionalCost: "Costo adicional",
    currency: "Moneda",
    unit_cost_snapshot: "Costo unitario",
    unitCostSnapshot: "Costo unitario",
    design_photo_url: "Imagen de diseño",
    designPhotoUrl: "Imagen de diseño",
  };

  return map[key] || key;
}

function translatePayloadValue(key: string, value: unknown) {
  if (value === null || value === undefined) return "-";

  const normalizedKey = String(key || "").trim();

  if (normalizedKey === "status") {
    return translateOrderStatus(String(value));
  }

  if (normalizedKey === "material_type" || normalizedKey === "materialType") {
    const raw = String(value || "").trim().toUpperCase();
    if (raw === "FABRIC_ROLL") return "Tela";
    if (raw === "TRIM") return "Avío";
  }

  return String(value);
}

function resolvePhoto(photoUrl?: string | null) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;
  return `/${photoUrl.replace(/^\/+/, "")}`;
}

function payloadEntries(payload?: Record<string, unknown> | null) {
  if (!payload) return [];
  return Object.entries(payload).map(([key, value]) => ({
    key,
    label: translatePayloadKey(key),
    value: translatePayloadValue(key, value),
  }));
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

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value?: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text ? escapeHtml(text) : fallback;
}

function formatPrintMoney(value?: string | number | null, currency = "USD") {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)} ${currency}`;
}

function translatePrintUnit(unit?: string | null) {
  if (!unit) return "";
  const normalized = unit.toLowerCase();

  const map: Record<string, string> = {
    meters: "metros",
    meter: "metro",
    m: "m",
    units: "unidades",
    unit: "unidad",
    pcs: "piezas",
    piece: "pieza",
  };

  return map[normalized] || unit;
}

function getPrintableStatus(status?: string | null) {
  if (!status) return "-";
  const map: Record<string, string> = {
    DRAFT: "Borrador",
    MATERIALS_RESERVED: "Materiales reservados",
    IN_PRODUCTION: "En producción",
    COMPLETED: "Completada",
    CANCELLED: "Cancelada",
  };
  return map[status] || status;
}

function getPrintablePriority(priority?: string | null) {
  if (!priority) return "-";
  const map: Record<string, string> = {
    LOW: "Baja",
    NORMAL: "Normal",
    HIGH: "Alta",
    URGENT: "Urgente",
  };
  return map[priority] || priority;
}

function toAbsoluteAssetUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const normalized = `/${url.replace(/^\/+/, "")}`;
  return `${window.location.origin}${normalized}`;
}

function buildPrintDocumentHtml({
  mode,
  order,
  costSummary,
  fabricMaterials,
  trimMaterials,
  designPhoto,
  tenantLogoUrl,
}: {
  mode: PdfMode;
  order: ProductionOrder;
  costSummary: CostSummary | null;
  fabricMaterials: Array<any>;
  trimMaterials: Array<any>;
  designPhoto: string | null;
  tenantLogoUrl: string | null;
}) {
  const currency = costSummary?.currency || order.currency || "USD";
  const tenantName = order.tenant_name || "DressFlow";

  const title =
    mode === "finance"
      ? "Ficha de Costos de Producción"
      : "Ficha Técnica de Producción";

  const subtitle =
    mode === "finance"
      ? "Uso interno · Control de costos y confección"
      : "Uso taller · Ficha técnica para confección";

  const renderRows = (items: Array<any>, includeCosts: boolean) =>
    items.length === 0
      ? `
        <tr>
          <td colspan="${includeCosts ? 7 : 6}" class="empty">No hay registros</td>
        </tr>
      `
      : items
          .map(
            (item) => `
        <tr>
          <td>${safeText(item.description_snapshot)}</td>
          <td>${safeText(item.roll_code)}</td>
          <td>${safeText(item.planned_quantity)}</td>
          <td>${safeText(item.delivered_quantity)}</td>
          <td>${safeText(translatePrintUnit(item.unit))}</td>
          <td>${safeText(item.notes)}</td>
          ${
            includeCosts
              ? `<td>${safeText(formatPrintMoney(item.unit_cost_snapshot, currency))}</td>`
              : ""
          }
        </tr>
      `
          )
          .join("");

  const logoBlock = tenantLogoUrl
    ? `
      <div class="brand-logo">
        <img src="${tenantLogoUrl}" alt="${safeText(tenantName)}" />
      </div>
    `
    : `
      <div class="brand-logo brand-logo-fallback">
        ${safeText(tenantName.slice(0, 2).toUpperCase())}
      </div>
    `;

  const financeMaterialCost = costSummary
    ? Number(costSummary.actual_material_cost || 0) > 0
      ? costSummary.actual_material_cost
      : costSummary.estimated_material_cost
    : 0;

  const financeLaborAndOther = costSummary
    ? Number(costSummary.labor_cost || 0) + Number(costSummary.additional_cost || 0)
    : 0;

  const financeTotal = costSummary
    ? Number(financeMaterialCost || 0) + financeLaborAndOther
    : 0;

  const financeBlock =
    mode === "finance" && costSummary
      ? `
      <section class="section section-finance">
        <div class="section-header">
          <div>
            <span class="section-kicker">Interno</span>
            <h2>Resumen de costos</h2>
          </div>
        </div>

        <div class="finance-hero">
          <div class="finance-main">
            <span class="finance-label">Total de costos</span>
            <strong>${safeText(
              formatPrintMoney(financeTotal, currency)
            )}</strong>
            <p>Costo consolidado de materiales, mano de obra y costos adicionales.</p>
          </div>

          <div class="finance-side">
            <div class="finance-mini finance-mini-dark">
              <span>Moneda</span>
              <strong>${safeText(currency)}</strong>
            </div>
            <div class="finance-mini finance-mini-dark">
              <span>Producido</span>
              <strong>${safeText(order.produced_quantity)}</strong>
            </div>
          </div>
        </div>

        <div class="finance-grid finance-grid--compact">
          <div class="finance-card">
            <span>Costo material</span>
            <strong>${safeText(
              formatPrintMoney(financeMaterialCost, currency)
            )}</strong>
          </div>
          <div class="finance-card">
            <span>Mano de obra / otros</span>
            <strong>${safeText(
              formatPrintMoney(financeLaborAndOther, currency)
            )}</strong>
          </div>
          <div class="finance-card">
            <span>Total</span>
            <strong>${safeText(
              formatPrintMoney(financeTotal, currency)
            )}</strong>
          </div>
        </div>
      </section>
    `
      : "";

  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${title} - ${safeText(order.order_number)}</title>
      <style>
        *{ box-sizing:border-box; }

        html, body{
          margin:0;
          padding:0;
          background:#ffffff;
          color:#171717;
          font-family: Inter, Arial, Helvetica, sans-serif;
        }

        body{
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page{
          width:210mm;
          min-height:297mm;
          margin:0 auto;
          padding:12mm 12mm 10mm;
          background:#fff;
        }

        .top-line{
          height:5px;
          background:linear-gradient(90deg, #121212 0%, #3f3f46 50%, #bdbdbd 100%);
          border-radius:999px;
          margin-bottom:16px;
        }

        .header{
          display:grid;
          grid-template-columns:1.2fr .8fr;
          gap:22px;
          align-items:start;
          padding-bottom:18px;
          border-bottom:1px solid #dddddd;
        }

        .brand{
          display:grid;
          gap:10px;
        }

        .brand-top{
          display:flex;
          align-items:flex-start;
          gap:16px;
        }

        .brand-logo{
          width:70px;
          height:70px;
          border:1px solid #dddddd;
          border-radius:20px;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#ffffff;
          overflow:hidden;
          flex-shrink:0;
        }

        .brand-logo img{
          width:100%;
          height:100%;
          object-fit:contain;
        }

        .brand-logo-fallback{
          font-size:26px;
          font-weight:900;
          letter-spacing:-.06em;
          color:#111111;
        }

        .brand-copy{
          display:grid;
          gap:5px;
          padding-top:2px;
        }

        .brand-eyebrow{
          margin:0;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.24em;
          color:#777777;
          font-weight:800;
        }

        .brand-title{
          margin:0;
          font-size:40px;
          line-height:.96;
          letter-spacing:-.07em;
          font-family: Georgia, "Times New Roman", serif;
          font-weight:700;
          color:#111111;
        }

        .brand-subtitle{
          margin:0;
          font-size:12px;
          line-height:1.5;
          color:#666666;
          max-width:560px;
        }

        .chips{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .chip{
          display:inline-flex;
          align-items:center;
          min-height:28px;
          padding:0 11px;
          border:1px solid #dcdcdc;
          border-radius:999px;
          background:#fafafa;
          font-size:10px;
          font-weight:800;
          letter-spacing:.08em;
          text-transform:uppercase;
          color:#2e2e2e;
        }

        .order-box{
          border:1px solid #dddddd;
          border-radius:24px;
          padding:16px 18px;
          background:linear-gradient(180deg, #ffffff 0%, #f7f7f7 100%);
          min-height:132px;
          display:flex;
          flex-direction:column;
          justify-content:center;
        }

        .order-box .label{
          display:block;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.20em;
          color:#777777;
          font-weight:800;
          margin-bottom:7px;
        }

        .order-box .value{
          font-size:44px;
          line-height:.92;
          letter-spacing:-.08em;
          font-weight:900;
          color:#111111;
        }

        .order-box .sub{
          margin-top:10px;
          font-size:12px;
          color:#666666;
          line-height:1.45;
        }

        .hero{
          display:grid;
          grid-template-columns:1.05fr .95fr;
          gap:18px;
          margin-top:18px;
        }

        .card{
          border:1px solid #dfdfdf;
          border-radius:24px;
          overflow:hidden;
          background:#ffffff;
        }

        .card-head{
          padding:12px 14px;
          border-bottom:1px solid #e7e7e7;
          background:#fafafa;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.10em;
          color:#777777;
          font-weight:800;
        }

        .card-body{
          padding:15px;
        }

        .meta-grid{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
        }

        .meta-item{
          border:1px solid #e7e7e7;
          border-radius:18px;
          padding:13px;
          min-height:78px;
          background:#fff;
        }

        .meta-item span{
          display:block;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.14em;
          color:#7a7a7a;
          font-weight:800;
          margin-bottom:7px;
        }

        .meta-item strong{
          font-size:16px;
          line-height:1.2;
          color:#151515;
        }

        .note{
          margin-top:12px;
          border:1px dashed #d7d7d7;
          border-radius:18px;
          padding:12px 13px;
          min-height:84px;
          white-space:pre-wrap;
          line-height:1.55;
          font-size:12px;
          color:#3b3b3b;
          background:#fcfcfc;
        }

        .note strong{
          display:block;
          margin-bottom:5px;
          font-size:10px;
          letter-spacing:.12em;
          text-transform:uppercase;
          color:#777777;
        }

        .visual{
          display:grid;
          gap:12px;
        }

        .image-box{
          border:1px solid #dfdfdf;
          border-radius:24px;
          min-height:390px;
          display:flex;
          align-items:center;
          justify-content:center;
          overflow:hidden;
          background:linear-gradient(180deg, #ffffff 0%, #f8f8f8 100%);
          padding:14px;
        }

        .image-box img{
          max-width:100%;
          max-height:400px;
          object-fit:contain;
        }

        .image-empty{
          color:#7a7a7a;
          font-size:13px;
          text-transform:uppercase;
          letter-spacing:.08em;
        }

        .mini-grid{
          display:grid;
          gap:10px;
        }

        .mini-card{
          border:1px solid #dfdfdf;
          border-radius:18px;
          padding:12px;
          background:#ffffff;
        }

        .mini-card span{
          display:block;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.14em;
          color:#7a7a7a;
          font-weight:800;
          margin-bottom:7px;
        }

        .mini-card strong{
          font-size:14px;
          line-height:1.3;
          color:#151515;
        }

        .mini-card-dark{
          background:#151515;
          border-color:#151515;
        }

        .mini-card-dark span{
          color:#c8c8c8;
        }

        .mini-card-dark strong{
          color:#ffffff;
        }

        .section{
          margin-top:18px;
        }

        .section-header{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:10px;
        }

        .section-title-row{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:10px;
        }

        .section h2{
          margin:0;
          font-size:18px;
          letter-spacing:-.02em;
          color:#151515;
        }

        .section-kicker{
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.10em;
          color:#7a7a7a;
          font-weight:800;
        }

        .section-materials{
          page-break-before: always;
          margin-top: 0;
        }

        .table-wrap{
          border:1px solid #dddddd;
          border-radius:22px;
          overflow:hidden;
          background:#fff;
        }

        table{
          width:100%;
          border-collapse:collapse;
        }

        th, td{
          padding:10px 11px;
          border-bottom:1px solid #ebebeb;
          text-align:left;
          vertical-align:top;
          font-size:12px;
          line-height:1.35;
        }

        thead th{
          background:#fafafa;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.14em;
          color:#7a7a7a;
          font-weight:800;
        }

        tbody tr:last-child td{
          border-bottom:none;
        }

        td.empty{
          text-align:center;
          color:#7a7a7a;
          padding:18px;
          background:#fcfcfc;
        }

        .section-finance{
          margin-top:20px;
        }

        .finance-hero{
          display:grid;
          grid-template-columns:1.05fr .95fr;
          gap:12px;
          border:1px solid #dddddd;
          border-radius:24px;
          padding:16px;
          background:linear-gradient(180deg, #fafafa 0%, #f4f4f4 100%);
          margin-bottom:12px;
        }

        .finance-main span{
          display:block;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.16em;
          color:#7a7a7a;
          font-weight:800;
          margin-bottom:7px;
        }

        .finance-main strong{
          display:block;
          font-size:34px;
          line-height:.95;
          letter-spacing:-.06em;
          color:#121212;
        }

        .finance-main p{
          margin:8px 0 0;
          font-size:12px;
          color:#666666;
          line-height:1.45;
        }

        .finance-side{
          display:grid;
          gap:10px;
        }

        .finance-grid{
          display:grid;
          grid-template-columns:repeat(4, 1fr);
          gap:10px;
        }

        .finance-grid--compact{
          grid-template-columns:repeat(3, 1fr);
        }

        .finance-card{
          border:1px solid #dddddd;
          border-radius:18px;
          padding:12px;
          background:#fff;
        }

        .finance-card span{
          display:block;
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.14em;
          color:#7a7a7a;
          font-weight:800;
          margin-bottom:7px;
        }

        .finance-card strong{
          font-size:15px;
          line-height:1.25;
          color:#151515;
        }

        .signatures{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:22px;
          margin-top:40px;
          page-break-before:avoid;
        }

        .signatures div{
          border-top:1px solid #d9d9d9;
          padding-top:10px;
          font-size:12px;
          color:#777777;
          min-height:24px;
        }

        .footer{
          margin-top:30px;
          border-top:1px solid #d9d9d9;
          padding-top:8px;
          font-size:10px;
          color:#7a7a7a;
          text-align:right;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        @page{
          size:A4;
          margin:10mm;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="top-line"></div>

        <section class="header">
          <div class="brand">
            <div class="brand-top">
              ${logoBlock}
              <div class="brand-copy">
                <p class="brand-eyebrow">${safeText(tenantName)}</p>
                <h1 class="brand-title">${title}</h1>
                <p class="brand-subtitle">${subtitle}</p>
              </div>
            </div>

            <div class="chips">
              <span class="chip">${safeText(getPrintableStatus(order.status))}</span>
              <span class="chip">Prioridad: ${safeText(
                getPrintablePriority(order.priority)
              )}</span>
              <span class="chip">Entrega: ${safeText(formatDate(order.due_date))}</span>
              <span class="chip">${mode === "finance" ? "Uso interno" : "Uso taller"}</span>
            </div>
          </div>

          <div class="order-box">
            <span class="label">Orden</span>
            <span class="value">${safeText(order.order_number)}</span>
            <div class="sub">Taller: ${safeText(order.workshop_supplier_name)}</div>
          </div>
        </section>

        <section class="hero">
          <div class="card">
            <div class="card-head">Información de la prenda</div>
            <div class="card-body">
              <div class="meta-grid">
                <div class="meta-item">
                  <span>Prenda</span>
                  <strong>${safeText(order.target_dress_name)}</strong>
                </div>
                <div class="meta-item">
                  <span>Código</span>
                  <strong>${safeText(order.target_dress_code)}</strong>
                </div>
                <div class="meta-item">
                  <span>Talle</span>
                  <strong>${safeText(order.target_size)}</strong>
                </div>
                <div class="meta-item">
                  <span>Color</span>
                  <strong>${safeText(order.target_color)}</strong>
                </div>
                <div class="meta-item">
                  <span>Planificado</span>
                  <strong>${safeText(order.planned_quantity)}</strong>
                </div>
                <div class="meta-item">
                  <span>Producido</span>
                  <strong>${safeText(order.produced_quantity)}</strong>
                </div>
              </div>

              <div class="note">
                <strong>Observaciones</strong>
                ${safeText(order.notes, "Sin observaciones.")}
              </div>

              <div class="note">
                <strong>Recepción</strong>
                ${safeText(order.received_notes, "Sin notas de recepción.")}
              </div>
            </div>
          </div>

          <div class="visual">
            <div class="card">
              <div class="card-head">Imagen de referencia</div>
              <div class="card-body">
                <div class="image-box">
                  ${
                    designPhoto
                      ? `<img src="${designPhoto}" alt="${safeText(order.target_dress_name)}" />`
                      : `<div class="image-empty">Sin imagen de referencia</div>`
                  }
                </div>
              </div>
            </div>

            <div class="mini-grid">
              <div class="mini-card">
                <span>Estado</span>
                <strong>${safeText(getPrintableStatus(order.status))}</strong>
              </div>
              <div class="mini-card">
                <span>Prioridad</span>
                <strong>${safeText(getPrintablePriority(order.priority))}</strong>
              </div>
              <div class="mini-card">
                <span>Taller</span>
                <strong>${safeText(order.workshop_supplier_name)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="section section-materials">
          <div class="section-title-row">
            <h2>Telas asignadas</h2>
            <span class="section-kicker">Materiales</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Rollo</th>
                  <th>Planificado</th>
                  <th>Entregado</th>
                  <th>Unidad</th>
                  <th>Notas</th>
                  ${mode === "finance" ? "<th>Costo unitario</th>" : ""}
                </tr>
              </thead>
              <tbody>
                ${renderRows(fabricMaterials, mode === "finance")}
              </tbody>
            </table>
          </div>
        </section>

        <section class="section">
          <div class="section-title-row">
            <h2>Avíos asignados</h2>
            <span class="section-kicker">Accesorios</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Rollo</th>
                  <th>Planificado</th>
                  <th>Entregado</th>
                  <th>Unidad</th>
                  <th>Notas</th>
                  ${mode === "finance" ? "<th>Costo unitario</th>" : ""}
                </tr>
              </thead>
              <tbody>
                ${renderRows(trimMaterials, mode === "finance")}
              </tbody>
            </table>
          </div>
        </section>

        ${financeBlock}

        <section class="signatures">
          <div>Firma responsable de producción</div>
          <div>Firma taller / recepción</div>
        </section>

        <div class="footer">
          ${safeText(tenantName)} · ${mode === "finance" ? "Ficha interna de costos" : "Ficha técnica de taller"}
        </div>
      </div>
    </body>
  </html>
  `;
}

function ProductionOrderEventsTab({
  latestEvents,
  expandedEvents,
  setExpandedEvents,
}: {
  latestEvents: EventItem[];
  expandedEvents: Record<string, boolean>;
  setExpandedEvents: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  return (
    <section className="po-section-card po-events-card">
      <style>{`
        .po-events-card {
          position: relative;
          overflow: hidden;
        }

        .po-events-card::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 34px;
          width: 1px;
          background: linear-gradient(
            180deg,
            rgba(216, 207, 195, 0) 0%,
            rgba(216, 207, 195, 0.95) 12%,
            rgba(216, 207, 195, 0.95) 88%,
            rgba(216, 207, 195, 0) 100%
          );
          pointer-events: none;
        }

        .po-events-timeline {
          display: grid;
          gap: 14px;
          position: relative;
          z-index: 1;
        }

        .po-event-card {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 12px;
          border: 1px solid rgba(222, 211, 203, 0.9);
          background:
            radial-gradient(circle at top right, rgba(195, 140, 122, 0.08), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%);
          border-radius: 22px;
          padding: 14px;
          box-shadow: 0 16px 34px rgba(52, 41, 58, 0.06);
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .po-event-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 20px 42px rgba(52, 41, 58, 0.09);
          border-color: rgba(195, 140, 122, 0.42);
        }

        .po-event-marker {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #f7efe8;
          border: 1px solid rgba(216, 207, 195, 0.95);
          color: #6f4f70;
          font-size: 18px;
          box-shadow: 0 10px 22px rgba(72, 55, 83, 0.08);
          position: relative;
          z-index: 2;
        }

        .po-event-body {
          min-width: 0;
        }

        .po-event-card__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .po-event-card__main {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .po-event-type-pill {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 28px;
          padding: 0 11px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border: 1px solid rgba(216, 207, 195, 0.9);
          background: rgba(255,255,255,0.78);
          color: #5f5667;
        }

        .po-event-card__summary {
          display: block;
          color: #30283c;
          font-size: 15px;
          letter-spacing: -0.01em;
        }

        .po-event-date {
          color: #8a7f73;
          font-size: 13px;
        }

        .po-event-card__payload {
          margin-top: 14px;
          display: grid;
          gap: 8px;
          border-top: 1px solid rgba(226, 218, 209, 0.9);
          padding-top: 12px;
        }

        .po-event-card__payload-row {
          display: grid;
          grid-template-columns: minmax(120px, 0.4fr) minmax(0, 1fr);
          gap: 10px;
          align-items: baseline;
          padding: 9px 10px;
          border-radius: 14px;
          background: rgba(255,255,255,0.68);
          border: 1px solid rgba(235, 229, 223, 0.8);
        }

        .po-event-card__payload-row span {
          color: #8a7f73;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .po-event-card__payload-row strong {
          color: #3c3345;
          font-size: 13px;
          word-break: break-word;
        }

        .po-event-card--finance .po-event-marker,
        .po-event-card--finance .po-event-type-pill {
          background: #f4efff;
          color: #6b4aa0;
          border-color: rgba(132, 96, 180, 0.24);
        }

        .po-event-card--materials .po-event-marker,
        .po-event-card--materials .po-event-type-pill {
          background: #fff7e8;
          color: #8a5e12;
          border-color: rgba(211, 177, 115, 0.34);
        }

        .po-event-card--production .po-event-marker,
        .po-event-card--production .po-event-type-pill {
          background: #edf7fb;
          color: #2f6d82;
          border-color: rgba(86, 145, 162, 0.26);
        }

        .po-event-card--image .po-event-marker,
        .po-event-card--image .po-event-type-pill {
          background: #fff0f3;
          color: #9a4659;
          border-color: rgba(217, 154, 162, 0.34);
        }

        .po-event-card--return .po-event-marker,
        .po-event-card--return .po-event-type-pill {
          background: #eefaf2;
          color: #2d754d;
          border-color: rgba(99, 155, 119, 0.3);
        }

        .po-ghost-btn {
          border: 1px solid rgba(216, 207, 195, 0.95);
          background: rgba(255,255,255,0.86);
          color: #3d3448;
          border-radius: 12px;
          min-height: 34px;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          transition: transform 0.16s ease, background 0.16s ease;
        }

        .po-ghost-btn:hover {
          transform: translateY(-1px);
          background: #fff;
        }

        @media (max-width: 720px) {
          .po-events-card::before {
            left: 27px;
          }

          .po-event-card {
            grid-template-columns: 38px minmax(0, 1fr);
            padding: 12px;
          }

          .po-event-marker {
            width: 34px;
            height: 34px;
            border-radius: 13px;
            font-size: 15px;
          }

          .po-event-card__top {
            flex-direction: column;
          }

          .po-event-card__payload-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="po-section-head">
        <h3>Movimientos</h3>
        <p>Timeline operativo de la orden, con eventos agrupados visualmente por tipo.</p>
      </div>

      <div className="po-events-timeline">
        {latestEvents.length === 0 ? (
          <div className="po-empty-state">Todavía no hay movimientos registrados.</div>
        ) : (
          latestEvents.map((event) => {
            const entries = payloadEntries(event.payload);
            const expanded = !!expandedEvents[event.id];
            const tone = eventVisualTone(event.event_type);

            return (
              <article
                key={event.id}
                className={`po-event-card po-event-card--${tone}`}
              >
                <div className="po-event-marker" aria-hidden="true">
                  {eventIcon(event.event_type)}
                </div>

                <div className="po-event-body">
                  <div className="po-event-card__top">
                    <div className="po-event-card__main">
                      <span className="po-event-type-pill">
                        {translateEventType(event.event_type)}
                      </span>

                      <strong className="po-event-card__summary">
                        {summarizeEvent(event)}
                      </strong>

                      <span className="po-event-date">
                        {formatDateTime(event.created_at)}
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
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function ProductionOrderDetailPanel({ orderId }: Props) {
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
  const [activeTab, setActiveTab] = useState<DetailTab>("operation");
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
    create_dress_records: false,
  });

  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [fabricAvailability, setFabricAvailability] = useState<FabricAvailability | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const [uploadingDesignImage, setUploadingDesignImage] = useState(false);
  const [designImageError, setDesignImageError] = useState("");

  useEffect(() => {
    void loadAll();
  }, [orderId]);

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
        api.get<ProductionOrder>(`/production-orders/${orderId}`),
        api.get<CostSummary>(`/production-orders/${orderId}/cost-summary`),
        api.get<Fabric[]>("/fabrics"),
        api.get<Material[]>(`/production-orders/${orderId}/materials`),
        api.get<EventItem[]>(`/production-orders/${orderId}/events`),
        api.get<PaginatedResponse<Roll>>("/fabric-rolls", {
          params: { page: 1, page_size: 100 },
        }),
        api.get<PaginatedResponse<Trim>>("/trims", {
          params: { page: 1, page_size: 100 },
        }),
        api.get<OutputItem[]>(`/production-orders/${orderId}/outputs`),
      ]);

      setOrder(orderRes.data);
      setCostSummary(costRes.data);
      setFabrics(Array.isArray(fabricsRes.data) ? fabricsRes.data : []);
      setMaterials(materialsRes.data || []);
      setEvents(eventsRes.data || []);
      setRolls(Array.isArray(rollsRes.data?.items) ? rollsRes.data.items : []);
      setTrims(Array.isArray(trimsRes.data?.items) ? trimsRes.data.items : []);
      setOutputs(Array.isArray(outputsRes.data) ? outputsRes.data : []);

      setReceiveForm({
        produced_quantity: String(orderRes.data.produced_quantity ?? ""),
        status: orderRes.data.status === "COMPLETED" ? "COMPLETED" : "PARTIALLY_RECEIVED",
        received_notes: orderRes.data.received_notes || "",
      });

      setCostForm((prev) => ({
        labor_cost: String(orderRes.data.labor_cost ?? "0"),
        additional_cost: String(orderRes.data.additional_cost ?? "0"),
        currency: orderRes.data.currency || "USD",
        price_multiplier: prev.price_multiplier || "2.5",
        exchange_rate: prev.exchange_rate || "1000",
      }));
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || "No se pudo cargar la orden.");
    } finally {
      setLoading(false);
    }
  };

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
    } catch {
      setFabricAvailability(null);
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (!fabricForm.fabric_id || !fabricForm.planned_quantity) {
      setFabricAvailability(null);
      return;
    }
    void checkFabricAvailability(fabricForm.fabric_id, fabricForm.planned_quantity);
  }, [fabricForm.fabric_id, fabricForm.planned_quantity]);

  const saveCosts = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setError("");
      await api.post(`/production-orders/${orderId}/costs`, {
        labor_cost: Number(costForm.labor_cost || 0),
        additional_cost: Number(costForm.additional_cost || 0),
        currency: costForm.currency || "USD",
      });
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || "No se pudieron guardar los costos.");
    }
  };

  const addFabricMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!fabricForm.fabric_roll_id) {
        setError("Seleccioná un rollo");
        return;
      }

      await api.post(`/production-orders/${orderId}/materials/fabric`, {
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
      setError(err?.response?.data?.detail?.message || "No se pudo agregar la tela.");
    }
  };

  const addTrimMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post(`/production-orders/${orderId}/materials/trim`, null, {
        params: {
          trim_id: trimForm.trim_id,
          planned_quantity: Number(trimForm.planned_quantity),
          notes: trimForm.notes || undefined,
        },
      });
      setTrimForm({ trim_id: "", planned_quantity: "", notes: "" });
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || "No se pudo agregar el avío.");
    }
  };

  const reserveMaterial = async (materialId: string) => {
    try {
      await api.post(`/production-orders/${orderId}/materials/${materialId}/reserve`);
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudo reservar el material."));
    }
  };

  const removeMaterial = async (materialId: string) => {
    const confirmed = window.confirm("¿Querés quitar este material de la orden?");
    if (!confirmed) return;

    try {
      await api.delete(`/production-orders/${orderId}/materials/${materialId}`);
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudo eliminar el material."));
    }
  };

  const issueMaterial = async (materialId: string) => {
    try {
      await api.post(`/production-orders/${orderId}/materials/${materialId}/issue`);
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
      for (const material of pending) {
        await api.post(`/production-orders/${orderId}/materials/${material.id}/issue`);
      }
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudieron entregar todos los materiales."));
    } finally {
      setIssuingAll(false);
    }
  };

  const receiveOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api.post(`/production-orders/${orderId}/receive`, {
        produced_quantity: Number(receiveForm.produced_quantity || 0),
        status: receiveForm.status,
        received_notes: receiveForm.received_notes || null,
      });
      await loadAll();
    } catch (err: any) {
      setError(String(err?.response?.data?.detail || "No se pudo registrar la recepción."));
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
      await api.post(`/production-orders/${orderId}/outputs`, {
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
  const tenantLogoUrl = toAbsoluteAssetUrl(order?.tenant_logo_url);

  const downloadPdf = (mode: PdfMode) => {
    if (!order) return;

    const html = buildPrintDocumentHtml({
      mode,
      order,
      costSummary,
      fabricMaterials,
      trimMaterials,
      designPhoto,
      tenantLogoUrl,
    });

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
      }, 1200);
    };

    const win = iframe.contentWindow;
    const doc = win?.document;

    if (!doc || !win) {
      setError("No se pudo generar la impresión.");
      iframe.remove();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      const afterPrint = () => {
        win.removeEventListener("afterprint", afterPrint);
        cleanup();
      };

      win.addEventListener("afterprint", afterPrint);
      win.focus();
      win.print();

      window.setTimeout(() => {
        win.removeEventListener("afterprint", afterPrint);
        cleanup();
      }, 2500);
    };

    if (doc.readyState === "complete") {
      window.setTimeout(triggerPrint, 250);
    } else {
      iframe.onload = () => {
        window.setTimeout(triggerPrint, 250);
      };
    }
  };

  if (loading) {
    return <div className="po-loading">Cargando orden...</div>;
  }

  if (!order) {
    return <div className="po-error">Orden no encontrada</div>;
  }

  return (
    <div className="po-detail-panel">
      <style>{`
        .po-hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 18px;
          padding: 6px 0 2px;
        }

        .po-hero__main {
          display: grid;
          gap: 4px;
        }

        .po-hero__eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #8a7f73;
          font-weight: 700;
        }

        .po-hero__title {
          margin: 0;
          font-size: 26px;
          line-height: 1;
          letter-spacing: -0.04em;
          color: #2f2940;
        }

        .po-hero__subtitle {
          margin: 0;
          font-size: 15px;
          color: #6f687b;
        }

        .po-hero__actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .po-action-btn {
          appearance: none;
          border: 1px solid #d8cfc3;
          background: #fff;
          color: #2f2940;
          border-radius: 14px;
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.18s ease;
          box-shadow: 0 8px 18px rgba(20, 20, 20, 0.05);
        }

        .po-action-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(20, 20, 20, 0.08);
        }

        .po-action-btn--primary {
          background: linear-gradient(135deg, #171717 0%, #2f2940 100%);
          color: #fff;
          border-color: #171717;
        }

        .po-meta-compact-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .po-meta-compact-card {
          background: #ffffff;
          border: 1px solid #e3d9ce;
          border-radius: 18px;
          padding: 14px 16px;
          min-height: 86px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .po-meta-compact-card span {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #8a7f73;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .po-meta-compact-card strong {
          font-size: 16px;
          line-height: 1.2;
          color: #4d4659;
        }

        @media (max-width: 980px) {
          .po-hero {
            flex-direction: column;
            align-items: stretch;
          }

          .po-meta-compact-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .po-meta-compact-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="po-hero">
        <div className="po-hero__main">
          <span className="po-hero__eyebrow">Orden de producción</span>
          <h2 className="po-hero__title">{order.order_number}</h2>
          <p className="po-hero__subtitle">{order.target_dress_name}</p>
        </div>

        <div className="po-hero__actions">
          <button
            className="po-action-btn po-action-btn--primary"
            onClick={() => downloadPdf("operation")}
            type="button"
          >
            PDF Taller
          </button>

          <button
            className="po-action-btn"
            onClick={() => downloadPdf("finance")}
            type="button"
          >
            PDF Costos
          </button>
        </div>
      </div>

      <div className="po-meta-compact-grid">
        <div className="po-meta-compact-card">
          <span>Estado</span>
          <strong>{translateOrderStatus(order.status)}</strong>
        </div>

        <div className="po-meta-compact-card">
          <span>Prioridad</span>
          <strong>{translatePriority(order.priority)}</strong>
        </div>

        <div className="po-meta-compact-card">
          <span>Taller</span>
          <strong>{order.workshop_supplier_name || "-"}</strong>
        </div>

        <div className="po-meta-compact-card">
          <span>Entrega</span>
          <strong>{formatDate(order.due_date)}</strong>
        </div>
      </div>

      <div className="po-detail-tabs">
        <button
          type="button"
          className={`po-detail-tab ${activeTab === "operation" ? "po-detail-tab--active" : ""}`}
          onClick={() => setActiveTab("operation")}
        >
          Operación
        </button>

        <button
          type="button"
          className={`po-detail-tab ${activeTab === "finance" ? "po-detail-tab--active" : ""}`}
          onClick={() => setActiveTab("finance")}
        >
          Costos
        </button>

        <button
          type="button"
          className={`po-detail-tab ${activeTab === "events" ? "po-detail-tab--active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          Movimientos
        </button>
      </div>

      {error ? <div className="po-inline-error">{error}</div> : null}

      <div className="po-tab-content">
        {activeTab === "operation" ? (
          <ProductionOrderOperationTab
            t={null}
            i18n={null}
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
            t={null}
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
            latestEvents={latestEvents}
            expandedEvents={expandedEvents}
            setExpandedEvents={setExpandedEvents}
          />
        )}
      </div>
    </div>
  );
}

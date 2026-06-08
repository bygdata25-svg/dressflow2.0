import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useTranslation } from "react-i18next";
import ProductionOrderOperationTab from "./ProductionOrderOperationTab";
import ProductionOrderFinanceTab from "./ProductionOrderFinanceTab";
import { formatCurrencyAmount, getCurrencySymbol } from "../../utils/currency";
import "../../styles/production-orders.css";

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

type ProductionOrderAssignment = {
  id: string;
  tenant_id: string;
  production_order_id: string;
  supplier_id: string;
  process_type_id: string;
  appointment_id?: string | null;
  status: string;
  estimated_cost?: string | number | null;
  actual_cost?: string | number | null;
  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
  supplier_name?: string | null;
  process_code?: string | null;
  process_name?: string | null;
  process_color?: string | null;
  process_icon?: string | null;
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

function normalizeCurrencyCode(currency?: string | null) {
  return String(currency || "USD").toUpperCase().trim();
}

function currencyLabel(currency?: string | null) {
  const currencyCode = normalizeCurrencyCode(currency);
  return `${getCurrencySymbol(currencyCode)} ${currencyCode}`;
}

function formatMoney(value?: string | number | null, currency = "USD", locale = "es-AR") {
  const currencyCode = normalizeCurrencyCode(currency);

  return formatCurrencyAmount(value ?? 0, {
    locale,
    currencyCode,
    symbol: getCurrencySymbol(currencyCode),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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


function normalizePayloadKey(key: string) {
  const map: Record<string, string> = {
    order_number: "orderNumber",
    roll_code: "rollCode",
    trim_code: "trimCode",
    material_id: "materialId",
    material_type: "materialType",
    reserved_quantity: "reservedQuantity",
    issued_quantity: "issuedQuantity",
    returned_quantity: "returnedQuantity",
    waste_quantity: "wasteQuantity",
    consumed_quantity: "consumedQuantity",
    produced_quantity: "producedQuantity",
    labor_cost: "laborCost",
    additional_cost: "additionalCost",
    unit_cost_snapshot: "unitCostSnapshot",
    design_photo_url: "designPhotoUrl",
  };

  return map[key] || key;
}

function translateEventType(t: any, value?: string | null) {
  const key = String(value || "").trim().toUpperCase();

  return t(`production-orders:events.types.${key}`, {
    defaultValue: value || t("production-orders:events.fallback"),
  });
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

function summarizeEvent(t: any, event: EventItem) {
  const key = String(event.event_type || "").trim().toUpperCase();
  return t(`production-orders:events.summaries.${key}`, {
    ...(event.payload || {}),
    defaultValue: translateEventType(t, event.event_type),
  });
}

function translateOrderStatus(t: any, value?: string | null) {
  const key = String(value || "").trim().toUpperCase();
  return t(`production-orders:status.${key}`, value || "-");
}

function translatePriority(t: any, value?: string | null) {
  const key = String(value || "").trim().toUpperCase();
  return t(`production-orders:priority.${key}`, value || "-");
}

function translateAssignmentStatus(t: any, value?: string | null) {
  const key = String(value || "").trim().toUpperCase();

  if (!key) {
    return "-";
  }

  return t(`production-orders:assignments.status.${key}`, {
    defaultValue: key,
  });
}

function assignmentStatusClass(status?: string | null) {
  const key = String(status || "").trim().toUpperCase();

  if (!key) {
    return "po-assignment-badge po-assignment-badge--scheduled";
  }

  if (key === "COMPLETED" || key === "DONE" || key === "FINISHED") {
    return "po-assignment-badge po-assignment-badge--completed";
  }

  if (key === "IN_PROGRESS" || key === "STARTED") {
    return "po-assignment-badge po-assignment-badge--progress";
  }

  if (key === "CANCELLED" || key === "CANCELED") {
    return "po-assignment-badge po-assignment-badge--cancelled";
  }

  return "po-assignment-badge po-assignment-badge--scheduled";
}



function assignmentIcon(icon?: string | null, code?: string | null, name?: string | null) {
  const normalizedIcon = String(icon || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ");

  const normalizedName = String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ");

  const signature = `${normalizedIcon} ${normalizedCode.toLowerCase()} ${normalizedName}`;

  if (/scissors|scissor|cutting|cut|corte/.test(signature)) return "✂";
  if (/sewing|shirt|confeccion|costura|sew/.test(signature)) return "◈";
  if (/sparkles|sparkle|embroidery|embroider|bordado|bordar/.test(signature)) return "✦";
  if (/gem|beading|bead|pedreria|perla|beads/.test(signature)) return "◆";
  if (/wand|finishing|finish|terminacion|acabado|iron/.test(signature)) return "✧";
  if (/badge check|badgecheck|quality|control calidad|quality control|check/.test(signature)) return "✓";
  if (/packaging|package|empaque|packing/.test(signature)) return "□";

  const trimmedIcon = String(icon || "").trim();
  if (trimmedIcon && !/[a-zA-Z]{3,}/.test(trimmedIcon) && trimmedIcon.length <= 3) {
    return trimmedIcon;
  }

  return "•";
}

function translatePayloadKey(t: any, value?: string | null) {
  const key = normalizePayloadKey(String(value || "").trim());
  return t(`production-orders:events.payload.${key}`, key);
}

function translatePayloadValue(t: any, key: string, value: unknown) {
  if (value === null || value === undefined) return "-";

  const normalizedKey = normalizePayloadKey(String(key || "").trim());

  if (normalizedKey === "status") {
    return translateOrderStatus(t, String(value));
  }

  if (normalizedKey === "materialType") {
    const raw = String(value || "").trim().toUpperCase();
    if (raw === "FABRIC_ROLL") return t("production-orders:materials.fabric");
    if (raw === "TRIM") return t("production-orders:materials.trim");
  }

  return String(value);
}


function getProductionOrderErrorMessage(
  t: any,
  code?: string,
  _fallback?: string
) {
  const key = String(code || "").trim().toUpperCase();

  const map: Record<
    string,
    {
      title: string;
      message: string;
    }
  > = {
    FABRIC_ROLL_NOT_ENOUGH_AVAILABLE: {
      title: t("production-orders:errors.stockTitle"),
      message: t(
        "production-orders:errors.fabricRollNotEnough"
      ),
    },
    FABRIC_ROLL_NOT_ENOUGH_AVAILABLE_TO_RESERVE: {
      title: t("production-orders:errors.reserveTitle"),
      message: t(
        "production-orders:errors.fabricReserveNotEnough"
      ),
    },
    TRIM_NOT_ENOUGH_AVAILABLE_TO_RESERVE: {
      title: t("production-orders:errors.reserveTitle"),
      message: t(
        "production-orders:errors.trimReserveNotEnough"
      ),
    },
    ISSUED_MATERIAL_CANNOT_BE_DELETED: {
      title: t("production-orders:errors.materialDeleteTitle"),
      message: t(
        "production-orders:errors.materialDeleteIssued"
      ),
    },
    INVALID_PLANNED_QUANTITY: {
      title: t("production-orders:errors.invalidQuantityTitle"),
      message: t(
        "production-orders:errors.invalidPlannedQuantity"
      ),
    },
    MISSING_ROLL: {
      title: t("production-orders:errors.missingRollTitle"),
      message: t("production-orders:errors.missingRollMessage"),
    },
    MISSING_TRIM: {
      title: t("production-orders:errors.missingTrimTitle"),
      message: t("production-orders:errors.missingTrimMessage"),
    },
  };

  return (
    map[key] || {
      title: t("production-orders:errors.genericTitle"),
      message: t("production-orders:errors.genericMessage"),
    }
  );
}

function extractApiError(err: any, fallback: string) {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") {
    return {
      code: err?.response?.data?.code || "",
      message: detail,
    };
  }

  if (Array.isArray(detail)) {
    return {
      code: "",
      message: detail.map((item: any) => item?.msg || String(item)).join(" · "),
    };
  }

  return {
    code:
      detail?.code ||
      detail?.error_code ||
      detail?.type ||
      err?.response?.data?.code ||
      "",
    message:
      detail?.message ||
      detail?.detail ||
      err?.response?.data?.message ||
      fallback,
  };
}

function payloadEntries(t: any, payload?: Record<string, unknown> | null) {
  if (!payload) return [];
  return Object.entries(payload).map(([key, value]) => ({
    key,
    label: translatePayloadKey(t, key),
    value: translatePayloadValue(t, key, value),
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

function formatPrintMoney(value?: string | number | null, currency = "USD", lang: PrintLang = "es") {
  const locale = lang === "en" ? "en-US" : "es-AR";
  return formatMoney(value, currency, locale);
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


type PrintLang = "es" | "en";

function normalizePrintLang(lang?: string | null): PrintLang {
  return String(lang || "").toLowerCase().startsWith("en") ? "en" : "es";
}

function printLabel(t: any, key: string) {
  return t(`production-orders:print.${key}`);
}


function getPrintableStatus(t: any, status?: string | null) {
  if (!status) return "-";

  const map: Record<string, string> = {
    DRAFT: printLabel(t, "draft"),
    MATERIALS_RESERVED: printLabel(t, "materialsReserved"),
    IN_PRODUCTION: printLabel(t, "inProduction"),
    APPROVED: printLabel(t, "approved"),
    COMPLETED: printLabel(t, "completed"),
    CANCELLED: printLabel(t, "cancelled"),
  };

  return map[status] || status;
}

function getPrintablePriority(t: any, priority?: string | null) {
  if (!priority) return "-";

  const map: Record<string, string> = {
    LOW: printLabel(t, "low"),
    NORMAL: printLabel(t, "normal"),
    HIGH: printLabel(t, "high"),
    URGENT: printLabel(t, "urgent"),
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
  t,
  mode,
  order,
  costSummary,
  fabricMaterials,
  trimMaterials,
  designPhoto,
  tenantLogoUrl,
  lang,
}: {
  t: any;
  mode: PdfMode;
  order: ProductionOrder;
  costSummary: CostSummary | null;
  fabricMaterials: Array<any>;
  trimMaterials: Array<any>;
  designPhoto: string | null;
  tenantLogoUrl: string | null;
  lang: PrintLang;
}) {
  const currency = costSummary?.currency || order.currency || "USD";
  const tenantName = order.tenant_name || "DressFlow";

  const title =
    mode === "finance"
      ? printLabel(t, "costsTitle")
      : printLabel(t, "workshopTitle");

  const subtitle =
    mode === "finance"
      ? printLabel(t, "costsSubtitle")
      : printLabel(t, "workshopSubtitle");

  const renderRows = (items: Array<any>, includeCosts: boolean) => {
    if (items.length === 0) {
      return `
        <tr>
          <td colspan="${includeCosts ? 7 : 6}" class="empty">${printLabel(t, "noRecords")}</td>
        </tr>
      `;
    }

    return items
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
              ? `<td>${safeText(formatPrintMoney(item.unit_cost_snapshot, currency, lang))}</td>`
              : ""
          }
        </tr>
      `
      )
      .join("");
  };

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
            <span class="section-kicker">${printLabel(t, "internal")}</span>
            <h2>${printLabel(t, "costSummary")}</h2>
          </div>
        </div>

        <div class="finance-hero">
          <div class="finance-main">
            <span class="finance-label">${printLabel(t, "totalCosts")}</span>
            <strong>${safeText(formatPrintMoney(financeTotal, currency, lang))}</strong>
            <p>${printLabel(t, "totalCostsHint")}</p>
          </div>

          <div class="finance-side">
            <div class="finance-mini finance-mini-dark">
              <span>${printLabel(t, "currency")}</span>
              <strong>${safeText(currencyLabel(currency))}</strong>
            </div>
            <div class="finance-mini finance-mini-dark">
              <span>${printLabel(t, "produced")}</span>
              <strong>${safeText(order.produced_quantity)}</strong>
            </div>
          </div>
        </div>

        <div class="finance-grid finance-grid--compact">
          <div class="finance-card">
            <span>${printLabel(t, "materialCost")}</span>
            <strong>${safeText(formatPrintMoney(financeMaterialCost, currency, lang))}</strong>
          </div>
          <div class="finance-card">
            <span>${printLabel(t, "laborOthers")}</span>
            <strong>${safeText(formatPrintMoney(financeLaborAndOther, currency, lang))}</strong>
          </div>
          <div class="finance-card">
            <span>${printLabel(t, "total")}</span>
            <strong>${safeText(formatPrintMoney(financeTotal, currency, lang))}</strong>
          </div>
        </div>
      </section>
    `
      : "";

  return `
  <!doctype html>
  <html lang="${lang}">
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
              <span class="chip">${safeText(getPrintableStatus(t, order.status))}</span>
              <span class="chip">${printLabel(t, "priority")}: ${safeText(
                getPrintablePriority(t, order.priority)
              )}</span>
              <span class="chip">${printLabel(t, "delivery")}: ${safeText(formatDate(order.due_date))}</span>
              <span class="chip">${mode === "finance" ? printLabel(t, "internalUse") : printLabel(t, "workshopUse")}</span>
            </div>
          </div>

          <div class="order-box">
            <span class="label">${printLabel(t, "order")}</span>
            <span class="value">${safeText(order.order_number)}</span>
            <div class="sub">${printLabel(t, "workshop")}: ${safeText(order.workshop_supplier_name)}</div>
          </div>
        </section>

        <section class="hero">
          <div class="card">
            <div class="card-head">${printLabel(t, "garmentInfo")}</div>
            <div class="card-body">
              <div class="meta-grid">
                <div class="meta-item">
                  <span>${printLabel(t, "garment")}</span>
                  <strong>${safeText(order.target_dress_name)}</strong>
                </div>
                <div class="meta-item">
                  <span>${printLabel(t, "code")}</span>
                  <strong>${safeText(order.target_dress_code)}</strong>
                </div>
                <div class="meta-item">
                  <span>${printLabel(t, "size")}</span>
                  <strong>${safeText(order.target_size)}</strong>
                </div>
                <div class="meta-item">
                  <span>${printLabel(t, "color")}</span>
                  <strong>${safeText(order.target_color)}</strong>
                </div>
                <div class="meta-item">
                  <span>${printLabel(t, "planned")}</span>
                  <strong>${safeText(order.planned_quantity)}</strong>
                </div>
                <div class="meta-item">
                  <span>${printLabel(t, "produced")}</span>
                  <strong>${safeText(order.produced_quantity)}</strong>
                </div>
              </div>

              <div class="note">
                <strong>${printLabel(t, "notes")}</strong>
                ${safeText(order.notes, printLabel(t, "noNotes"))}
              </div>

              <div class="note">
                <strong>${printLabel(t, "reception")}</strong>
                ${safeText(order.received_notes, printLabel(t, "noReceptionNotes"))}
              </div>
            </div>
          </div>

          <div class="visual">
            <div class="card">
              <div class="card-head">${printLabel(t, "referenceImage")}</div>
              <div class="card-body">
                <div class="image-box">
                  ${
                    designPhoto
                      ? `<img src="${designPhoto}" alt="${safeText(order.target_dress_name)}" />`
                      : `<div class="image-empty">${printLabel(t, "noReferenceImage")}</div>`
                  }
                </div>
              </div>
            </div>

            <div class="mini-grid">
              <div class="mini-card">
                <span>${printLabel(t, "status")}</span>
                <strong>${safeText(getPrintableStatus(t, order.status))}</strong>
              </div>
              <div class="mini-card">
                <span>${printLabel(t, "priority")}</span>
                <strong>${safeText(getPrintablePriority(t, order.priority))}</strong>
              </div>
              <div class="mini-card">
                <span>${printLabel(t, "workshop")}</span>
                <strong>${safeText(order.workshop_supplier_name)}</strong>
              </div>
            </div>
          </div>
        </section>

        <section class="section section-materials">
          <div class="section-title-row">
            <h2>${printLabel(t, "assignedFabrics")}</h2>
            <span class="section-kicker">${printLabel(t, "materials")}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>${printLabel(t, "description")}</th>
                  <th>${printLabel(t, "roll")}</th>
                  <th>${printLabel(t, "planned")}</th>
                  <th>${printLabel(t, "delivered")}</th>
                  <th>${printLabel(t, "unit")}</th>
                  <th>${printLabel(t, "notes")}</th>
                  ${mode === "finance" ? `<th>${printLabel(t, "unitCost")}</th>` : ""}
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
            <h2>${printLabel(t, "assignedTrims")}</h2>
            <span class="section-kicker">${printLabel(t, "accessories")}</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>${printLabel(t, "description")}</th>
                  <th>${printLabel(t, "roll")}</th>
                  <th>${printLabel(t, "planned")}</th>
                  <th>${printLabel(t, "delivered")}</th>
                  <th>${printLabel(t, "unit")}</th>
                  <th>${printLabel(t, "notes")}</th>
                  ${mode === "finance" ? `<th>${printLabel(t, "unitCost")}</th>` : ""}
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
          <div>${printLabel(t, "productionSignature")}</div>
          <div>${printLabel(t, "workshopSignature")}</div>
        </section>

        <div class="footer">
          ${safeText(tenantName)} · ${mode === "finance" ? printLabel(t, "internalCostSheet") : printLabel(t, "workshopSheet")}
        </div>
      </div>
    </body>
  </html>
  `;
}


function ProductionOrderEventsTab({
  t,
  latestEvents,
  expandedEvents,
  setExpandedEvents,
}: {
  t: any;
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
          gap: 12px;
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
        <h3>{t("production-orders:events.title")}</h3>
        <p>{t("production-orders:events.subtitle")}</p>
      </div>

      <div className="po-events-timeline">
        {latestEvents.length === 0 ? (
          <div className="po-empty-state">{t("production-orders:events.empty")}</div>
        ) : (
          latestEvents.map((event) => {
            const entries = payloadEntries(t, event.payload);
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
                        {translateEventType(t, event.event_type)}
                      </span>

                      <strong className="po-event-card__summary">
                        {summarizeEvent(t, event)}
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
                        {expanded ? t("production-orders:events.hideDetails") : t("production-orders:events.showDetails")}
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

function ProductionOrderAssignmentsSection({
  t,
  assignments,
  locale,
}: {
  t: any;
  assignments: ProductionOrderAssignment[];
  locale: string;
}) {
  return (
    <section className="po-section-card po-assignments-section">
      <style>{`
        .po-assignments-section {
          position: relative;
          overflow: hidden;
        }

        .po-assignments-section::before {
          content: "";
          position: absolute;
          inset: 0 0 auto auto;
          width: 260px;
          height: 260px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(195, 140, 122, 0.14), transparent 68%);
          pointer-events: none;
        }

        .po-assignments-grid {
          display: grid;
          gap: 14px;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          position: relative;
          z-index: 1;
        }

        .po-assignment-card {
          border: 1px solid rgba(222, 211, 203, 0.9);
          border-radius: 22px;
          padding: 16px;
          background:
            radial-gradient(circle at top right, rgba(195, 140, 122, 0.08), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%);
          box-shadow: 0 14px 30px rgba(52, 41, 58, 0.06);
          display: grid;
          gap: 14px;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .po-assignment-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 20px 42px rgba(52, 41, 58, 0.09);
          border-color: rgba(195, 140, 122, 0.42);
        }

        .po-assignment-card__top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .po-assignment-card__process {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .po-assignment-card__process strong {
          display: block;
          font-size: 15px;
          color: #2f2940;
          line-height: 1.2;
        }

        .po-assignment-card__process span {
          color: #85776c;
          font-size: 13px;
          line-height: 1.25;
        }

        .po-assignment-card__icon {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          background: #f7efe8;
          border: 1px solid rgba(216, 207, 195, 0.95);
          color: #6f4f70;
          font-size: 16px;
          line-height: 1;
          overflow: hidden;
          flex-shrink: 0;
        }

        .po-assignment-card__meta {
          display: grid;
          gap: 8px;
          font-size: 13px;
          color: #5f5667;
        }

        .po-assignment-card__meta span {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .po-assignment-card__notes {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: #4a4355;
          border-top: 1px solid rgba(226, 218, 209, 0.9);
          padding-top: 12px;
        }

        .po-assignment-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .po-assignment-badge--scheduled {
          background: #f3f0ff;
          color: #6b4aa0;
        }

        .po-assignment-badge--progress {
          background: #edf7fb;
          color: #2f6d82;
        }

        .po-assignment-badge--completed {
          background: #eefaf2;
          color: #2d754d;
        }

        .po-assignment-badge--cancelled {
          background: #fff1f1;
          color: #9d4040;
        }
      `}</style>

      <div className="po-section-head">
        <h3>{t("production-orders:assignments.title")}</h3>
        <p>
          {t("production-orders:assignments.subtitle")}
        </p>
      </div>

      <div className="po-assignments-grid">
        {assignments.length === 0 ? (
          <div className="po-empty-state">
            {t("production-orders:assignments.empty")}
          </div>
        ) : (
          assignments.map((assignment) => (
            <article key={assignment.id} className="po-assignment-card">
              <div className="po-assignment-card__top">
                <div style={{ display: "flex", gap: 12, minWidth: 0 }}>
                  <div
                    className="po-assignment-card__icon"
                    style={
                      assignment.process_color
                        ? {
                            background: `${assignment.process_color}18`,
                            color: assignment.process_color,
                            borderColor: `${assignment.process_color}42`,
                          }
                        : undefined
                    }
                  >
                    <span className="po-process-icon-glyph" aria-hidden="true">
                      {assignmentIcon(assignment.process_icon, assignment.process_code, assignment.process_name)}
                    </span>
                  </div>

                  <div className="po-assignment-card__process">
                    <strong>{assignment.process_name || assignment.process_code || "-"}</strong>
                    <span>{assignment.supplier_name || "-"}</span>
                  </div>
                </div>

                <span className={assignmentStatusClass(assignment.status)}>
                  {translateAssignmentStatus(t, assignment.status)}
                </span>
              </div>

              <div className="po-assignment-card__meta">
                <span>
                  📅 {t("production-orders:assignments.startedAt")}: {formatDateTime(assignment.started_at, locale)}
                </span>
                <span>
                  🏁 {t("production-orders:assignments.finishedAt")}: {formatDateTime(assignment.finished_at, locale)}
                </span>
                {assignment.appointment_id ? (
                  <span>
                    🗓 {t("production-orders:assignments.syncedWithAgenda")}
                  </span>
                ) : null}
              </div>

              {assignment.notes ? (
                <p className="po-assignment-card__notes">{assignment.notes}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default function ProductionOrderDetailPanel({ orderId }: Props) {
  const { t, i18n } = useTranslation(["common", "production-orders"]);
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [trims, setTrims] = useState<Trim[]>([]);
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [assignments, setAssignments] = useState<ProductionOrderAssignment[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorDialog, setErrorDialog] = useState<{
    title: string;
    message: string;
    detail?: string;
  } | null>(null);
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

  const showApiError = (err: any, fallback: string) => {
    const parsedError = extractApiError(err, fallback);

    const mappedError = getProductionOrderErrorMessage(
      t,
      parsedError.code,
      parsedError.message
    );

    setError("");
  
    setErrorDialog({
      title: mappedError.title,
      message: mappedError.message,
    });
  };

  const closeErrorDialog = () => setErrorDialog(null);


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
        assignmentsRes,
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
        api.get<ProductionOrderAssignment[]>(`/production-orders/${orderId}/assignments`),
      ]);

      setOrder(orderRes.data);
      setCostSummary(costRes.data);
      setFabrics(Array.isArray(fabricsRes.data) ? fabricsRes.data : []);
      setMaterials(materialsRes.data || []);
      setEvents(eventsRes.data || []);
      setRolls(Array.isArray(rollsRes.data?.items) ? rollsRes.data.items : []);
      setTrims(Array.isArray(trimsRes.data?.items) ? trimsRes.data.items : []);
      setOutputs(Array.isArray(outputsRes.data) ? outputsRes.data : []);
      setAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);


      setCostForm((prev) => ({
        labor_cost: String(orderRes.data.labor_cost ?? "0"),
        additional_cost: String(orderRes.data.additional_cost ?? "0"),
        currency: orderRes.data.currency || "USD",
        price_multiplier: prev.price_multiplier || "2.5",
        exchange_rate: prev.exchange_rate || "1000",
      }));
    } catch (err: any) {
      setError(err?.response?.data?.detail?.message || t("production-orders:messages.detailLoadError"));
    } finally {
      setLoading(false);
    }
  };

  const refreshAssignments = async () => {
    try {
      const response = await api.get<ProductionOrderAssignment[]>(
        `/production-orders/${orderId}/assignments`
      );

      setAssignments(Array.isArray(response.data) ? response.data : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t(
            "production-orders:assignments.loadError",
            "No se pudieron cargar los procesos de la orden."
          )
      );
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
      showApiError(
        err,
        t("production-orders:costs.saveError")
      );
    }
  };

  const addFabricMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!fabricForm.fabric_roll_id) {
        setError("");
        setErrorDialog({
          title: t("production-orders:errors.missingRollTitle"),
          message: t("production-orders:errors.missingRollMessage"),
        });
        return;
      }

      if (Number(fabricForm.planned_quantity || 0) <= 0) {
        setError("");
        setErrorDialog({
          title: t("production-orders:errors.invalidQuantityTitle"),
          message: t("production-orders:errors.invalidPlannedQuantity"),
        });
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
      showApiError(
        err,
        t("production-orders:materials.addFabricError")
      );
    }
  };

  const addTrimMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (!trimForm.trim_id) {
        setError("");
        setErrorDialog({
          title: t("production-orders:errors.missingTrimTitle"),
          message: t("production-orders:errors.missingTrimMessage"),
        });
        return;
      }

      if (Number(trimForm.planned_quantity || 0) <= 0) {
        setError("");
        setErrorDialog({
          title: t("production-orders:errors.invalidQuantityTitle"),
          message: t("production-orders:errors.invalidPlannedQuantity"),
        });
        return;
      }

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
      showApiError(
        err,
        t("production-orders:materials.addTrimError")
      );
    }
  };

  const reserveMaterial = async (materialId: string) => {
    try {
      await api.post(`/production-orders/${orderId}/materials/${materialId}/reserve`);
      await loadAll();
    } catch (err: any) {
      showApiError(
        err,
        t("production-orders:materials.reserveError")
      );
    }
  };

  const removeMaterial = async (materialId: string) => {
    const confirmed = window.confirm(t("production-orders:materials.confirmRemove"));
    if (!confirmed) return;

    try {
      await api.delete(`/production-orders/${orderId}/materials/${materialId}`);
      await loadAll();
    } catch (err: any) {
      showApiError(
        err,
        t("production-orders:materials.removeError")
      );
    }
  };

  const issueMaterial = async (materialId: string) => {
    try {
      await api.post(`/production-orders/${orderId}/materials/${materialId}/issue`);
      await loadAll();
    } catch (err: any) {
      showApiError(
        err,
        t("production-orders:materials.issueError")
      );
    }
  };

  const issueAllMaterials = async () => {
    const pending = materialCards.filter((m) => m.canIssue);
    if (pending.length === 0) {
      setError(t("production-orders:materials.noMaterialsToIssue"));
      return;
    }

    const confirmed = window.confirm(t("production-orders:materials.confirmIssueAll"));
    if (!confirmed) return;

    try {
      setIssuingAll(true);
      for (const material of pending) {
        await api.post(`/production-orders/${orderId}/materials/${material.id}/issue`);
      }
      await loadAll();
    } catch (err: any) {
      showApiError(
        err,
        t("production-orders:materials.issueAllError")
      );
    } finally {
      setIssuingAll(false);
    }
  };


  const createOutput = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setError("");

      const quantity = Number(outputForm.quantity || 1);

      await api.post(`/production-orders/${orderId}/receive`, {
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
  
    } catch (err: any) {
      showApiError(
        err,
        t("production-orders:outputs.createError")
      );
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

  const designPhoto = toAbsoluteAssetUrl(order?.design_photo_url);
  const tenantLogoUrl = toAbsoluteAssetUrl(order?.tenant_logo_url);

  const downloadPdf = (mode: PdfMode) => {
    if (!order) return;

    const html = buildPrintDocumentHtml({
      t,
      mode,
      order,
      costSummary,
      fabricMaterials,
      trimMaterials,
      designPhoto,
      tenantLogoUrl,
      lang: normalizePrintLang(i18n.language),
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
      setError(t("production-orders:print.error"));
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
    return <div className="po-loading">{t("production-orders:messages.loading")}</div>;
  }

  if (!order) {
    return <div className="po-error">{t("production-orders:messages.notFound")}</div>;
  }

  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      order.planned_quantity > 0
        ? Math.round((order.produced_quantity / order.planned_quantity) * 100)
        : 0
    )
  );

  const locale = i18n.language === "en" ? "en-US" : "es-AR";

  const garmentMeta = [
    order.target_dress_code
      ? `${t("production-orders:fields.codeShort")} ${order.target_dress_code}`
      : null,
    order.target_size
      ? `${t("production-orders:fields.size")} ${order.target_size}`
      : null,
    order.target_color || null,
  ].filter(Boolean);

  const sortedAssignments = [...assignments].sort((a, b) => {
    const aCreated = new Date(a.created_at || a.updated_at || 0).getTime();
    const bCreated = new Date(b.created_at || b.updated_at || 0).getTime();
    return aCreated - bCreated;
  });

  const visibleAssignments = sortedAssignments.slice(0, 6);
  const visibleMaterials = materialCards.slice(0, 5);
  const visibleEvents = latestEvents.slice(0, 4);
  const effectiveCurrency = costSummary?.currency || order.currency || "USD";
  const estimatedTotalCost = toNumber(costSummary?.estimated_total_cost || order.estimated_total_cost);
  const actualTotalCost = toNumber(costSummary?.actual_total_cost || order.actual_total_cost);
  const visibleActualCost = actualTotalCost > 0 ? actualTotalCost : estimatedTotalCost;
  const costVariation = estimatedTotalCost > 0
    ? ((visibleActualCost - estimatedTotalCost) / estimatedTotalCost) * 100
    : 0;
  const completedAssignments = sortedAssignments.filter((item) => {
    const status = String(item.status || "").toUpperCase();
    return status === "COMPLETED" || status === "DONE" || status === "FINISHED";
  }).length;
  const activeAssignments = sortedAssignments.filter((item) => {
    const status = String(item.status || "").toUpperCase();
    return status === "IN_PROGRESS" || status === "STARTED";
  }).length;
  const pendingQuantity = Math.max(0, Number(order.planned_quantity || 0) - Number(order.produced_quantity || 0));
  const nextEvent = visibleEvents[0];
  const notesText = order.notes || order.received_notes || t("production-orders:detailOverview.noNotes");

  return (
    <div className="po-detail-panel po-detail-panel--editorial">
      <style>{`
        .po-detail-panel--editorial {
          display: grid;
          gap: 18px;
        }

        .po-error-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(29, 23, 34, 0.36);
          backdrop-filter: blur(10px);
        }

        .po-error-modal-card {
          width: min(520px, 100%);
          overflow: hidden;
          border: 1px solid rgba(216, 207, 195, 0.96);
          border-radius: 28px;
          background:
            radial-gradient(circle at top right, rgba(195, 140, 122, 0.13), transparent 36%),
            linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%);
          box-shadow: 0 30px 80px rgba(35, 26, 44, 0.22);
        }

        .po-error-modal-header {
          padding: 24px 26px 16px;
          border-bottom: 1px solid rgba(226, 218, 209, 0.9);
        }

        .po-error-modal-header h2 {
          margin: 0;
          color: #2f2940;
          font-size: 24px;
          line-height: 1.05;
          letter-spacing: -0.04em;
        }

        .po-error-modal-header p {
          margin: 8px 0 0;
          color: #83786f;
          font-size: 14px;
          line-height: 1.45;
        }

        .po-error-modal-body {
          padding: 22px 26px;
        }

        .po-error-dialog {
          display: flex;
          gap: 18px;
          align-items: flex-start;
        }

        .po-error-dialog__icon {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: #fff4eb;
          color: #c56d2d;
          display: grid;
          place-items: center;
          font-size: 24px;
          flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
        }

        .po-error-dialog__content {
          display: grid;
          gap: 8px;
          min-width: 0;
        }

        .po-error-dialog__content strong {
          color: #2f2940;
          font-size: 15px;
          line-height: 1.45;
        }

        .po-error-dialog__content p {
          margin: 0;
          color: #7b7284;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }

        .po-error-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 26px 24px;
        }

        .po-error-modal-button {
          border: 1px solid rgba(216, 207, 195, 0.95);
          border-radius: 14px;
          min-height: 40px;
          padding: 0 18px;
          background: linear-gradient(135deg, #171717 0%, #2f2940 100%);
          color: #fff;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(47, 41, 64, 0.16);
        }

        .po-editorial-hero {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(216, 207, 195, 0.78);
          border-radius: 30px;
          background:
            radial-gradient(circle at top right, rgba(212, 175, 55, 0.16), transparent 34%),
            linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(249, 245, 239, 0.94));
          box-shadow: 0 24px 64px rgba(52, 41, 58, 0.11);
        }

        .po-editorial-hero__bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(120deg, rgba(32, 26, 40, 0.04), transparent 45%),
            radial-gradient(circle at 16% 22%, rgba(139, 92, 62, 0.08), transparent 22%);
        }

        .po-editorial-hero__inner {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(150px, 220px) minmax(0, 1fr);
          gap: 16px;
          padding: 14px;
        }

        .po-editorial-hero__visual {
          min-height: 220px;
          border: 1px solid rgba(216, 207, 195, 0.9);
          border-radius: 22px;
          overflow: hidden;
          background:
            radial-gradient(circle at top, rgba(255,255,255,.92), transparent 44%),
            linear-gradient(180deg, rgba(245, 239, 232, 0.96), rgba(235, 226, 216, 0.92));
          display: grid;
          place-items: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
        }

        .po-editorial-hero__visual img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .po-editorial-hero__visual-empty {
          display: grid;
          place-items: center;
          gap: 8px;
          color: #8b7763;
          text-align: center;
          padding: 24px;
        }

        .po-editorial-hero__visual-empty span {
          width: 54px;
          height: 54px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(255,255,255,.72);
          border: 1px solid rgba(216, 207, 195, 0.9);
          font-size: 24px;
          color: #34293a;
        }

        .po-editorial-hero__visual-empty strong {
          font-size: 13px;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .po-editorial-hero__content {
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
        }

        .po-editorial-hero__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .po-editorial-hero__eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: #9a7c61;
        }

        .po-editorial-hero__number {
          margin: 7px 0 0;
          font-size: 30px;
          line-height: .95;
          letter-spacing: -.07em;
          color: #251f2f;
          font-weight: 950;
        }

        .po-editorial-hero__title {
          margin: 6px 0 0;
          color: #4d4659;
          font-size: 17px;
          line-height: 1.16;
          letter-spacing: -.035em;
        }

        .po-editorial-hero__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 9px;
        }

        .po-editorial-chip {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          border-radius: 999px;
          padding: 0 10px;
          border: 1px solid rgba(216, 207, 195, 0.86);
          background: rgba(255,255,255,.72);
          color: #6f6259;
          font-size: 11px;
          font-weight: 850;
        }

        .po-editorial-hero__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 10px;
          flex-shrink: 0;
        }

        .po-action-btn {
          appearance: none;
          border: 1px solid #d8cfc3;
          background: #fff;
          color: #2f2940;
          border-radius: 14px;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 850;
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

        .po-editorial-hero__bottom {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 12px;
          align-items: end;
        }

        .po-editorial-progress {
          display: grid;
          gap: 8px;
        }

        .po-editorial-progress__top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #746a62;
          font-size: 12px;
          font-weight: 850;
        }

        .po-editorial-progress__top strong {
          color: #251f2f;
        }

        .po-editorial-progress__track {
          height: 8px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(216, 207, 195, 0.62);
          box-shadow: inset 0 1px 2px rgba(52,41,58,.08);
        }

        .po-editorial-progress__fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #201a28, #9a7c61);
          box-shadow: 0 8px 18px rgba(32,26,40,.18);
        }

        .po-editorial-due {
          min-width: 118px;
          border: 1px solid rgba(216, 207, 195, 0.88);
          border-radius: 18px;
          background: rgba(255,255,255,.74);
          padding: 10px 12px;
          text-align: right;
        }

        .po-editorial-due span {
          display: block;
          color: #9a8d82;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .po-editorial-due strong {
          display: block;
          margin-top: 4px;
          color: #251f2f;
          font-size: 16px;
          line-height: 1.12;
        }

        .po-meta-compact-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .po-meta-compact-card {
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid rgba(227, 217, 206, 0.92);
          border-radius: 18px;
          padding: 11px 13px;
          min-height: 68px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          box-shadow: 0 14px 34px rgba(52, 41, 58, 0.055);
        }

        .po-meta-compact-card span {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #8a7f73;
          font-weight: 850;
          margin-bottom: 5px;
        }

        .po-meta-compact-card strong {
          font-size: 14px;
          line-height: 1.16;
          color: #4d4659;
        }

        .po-detail-tabs {
          position: sticky;
          top: 0;
          z-index: 5;
          display: flex;
          gap: 8px;
          padding: 8px;
          border: 1px solid rgba(216, 207, 195, 0.72);
          border-radius: 999px;
          background: rgba(255,255,255,.84);
          backdrop-filter: blur(16px);
          box-shadow: 0 18px 38px rgba(52, 41, 58, 0.07);
        }

        .po-detail-tab {
          flex: 1;
          min-height: 40px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: #746a62;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          transition: all .18s ease;
        }

        .po-detail-tab:hover {
          color: #251f2f;
          background: rgba(250, 247, 243, 0.92);
        }

        .po-detail-tab--active {
          color: #fff;
          background: linear-gradient(135deg, #171717 0%, #34293a 100%);
          box-shadow: 0 12px 22px rgba(32,26,40,.16);
        }

        .po-tab-content {
          display: grid;
          gap: 12px;
        }

        @media (max-width: 1120px) {
          .po-editorial-hero__inner {
            grid-template-columns: 1fr;
          }

          .po-editorial-hero__visual {
            min-height: 220px;
          }
        }

        @media (max-width: 980px) {
          .po-editorial-hero__top,
          .po-editorial-hero__bottom {
            grid-template-columns: 1fr;
            flex-direction: column;
            align-items: stretch;
          }

          .po-editorial-hero__actions {
            justify-content: flex-start;
          }

          .po-editorial-due {
            text-align: left;
            width: fit-content;
          }

          .po-meta-compact-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .po-editorial-hero__inner {
            padding: 14px;
          }

          .po-editorial-hero__number {
            font-size: 28px;
          }

          .po-meta-compact-grid {
            grid-template-columns: 1fr;
          }

          .po-detail-tabs {
            border-radius: 22px;
            flex-direction: column;
          }
        }
      `}</style>

      <section className="po-editorial-hero">
        <div className="po-editorial-hero__bg" />

        <div className="po-editorial-hero__inner">
          <div className="po-editorial-hero__visual">
            {designPhoto ? (
              <img src={designPhoto} alt={order.target_dress_name} />
            ) : (
              <div className="po-editorial-hero__visual-empty">
                <span>✦</span>
                <strong>
                  {t("production-orders:design.noReference")}
                </strong>
              </div>
            )}
          </div>

          <div className="po-editorial-hero__content">
            <div className="po-editorial-hero__top">
              <div>
                <p className="po-editorial-hero__eyebrow">
                  {t("production-orders:detailTitle")}
                </p>

                <h2 className="po-editorial-hero__number">{order.order_number}</h2>

                <h3 className="po-editorial-hero__title">
                  {order.target_dress_name}
                </h3>

                <div className="po-editorial-hero__meta">
                  {garmentMeta.length > 0 ? (
                    garmentMeta.map((item) => (
                      <span key={String(item)} className="po-editorial-chip">
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="po-editorial-chip">
                      {t("production-orders:fields.noGarmentDetails")}
                    </span>
                  )}

                  <span className="po-editorial-chip">
                    {translateOrderStatus(t, order.status)}
                  </span>

                  <span className="po-editorial-chip">
                    {translatePriority(t, order.priority)}
                  </span>
                </div>
              </div>

              <div className="po-editorial-hero__actions">
                <button
                  className="po-action-btn po-action-btn--primary"
                  onClick={() => downloadPdf("operation")}
                  type="button"
                >
                  {t("production-orders:actions.workshopPdf")}
                </button>

                <button
                  className="po-action-btn"
                  onClick={() => downloadPdf("finance")}
                  type="button"
                >
                  {t("production-orders:actions.costPdf")}
                </button>
              </div>
            </div>

            <div className="po-editorial-hero__bottom">
              <div className="po-editorial-progress">
                <div className="po-editorial-progress__top">
                  <span>
                    {t("production-orders:fields.progress")} ·{" "}
                    {order.produced_quantity} / {order.planned_quantity}
                  </span>
                  <strong>{progressPercent}%</strong>
                </div>

                <div className="po-editorial-progress__track">
                  <div
                    className="po-editorial-progress__fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="po-editorial-due">
                <span>{t("production-orders:fields.dueDate")}</span>
                <strong>{formatDate(order.due_date, locale)}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="po-meta-compact-grid">
        <div className="po-meta-compact-card">
          <span>{t("production-orders:fields.workshop")}</span>
          <strong>{order.workshop_supplier_name || "-"}</strong>
        </div>

        <div className="po-meta-compact-card">
          <span>{t("production-orders:fields.plannedQuantity")}</span>
          <strong>{order.planned_quantity}</strong>
        </div>

        <div className="po-meta-compact-card">
          <span>{t("production-orders:fields.producedQuantity")}</span>
          <strong>{order.produced_quantity}</strong>
        </div>

        <div className="po-meta-compact-card">
          <span>{t("production-orders:costs.currency")}</span>
          <strong>{order.currency || costSummary?.currency || "USD"}</strong>
        </div>
      </div>

      <section className="po-premium-dashboard" aria-label={t("production-orders:detailOverview.title")}>
        <article className="po-premium-card po-premium-card--summary">
          <div className="po-premium-card__head">
            <span>1</span>
            <div>
              <h3>{t("production-orders:detailOverview.summaryTitle")}</h3>
              <p>{t("production-orders:detailOverview.summarySubtitle")}</p>
            </div>
          </div>

          <dl className="po-premium-summary-list">
            <div>
              <dt>{t("production-orders:fields.orderNumber")}</dt>
              <dd>{order.order_number}</dd>
            </div>
            <div>
              <dt>{t("production-orders:fields.targetDressName")}</dt>
              <dd>{order.target_dress_name}</dd>
            </div>
            <div>
              <dt>{t("production-orders:fields.status")}</dt>
              <dd>{translateOrderStatus(t, order.status)}</dd>
            </div>
            <div>
              <dt>{t("production-orders:fields.priority")}</dt>
              <dd>{translatePriority(t, order.priority)}</dd>
            </div>
            <div>
              <dt>{t("production-orders:detailOverview.pendingQuantity")}</dt>
              <dd>{pendingQuantity}</dd>
            </div>
            <div>
              <dt>{t("production-orders:detailOverview.activeProcesses")}</dt>
              <dd>{activeAssignments}</dd>
            </div>
          </dl>
        </article>

        <article className="po-premium-card po-premium-card--timeline">
          <div className="po-premium-card__head">
            <span>2</span>
            <div>
              <h3>{t("production-orders:detailOverview.timelineTitle")}</h3>
              <p>
                {completedAssignments} / {sortedAssignments.length || 0} {t("production-orders:detailOverview.completedProcesses")}
              </p>
            </div>
          </div>

          <div className="po-premium-process-line">
            {visibleAssignments.length > 0 ? (
              visibleAssignments.map((assignment, index) => {
                const statusClass = assignmentStatusClass(assignment.status);
                return (
                  <div className="po-premium-process-line__item" key={assignment.id}>
                    <div className={`po-premium-process-line__dot ${statusClass}`}>
                      {index + 1}
                    </div>
                    <strong>{assignment.process_name || assignment.process_code || t("production-orders:assignments.process")}</strong>
                    <span>{translateAssignmentStatus(t, assignment.status)}</span>
                  </div>
                );
              })
            ) : (
              <div className="po-premium-empty-inline">
                {t("production-orders:detailOverview.noProcesses")}
              </div>
            )}
          </div>
        </article>

        <article className="po-premium-card po-premium-card--materials">
          <div className="po-premium-card__head">
            <span>3</span>
            <div>
              <h3>{t("production-orders:detailOverview.materialsTitle")}</h3>
              <p>{materialCards.length} {t("production-orders:detailOverview.assignedMaterials")}</p>
            </div>
          </div>

          <div className="po-premium-table">
            <div className="po-premium-table__row po-premium-table__row--head">
              <span>{t("production-orders:fields.material")}</span>
              <span>{t("production-orders:fields.plannedQuantityMaterial")}</span>
              <span>{t("production-orders:fields.deliveredQuantity")}</span>
              <span>{t("production-orders:fields.status")}</span>
            </div>
            {visibleMaterials.length > 0 ? (
              visibleMaterials.map((material) => (
                <div className="po-premium-table__row" key={material.id}>
                  <span>{material.description_snapshot || material.roll_code || material.material_type}</span>
                  <span>{material.planned_quantity} {material.unit}</span>
                  <span>{material.delivered_quantity} {material.unit}</span>
                  <span>{material.badgeLabel}</span>
                </div>
              ))
            ) : (
              <div className="po-premium-empty-inline">
                {t("production-orders:materials.empty")}
              </div>
            )}
          </div>
        </article>

        <article className="po-premium-card po-premium-card--costs">
          <div className="po-premium-card__head">
            <span>4</span>
            <div>
              <h3>{t("production-orders:detailOverview.costsTitle")}</h3>
              <p>{t("production-orders:detailOverview.costsSubtitle")}</p>
            </div>
          </div>

          <div className="po-premium-cost-grid">
            <div>
              <span>{t("production-orders:costs.estimatedTotalCost")}</span>
              <strong>{formatMoney(estimatedTotalCost, effectiveCurrency, locale)}</strong>
            </div>
            <div>
              <span>{t("production-orders:costs.actualTotalCost")}</span>
              <strong>{formatMoney(visibleActualCost, effectiveCurrency, locale)}</strong>
            </div>
            <div>
              <span>{t("production-orders:detailOverview.variation")}</span>
              <strong className={costVariation > 0 ? "is-negative" : "is-positive"}>
                {costVariation.toFixed(1)}%
              </strong>
            </div>
          </div>
        </article>

        <article className="po-premium-card po-premium-card--people">
          <div className="po-premium-card__head">
            <span>5</span>
            <div>
              <h3>{t("production-orders:detailOverview.peopleTitle")}</h3>
              <p>{t("production-orders:detailOverview.peopleSubtitle")}</p>
            </div>
          </div>

          <div className="po-premium-people-list">
            {visibleAssignments.length > 0 ? (
              visibleAssignments.slice(0, 4).map((assignment) => (
                <div className="po-premium-person" key={assignment.id}>
                  <div>
                    <strong>{assignment.process_name || assignment.process_code || t("production-orders:assignments.process")}</strong>
                    <span>{assignment.supplier_name || order.workshop_supplier_name || "-"}</span>
                  </div>
                  <em>{translateAssignmentStatus(t, assignment.status)}</em>
                </div>
              ))
            ) : (
              <div className="po-premium-empty-inline">
                {t("production-orders:detailOverview.noPeople")}
              </div>
            )}
          </div>
        </article>

        <article className="po-premium-card po-premium-card--notes">
          <div className="po-premium-card__head">
            <span>6</span>
            <div>
              <h3>{t("production-orders:detailOverview.notesTitle")}</h3>
              <p>
                {nextEvent
                  ? formatDateTime(nextEvent.created_at, locale)
                  : t("production-orders:detailOverview.noEvents")}
              </p>
            </div>
          </div>

          <div className="po-premium-note-box">{notesText}</div>
        </article>
      </section>

      <div className="po-detail-tabs">
        <button
          type="button"
          className={`po-detail-tab ${activeTab === "operation" ? "po-detail-tab--active" : ""}`}
          onClick={() => setActiveTab("operation")}
        >
          {t("production-orders:tabs.operation")}
        </button>

        <button
          type="button"
          className={`po-detail-tab ${activeTab === "finance" ? "po-detail-tab--active" : ""}`}
          onClick={() => setActiveTab("finance")}
        >
          {t("production-orders:tabs.finance")}
        </button>

        <button
          type="button"
          className={`po-detail-tab ${activeTab === "events" ? "po-detail-tab--active" : ""}`}
          onClick={() => setActiveTab("events")}
        >
          {t("production-orders:tabs.events")}
        </button>
      </div>

      {error ? <div className="po-inline-error">{error}</div> : null}

      <div className="po-tab-content">
        {activeTab === "operation" ? (
          <>
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
              onWorkflowChanged={refreshAssignments}
            />

            <ProductionOrderAssignmentsSection
              t={t}
              assignments={assignments}
              locale={locale}
            />
          </>
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
          />
        )}
      </div>

      {errorDialog ? (
        <div
          className="po-error-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="production-order-error-title"
        >
          <div className="po-error-modal-card">
            <div className="po-error-modal-header">
              <h2 id="production-order-error-title">{errorDialog.title}</h2>
              <p>
                {t("production-orders:errors.subtitle")}
              </p>
            </div>

            <div className="po-error-modal-body">
              <div className="po-error-dialog">
                <div className="po-error-dialog__icon" aria-hidden="true">
                  ⚠
                </div>

                <div className="po-error-dialog__content">
                  <strong>{errorDialog.message}</strong>

                  {errorDialog.detail ? <p>{errorDialog.detail}</p> : null}
                </div>
              </div>
            </div>

            <div className="po-error-modal-footer">
              <button
                type="button"
                className="po-error-modal-button"
                onClick={closeErrorDialog}
              >
                {t("common:actions.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  CartesianGrid,
} from "recharts";
import {
  Shirt,
  BriefcaseBusiness,
  Wallet,
  TrendingUp,
  Factory,
  TriangleAlert,
  PackageSearch,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import "./HomePage.css";

type DashboardAlert = {
  type?: string;
  category?: string;
  category_label?: string;
  priority?: number;
  level: string;
  title: string;
  message: string;
  action?: {
    label: string;
    url: string;
  } | null;
};

type DashboardInsight = {
  type: string;
  title: string;
  value: string | number;
  description?: string | null;
  tone?: "neutral" | "success" | "warning" | "danger" | string;
};

type DashboardData = {
  dresses: {
    available: number;
    loaned: number;
    maintenance: number;
    sold: number;
  };
  rolls: {
    available: number;
    depleted: number;
  };
  loans: {
    active: number;
    overdue: number;
    due_soon: number;
  };
  recent_movements: {
    id: string;
    roll_code?: string | null;
    fabric?: string | null;
    type: string;
    quantity: number;
    reference?: string | null;
  }[];
  recent_loans: {
    id: string;
    customer?: string | null;
    dress?: string | null;
    status: string;
    expected_return_date?: string | null;
  }[];
  featured_dresses: {
    id: string;
    name: string;
    code?: string | null;
    status: string;
    main_image_url?: string | null;
  }[];
  top_dresses: {
    id: string;
    name: string;
    loan_count: number;
  }[];
  idle_dresses: {
    id: string;
    name: string;
    code?: string | null;
    days_without_movement: number;
  }[];
  alerts: DashboardAlert[];
  insights?: DashboardInsight[];
};

type OperationalData = {
  production: {
    active: number;
    delayed: number;
    due_soon: number;
  };
  stock_alerts: {
    accessories_low: number;
    trims_low: number;
  };
  workshops: {
    name: string;
    active_orders: number;
  }[];
  orders: {
    id: string;
    code: string;
    status: string;
    priority?: string | null;
    workshop?: string | null;
    target_name?: string | null;
    target_code?: string | null;
    due_date?: string | null;
    days_late: number;
    due_state: "normal" | "due_soon" | "delayed";
  }[];
};

type TranslateFn = (key: string, options?: Record<string, any>) => string;

function getLocale(language?: string) {
  const raw = String(language || "").toLowerCase();
  if (raw.startsWith("en")) return "en-US";
  return "es-AR";
}

function formatTime(value: Date | null, locale: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function todayLabel(locale: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}

function alertTone(level: string) {
  if (level === "high") return "danger";
  if (level === "medium" || level === "warning") return "warning";
  return "info";
}

function alertCategory(alert: DashboardAlert) {
  const explicit = String(alert.category || "").toLowerCase();
  if (explicit) return explicit;

  const raw = String(alert.type || "").toUpperCase();

  if (raw.startsWith("PRODUCTION")) return "production";
  if (raw.includes("STOCK") || raw.includes("FABRIC") || raw.includes("ROLL") || raw.includes("MATERIAL")) {
    return "stock";
  }
  if (raw.includes("LOAN") || raw.includes("RETURN")) return "loans";
  if (raw.includes("DRESS") || raw.includes("IDLE")) return "inventory";
  if (raw.includes("COST") || raw.includes("PROFIT") || raw.includes("MARGIN")) return "financial";

  return "general";
}

function alertCategoryLabel(alert: DashboardAlert, t: TranslateFn) {
  if (alert.category_label) return alert.category_label;

  const category = alertCategory(alert);
  if (category === "production") return t("alerts.categories.production");
  if (category === "stock") return t("alerts.categories.stock");
  if (category === "loans") return t("alerts.categories.loans");
  if (category === "inventory") return t("alerts.categories.inventory");
  if (category === "financial") return t("alerts.categories.financial");
  return t("alerts.categories.general");
}

function alertPriority(alert: DashboardAlert) {
  const level = String(alert.level || "info").toLowerCase();
  if (typeof alert.priority === "number") return alert.priority;
  if (level === "high") return 1;
  if (level === "medium" || level === "warning") return 2;
  if (level === "low") return 3;
  return 4;
}

const ALERT_CATEGORY_ORDER: Record<string, number> = {
  production: 1,
  stock: 2,
  loans: 3,
  inventory: 4,
  financial: 5,
  general: 9,
};

function insightTone(value?: string | null) {
  const raw = String(value || "").toLowerCase();
  if (raw === "danger") return "danger";
  if (raw === "warning") return "warning";
  if (raw === "success") return "success";
  return "neutral";
}

function dueStateLabel(value: OperationalData["orders"][number]["due_state"], t: TranslateFn) {
  if (value === "delayed") return t("orders.dueStates.delayed");
  if (value === "due_soon") return t("orders.dueStates.dueSoon");
  return t("orders.dueStates.normal");
}

function statusLabel(value: string | null | undefined, t: TranslateFn) {
  const raw = String(value || "").toUpperCase();
  if (raw === "DRAFT") return t("orders.statuses.DRAFT");
  if (raw === "MATERIALS_RESERVED") return t("orders.statuses.MATERIALS_RESERVED");
  if (raw === "APPROVED") return t("orders.statuses.APPROVED");
  if (raw === "IN_PRODUCTION") return t("orders.statuses.IN_PRODUCTION");
  if (raw === "COMPLETED") return t("orders.statuses.COMPLETED");
  if (raw === "CANCELLED") return t("orders.statuses.CANCELLED");
  return value || "—";
}

function priorityLabel(value: string | null | undefined, t: TranslateFn) {
  const raw = String(value || "").toUpperCase();
  if (raw === "HIGH") return t("orders.priorities.HIGH");
  if (raw === "URGENT") return t("orders.priorities.URGENT");
  if (raw === "LOW") return t("orders.priorities.LOW");
  return t("orders.priorities.NORMAL");
}

function movementTypeLabel(value: string | null | undefined, t: TranslateFn) {
  const raw = String(value || "").toUpperCase();
  return t(`movementTypes.${raw}`, { defaultValue: value || "—" });
}

const DRESS_COLORS = ["#e29b8b", "#bf6665", "#9a88a5", "#ddd1c4"];
const LOAN_COLORS = ["#d5aa68", "#e1a292", "#ccb8a5"];

export default function HomePage() {
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const locale = getLocale(i18n.language);

  const [data, setData] = useState<DashboardData | null>(null);
  const [ops, setOps] = useState<OperationalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadDashboard = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const [summaryRes, operationalRes] = await Promise.all([
        api.get<DashboardData>("/dashboard/summary"),
        api.get<OperationalData>("/dashboard/operational-summary"),
      ]);

      setData(summaryRes.data);
      setOps(operationalRes.data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error(t("errors.consoleLoad"), error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();

    const timer = window.setInterval(() => {
      void loadDashboard(true);
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const dateText = useMemo(() => todayLabel(locale), [locale]);

  const dressesChartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: t("charts.dresses.labels.available"), value: data.dresses.available },
      { name: t("charts.dresses.labels.loaned"), value: data.dresses.loaned },
      { name: t("charts.dresses.labels.maintenance"), value: data.dresses.maintenance },
      { name: t("charts.dresses.labels.sold"), value: data.dresses.sold },
    ];
  }, [data, t]);

  const loansChartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: t("charts.loans.labels.active"), value: data.loans.active },
      { name: t("charts.loans.labels.overdue"), value: data.loans.overdue },
      { name: t("charts.loans.labels.dueSoon"), value: data.loans.due_soon },
    ];
  }, [data, t]);

  const executiveHighlights = useMemo(() => {
    if (!data || !ops) return [];

    const lowStockTotal = ops.stock_alerts.accessories_low + ops.stock_alerts.trims_low;

    return [
      {
        title: t("executive.delayedProduction.title"),
        value: `${ops.production.delayed}`,
        subtitle: t("executive.delayedProduction.subtitle"),
        tone: ops.production.delayed > 0 ? "danger" : "neutral",
      },
      {
        title: t("executive.criticalSupplies.title"),
        value: `${lowStockTotal}`,
        subtitle: t("executive.criticalSupplies.subtitle"),
        tone: lowStockTotal > 0 ? "warning" : "neutral",
      },
      {
        title: t("executive.overdueLoans.title"),
        value: `${data.loans.overdue}`,
        subtitle: t("executive.overdueLoans.subtitle"),
        tone: data.loans.overdue > 0 ? "danger" : "neutral",
      },
    ];
  }, [data, ops, t]);

  const smartAlerts = useMemo<DashboardAlert[]>(() => {
    if (!data || !ops) return [];

    const alerts: DashboardAlert[] = Array.isArray(data.alerts) ? [...data.alerts] : [];

    if (ops.stock_alerts.accessories_low > 0) {
      alerts.push({
        type: "ACCESSORIES_LOW_STOCK",
        category: "stock",
        level: "medium",
        title: t("alerts.generated.accessoriesLow.title"),
        message: t("alerts.generated.accessoriesLow.message", {
          count: ops.stock_alerts.accessories_low,
        }),
        action: { label: t("alerts.actions.viewAccessories"), url: "/accessories" },
      });
    }

    if (ops.stock_alerts.trims_low > 0) {
      alerts.push({
        type: "TRIMS_LOW_STOCK",
        category: "stock",
        level: "medium",
        title: t("alerts.generated.trimsLow.title"),
        message: t("alerts.generated.trimsLow.message", {
          count: ops.stock_alerts.trims_low,
        }),
        action: { label: t("alerts.actions.viewTrims"), url: "/trims" },
      });
    }

    return alerts.sort((a, b) => {
      const priorityDiff = alertPriority(a) - alertPriority(b);
      if (priorityDiff !== 0) return priorityDiff;

      const categoryDiff =
        (ALERT_CATEGORY_ORDER[alertCategory(a)] || 9) -
        (ALERT_CATEGORY_ORDER[alertCategory(b)] || 9);

      if (categoryDiff !== 0) return categoryDiff;

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, [data, ops, t]);

  const groupedAlerts = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; alerts: DashboardAlert[] }>();

    for (const alert of smartAlerts) {
      const key = alertCategory(alert);
      const existing = groups.get(key);

      if (existing) {
        existing.alerts.push(alert);
      } else {
        groups.set(key, {
          key,
          label: alertCategoryLabel(alert, t),
          alerts: [alert],
        });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => (ALERT_CATEGORY_ORDER[a.key] || 9) - (ALERT_CATEGORY_ORDER[b.key] || 9)
    );
  }, [smartAlerts, t]);

  const smartInsights = useMemo<DashboardInsight[]>(() => {
    if (!data || !ops) return [];

    const backendInsights = Array.isArray(data.insights) ? data.insights : [];

    if (backendInsights.length > 0) {
      return backendInsights;
    }

    const fallback: DashboardInsight[] = [];

    if (data.top_dresses.length > 0) {
      const top = data.top_dresses[0];

      fallback.push({
        type: "TOP_DRESS",
        title: t("insights.fallback.topDress.title"),
        value: top.name,
        description: t("insights.fallback.topDress.description", {
          count: top.loan_count,
        }),
        tone: "success",
      });
    }

    if (data.idle_dresses.length > 0) {
      fallback.push({
        type: "IDLE_DRESSES",
        title: t("insights.fallback.idleDresses.title"),
        value: data.idle_dresses.length,
        description: t("insights.fallback.idleDresses.description"),
        tone: "warning",
      });
    }

    if (ops.production.delayed > 0) {
      fallback.push({
        type: "PRODUCTION_DELAY",
        title: t("insights.fallback.productionDelay.title"),
        value: ops.production.delayed,
        description: t("insights.fallback.productionDelay.description"),
        tone: "danger",
      });
    }

    if (ops.workshops.length > 0) {
      const busiestWorkshop = [...ops.workshops].sort(
        (a, b) => b.active_orders - a.active_orders
      )[0];

      fallback.push({
        type: "WORKSHOP_LOAD",
        title: t("insights.fallback.workshopLoad.title"),
        value: busiestWorkshop.name,
        description: t("insights.fallback.workshopLoad.description", {
          count: busiestWorkshop.active_orders,
        }),
        tone: "neutral",
      });
    }

    return fallback.slice(0, 4);
  }, [data, ops, t]);

  if (loading) {
    return (
      <section className="home">
        <div className="home__empty">{t("states.loading")}</div>
      </section>
    );
  }

  if (!data || !ops) {
    return (
      <section className="home">
        <div className="home__empty">{t("states.loadError")}</div>
      </section>
    );
  }

  return (
    <section className="home">
      <style>{`
        .home__smart-insights {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .home__insight-card {
          border: 1px solid rgba(222, 211, 203, 0.92);
          border-radius: 24px;
          padding: 18px 18px 16px;
          background:
            radial-gradient(circle at top right, rgba(226, 155, 139, 0.12), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%);
          box-shadow: 0 18px 38px rgba(62, 48, 39, 0.07);
          display: grid;
          gap: 10px;
          min-height: 150px;
          position: relative;
          overflow: hidden;
        }

        .home__insight-card::after {
          content: "";
          position: absolute;
          right: -42px;
          bottom: -48px;
          width: 120px;
          height: 120px;
          border-radius: 999px;
          background: rgba(125, 88, 164, 0.08);
        }

        .home__insight-card--danger {
          background:
            radial-gradient(circle at top right, rgba(180, 35, 24, 0.12), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #fff7f6 100%);
        }

        .home__insight-card--warning {
          background:
            radial-gradient(circle at top right, rgba(213, 170, 104, 0.18), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #fffaf1 100%);
        }

        .home__insight-card--success {
          background:
            radial-gradient(circle at top right, rgba(47, 130, 96, 0.12), transparent 34%),
            linear-gradient(180deg, #ffffff 0%, #f5fffa 100%);
        }

        .home__insight-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          z-index: 1;
        }

        .home__insight-kicker {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.13em;
          font-weight: 800;
          color: #8c7f75;
        }

        .home__insight-icon {
          width: 34px;
          height: 34px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #f8efe9;
          color: #8f5e82;
          flex-shrink: 0;
        }

        .home__insight-value {
          position: relative;
          z-index: 1;
          font-size: 24px;
          line-height: 1.05;
          letter-spacing: -0.04em;
          color: #32273c;
          font-weight: 900;
          word-break: break-word;
        }

        .home__insight-description {
          position: relative;
          z-index: 1;
          margin: 0;
          color: #7e7486;
          font-size: 13px;
          line-height: 1.45;
        }

        .home__alert-action {
          margin-top: 10px;
          border: 1px solid rgba(50, 39, 60, 0.12);
          background: rgba(255,255,255,0.76);
          color: #32273c;
          border-radius: 12px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          width: fit-content;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .home__alert-action:hover {
          transform: translateY(-1px);
          background: #ffffff;
        }

        .home__alert-group {
          display: grid;
          gap: 10px;
        }

        .home__alert-group-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 2px 0;
          color: #766a7e;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 900;
        }

        .home__alert-group-badge {
          border-radius: 999px;
          background: #f6efe8;
          color: #8b5e4e;
          padding: 4px 8px;
          font-size: 11px;
          letter-spacing: 0;
        }


        .home__production-widget {
          min-height: auto;
          align-content: start;
        }

        .home__production-widget-head {
          align-items: flex-start;
        }

        .home__production-widget-head p {
          margin: 4px 0 0;
          color: #8a7f73;
          font-size: 13px;
        }

        .home__production-view-all {
          border: 1px solid rgba(50, 39, 60, 0.12);
          background: rgba(255,255,255,0.8);
          color: #32273c;
          border-radius: 999px;
          min-height: 34px;
          padding: 0 12px;
          font-size: 12px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .home__production-view-all:hover {
          transform: translateY(-1px);
          background: #ffffff;
        }

        .home__production-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 12px;
        }

        .home__production-summary-card {
          border: 1px solid rgba(222, 211, 203, 0.9);
          background: #fff;
          border-radius: 16px;
          padding: 12px;
          display: grid;
          gap: 4px;
        }

        .home__production-summary-card span {
          color: #8a7f73;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 800;
        }

        .home__production-summary-card strong {
          color: #30283c;
          font-size: 24px;
          line-height: 1;
        }

        .home__production-summary-card--danger {
          background: #fff7f6;
        }

        .home__production-summary-card--warning {
          background: #fffaf1;
        }

        .home__production-list {
          display: grid;
          gap: 10px;
        }

        .home__production-row {
          border: 1px solid rgba(222, 211, 203, 0.92);
          background: linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%);
          border-radius: 18px;
          padding: 14px;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: center;
          cursor: pointer;
          transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
        }

        .home__production-row:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 34px rgba(62, 48, 39, 0.08);
          border-color: rgba(195, 140, 122, 0.42);
        }

        .home__production-row--delayed {
          background: linear-gradient(180deg, #ffffff 0%, #fff7f6 100%);
        }

        .home__production-row--due_soon {
          background: linear-gradient(180deg, #ffffff 0%, #fffaf1 100%);
        }

        .home__production-main {
          display: grid;
          gap: 6px;
          min-width: 0;
        }

        .home__production-code-line {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .home__production-code-line strong {
          color: #30283c;
          font-size: 15px;
        }

        .home__production-state {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
          background: #eefaf2;
          color: #2d754d;
        }

        .home__production-state--delayed {
          background: #fff0f0;
          color: #b42318;
        }

        .home__production-state--due_soon {
          background: #fff7e8;
          color: #8a5e12;
        }

        .home__production-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          color: #7e7486;
          font-size: 12px;
        }

        .home__production-meta span {
          background: rgba(15,23,42,0.05);
          border-radius: 999px;
          padding: 4px 8px;
        }

        .home__production-side {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #6f687b;
        }

        .home__production-status,
        .home__production-priority {
          border: 1px solid rgba(222, 211, 203, 0.9);
          border-radius: 999px;
          padding: 6px 9px;
          font-size: 11px;
          font-weight: 800;
          background: #fff;
          white-space: nowrap;
        }

        .home__production-empty {
          border: 1px dashed rgba(222, 211, 203, 0.95);
          border-radius: 18px;
          padding: 28px;
          display: grid;
          justify-items: center;
          gap: 8px;
          color: #8a7f73;
          background: #fff;
          text-align: center;
        }

        .home__production-empty strong {
          color: #30283c;
        }

        @media (max-width: 1180px) {
          .home__smart-insights {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .home__smart-insights {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="home__hero">
        <div className="home__hero-main">
          <div className="home__eyebrow">{dateText}</div>
          <h1 className="home__title">{t("hero.title")}</h1>
          <p className="home__subtitle">{t("hero.subtitle")}</p>
        </div>

        <div className="home__hero-side">
          <span className="home__hero-side-label">{t("hero.lastUpdate")}</span>
          <strong className="home__hero-side-value">
            {formatTime(lastUpdate, locale)}
          </strong>
          <span className="home__hero-side-note">{t("hero.autoUpdate")}</span>
        </div>
      </div>

      {smartInsights.length > 0 && (
        <section className="home__section-block">
          <div className="home__section-head home__section-head--soft">
            <div>
              <span className="home__section-kicker">{t("insights.eyebrow")}</span>
              <h2 className="home__section-title">{t("insights.title")}</h2>
            </div>
          </div>

          <div className="home__smart-insights">
            {smartInsights.map((insight) => (
              <article
                key={insight.type}
                className={`home__insight-card home__insight-card--${insightTone(
                  insight.tone
                )}`}
              >
                <div className="home__insight-top">
                  <span className="home__insight-kicker">{insight.title}</span>
                  <span className="home__insight-icon">
                    <Sparkles size={18} strokeWidth={1.8} />
                  </span>
                </div>

                <strong className="home__insight-value">{insight.value}</strong>

                {insight.description ? (
                  <p className="home__insight-description">
                    {insight.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="home__executive-grid">
        {executiveHighlights.map((item) => (
          <article
            key={item.title}
            className={`home__executive-card home__executive-card--${item.tone}`}
          >
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <small>{item.subtitle}</small>
          </article>
        ))}
      </div>

      <section className="home__section-block">
        <div className="home__section-head">
          <div>
            <span className="home__section-kicker">{t("sections.operations.eyebrow")}</span>
            <h2 className="home__section-title">{t("sections.operations.title")}</h2>
          </div>
        </div>

        <div className="home__kpis home__kpis--pro">
          <article className="home__kpi home__kpi--rose">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.activeOrders.label")}</span>
                <strong className="home__kpi-value">{ops.production.active}</strong>
                <span className="home__kpi-meta">{t("kpis.activeOrders.meta")}</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--rose">
                <Factory size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi home__kpi--danger">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.delayed.label")}</span>
                <strong className="home__kpi-value home__kpi-value--danger">
                  {ops.production.delayed}
                </strong>
                <span className="home__kpi-meta">{t("kpis.delayed.meta")}</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--danger">
                <TriangleAlert size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi home__kpi--warning">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.dueSoon.label")}</span>
                <strong className="home__kpi-value home__kpi-value--warning">
                  {ops.production.due_soon}
                </strong>
                <span className="home__kpi-meta">{t("kpis.dueSoon.meta")}</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--warning">
                <TrendingUp size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.workshops.label")}</span>
                <strong className="home__kpi-value">{ops.workshops.length}</strong>
                <span className="home__kpi-meta">{t("kpis.workshops.meta")}</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--stone">
                <BriefcaseBusiness size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="home__section-block">
        <div className="home__section-head home__section-head--soft">
          <div>
            <span className="home__section-kicker">{t("sections.inventory.eyebrow")}</span>
            <h2 className="home__section-title">{t("sections.inventory.title")}</h2>
          </div>
        </div>

        <div className="home__kpis home__kpis--pro">
          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.availableDresses.label")}</span>
                <strong className="home__kpi-value">{data.dresses.available}</strong>
                <span className="home__kpi-meta">
                  {t("kpis.availableDresses.meta", { count: data.dresses.loaned })}
                </span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--rose">
                <Shirt size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.availableRolls.label")}</span>
                <strong className="home__kpi-value">{data.rolls.available}</strong>
                <span className="home__kpi-meta">
                  {t("kpis.availableRolls.meta", { count: data.rolls.depleted })}
                </span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--sand">
                <Wallet size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.criticalAccessories.label")}</span>
                <strong className="home__kpi-value">
                  {ops.stock_alerts.accessories_low}
                </strong>
                <span className="home__kpi-meta">{t("kpis.criticalAccessories.meta")}</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--lavender">
                <PackageSearch size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">{t("kpis.activeAlerts.label")}</span>
                <strong className="home__kpi-value">{smartAlerts.length}</strong>
                <span className="home__kpi-meta">{t("kpis.activeAlerts.meta")}</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--stone">
                <TrendingUp size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="home__main-grid">
        <section className="home__card home__card--orders home__production-widget">
          <div className="home__card-head home__production-widget-head">
            <div>
              <h2>{t("orders.title")}</h2>
              <p>{t("orders.subtitle", { defaultValue: "Seguimiento operativo de producción activa." })}</p>
            </div>

            <button
              type="button"
              className="home__production-view-all"
              onClick={() => navigate("/production-orders")}
            >
              {t("orders.viewAll", { defaultValue: "Ver todas" })}
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="home__production-summary">
            <div className="home__production-summary-card">
              <span>{t("kpis.activeOrders.label")}</span>
              <strong>{ops.production.active}</strong>
            </div>

            <div className="home__production-summary-card home__production-summary-card--danger">
              <span>{t("kpis.delayed.label")}</span>
              <strong>{ops.production.delayed}</strong>
            </div>

            <div className="home__production-summary-card home__production-summary-card--warning">
              <span>{t("kpis.dueSoon.label")}</span>
              <strong>{ops.production.due_soon}</strong>
            </div>
          </div>

          <div className="home__production-list">
            {ops.orders.length === 0 ? (
              <div className="home__production-empty">
                <Factory size={28} strokeWidth={1.6} />
                <strong>{t("orders.empty")}</strong>
                <span>{t("orders.emptyHint", { defaultValue: "No hay producción activa para revisar." })}</span>
              </div>
            ) : (
              ops.orders.slice(0, 6).map((order) => (
                <article
                  key={order.id}
                  className={`home__production-row home__production-row--${order.due_state}`}
                  onClick={() => navigate(`/production-orders?order=${order.id}&tab=operation`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/production-orders?order=${order.id}&tab=operation`);
                    }
                  }}
                >
                  <div className="home__production-main">
                    <div className="home__production-code-line">
                      <strong>{order.code}</strong>
                      <span className={`home__production-state home__production-state--${order.due_state}`}>
                        {order.due_state === "delayed"
                          ? t("orders.daysLate", { count: order.days_late })
                          : dueStateLabel(order.due_state, t)}
                      </span>
                    </div>

                    <div className="home__production-meta">
                      <span>{order.target_name || t("orders.noProduct")}</span>
                      <span>{order.workshop || t("orders.noWorkshop")}</span>
                    </div>
                  </div>

                  <div className="home__production-side">
                    <span className="home__production-status">
                      {statusLabel(order.status, t)}
                    </span>
                    <span className="home__production-priority">
                      {priorityLabel(order.priority, t)}
                    </span>
                    <ArrowRight size={16} strokeWidth={2} />
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>{t("alerts.title")}</h2>
            <span>{t("alerts.today")}</span>
          </div>

          <div className="home__stack">
            {smartAlerts.length === 0 && (
              <div className="home__placeholder">{t("alerts.empty")}</div>
            )}

            {groupedAlerts.map((group) => (
              <div key={group.key} className="home__alert-group">
                <div className="home__alert-group-head">
                  <span>{group.label}</span>
                  <span className="home__alert-group-badge">{group.alerts.length}</span>
                </div>

                {group.alerts.map((alert, index) => (
                  <article
                    key={`${alert.type || alert.title}-${index}`}
                    className={`home__alert home__alert--${alertTone(alert.level)}`}
                  >
                    <strong>{alert.title}</strong>
                    <span>{alert.message}</span>

                    {alert.action?.url ? (
                      <button
                        type="button"
                        className="home__alert-action"
                        onClick={() => navigate(alert.action?.url || "/")}
                      >
                        {alert.action.label || t("alerts.actions.viewDetail")}
                        <ArrowRight size={14} strokeWidth={2} />
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="home__charts">
        <section className="home__card home__card--chart">
          <div className="home__card-head">
            <h2>{t("charts.dresses.title")}</h2>
            <span>{t("charts.dresses.subtitle")}</span>
          </div>

          <div className="home__chart">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={dressesChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {dressesChartData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={DRESS_COLORS[index % DRESS_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="home__card home__card--chart">
          <div className="home__card-head">
            <h2>{t("charts.loans.title")}</h2>
            <span>{t("charts.loans.subtitle")}</span>
          </div>

          <div className="home__chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={loansChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <Tooltip />
                <Bar dataKey="value" radius={[14, 14, 0, 0]}>
                  {loansChartData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={LOAN_COLORS[index % LOAN_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="home__card home__card--chart">
          <div className="home__card-head">
            <h2>{t("charts.workshops.title")}</h2>
            <span>{t("charts.workshops.subtitle")}</span>
          </div>

          <div className="home__stack">
            {ops.workshops.length === 0 && (
              <div className="home__placeholder">{t("charts.workshops.empty")}</div>
            )}

            {ops.workshops.map((workshop) => (
              <article key={workshop.name} className="home__item">
                <strong>{workshop.name}</strong>
                <span>{t("charts.workshops.activeOrders", { count: workshop.active_orders })}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="home__grid">
        <section className="home__card">
          <div className="home__card-head">
            <h2>{t("lists.topDresses.title")}</h2>
            <span>{data.top_dresses.length}</span>
          </div>

          <div className="home__stack">
            {data.top_dresses.length === 0 && (
              <div className="home__placeholder">
                {t("lists.topDresses.empty")}
              </div>
            )}

            {data.top_dresses.map((dress, index) => (
              <article key={dress.id} className="home__item">
                <strong>
                  #{index + 1} · {dress.name}
                </strong>
                <span>{t("lists.topDresses.loans", { count: dress.loan_count })}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>{t("lists.idleDresses.title")}</h2>
            <span>{data.idle_dresses.length}</span>
          </div>

          <div className="home__stack">
            {data.idle_dresses.length === 0 && (
              <div className="home__placeholder">
                {t("lists.idleDresses.empty")}
              </div>
            )}

            {data.idle_dresses.map((dress) => (
              <article key={dress.id} className="home__item">
                <strong>{dress.name}</strong>
                <span>
                  {dress.code || t("common.noCode")} ·{" "}
                  {t("lists.idleDresses.daysWithoutMovement", {
                    count: dress.days_without_movement,
                  })}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>{t("lists.recentLoans.title")}</h2>
            <span>{data.recent_loans.length}</span>
          </div>

          <div className="home__stack">
            {data.recent_loans.length === 0 && (
              <div className="home__placeholder">
                {t("lists.recentLoans.empty")}
              </div>
            )}

            {data.recent_loans.map((loan) => (
              <article key={loan.id} className="home__item">
                <strong>{loan.dress || t("lists.recentLoans.noDress")}</strong>
                <span>
                  {loan.customer || t("lists.recentLoans.noCustomer")}
                  {loan.expected_return_date
                    ? ` · ${t("lists.recentLoans.returns", {
                        date: loan.expected_return_date,
                      })}`
                    : ""}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>{t("lists.recentMovements.title")}</h2>
            <span>{data.recent_movements.length}</span>
          </div>

          <div className="home__stack">
            {data.recent_movements.length === 0 && (
              <div className="home__placeholder">
                {t("lists.recentMovements.empty")}
              </div>
            )}

            {data.recent_movements.map((movement) => (
              <article key={movement.id} className="home__item">
                <strong>{movement.roll_code || t("lists.recentMovements.noRollCode")}</strong>
                <span>
                  {movement.fabric || t("lists.recentMovements.fabricFallback")} ·{" "}
                  {movementTypeLabel(movement.type, t)} · {movement.quantity}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

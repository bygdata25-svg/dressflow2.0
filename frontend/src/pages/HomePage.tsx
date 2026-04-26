import { useEffect, useMemo, useState } from "react";
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

function formatTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function todayLabel() {
  return new Intl.DateTimeFormat("es-AR", {
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

function alertCategoryLabel(alert: DashboardAlert) {
  if (alert.category_label) return alert.category_label;

  const category = alertCategory(alert);
  if (category === "production") return "Producción";
  if (category === "stock") return "Stock";
  if (category === "loans") return "Préstamos";
  if (category === "inventory") return "Inventario";
  if (category === "financial") return "Finanzas";
  return "General";
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

function dueStateLabel(value: OperationalData["orders"][number]["due_state"]) {
  if (value === "delayed") return "Atrasada";
  if (value === "due_soon") return "Vence pronto";
  return "En término";
}

function statusLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "DRAFT") return "Borrador";
  if (raw === "MATERIALS_RESERVED") return "Material reservado";
  if (raw === "APPROVED") return "Aprobada";
  if (raw === "IN_PRODUCTION") return "En producción";
  if (raw === "COMPLETED") return "Completada";
  if (raw === "CANCELLED") return "Cancelada";
  return value || "—";
}

function priorityLabel(value?: string | null) {
  const raw = String(value || "").toUpperCase();
  if (raw === "HIGH") return "Alta";
  if (raw === "URGENT") return "Urgente";
  if (raw === "LOW") return "Baja";
  return "Normal";
}

const DRESS_COLORS = ["#e29b8b", "#bf6665", "#9a88a5", "#ddd1c4"];
const LOAN_COLORS = ["#d5aa68", "#e1a292", "#ccb8a5"];

export default function HomePage() {
  const navigate = useNavigate();

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
      console.error("Error cargando dashboard", error);
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

  const dateText = useMemo(() => todayLabel(), []);

  const dressesChartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Disponibles", value: data.dresses.available },
      { name: "Prestados", value: data.dresses.loaned },
      { name: "Mantenimiento", value: data.dresses.maintenance },
      { name: "Vendidos", value: data.dresses.sold },
    ];
  }, [data]);

  const loansChartData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Activos", value: data.loans.active },
      { name: "Vencidos", value: data.loans.overdue },
      { name: "Vencen pronto", value: data.loans.due_soon },
    ];
  }, [data]);

  const executiveHighlights = useMemo(() => {
    if (!data || !ops) return [];

    return [
      {
        title: "Producción atrasada",
        value: `${ops.production.delayed}`,
        subtitle: "orden(es) fuera de fecha",
        tone: ops.production.delayed > 0 ? "danger" : "neutral",
      },
      {
        title: "Insumos críticos",
        value: `${ops.stock_alerts.accessories_low + ops.stock_alerts.trims_low}`,
        subtitle: "accesorios y avíos bajo mínimo",
        tone:
          ops.stock_alerts.accessories_low + ops.stock_alerts.trims_low > 0
            ? "warning"
            : "neutral",
      },
      {
        title: "Préstamos vencidos",
        value: `${data.loans.overdue}`,
        subtitle: "requieren seguimiento inmediato",
        tone: data.loans.overdue > 0 ? "danger" : "neutral",
      },
    ];
  }, [data, ops]);


  const smartAlerts = useMemo<DashboardAlert[]>(() => {
    if (!data || !ops) return [];

    const alerts: DashboardAlert[] = Array.isArray(data.alerts) ? [...data.alerts] : [];

    if (ops.stock_alerts.accessories_low > 0) {
      alerts.push({
        type: "ACCESSORIES_LOW_STOCK",
        category: "stock",
        level: "medium",
        title: "Accesorios bajo mínimo",
        message: `${ops.stock_alerts.accessories_low} accesorio(s) requieren reposición.`,
        action: { label: "Ver accesorios", url: "/accessories" },
      });
    }

    if (ops.stock_alerts.trims_low > 0) {
      alerts.push({
        type: "TRIMS_LOW_STOCK",
        category: "stock",
        level: "medium",
        title: "Avíos bajo mínimo",
        message: `${ops.stock_alerts.trims_low} avío(s) requieren reposición.`,
        action: { label: "Ver avíos", url: "/trims" },
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
  }, [data, ops]);

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
          label: alertCategoryLabel(alert),
          alerts: [alert],
        });
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => (ALERT_CATEGORY_ORDER[a.key] || 9) - (ALERT_CATEGORY_ORDER[b.key] || 9)
    );
  }, [smartAlerts]);


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
        title: "Vestido más utilizado",
        value: top.name,
        description: `${top.loan_count} préstamo(s). Ideal para analizar reposición o cápsulas similares.`,
        tone: "success",
      });
    }

    if (data.idle_dresses.length > 0) {
      fallback.push({
        type: "IDLE_DRESSES",
        title: "Inventario sin rotación",
        value: data.idle_dresses.length,
        description: "Vestidos sin movimiento detectados. Revisá pricing, fotos o disponibilidad.",
        tone: "warning",
      });
    }

    if (ops.production.delayed > 0) {
      fallback.push({
        type: "PRODUCTION_DELAY",
        title: "Riesgo operativo",
        value: ops.production.delayed,
        description: "Órdenes atrasadas que pueden afectar entregas o stock disponible.",
        tone: "danger",
      });
    }

    if (ops.workshops.length > 0) {
      const busiestWorkshop = [...ops.workshops].sort(
        (a, b) => b.active_orders - a.active_orders
      )[0];

      fallback.push({
        type: "WORKSHOP_LOAD",
        title: "Taller con mayor carga",
        value: busiestWorkshop.name,
        description: `${busiestWorkshop.active_orders} orden(es) activas.`,
        tone: "neutral",
      });
    }

    return fallback.slice(0, 4);
  }, [data, ops]);


  if (loading) {
    return (
      <section className="home">
        <div className="home__empty">Cargando dashboard...</div>
      </section>
    );
  }

  if (!data || !ops) {
    return (
      <section className="home">
        <div className="home__empty">No se pudieron cargar los datos.</div>
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
          <h1 className="home__title">Tu operación, en una sola vista.</h1>
          <p className="home__subtitle">
            Producción, stock, préstamos y alertas operativas con lectura clara
            para decidir rápido y actuar antes del desvío.
          </p>
        </div>

        <div className="home__hero-side">
          <span className="home__hero-side-label">Última actualización</span>
          <strong className="home__hero-side-value">
            {formatTime(lastUpdate)}
          </strong>
          <span className="home__hero-side-note">Actualización automática</span>
        </div>
      </div>

      {smartInsights.length > 0 && (
        <section className="home__section-block">
          <div className="home__section-head home__section-head--soft">
            <div>
              <span className="home__section-kicker">Insights</span>
              <h2 className="home__section-title">Lecturas inteligentes</h2>
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
            <span className="home__section-kicker">Operación</span>
            <h2 className="home__section-title">Producción en foco</h2>
          </div>
        </div>

        <div className="home__kpis home__kpis--pro">
          <article className="home__kpi home__kpi--rose">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">Órdenes activas</span>
                <strong className="home__kpi-value">{ops.production.active}</strong>
                <span className="home__kpi-meta">Producción en curso</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--rose">
                <Factory size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi home__kpi--danger">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">Atrasadas</span>
                <strong className="home__kpi-value home__kpi-value--danger">
                  {ops.production.delayed}
                </strong>
                <span className="home__kpi-meta">Fuera de compromiso</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--danger">
                <TriangleAlert size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi home__kpi--warning">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">Vencen pronto</span>
                <strong className="home__kpi-value home__kpi-value--warning">
                  {ops.production.due_soon}
                </strong>
                <span className="home__kpi-meta">Próximas 72 hs</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--warning">
                <TrendingUp size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">Talleres activos</span>
                <strong className="home__kpi-value">{ops.workshops.length}</strong>
                <span className="home__kpi-meta">Carga distribuida</span>
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
            <span className="home__section-kicker">Inventario</span>
            <h2 className="home__section-title">Base operativa</h2>
          </div>
        </div>

        <div className="home__kpis home__kpis--pro">
          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">Vestidos disponibles</span>
                <strong className="home__kpi-value">{data.dresses.available}</strong>
                <span className="home__kpi-meta">
                  {data.dresses.loaned} en préstamo
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
                <span className="home__kpi-label">Rollos disponibles</span>
                <strong className="home__kpi-value">{data.rolls.available}</strong>
                <span className="home__kpi-meta">
                  {data.rolls.depleted} agotados
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
                <span className="home__kpi-label">Accesorios críticos</span>
                <strong className="home__kpi-value">
                  {ops.stock_alerts.accessories_low}
                </strong>
                <span className="home__kpi-meta">Stock igual o bajo mínimo</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--lavender">
                <PackageSearch size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>

          <article className="home__kpi">
            <div className="home__kpi-top">
              <div className="home__kpi-content">
                <span className="home__kpi-label">Alertas activas</span>
                <strong className="home__kpi-value">{smartAlerts.length}</strong>
                <span className="home__kpi-meta">Seguimiento prioritario</span>
              </div>
              <div className="home__kpi-icon home__kpi-icon--stone">
                <TrendingUp size={26} strokeWidth={1.8} />
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="home__main-grid">
        <section className="home__card home__card--orders">
          <div className="home__card-head">
            <h2>Órdenes de producción</h2>
            <span>{ops.orders.length}</span>
          </div>

          <div className="home__orders-list">
            {ops.orders.length === 0 && (
              <div className="home__placeholder">No hay órdenes activas.</div>
            )}

            {ops.orders.map((order) => (
              <article
                key={order.id}
                className="home__order-row home__order-row--clickable"
                onClick={() => navigate(`/production-orders/${order.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/production-orders/${order.id}`);
                  }
                }}
              >
                <div className="home__order-main">
                  <div className="home__order-code">{order.code}</div>
                  <div className="home__order-meta">
                    <span>{order.workshop || "Sin taller"}</span>
                    <span>{order.target_name || "Sin producto"}</span>
                  </div>
                </div>

                <div className="home__order-center">
                  <span className="home__pill home__pill--status">
                    {statusLabel(order.status)}
                  </span>
                  <span className="home__pill home__pill--priority">
                    {priorityLabel(order.priority)}
                  </span>
                </div>

                <div className="home__order-right">
                  <div className="home__order-due">
                    {order.due_date ? `Entrega ${order.due_date}` : "Sin fecha"}
                  </div>
                  <div
                    className={`home__order-late home__order-late--${order.due_state}`}
                  >
                    {order.due_state === "delayed"
                      ? `${order.days_late} día(s) tarde`
                      : dueStateLabel(order.due_state)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>Alertas críticas</h2>
            <span>Hoy</span>
          </div>

          <div className="home__stack">
            {smartAlerts.length === 0 && (
              <div className="home__placeholder">Sin alertas activas.</div>
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
                        {alert.action.label || "Ver detalle"}
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
            <h2>Estado del inventario</h2>
            <span>Vestidos</span>
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
            <h2>Actividad de préstamos</h2>
            <span>Seguimiento</span>
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
            <h2>Carga por taller</h2>
            <span>Producción activa</span>
          </div>

          <div className="home__stack">
            {ops.workshops.length === 0 && (
              <div className="home__placeholder">Sin talleres activos.</div>
            )}

            {ops.workshops.map((workshop) => (
              <article key={workshop.name} className="home__item">
                <strong>{workshop.name}</strong>
                <span>{workshop.active_orders} orden(es) activas</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="home__grid">
        <section className="home__card">
          <div className="home__card-head">
            <h2>Más utilizados</h2>
            <span>{data.top_dresses.length}</span>
          </div>

          <div className="home__stack">
            {data.top_dresses.length === 0 && (
              <div className="home__placeholder">
                Todavía no hay suficientes datos.
              </div>
            )}

            {data.top_dresses.map((dress, index) => (
              <article key={dress.id} className="home__item">
                <strong>
                  #{index + 1} · {dress.name}
                </strong>
                <span>{dress.loan_count} préstamo(s)</span>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>Sin movimiento</h2>
            <span>{data.idle_dresses.length}</span>
          </div>

          <div className="home__stack">
            {data.idle_dresses.length === 0 && (
              <div className="home__placeholder">
                No hay vestidos inactivos.
              </div>
            )}

            {data.idle_dresses.map((dress) => (
              <article key={dress.id} className="home__item">
                <strong>{dress.name}</strong>
                <span>
                  {dress.code || "Sin código"} · {dress.days_without_movement} días sin movimiento
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>Préstamos recientes</h2>
            <span>{data.recent_loans.length}</span>
          </div>

          <div className="home__stack">
            {data.recent_loans.length === 0 && (
              <div className="home__placeholder">
                No hay préstamos recientes.
              </div>
            )}

            {data.recent_loans.map((loan) => (
              <article key={loan.id} className="home__item">
                <strong>{loan.dress || "Vestido sin nombre"}</strong>
                <span>
                  {loan.customer || "Cliente sin nombre"}
                  {loan.expected_return_date
                    ? ` · Devuelve ${loan.expected_return_date}`
                    : ""}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="home__card">
          <div className="home__card-head">
            <h2>Movimientos recientes</h2>
            <span>{data.recent_movements.length}</span>
          </div>

          <div className="home__stack">
            {data.recent_movements.length === 0 && (
              <div className="home__placeholder">
                No hay movimientos recientes.
              </div>
            )}

            {data.recent_movements.map((movement) => (
              <article key={movement.id} className="home__item">
                <strong>{movement.roll_code || "Rollo sin código"}</strong>
                <span>
                  {movement.fabric || "Tela"} · {movement.type} · {movement.quantity}
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

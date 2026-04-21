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
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { api } from "../lib/api";
import "./HomePage.css";

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
  alerts: {
    level: string;
    title: string;
    message: string;
  }[];
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
  if (level === "medium") return "warning";
  return "info";
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
                <strong className="home__kpi-value">{data.alerts.length}</strong>
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
            {data.alerts.length === 0 && (
              <div className="home__placeholder">Sin alertas activas.</div>
            )}

            {data.alerts.map((alert, index) => (
              <article
                key={`${alert.title}-${index}`}
                className={`home__alert home__alert--${alertTone(alert.level)}`}
              >
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
              </article>
            ))}

            {ops.stock_alerts.accessories_low > 0 && (
              <article className="home__alert home__alert--warning">
                <strong>Accesorios bajo mínimo</strong>
                <span>
                  {ops.stock_alerts.accessories_low} accesorio(s) requieren reposición.
                </span>
              </article>
            )}

            {ops.stock_alerts.trims_low > 0 && (
              <article className="home__alert home__alert--warning">
                <strong>Avíos bajo mínimo</strong>
                <span>
                  {ops.stock_alerts.trims_low} avío(s) requieren reposición.
                </span>
              </article>
            )}
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

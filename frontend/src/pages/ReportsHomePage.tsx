import { useNavigate } from "react-router-dom";
import "./DressesPage.css";

type ReportCardProps = {
  title: string;
  description: string;
  onClick: () => void;
  icon: React.ReactNode;
};

function ReportCard({ title, description, onClick, icon }: ReportCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid #eadfd7",
        background: "#fff",
        borderRadius: 20,
        padding: 22,
        display: "grid",
        gap: 12,
        textAlign: "left",
        cursor: "pointer",
        boxShadow: "0 10px 24px rgba(61, 54, 72, 0.06)",
        transition: "all 0.18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 28px rgba(61, 54, 72, 0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 10px 24px rgba(61, 54, 72, 0.06)";
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--tenant-primary) 10%, white)",
          color: "var(--tenant-primary)",
        }}
      >
        {icon}
      </div>

      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#3d3648",
            marginBottom: 6,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 14,
            color: "#8a7f78",
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
    </button>
  );
}

function StockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 7c2-2 4-2 6 0s4 2 8 0v10c-4 2-6 2-8 0s-4-2-6 0V7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MovementsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h10M7 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M14 4l3 3-3 3M10 20l-3-3 3-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoansIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 7h10M7 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M17 17l3-3-3-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 10h17"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function ReportsHomePage() {
  const navigate = useNavigate();

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
          <p className="df-pro-page__eyebrow">Reportes</p>
          <h1 className="df-pro-page__title">Centro de reportes</h1>
          <p className="df-pro-page__subtitle">
            Consultá y exportá la información clave de la operación diaria.
          </p>
        </div>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 18,
        }}
      >
        <ReportCard
          title="Stock valorizado"
          description="Visualizá el stock disponible de telas, el precio promedio por metro y el valor total del inventario."
          onClick={() => navigate("/reports/stock-valuation")}
          icon={<StockIcon />}
        />

        <ReportCard
          title="Movimientos de tela"
          description="Consultá entradas, salidas y ajustes de rollos, con filtros y exportación a Excel."
          onClick={() => navigate("/reports/fabric-movements")}
          icon={<MovementsIcon />}
        />

        <ReportCard
          title="Préstamos"
          description="Revisá préstamos activos, vencidos y devueltos, con acceso a exportación detallada."
          onClick={() => navigate("/reports/loans")}
          icon={<LoansIcon />}
        />

        <ReportCard
          title="Costos de producción"
          description="Analizá costos reales vs estimados por orden, con detalle de materiales y márgenes."
          onClick={() => navigate("/reports/production-costs")}
          icon={<StockIcon />}
        />

        <ReportCard
          title="Ventas unificadas"
          description="Vestidos, accesorios, multipagos y multimoneda en un solo reporte con métricas completas."
          onClick={() => navigate("/reports/sales-unified")}
          icon={<SalesIcon />}
        />
      </section>
    </section>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Toaster } from "react-hot-toast";

import HomePage from "./pages/HomePage";
import DressesPage from "./pages/DressesPage";
import LoginPage from "./pages/LoginPage";
import EditDressPage from "./pages/EditDressPage";
import LoansPage from "./pages/LoansPage";
import CustomersPage from "./pages/CustomersPage";
import SuppliersPage from "./pages/SuppliersPage";
import FabricsPage from "./pages/FabricsPage";
import FabricRollsPage from "./pages/FabricRollsPage";
import FabricMovementsPage from "./pages/FabricMovementsPage";
import ProductionOrdersPage from "./pages/ProductionOrdersPage";
import ProductionOrderDetailPage from "./pages/ProductionOrderDetailPage";
import ProductionOrderPrintPage from "./pages/ProductionOrderPrintPage";
import TrimsPage from "./pages/TrimsPage";
import SuperadminTenantsPage from "./pages/SuperadminTenantsPage";
import TenantBrandingPage from "./pages/TenantBrandingPage";
import CapsulesPage from "./pages/CapsulesPage";
import UsersPage from "./pages/UsersPage";
import ChangePasswordPage from "./pages/ChangePasswordPage";
import ReportsPage from "./pages/ReportsPage";
import FabricMovementsReportPage from "./pages/FabricMovementsReportPage";
import LoansReportPage from "./pages/LoansReportPage";
import ProductionCostsReportPage from "./pages/ProductionCostsReportPage";
import SalesReportPage from "./pages/reports/SalesReportPage";
import TenantFieldSettingsPage from "./pages/TenantFieldSettingsPage";
import SalesUnifiedPage from "./pages/SalesUnifiedPage";
import AccessoriesPage from "./pages/AccessoriesPage";
import AccessoryMovementsPage from "./pages/AccessoryMovementsPage";
import AccessorySalesPage from "./pages/AccessorySalesPage";
import FinancialDashboardPage from "./pages/FinancialDashboardPage";
import AppLoader from "./components/AppLoader";
import { setBrowserFavicon, setBrowserTitle } from "./lib/browserBranding";

import { applyTenantBranding } from "./lib/tenantBranding";
import { api } from "./lib/api";
import {
  clearToken,
  fetchMe,
  getToken,
  type MeResponse,
} from "./lib/auth";

import ImpersonationBanner from "./components/ImpersonationBanner";
import "./styles/app-shell.css";

type Me = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  tenant_id?: string | null;
  tenant_name?: string | null;
  tenant_logo_url?: string | null;
  tenant_primary_color?: string | null;
  role?: string | null;
  is_superuser?: boolean;
  impersonated?: boolean;
  must_change_password?: boolean;
};

type NavItem = {
  to: string;
  label: ReactNode;
};

type NavGroup = {
  key: string;
  label: ReactNode;
  items: NavItem[];
};

type LoanCountResponse = {
  items: unknown[];
  page: number;
  page_size: number;
  total: number;
};

function SidebarIcon({
  children,
}: {
  children: ReactNode;
}) {
  return <span className="df-sidebar__icon">{children}</span>;
}

function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 10.5 12 3l9 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 9.5V20h13V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DressIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 4c0 1.5-1 2.5-3 3l2.5 4L6 20h12l-2.5-9L18 7c-2-.5-3-1.5-3-3h-2c0 1-.4 1.7-1 2-.6-.3-1-1-1-2H9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CapsuleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 6v12" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LoanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function OrderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CompanyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V6l8-3v17M20 20V10l-8-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h.01M8 12h.01M8 16h.01M12 10h.01M12 14h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FabricIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function RollIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="12" r="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrimIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M11.5 12h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MovementIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function BrandingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4a8 8 0 1 0 8 8c0-2-1.5-3-3-3h-2a2 2 0 0 1-2-2V5.5A1.5 1.5 0 0 0 12 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 19a4 4 0 0 0-8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19 19a3 3 0 0 0-2.2-2.9M5 19a3 3 0 0 1 2.2-2.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SupplierIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V7l6-3v16M20 20V10l-10-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 9h.01M8 13h.01M13 11h.01M13 15h.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="9" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6 19a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 19V5h14v14H5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 15V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 15V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 15v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function StockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function MovementsReportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function LoansReportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function SalesReportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M4 10h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function SidebarGroup({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const [open, setOpen] = useState(
    group.items.some((item) =>
      item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
    )
  );

  useEffect(() => {
    if (
      group.items.some((item) =>
        item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
      )
    ) {
      setOpen(true);
    }
  }, [pathname, group.items]);

  const hasActive = group.items.some((item) =>
    item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
  );

  return (
    <>
      <button
        type="button"
        className={`df-sidebar__group-toggle ${
          hasActive ? "df-sidebar__group-toggle--active" : ""
        }`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {group.label}
        </div>
        <span className="df-sidebar__group-toggle-icon">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="df-sidebar__subnav">
          {group.items.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`df-sidebar__link df-sidebar__link--sub ${
                  active ? "df-sidebar__link--active" : ""
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function LoansLateBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span
      style={{
        background: "#b42318",
        color: "#fff",
        borderRadius: 999,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 20,
      }}
    >
      {count}
    </span>
  );
}

function AlertBell({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={count > 0 ? `${count} préstamos vencidos` : "Sin vencidos"}
      aria-label={count > 0 ? `${count} préstamos vencidos` : "Sin vencidos"}
      style={{
        position: "relative",
        width: 40,
        height: 40,
        borderRadius: 12,
        border: "1px solid var(--df-border, #e5e7eb)",
        background: "#fff",
        color: count > 0 ? "#b42318" : "#6b7280",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 9a6 6 0 1 1 12 0v4.5l1.5 2.5H4.5L6 13.5V9Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M10 19a2 2 0 0 0 4 0"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>

      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 999,
            background: "#b42318",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            padding: "0 4px",
            boxShadow: "0 4px 10px rgba(180, 35, 24, 0.22)",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function AppShell({
  me,
  onLogout,
}: {
  me: Me;
  onLogout: () => void;
}) {
  const { t, i18n } = useTranslation("common");
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lateLoansCount, setLateLoansCount] = useState(0);

  useEffect(() => {
    const tenantName = me.tenant_name?.trim();

    setBrowserTitle(
      tenantName
        ? `${tenantName} | DressFlow`
        : "DressFlow | AI • FASHION • ERP"
   );

    setBrowserFavicon(me.tenant_logo_url || "/logo-icon.png");
  }, [me.tenant_name, me.tenant_logo_url]);

  useEffect(() => {
    applyTenantBranding({
      logo_url: me.tenant_logo_url,
      primary_color: me.tenant_primary_color,
      secondary_color: null,
      accent_color: null,
      surface_color: null,
      sidebar_color: null,
    });

    return () => {
      applyTenantBranding(null);
    };
  }, [me]);

  const loadLateLoansCount = async () => {
    try {
      const response = await api.get<LoanCountResponse>("/loans", {
        params: {
          page: 1,
          page_size: 1,
          status: "LATE",
        },
      });

      setLateLoansCount(Number(response.data?.total || 0));
    } catch (error) {
      console.error("Error loading late loans count:", error);
      setLateLoansCount(0);
    }
  };

  useEffect(() => {
    void loadLateLoansCount();
  }, [location.pathname]);

  useEffect(() => {
    const onFocus = () => {
      void loadLateLoansCount();
    };

    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      void loadLateLoansCount();
    }, 60000);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, []);

  const topLevelItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [
      {
        to: "/",
        label: (
          <>
            <SidebarIcon><HomeIcon /></SidebarIcon>
            <span>{t("navigation.home")}</span>
          </>
        ),
      },
      {
        to: "/dresses",
        label: (
          <>
            <SidebarIcon><DressIcon /></SidebarIcon>
            <span>{t("navigation.dresses")}</span>
          </>
        ),
      },
      {
        to: "/accessories",
        label: (
          <>
            <SidebarIcon><TrimIcon /></SidebarIcon>
            <span>Accesorios</span>
          </>
        ),
      },
      {
        to: "/accessory-movements",
        label: (
          <>
            <SidebarIcon><MovementIcon /></SidebarIcon>
            <span>Movimientos accesorios</span>
          </>
        ),
      },
      {
        to: "/capsules",
        label: (
          <>
            <SidebarIcon><CapsuleIcon /></SidebarIcon>
            <span>Capsulas</span>
          </>
        ),
      },
      {
        to: "/loans",
        label: (
          <>
            <SidebarIcon><LoanIcon /></SidebarIcon>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                width: "100%",
              }}
            >
              <span>{t("navigation.loans")}</span>
              <LoansLateBadge count={lateLoansCount} />
            </div>
          </>
        ),
      },
      {
        to: "/sales",
        label: (
          <>
            <SidebarIcon><ReportsIcon /></SidebarIcon>
            <span>Ventas</span>
          </>
        ),
      },
      {
        to: "/production-orders",
        label: (
          <>
            <SidebarIcon><OrderIcon /></SidebarIcon>
            <span>{t("navigation.productionOrders")}</span>
          </>
        ),
      },
    ];

    if (me.is_superuser) {
      items.push({
        to: "/superadmin/tenants",
        label: (
          <>
            <SidebarIcon><CompanyIcon /></SidebarIcon>
            <span>Empresas</span>
          </>
        ),
      });
    }

    return items;
  }, [t, lateLoansCount, me.is_superuser]);

  const groupedItems: NavGroup[] = [
    {
      key: "textileInventory",
      label: (
        <>
          <SidebarIcon><FabricIcon /></SidebarIcon>
          <span>{t("navigation.textileInventory")}</span>
        </>
      ),
      items: [
        {
          to: "/fabrics",
          label: (
            <>
              <SidebarIcon><FabricIcon /></SidebarIcon>
              <span>{t("navigation.fabrics")}</span>
            </>
          ),
        },
        {
          to: "/fabric-rolls",
          label: (
            <>
              <SidebarIcon><RollIcon /></SidebarIcon>
              <span>{t("navigation.fabricRolls")}</span>
            </>
          ),
        },
        {
          to: "/trims",
          label: (
            <>
              <SidebarIcon><TrimIcon /></SidebarIcon>
              <span>{t("navigation.trims")}</span>
            </>
          ),
        },
        {
          to: "/fabric-movements",
          label: (
            <>
              <SidebarIcon><MovementIcon /></SidebarIcon>
              <span>{t("navigation.fabricMovements")}</span>
            </>
          ),
        },
      ],
    },
    {
      key: "reports",
      label: (
        <>
          <SidebarIcon><ReportsIcon /></SidebarIcon>
          <span>Reportes</span>
        </>
      ),
      items: [
        {
          to: "/reports/stock-valuation",
          label: (
            <>
              <SidebarIcon><StockIcon /></SidebarIcon>
              <span>Stock valorizado</span>
            </>
          ),
        },
        {
          to: "/reports/fabric-movements",
          label: (
            <>
              <SidebarIcon><MovementsReportIcon /></SidebarIcon>
              <span>Movimientos de tela</span>
            </>
          ),
        },
        {
          to: "/reports/loans",
          label: (
            <>
              <SidebarIcon><LoansReportIcon /></SidebarIcon>
              <span>Préstamos</span>
            </>
          ),
        },
        {
          to: "/reports/production-costs",
          label: (
            <>
              <SidebarIcon><StockIcon /></SidebarIcon>
              <span>Costos de producción</span>
            </>
          ),
        },
        {
          to: "/reports/sales-unified",
          label: (
            <>
              <SidebarIcon><SalesReportIcon /></SidebarIcon>
              <span>Ventas</span>
            </>
          ),
        },
        {
          to: "/dashboard/financial",
          label: (
            <>
              <SidebarIcon><ReportsIcon /></SidebarIcon>
              <span>Dashboard financiero</span>
            </>
          ),
        }
      ],
    },
    {
      key: "settings",
      label: (
        <>
          <SidebarIcon><BrandingIcon /></SidebarIcon>
          <span>{t("navigation.settings")}</span>
        </>
      ),
      items: [
        {
          to: "/tenant-branding",
          label: (
            <>
              <SidebarIcon><BrandingIcon /></SidebarIcon>
              <span>Branding</span>
            </>
          ),
        },
        {
          to: "/users",
          label: (
            <>
              <SidebarIcon><UsersIcon /></SidebarIcon>
              <span>{t("navigation.users")}</span>
            </>
          ),
        },
        {
          to: "/suppliers",
          label: (
            <>
              <SidebarIcon><SupplierIcon /></SidebarIcon>
              <span>{t("navigation.suppliers")}</span>
            </>
          ),
        },
        {
          to: "/customers",
          label: (
            <>
              <SidebarIcon><CustomerIcon /></SidebarIcon>
              <span>{t("navigation.customers")}</span>
            </>
          ),
        },
        ...(me.is_superuser
          ? [
              {
                to: "/settings/field-config",
                label: "Configuración de campos",
              },
            ]
          : []),
      ],
    },
  ];

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  if (me.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  if (me.must_change_password && location.pathname === "/change-password") {
    return (
      <main className="df-main">
        <Toaster position="top-right" />
        <Routes>
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/change-password" replace />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="df-shell">
      <header
        className="df-topbar"
        style={{
          borderTop: me.impersonated
            ? "3px solid #b42318"
            : "3px solid var(--tenant-primary)",
          background: me.impersonated ? "#fff5f5" : undefined,
          boxShadow: me.impersonated
            ? "0 2px 8px rgba(180, 35, 24, 0.15)"
            : undefined,
          transition: "all 0.2s ease",
        }}
      >
        <div className="df-topbar__left">
          <button
            className="df-mobile-nav-toggle"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              className="df-brand"
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <img
                src="/logo-icon.png"
                alt="DressFlow"
                style={{
                  height: 36,
                  width: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
                }}
              />

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1,
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                  }}
                >
                  DressFlow
                </span>

                <span
                  style={{
                    fontSize: 10,
                    color: "#9ca3af",
                    letterSpacing: "0.08em",
                  }}
                >
                  AI • FASHION • ERP
                </span>
              </div>
            </div>

            <div
              style={{
                width: 1,
                height: 32,
                background: "var(--df-border, #e5e7eb)",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {me.tenant_logo_url ? (
                <img
                  src={me.tenant_logo_url}
                  alt={me.tenant_name || "Tenant logo"}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    objectFit: "cover",
                    border: "1px solid var(--df-border, #e5e7eb)",
                    background: "#fff",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--tenant-primary)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    color: "#ffffff",
                    border: "1px solid var(--df-border, #e5e7eb)",
                  }}
                >
                  {me.tenant_name?.[0]?.toUpperCase() || "T"}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  lineHeight: 1.1,
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {me.tenant_name || "Empresa"}
                </span>

                {me.impersonated && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#b42318",
                      fontWeight: 700,
                      background: "#fee4e2",
                      padding: "2px 6px",
                      borderRadius: 6,
                      display: "inline-block",
                      width: "fit-content",
                    }}
                  >
                    Modo soporte
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="df-topbar__center">
          <input
            className="df-topbar__search"
            placeholder={t("topbar.searchPlaceholder")}
          />
        </div>

        <div className="df-topbar__right">
          <button
            className="df-lang-btn"
            onClick={() => i18n.changeLanguage("es")}
          >
            ES
          </button>
          <button
            className="df-lang-btn"
            onClick={() => i18n.changeLanguage("en")}
          >
            EN
          </button>

          <AlertBell
            count={lateLoansCount}
            onClick={() => navigate("/loans")}
          />

          <div className="df-user-chip">
            <div className="df-user-chip__avatar">
              {me.first_name?.[0] || me.email?.[0] || "U"}
            </div>
            <div className="df-user-chip__meta">
              <span className="df-user-chip__name">
                {me.first_name} {me.last_name}
              </span>
              <span className="df-user-chip__email">{me.email}</span>
            </div>
          </div>

          <button className="df-ghost-btn" onClick={onLogout}>
            {t("actions.logout")}
          </button>
        </div>
      </header>

      <div className="df-layout">
        <aside
          className={`df-sidebar ${mobileNavOpen ? "df-sidebar--open" : ""}`}
        >
          <nav className="df-sidebar__nav">
            {topLevelItems.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`df-sidebar__link ${
                    active ? "df-sidebar__link--active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {groupedItems.map((group) => (
              <div
                key={group.key}
                className={
                  group.key === "settings"
                    ? "df-sidebar__group df-sidebar__group--settings"
                    : "df-sidebar__group"
                }
              >
                <SidebarGroup group={group} pathname={location.pathname} />
              </div>
            ))}
          </nav>
        </aside>

        {mobileNavOpen && (
          <button
            className="df-sidebar-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
        )}

        <main className="df-main">
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route
              path="/login/:tenantSlug"
              element={<Navigate to="/" replace />}
            />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/dresses" element={<DressesPage />} />
            <Route path="/dresses/:id" element={<EditDressPage />} />
            <Route path="/loans" element={<LoansPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/fabrics" element={<FabricsPage />} />
            <Route path="/fabric-rolls" element={<FabricRollsPage />} />
            <Route path="/capsules" element={<CapsulesPage />} />
            <Route path="/accessories" element={<AccessoriesPage />} />
            <Route path="/accessory-movements" element={<AccessoryMovementsPage />} />
            <Route path="/accessory-sales" element={<AccessorySalesPage />} />
            <Route path="/reports/sales-unified" element={<SalesReportPage />} />
            <Route path="/sales" element={<SalesUnifiedPage />} />
            <Route path="/dashboard/financial" element={<FinancialDashboardPage />} />
            <Route
              path="/fabric-movements"
              element={<FabricMovementsPage />}
            />
            <Route path="/trims" element={<TrimsPage />} />
            <Route
              path="/production-orders"
              element={<ProductionOrdersPage />}
            />
            <Route
              path="/production-orders/:id"
              element={<ProductionOrderDetailPage />}
            />
            <Route
              path="/production-orders/:id/print"
              element={<ProductionOrderPrintPage />}
            />
            <Route
              path="/superadmin/tenants"
              element={<SuperadminTenantsPage />}
            />
            <Route
              path="/tenant-branding"
              element={<TenantBrandingPage />}
            />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/reports/stock-valuation" element={<ReportsPage />} />
            <Route
              path="/reports/fabric-movements"
              element={<FabricMovementsReportPage />}
            />
            <Route path="/reports/loans" element={<LoansReportPage />} />
            <Route path="/reports/production-costs" element={<ProductionCostsReportPage />} />
            <Route
              path="/settings/field-config"
              element={
                me.is_superuser ? (
                  <TenantFieldSettingsPage />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const location = useLocation();

  const isPrintRoute = location.pathname.includes("/print");

  const loadSession = async () => {
    const token = getToken();

    if (!token) {
      setMe(null);
      setLoadingMe(false);
      return;
    }

    try {
      setLoadingMe(true);
      const data = await fetchMe();
      setMe(data);

      if (
        data.must_change_password &&
        window.location.pathname !== "/change-password"
      ) {
        window.location.replace("/change-password");
        return;
      }
    } catch (error) {
      console.error("Error cargando sesión:", error);
      setMe(null);
    } finally {
      setLoadingMe(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const handleLogout = () => {
    clearToken();
    window.location.href = "/login";
  };

  if (loadingMe) {
    return <AppLoader title="DressFlow" subtitle="AI • FASHION • ERP" />;
  }

  // 🔥 PRINT MODE (SIN APP SHELL)
  if (isPrintRoute) {
    return (
      <Routes>
        <Route
          path="/production-orders/:id/print"
          element={<ProductionOrderPrintPage />}
        />
      </Routes>
    );
  }

  if (!me) {
    return (
      <Routes>
        <Route
          path="/login"
          element={<LoginPage onLoginSuccess={loadSession} />}
        />
        <Route
          path="/login/:tenantSlug"
          element={<LoginPage onLoginSuccess={loadSession} />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <>
      <ImpersonationBanner me={me} onSessionChanged={loadSession} />

      <AppShell
        me={{
          id: me.id,
          email: me.email,
          first_name: me.first_name,
          last_name: me.last_name,
          tenant_id: me.tenant_id,
          tenant_name: me.tenant_name,
          tenant_logo_url: me.tenant_logo_url,
          tenant_primary_color: me.tenant_primary_color,
          role: me.role,
          is_superuser: me.is_superuser,
          impersonated: me.impersonated,
          must_change_password: me.must_change_password,
        }}
        onLogout={handleLogout}
      />
    </>
  );
}

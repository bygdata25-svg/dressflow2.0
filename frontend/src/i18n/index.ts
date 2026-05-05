import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import esCommon from "./es/common.json";
import enCommon from "./en/common.json";

import esDresses from "./es/dresses.json";
import enDresses from "./en/dresses.json";

import esCustomers from "./es/customers.json";
import enCustomers from "./en/customers.json";

import esLoans from "./es/loans.json";
import enLoans from "./en/loans.json";

import esSuppliers from "./es/suppliers.json";
import enSuppliers from "./en/suppliers.json";

import esFabrics from "./es/fabrics.json";
import enFabrics from "./en/fabrics.json";

import esFabricRolls from "./es/fabric-rolls.json";
import enFabricRolls from "./en/fabric-rolls.json";

import esFabricMovements from "./es/fabric-movements.json";
import enFabricMovements from "./en/fabric-movements.json";

import esDashboard from "./es/dashboard.json";
import enDashboard from "./en/dashboard.json";

import esProductionOrders from "./es/production-orders.json";
import enProductionOrders from "./en/production-orders.json";

import esTrims from "./es/trims.json";
import enTrims from "./en/trims.json";

import esAccessories from "./es/accessories.json";
import enAccessories from "./en/accessories.json";

import esAccessoryMovements from "./es/accessoryMovements.json";
import enAccessoryMovements from "./en/accessoryMovements.json";

import esCapsules from "./es/capsules.json";
import enCapsules from "./en/capsules.json";

import esSalesUnified from "./es/sales.json";
import enSalesUnified from "./en/sales.json";

import loansReportEs from "./es/loans-report.json";
import loansReportEn from "./en/loans-report.json";

import esStockValuationReport from "./es/stock-valuation-report.json";
import enStockValuationReport from "./en/stock-valuation-report.json";

import esDressStockReport from "./es/dress-stock-report.json";
import enDressStockReport from "./en/dress-stock-report.json";

import esFabricMovementsReport from "./es/fabric-movements-report.json";
import enFabricMovementsReport from "./en/fabric-movements-report.json";

import esProductionCosts from "./es/production-costs-report.json";
import enProductionCosts from "./en/production-costs-report.json";

import esSalesReport from "./es/sales-report.json";
import enSalesReport from "./en/sales-report.json";

import esFinancialDashboard from "./es/financial-dashboard.json";
import enFinancialDashboard from "./en/financial-dashboard.json";

import esBranding from "./es/branding.json";
import enBranding from "./en/branding.json";

import esUsers from "./es/users.json";
import enUsers from "./en/users.json";

import importsES from "./es/imports.json";
import importsEN from "./en/imports.json";

i18n.use(initReactI18next).init({
  resources: {
    es: {
      common: esCommon,
      dresses: esDresses,
      customers: esCustomers,
      loans: esLoans,
      suppliers: esSuppliers,
      fabrics: esFabrics,
      "fabric-rolls": esFabricRolls,
      "fabric-movements": esFabricMovements,
      dashboard: esDashboard,
      "production-orders": esProductionOrders,
      trims: esTrims,
      accessories: esAccessories,
      accessoryMovements: esAccessoryMovements,
      capsules: esCapsules,
      sales: esSalesUnified,
      "loans-report": loansReportEs,
      "stock-valuation-report": esStockValuationReport,
      "dress-stock-report": esDressStockReport,
      "fabric-movements-report": esFabricMovementsReport,
      "production-costs-report": esProductionCosts,
      "sales-report": esSalesReport,
      "financial-dashboard": esFinancialDashboard,
      branding: esBranding,
      users: esUsers,
      imports: importsES,
    },
    en: {
      common: enCommon,
      dresses: enDresses,
      customers: enCustomers,
      loans: enLoans,
      suppliers: enSuppliers,
      fabrics: enFabrics,
      "fabric-rolls": enFabricRolls,
      "fabric-movements": enFabricMovements,
      dashboard: enDashboard,
      "production-orders": enProductionOrders,
      trims: enTrims,
      accessories: enAccessories,
      accessoryMovements: enAccessoryMovements,
      capsules: enCapsules,
      sales: enSalesUnified,
      "loans-report": loansReportEn,
      "stock-valuation-report": enStockValuationReport,
      "dress-stock-report": enDressStockReport,
      "fabric-movements-report": enFabricMovementsReport,
      "production-costs-report": enProductionCosts,
      "sales-report": enSalesReport,
      "financial-dashboard": enFinancialDashboard,
      branding: enBranding,
      users: enUsers,
      imports: importsEN,
    }
  },
  lng: "es",
  fallbackLng: "es",
  interpolation: {
    escapeValue: false
  },
  ns: [
    "common",
    "dresses",
    "customers",
    "loans",
    "suppliers",
    "fabrics",
    "fabric-rolls",
    "fabric-movements",
    "dashboard",
    "production-orders",
    "trims",
    "accessories",
    "loans-report",
    "stock-valuation-report",
    "dress-stock-report",
    "production-costs-report",
    "sales-report",
    "branding",
    "users",
    
  ],
  defaultNS: "common"
});

export default i18n;

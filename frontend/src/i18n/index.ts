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
      trims: esTrims
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
      trims: enTrims
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
    "trims"
  ],
  defaultNS: "common"
});

export default i18n;

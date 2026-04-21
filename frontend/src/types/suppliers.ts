// src/types/supplier.ts
export type SupplierType = "FABRIC_SUPPLIER" | "WORKSHOP" | "BOTH";

export type Supplier = {
  id?: string;
  tenant_id?: string;
  name: string;
  supplier_code?: string | null;
  origin?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  supplier_type: SupplierType;
};

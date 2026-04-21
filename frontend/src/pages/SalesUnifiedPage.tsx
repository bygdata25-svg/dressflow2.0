import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import toast from "react-hot-toast";
import "./SalesUnifiedPage.css";

type CurrencyCode = "USD" | "ARS";
type SaleItemType = "dress" | "accessory";
type PaymentMethod = "cash" | "transfer" | "debit" | "credit" | "mercadopago" | "other";

type SaleItem = {
  type: SaleItemType;
  item_id: string;
  name: string;
  price: number;
  quantity: number;
  currency: CurrencyCode;
};

type SalePayment = {
  method: PaymentMethod;
  amount: number;
  currency: CurrencyCode;
  reference?: string;
};

type Customer = {
  id: string;
  code?: string;
  full_name?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string | null;
  phone?: string | null;
};

type DressOption = {
  id: string;
  code?: string;
  name: string;
  sale_price?: number;
  rental_price?: number;
  status?: string;
};

type AccessoryOption = {
  id: string;
  code?: string;
  name: string;
  sale_price?: number;
  stock?: number;
};

type SaleRecordItem = {
  id: string;
  item_type: string;
  description_snapshot?: string;
  quantity: number;
  unit_price: number;
  currency: CurrencyCode;
  line_total: number;
};

type SaleRecordPayment = {
  id: string;
  payment_method: PaymentMethod | string;
  amount: number;
  currency: CurrencyCode;
  reference?: string | null;
  notes?: string | null;
};

type SaleRecord = {
  id: string;
  sale_number?: string;
  sale_date?: string;
  created_at?: string;
  customer_full_name?: string | null;
  currency?: string;
  status?: string;
  subtotal_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  notes?: string | null;
  items?: SaleRecordItem[];
  payments?: SaleRecordPayment[];
};

type CustomerFormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

const EMPTY_CUSTOMER_FORM: CustomerFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
};

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function getCustomerDisplayName(
  customer?:
    | Customer
    | {
        full_name?: string | null;
        first_name?: string;
        last_name?: string;
      }
    | null
) {
  if (!customer) return "";

  const fullName = (customer.full_name || "").trim();
  if (fullName) return fullName;

  return [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim();
}

function formatMoney(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "cash":
      return "Efectivo";
    case "transfer":
      return "Transferencia";
    case "debit":
      return "Débito";
    case "credit":
      return "Crédito";
    case "mercadopago":
      return "Mercado Pago";
    default:
      return "Otro";
  }
}

function getPaymentMethodLabel(method?: string) {
  switch (String(method || "").toLowerCase()) {
    case "cash":
      return "Efectivo";
    case "transfer":
      return "Transferencia";
    case "debit":
      return "Débito";
    case "credit":
      return "Crédito";
    case "mercadopago":
      return "Mercado Pago";
    case "other":
      return "Otro";
    default:
      return method || "Sin definir";
  }
}

function getPaymentStatusLabel(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "PAID":
      return "Pagada";
    case "PARTIAL":
      return "Pago parcial";
    case "PENDING":
      return "Pendiente";
    case "COMPLETED":
      return "Completada";
    case "CANCELLED":
      return "Cancelada";
    default:
      return status || "Sin estado";
  }
}

function getSaleCurrencyBreakdown(sale: SaleRecord) {
  const items = sale.items || [];
  const payments = sale.payments || [];

  const itemsUSD = items
    .filter((item) => String(item.currency || "ARS").toUpperCase() === "USD")
    .reduce((acc, item) => acc + Number(item.line_total || 0), 0);

  const itemsARS = items
    .filter((item) => String(item.currency || "ARS").toUpperCase() === "ARS")
    .reduce((acc, item) => acc + Number(item.line_total || 0), 0);

  const paidUSD = payments
    .filter((payment) => String(payment.currency || "ARS").toUpperCase() === "USD")
    .reduce((acc, payment) => acc + Number(payment.amount || 0), 0);

  const paidARS = payments
    .filter((payment) => String(payment.currency || "ARS").toUpperCase() === "ARS")
    .reduce((acc, payment) => acc + Number(payment.amount || 0), 0);

  return {
    itemsUSD: Number(itemsUSD.toFixed(2)),
    itemsARS: Number(itemsARS.toFixed(2)),
    paidUSD: Number(paidUSD.toFixed(2)),
    paidARS: Number(paidARS.toFixed(2)),
  };
}

function getSaleDisplayTotal(sale: SaleRecord) {
  const breakdown = getSaleCurrencyBreakdown(sale);
  const hasUSD = breakdown.itemsUSD > 0;
  const hasARS = breakdown.itemsARS > 0;

  if (hasUSD && hasARS) {
    return `${formatMoney(breakdown.itemsUSD, "USD")} + ${formatMoney(breakdown.itemsARS, "ARS")}`;
  }

  if (hasUSD) return formatMoney(breakdown.itemsUSD, "USD");
  if (hasARS) return formatMoney(breakdown.itemsARS, "ARS");

  if (sale.total_amount != null) {
    return formatMoney(Number(sale.total_amount || 0), String(sale.currency || "ARS").toUpperCase() === "USD" ? "USD" : "ARS");
  }

  return "-";
}

export default function SalesUnifiedPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [lastCreatedSaleId, setLastCreatedSaleId] = useState<string | null>(null);
  const [isRefreshingSales, setIsRefreshingSales] = useState(false);

  const [dresses, setDresses] = useState<DressOption[]>([]);
  const [accessories, setAccessories] = useState<AccessoryOption[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const [submittingSale, setSubmittingSale] = useState(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");
  const [dressQuery, setDressQuery] = useState("");
  const [accessoryQuery, setAccessoryQuery] = useState("");

  const [customerOpen, setCustomerOpen] = useState(false);
  const [dressOpen, setDressOpen] = useState(false);
  const [accessoryOpen, setAccessoryOpen] = useState(false);

  const [paymentDraftCurrency, setPaymentDraftCurrency] = useState<CurrencyCode>("ARS");
  const [exchangeRate, setExchangeRate] = useState<string>("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");

  const customerBoxRef = useRef<HTMLDivElement | null>(null);
  const dressBoxRef = useRef<HTMLDivElement | null>(null);
  const accessoryBoxRef = useRef<HTMLDivElement | null>(null);

  const [payments, setPayments] = useState<SalePayment[]>([]);

  const [form, setForm] = useState<{
    customer_id: string | null;
    items: SaleItem[];
    notes: string;
  }>({
    customer_id: null,
    items: [],
    notes: "",
  });

  const [customerForm, setCustomerForm] = useState<CustomerFormState>(EMPTY_CUSTOMER_FORM);

  const totals = useMemo(() => {
    return form.items.reduce(
      (acc, item) => {
        const subtotal = Number(item.price || 0) * Number(item.quantity || 0);
        if (item.currency === "USD") acc.usd += subtotal;
        if (item.currency === "ARS") acc.ars += subtotal;
        return acc;
      },
      { usd: 0, ars: 0 }
    );
  }, [form.items]);

  const exchangeRateNumber = Number(exchangeRate || 0);

  const paymentsByCurrency = useMemo(() => {
    return payments.reduce(
      (acc, payment) => {
        if (payment.currency === "USD") acc.usd += Number(payment.amount || 0);
        if (payment.currency === "ARS") acc.ars += Number(payment.amount || 0);
        return acc;
      },
      { usd: 0, ars: 0 }
    );
  }, [payments]);

  const summaryTotals = useMemo(() => {
    const units = form.items.reduce(
      (acc, item) => acc + Number(item.quantity || 0),
      0
    );

    const itemsUSD = Number(totals.usd.toFixed(2));
    const itemsARS = Number(totals.ars.toFixed(2));
    const paidUSD = Number(paymentsByCurrency.usd.toFixed(2));
    const paidARS = Number(paymentsByCurrency.ars.toFixed(2));
    const balanceUSD = Number((totals.usd - paymentsByCurrency.usd).toFixed(2));
    const balanceARS = Number((totals.ars - paymentsByCurrency.ars).toFixed(2));

    const paymentBreakdown = payments.reduce<Array<{ method: string; currency: CurrencyCode; amount: number }>>(
      (acc, payment) => {
        const existing = acc.find(
          (row) => row.method === payment.method && row.currency === payment.currency
        );

        if (existing) {
          existing.amount = Number((existing.amount + Number(payment.amount || 0)).toFixed(2));
        } else {
          acc.push({
            method: payment.method,
            currency: payment.currency,
            amount: Number(Number(payment.amount || 0).toFixed(2)),
          });
        }

        return acc;
      },
      []
    );

    const equivalentARS = Number(
      (itemsARS + (exchangeRateNumber > 0 ? itemsUSD * exchangeRateNumber : 0)).toFixed(2)
    );
    const paidEquivalentARS = Number(
      (paidARS + (exchangeRateNumber > 0 ? paidUSD * exchangeRateNumber : 0)).toFixed(2)
    );

    let paymentStatus: "PAID" | "PARTIAL" | "PENDING" = "PENDING";
    const anyPaid = paidUSD > 0 || paidARS > 0;
    const usdCovered = Math.abs(balanceUSD) <= 0.01 || paidUSD >= itemsUSD;
    const arsCovered = Math.abs(balanceARS) <= 0.01 || paidARS >= itemsARS;

    if (usdCovered && arsCovered) {
      paymentStatus = "PAID";
    } else if (anyPaid) {
      paymentStatus = "PARTIAL";
    }

    return {
      itemsUSD,
      itemsARS,
      paidUSD,
      paidARS,
      balanceUSD,
      balanceARS,
      units,
      itemCount: form.items.length,
      equivalentARS,
      paidEquivalentARS,
      paymentBreakdown,
      paymentStatus,
    };
  }, [form.items, totals, paymentsByCurrency, payments, exchangeRateNumber]);

  const requiresExchangeRate = useMemo(() => {
    const hasItemsInBothCurrencies = summaryTotals.itemsUSD > 0 && summaryTotals.itemsARS > 0;
    const hasPaymentsInBothCurrencies = summaryTotals.paidUSD > 0 && summaryTotals.paidARS > 0;
    const hasCrossCurrencyGap =
      (summaryTotals.itemsUSD > 0 && summaryTotals.balanceARS < 0) ||
      (summaryTotals.itemsARS > 0 && summaryTotals.balanceUSD < 0);

    return hasItemsInBothCurrencies || hasPaymentsInBothCurrencies || hasCrossCurrencyGap;
  }, [summaryTotals]);

  const convertedUsdToArs = useMemo(() => {
    if (exchangeRateNumber <= 0) return 0;
    return Number((summaryTotals.itemsUSD * exchangeRateNumber).toFixed(2));
  }, [exchangeRateNumber, summaryTotals.itemsUSD]);

  const totalEquivalentArs = useMemo(() => {
    if (summaryTotals.itemsUSD > 0 && exchangeRateNumber <= 0) return summaryTotals.itemsARS;
    return Number((summaryTotals.itemsARS + convertedUsdToArs).toFixed(2));
  }, [summaryTotals.itemsARS, summaryTotals.itemsUSD, exchangeRateNumber, convertedUsdToArs]);

  const totalPaidEquivalentArs = useMemo(() => {
    if (summaryTotals.paidUSD > 0 && exchangeRateNumber <= 0) return summaryTotals.paidARS;
    return Number(
      (summaryTotals.paidARS + summaryTotals.paidUSD * exchangeRateNumber).toFixed(2)
    );
  }, [summaryTotals, exchangeRateNumber]);

  const paymentDifferenceEquivalentArs = useMemo(() => {
    if (requiresExchangeRate && exchangeRateNumber <= 0) return totalEquivalentArs;
    return Number((totalEquivalentArs - totalPaidEquivalentArs).toFixed(2));
  }, [requiresExchangeRate, exchangeRateNumber, totalEquivalentArs, totalPaidEquivalentArs]);

  const summaryHeadline = useMemo(() => {
    const hasUSD = summaryTotals.itemsUSD > 0;
    const hasARS = summaryTotals.itemsARS > 0;

    if (hasUSD && hasARS) {
      return {
        mode: "mixed" as const,
        label: "TOTAL MIXTO",
        value: `${formatMoney(summaryTotals.itemsUSD, "USD")} + ${formatMoney(summaryTotals.itemsARS, "ARS")}`,
        hint:
          exchangeRateNumber > 0
            ? `Equiv. ${formatMoney(totalEquivalentArs, "ARS")}`
            : "Cargá tipo de cambio para ver equivalente consolidado",
      };
    }

    if (hasUSD) {
      return {
        mode: "usd" as const,
        label: "TOTAL",
        value: formatMoney(summaryTotals.itemsUSD, "USD"),
        hint: "Venta expresada en USD",
      };
    }

    if (hasARS) {
      return {
        mode: "ars" as const,
        label: "TOTAL",
        value: formatMoney(summaryTotals.itemsARS, "ARS"),
        hint: "Venta expresada en ARS",
      };
    }

    return {
      mode: "empty" as const,
      label: "TOTAL",
      value: formatMoney(0, "ARS"),
      hint: "Agregá ítems para ver el resumen",
    };
  }, [summaryTotals, exchangeRateNumber, totalEquivalentArs]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customer_id) || null,
    [customers, form.customer_id]
  );

  const filteredCustomers = useMemo(() => {
    const q = normalizeText(customerQuery);
    if (!q) return customers.slice(0, 8);

    return customers
      .filter((customer) =>
        normalizeText(getCustomerDisplayName(customer)).includes(q)
      )
      .slice(0, 8);
  }, [customers, customerQuery]);

  const filteredDresses = useMemo(() => {
    const q = normalizeText(dressQuery);
    const available = dresses.filter(
      (dress) =>
        !form.items.some((item) => item.type === "dress" && item.item_id === dress.id)
    );

    if (!q) return available.slice(0, 8);

    return available
      .filter((dress) =>
        normalizeText([dress.code, dress.name].filter(Boolean).join(" ")).includes(q)
      )
      .slice(0, 8);
  }, [dresses, dressQuery, form.items]);

  const filteredAccessories = useMemo(() => {
    const q = normalizeText(accessoryQuery);
    if (!q) return accessories.slice(0, 8);

    return accessories
      .filter((accessory) =>
        normalizeText([accessory.code, accessory.name].filter(Boolean).join(" ")).includes(q)
      )
      .slice(0, 8);
  }, [accessories, accessoryQuery]);

  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      const res = await api.get("/customers");
      const rows = res?.data?.items || res?.data || [];
      setCustomers(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error loading customers", error);
      setCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const fetchSales = async (highlightId?: string | null) => {
    try {
      setLoadingSales(true);
      setIsRefreshingSales(true);
      const res = await api.get("/sales-unified");
      const rows = res?.data?.items || res?.data || [];
      const parsedRows = Array.isArray(rows) ? rows : [];
      setSales(parsedRows);

      const effectiveId = highlightId || null;
      if (effectiveId) {
        setLastCreatedSaleId(effectiveId);

        setTimeout(() => {
          const row = document.querySelector(
            `[data-sale-row-id="${effectiveId}"]`
          ) as HTMLElement | null;

          if (row) {
            row.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }
        }, 180);

        setTimeout(() => {
          setLastCreatedSaleId((current) =>
            current === effectiveId ? null : current
          );
        }, 4500);
      }
    } catch (error) {
      console.error("Error loading sales", error);
      setSales([]);
    } finally {
      setLoadingSales(false);
      setIsRefreshingSales(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      setLoadingCatalogs(true);

      const [dressesRes, accessoriesRes] = await Promise.all([
        api.get("/dresses"),
        api.get("/accessories"),
      ]);

      const dressesRows = dressesRes?.data?.items || dressesRes?.data || [];
      const accessoriesRows = accessoriesRes?.data?.items || accessoriesRes?.data || [];

      setDresses(
        Array.isArray(dressesRows)
          ? dressesRows.filter(
              (item: DressOption) =>
                !item.status ||
                item.status === "AVAILABLE" ||
                item.status === "available"
            )
          : []
      );

      setAccessories(Array.isArray(accessoriesRows) ? accessoriesRows : []);
    } catch (error) {
      console.error("Error loading catalogs", error);
      setDresses([]);
      setAccessories([]);
    } finally {
      setLoadingCatalogs(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSales();
    fetchCatalogs();
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (customerBoxRef.current && !customerBoxRef.current.contains(target)) {
        setCustomerOpen(false);
      }
      if (dressBoxRef.current && !dressBoxRef.current.contains(target)) {
        setDressOpen(false);
      }
      if (accessoryBoxRef.current && !accessoryBoxRef.current.contains(target)) {
        setAccessoryOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const resetSaleForm = () => {
    setForm({
      customer_id: null,
      items: [],
      notes: "",
    });
    setCustomerQuery("");
    setDressQuery("");
    setAccessoryQuery("");
    setCustomerOpen(false);
    setDressOpen(false);
    setAccessoryOpen(false);
    setPaymentDraftCurrency("ARS");
    setExchangeRate("");
    setPayments([]);
    setPaymentMethod("cash");
    setPaymentAmount("");
    setPaymentReference("");
  };

  const openNewSaleModal = () => {
    resetSaleForm();
    setShowSaleModal(true);
  };

  const closeSaleModal = () => {
    setShowSaleModal(false);
  };

  const openCustomerModal = () => {
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setShowCustomerModal(true);
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
  };

  const addItem = (item: SaleItem) => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (
    index: number,
    field: keyof SaleItem,
    value: string | number
  ) => {
    setForm((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [field]:
          field === "quantity" || field === "price" ? Number(value) : value,
      };
      return { ...prev, items: updated };
    });
  };

  const selectCustomer = (customer: Customer) => {
    setForm((prev) => ({
      ...prev,
      customer_id: customer.id,
    }));
    setCustomerQuery(getCustomerDisplayName(customer));
    setCustomerOpen(false);
  };

  const selectDress = (dress: DressOption) => {
    addItem({
      type: "dress",
      item_id: dress.id,
      name: [dress.code, dress.name].filter(Boolean).join(" - "),
      price: Number(dress.sale_price ?? 0),
      quantity: 1,
      currency: "USD",
    });
    setDressQuery("");
    setDressOpen(false);
  };

  const selectAccessory = (accessory: AccessoryOption) => {
    const existingIndex = form.items.findIndex(
      (item) => item.type === "accessory" && item.item_id === accessory.id
    );

    if (existingIndex >= 0) {
      updateItem(
        existingIndex,
        "quantity",
        Number(form.items[existingIndex].quantity || 0) + 1
      );
    } else {
      addItem({
        type: "accessory",
        item_id: accessory.id,
        name: [accessory.code, accessory.name].filter(Boolean).join(" - "),
        price: Number(accessory.sale_price ?? 0),
        quantity: 1,
        currency: "ARS",
      });
    }

    setAccessoryQuery("");
    setAccessoryOpen(false);
  };

  const addPayment = () => {
    const amount = Number(paymentAmount || 0);

    if (amount <= 0) {
      toast.error("Ingresá un monto de pago mayor a 0.");
      return;
    }

    setPayments((prev) => [
      ...prev,
      {
        method: paymentMethod,
        amount,
        currency: paymentDraftCurrency,
        reference: paymentReference.trim() || undefined,
      },
    ]);

    setPaymentAmount("");
    setPaymentReference("");
    setPaymentMethod("cash");
    setPaymentDraftCurrency("ARS");
  };

  const removePayment = (index: number) => {
    setPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitSale = async () => {
    if (!form.customer_id) {
      toast.error("Debés seleccionar un cliente.");
      return;
    }

    if (!form.items.length) {
      toast.error("Debés agregar al menos un ítem.");
      return;
    }

    const invalidQty = form.items.some((item) => Number(item.quantity) <= 0);
    if (invalidQty) {
      toast.error("La cantidad de todos los ítems debe ser mayor a 0.");
      return;
    }

    if (payments.length === 0) {
      toast.error("Debés cargar al menos una forma de pago.");
      return;
    }

    const normalizedItems = form.items.map((item) => ({
      item_type: item.type === "dress" ? "dress" : "accessory",
      dress_id: item.type === "dress" ? item.item_id : null,
      accessory_id: item.type === "accessory" ? item.item_id : null,
      quantity: Number(item.quantity || 1),
      unit_price: Number(item.price || 0),
      currency: item.currency === "USD" ? "USD" : "ARS",
      notes: null,
    }));

    const invalidItem = normalizedItems.find(
      (item) =>
        !item.item_type ||
        (item.item_type === "dress" && !item.dress_id) ||
        (item.item_type === "accessory" && !item.accessory_id) ||
        item.quantity <= 0 ||
        item.unit_price < 0
    );

    if (invalidItem) {
      console.error("INVALID ITEM", invalidItem);
      toast.error("Hay ítems incompletos o inválidos.");
      return;
    }

    const normalizedPayments = payments.map((payment) => ({
      payment_method: payment.method,
      amount: Number(payment.amount || 0),
      currency: payment.currency === "USD" ? "USD" : "ARS",
      reference: payment.reference || null,
      notes: null,
    }));

    const invalidPayment = normalizedPayments.find(
      (payment) => !payment.payment_method || Number(payment.amount) <= 0
    );

    if (invalidPayment) {
      console.error("INVALID PAYMENT", invalidPayment);
      toast.error("Hay pagos incompletos o inválidos.");
      return;
    }

    const itemTotals = normalizedItems.reduce(
      (acc, item) => {
        const subtotal = Number(item.unit_price) * Number(item.quantity);
        if (item.currency === "USD") acc.usd += subtotal;
        else acc.ars += subtotal;
        return acc;
      },
      { usd: 0, ars: 0 }
    );

    const paymentTotals = normalizedPayments.reduce(
      (acc, payment) => {
        if (payment.currency === "USD") acc.usd += Number(payment.amount);
        else acc.ars += Number(payment.amount);
        return acc;
      },
      { usd: 0, ars: 0 }
    );

    const needsExchangeRate =
      paymentTotals.ars + 0.01 < itemTotals.ars ||
      paymentTotals.usd + 0.01 < itemTotals.usd;

    if (needsExchangeRate && exchangeRateNumber <= 0) {
      toast.error("Debés ingresar un tipo de cambio válido para convertir entre ARS y USD.");
      return;
    }

    try {
      setSubmittingSale(true);

      const payload = {
        customer_id: form.customer_id,
        sale_date: null,
        currency: "ARS",
        exchange_rate: needsExchangeRate && exchangeRateNumber > 0 ? exchangeRateNumber : null,
        discount_amount: 0,
        notes: form.notes || null,
        items: normalizedItems,
        payments: normalizedPayments,
      };

      console.log("PAYLOAD FINAL", JSON.stringify(payload, null, 2));

      const response = await api.post("/sales-unified", payload);

      const createdSale = response?.data;
      const createdSaleId = createdSale?.id || null;
      const createdSaleNumber = createdSale?.sale_number || "";

      toast.success(
        createdSaleNumber
          ? `Venta ${createdSaleNumber} guardada correctamente`
          : "Venta guardada correctamente"
      );

      closeSaleModal();
      resetSaleForm();
      await fetchSales(createdSaleId);
    } catch (error) {
      console.error("SALE UNIFIED ERROR FULL", error);
      console.error("SALE UNIFIED ERROR RESPONSE", (error as any)?.response);
      console.error("SALE UNIFIED ERROR DATA", (error as any)?.response?.data);
      console.error("SALE UNIFIED ERROR DETAIL", (error as any)?.response?.data?.detail);

      toast.error(
        typeof (error as any)?.response?.data?.detail === "string"
          ? (error as any).response.data.detail
          : "No se pudo guardar la venta."
      );
    } finally {
      setSubmittingSale(false);
    }
  };

  const handleSubmitCustomer = async () => {
    if (!customerForm.first_name.trim()) {
      toast.error("Debés ingresar el nombre del cliente.");
      return;
    }

    try {
      setSubmittingCustomer(true);

      const payload = {
        first_name: customerForm.first_name.trim(),
        last_name: customerForm.last_name.trim(),
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
      };

      const res = await api.post("/customers", payload);
      const created = res?.data;

      await fetchCustomers();

      if (created?.id) {
        setForm((prev) => ({
          ...prev,
          customer_id: created.id,
        }));
      }

      setCustomerQuery(
        [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim()
      );

      closeCustomerModal();
      toast.success("Cliente creado correctamente.");
    } catch (error) {
      console.error("Error creating customer", error);
      toast.error("No se pudo crear el cliente.");
    } finally {
      setSubmittingCustomer(false);
    }
  };

  return (
    <div className="page-shell sales-unified-page">
      <style>{`
        .sales-summary-head {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 18px;
          border-radius: 22px;
          margin-bottom: 14px;
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .sales-summary-head span {
          font-size: 12px;
          letter-spacing: .12em;
          text-transform: uppercase;
          opacity: .82;
        }
        .sales-summary-head strong {
          font-size: 34px;
          line-height: 1.02;
          letter-spacing: -0.03em;
        }
        .sales-summary-head small {
          font-size: 12px;
          opacity: .9;
        }
        .sales-summary-head--usd {
          background: linear-gradient(135deg, rgba(63,40,74,.95) 0%, rgba(81,34,64,.95) 100%);
        }
        .sales-summary-head--ars {
          background: linear-gradient(135deg, rgba(54,38,85,.95) 0%, rgba(74,33,89,.95) 100%);
        }
        .sales-summary-head--mixed {
          background: linear-gradient(135deg, rgba(71,32,60,.98) 0%, rgba(90,42,98,.98) 40%, rgba(40,62,94,.95) 100%);
          border-color: rgba(255,255,255,0.14);
          position: relative;
          overflow: hidden;
        }
        .sales-summary-head--mixed::after {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at top right, rgba(255,255,255,0.14), transparent 35%);
          pointer-events: none;
        }
        .sales-summary-head--empty {
          background: linear-gradient(135deg, rgba(63,40,74,.7) 0%, rgba(81,34,64,.72) 100%);
        }

        .sales-summary-head small {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(6px);
          font-size: 11px;
          letter-spacing: .03em;
        }
        .sales-summary-metric {
          background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.05) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .sales-payment-detail-box {
          margin-top: 14px;
          padding: 14px;
          border-radius: 18px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .sales-payment-breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 8px;
        }
        .sales-payment-breakdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .sales-payment-breakdown-item span {
          opacity: .9;
        }
        .sales-payment-breakdown-item strong {
          font-weight: 800;
        }
        .sales-status-pill--completed,
        .sales-status-pill--paid {
          background: rgba(34,197,94,0.10);
          color: #1f7a45;
          border-color: rgba(34,197,94,0.18);
        }
        .sales-status-pill--partial {
          background: rgba(245,158,11,0.12);
          color: #9a5c00;
          border-color: rgba(245,158,11,0.18);
        }
        .sales-status-pill--pending {
          background: rgba(59,130,246,0.10);
          color: #295caa;
          border-color: rgba(59,130,246,0.18);
        }
        .sales-status-pill--cancelled {
          background: rgba(239,68,68,0.10);
          color: #a73737;
          border-color: rgba(239,68,68,0.16);
        }
        .sales-refresh-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.08);
          color: #6d28d9;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .sales-table-row {
          transition:
            background-color 0.35s ease,
            box-shadow 0.35s ease,
            transform 0.35s ease,
            border-color 0.35s ease;
        }
        .sales-table-row--highlight {
          background: linear-gradient(180deg, rgba(124, 58, 237, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%);
          box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.18), 0 12px 30px rgba(124, 58, 237, 0.10);
          border-color: rgba(124, 58, 237, 0.24);
          transform: translateY(-1px);
          animation: salesRowPulse 1.6s ease-out 1;
        }
        @keyframes salesRowPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(124, 58, 237, 0.28);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(124, 58, 237, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(124, 58, 237, 0);
          }
        }


      `}</style>
      <div className="sales-hero">
        <div className="sales-hero-copy">
          <div className="sales-kicker">Operaciones</div>
          <h1>Ventas</h1>
          <p>
            Gestioná ventas unificadas de vestidos y accesorios con una
            operatoria simple, clara y profesional.
          </p>
        </div>

        <div className="sales-hero-actions">
          <button className="sales-primary-btn" onClick={openNewSaleModal}>
            Nueva venta
          </button>
        </div>
      </div>

      <div className="sales-panel">
        <div className="sales-panel-header">
          <div>
            <h2>Listado de ventas</h2>
            <p>Consultá las operaciones registradas y su resumen general.</p>
          </div>

          <div className="sales-panel-chip">
            {loadingSales
              ? "Actualizando..."
              : `${sales.length} registro${sales.length === 1 ? "" : "s"}`}
          </div>

          {isRefreshingSales && (
            <div className="sales-refresh-badge">Actualizando...</div>
          )}
        </div>

        <div className="sales-panel-body">
          {loadingSales ? (
            <div className="sales-empty-state">
              <div className="sales-empty-icon">◌</div>
              <div>
                <strong>Cargando ventas</strong>
                <p>Estamos trayendo la información más reciente.</p>
              </div>
            </div>
          ) : sales.length === 0 ? (
            <div className="sales-empty-state">
              <div className="sales-empty-icon">＋</div>
              <div>
                <strong>Todavía no hay ventas registradas</strong>
                <p>Creá tu primera venta unificada de vestidos y accesorios.</p>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table sales-table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Moneda</th>
                    <th>Ítems</th>
                    <th>Pagos</th>
                    <th>Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const isNewRow = sale.id === lastCreatedSaleId;

                    return (
                    <tr
                      key={sale.id}
                      data-sale-row-id={sale.id}
                      className={isNewRow ? "sales-table-row sales-table-row--highlight" : "sales-table-row"}
                    >
                      <td>
                        <div className="sales-code-cell">
                          {sale.sale_number || "-"}
                        </div>
                      </td>
                      <td>
                        {sale.sale_date
                          ? new Date(sale.sale_date).toLocaleDateString("es-AR")
                          : sale.created_at
                          ? new Date(sale.created_at).toLocaleDateString("es-AR")
                          : "-"}
                      </td>
                      <td>{sale.customer_full_name || "-"}</td>
                      <td>{sale.currency || "-"}</td>
                      <td>
                        <div className="sales-table-stacked">
                          {(sale.items || []).length === 0 ? (
                            <span className="sales-muted">-</span>
                          ) : (
                            (sale.items || []).map((item) => (
                              <div key={item.id} className="sales-table-line">
                                <strong>{item.item_type === "dress" ? "Vestido" : item.item_type === "DRESS" ? "Vestido" : "Accesorio"}</strong>{" "}
                                · {item.description_snapshot || "Ítem"} · x{item.quantity} · {formatMoney(Number(item.line_total || 0), item.currency || "ARS")}
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="sales-table-stacked">
                          {(sale.payments || []).length === 0 ? (
                            <span className="sales-muted">-</span>
                          ) : (
                            (sale.payments || []).map((payment) => (
                              <div key={payment.id} className="sales-table-line">
                                <strong>{getPaymentMethodLabel(payment.payment_method || "other")}</strong>{" "}
                                · {formatMoney(Number(payment.amount || 0), payment.currency || "ARS")}
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="sales-total-cell">
                        {getSaleDisplayTotal(sale)}
                      </td>
                      <td>
                        <span className={`sales-items-pill sales-status-pill sales-status-pill--${String(sale.status || "").toLowerCase()}`}>
                          {getPaymentStatusLabel(sale.status)}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showSaleModal && (
        <div className="modal-overlay" onClick={closeSaleModal}>
          <div
            className="modal-content sales-modal-pro"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header sales-modal-header-pro">
              <div>
                <div className="sales-kicker">Operación comercial</div>
                <h2>Nueva venta</h2>
                <p>
                  Armá una venta unificada con una experiencia más ágil, visual
                  y ordenada.
                </p>
              </div>

              <button
                className="icon-btn sales-close-btn"
                onClick={closeSaleModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="sales-modal-layout">
              <div className="sales-modal-main">
                <div className="sales-pro-card">
                  <div className="sales-pro-card-head">
                    <div>
                      <h3>Cliente</h3>
                      <p>Buscá o creá un cliente sin salir de la venta.</p>
                    </div>
                    <button
                      type="button"
                      className="sales-secondary-btn"
                      onClick={openCustomerModal}
                    >
                      Nuevo cliente
                    </button>
                  </div>

                  <div className="sales-search-grid">
                    <div className="sales-search-field" ref={customerBoxRef}>
                      <label>Buscar cliente</label>
                      <input
                        type="text"
                        value={customerQuery}
                        onChange={(e) => {
                          setCustomerQuery(e.target.value);
                          setCustomerOpen(true);
                        }}
                        onFocus={() => setCustomerOpen(true)}
                        placeholder={
                          loadingCustomers
                            ? "Cargando clientes..."
                            : "Escribí nombre del cliente"
                        }
                      />

                      {customerOpen && (
                        <div className="sales-dropdown">
                          {filteredCustomers.length === 0 ? (
                            <div className="sales-dropdown-empty">
                              No se encontraron clientes.
                            </div>
                          ) : (
                            filteredCustomers.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                className="sales-dropdown-item"
                                onClick={() => selectCustomer(customer)}
                              >
                                <strong>
                                  {getCustomerDisplayName(customer) || "Cliente sin nombre"}
                                </strong>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="sales-search-selected">
                      <label>Cliente seleccionado</label>
                      <div className="sales-selected-chip">
                        {getCustomerDisplayName(selectedCustomer) || "Sin seleccionar"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sales-pro-card">
                  <div className="sales-pro-card-head">
                    <div>
                      <h3>Agregar ítems</h3>
                      <p>Sumá vestidos y accesorios con búsqueda rápida.</p>
                    </div>
                  </div>

                  <div className="sales-search-grid">
                    <div className="sales-search-field" ref={dressBoxRef}>
                      <label>Vestido</label>
                      <input
                        type="text"
                        value={dressQuery}
                        onChange={(e) => {
                          setDressQuery(e.target.value);
                          setDressOpen(true);
                        }}
                        onFocus={() => setDressOpen(true)}
                        placeholder={
                          loadingCatalogs
                            ? "Cargando vestidos..."
                            : "Buscar vestido por código o nombre"
                        }
                      />
                      {dressOpen && (
                        <div className="sales-dropdown">
                          {filteredDresses.length === 0 ? (
                            <div className="sales-dropdown-empty">
                              No hay vestidos disponibles.
                            </div>
                          ) : (
                            filteredDresses.map((dress) => (
                              <button
                                key={dress.id}
                                type="button"
                                className="sales-dropdown-item"
                                onClick={() => selectDress(dress)}
                              >
                                <strong>
                                  {[dress.code, dress.name].filter(Boolean).join(" - ")}
                                </strong>
                                <span>
                                  {formatMoney(Number(dress.sale_price ?? 0), "USD")}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div className="sales-search-field" ref={accessoryBoxRef}>
                      <label>Accesorio</label>
                      <input
                        type="text"
                        value={accessoryQuery}
                        onChange={(e) => {
                          setAccessoryQuery(e.target.value);
                          setAccessoryOpen(true);
                        }}
                        onFocus={() => setAccessoryOpen(true)}
                        placeholder={
                          loadingCatalogs
                            ? "Cargando accesorios..."
                            : "Buscar accesorio por código o nombre"
                        }
                      />
                      {accessoryOpen && (
                        <div className="sales-dropdown">
                          {filteredAccessories.length === 0 ? (
                            <div className="sales-dropdown-empty">
                              No se encontraron accesorios.
                            </div>
                          ) : (
                            filteredAccessories.map((accessory) => (
                              <button
                                key={accessory.id}
                                type="button"
                                className="sales-dropdown-item"
                                onClick={() => selectAccessory(accessory)}
                              >
                                <strong>
                                  {[accessory.code, accessory.name]
                                    .filter(Boolean)
                                    .join(" - ")}
                                </strong>
                                <span>
                                  {Number(accessory.sale_price ?? 0) === 0
                                    ? "Bonificado"
                                    : formatMoney(Number(accessory.sale_price ?? 0), "ARS")}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {form.items.length === 0 ? (
                    <div className="sales-empty-inline">
                      Agregá vestidos o accesorios para comenzar la venta.
                    </div>
                  ) : (
                    <div className="sales-items-list">
                      {form.items.map((item, index) => {
                        const isBonus =
                          item.type === "accessory" && Number(item.price) === 0;

                        return (
                          <div className="sales-item-card" key={`${item.item_id}-${index}`}>
                            <div className="sales-item-card-left">
                              <span
                                className={`sale-badge ${
                                  item.type === "dress"
                                    ? "sale-badge-dress"
                                    : "sale-badge-accessory"
                                }`}
                              >
                                {item.type === "dress" ? "Vestido" : "Accesorio"}
                              </span>

                              <div className="sales-item-card-copy">
                                <strong>{item.name}</strong>
                                <span>
                                  {isBonus
                                    ? "Bonificado"
                                    : `${formatMoney(Number(item.price), item.currency)} por unidad`}
                                </span>
                              </div>
                            </div>

                            <div className="sales-item-card-right">
                              <div className="sales-inline-field">
                                <label>Cant.</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItem(index, "quantity", Number(e.target.value))
                                  }
                                />
                              </div>

                              <div className="sales-inline-field">
                                <label>Precio ({item.currency})</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={item.price}
                                  onChange={(e) =>
                                    updateItem(index, "price", Number(e.target.value))
                                  }
                                />
                              </div>

                              <div className="sales-item-subtotal">
                                {isBonus
                                  ? "Bonificado"
                                  : formatMoney(
                                      Number(item.price) * Number(item.quantity),
                                      item.currency
                                    )}
                              </div>

                              <button
                                className="icon-btn danger"
                                onClick={() => removeItem(index)}
                                type="button"
                                title="Eliminar ítem"
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="sales-field sales-notes-field">
                    <label>Notas</label>
                    <textarea
                      placeholder="Observaciones de la venta..."
                      value={form.notes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <aside className="sales-modal-aside">
                <div className="sales-summary-panel">
                  <div className={`sales-summary-head sales-summary-head--${summaryHeadline.mode}`}>
                    <span>{summaryHeadline.label}</span>
                    <strong>{summaryHeadline.value}</strong>
                    <small>{summaryHeadline.hint}</small>
                  </div>

                  <div className="sales-summary-metrics">
                    <div className="sales-summary-metric">
                      <span>Cliente</span>
                      <strong>
                        {getCustomerDisplayName(selectedCustomer) || "Sin seleccionar"}
                      </strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Estado de pago</span>
                      <strong>{getPaymentStatusLabel(summaryTotals.paymentStatus)}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Ítems</span>
                      <strong>{summaryTotals.itemCount}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Unidades</span>
                      <strong>{summaryTotals.units}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Total ítems USD</span>
                      <strong>{formatMoney(summaryTotals.itemsUSD, "USD")}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Total ítems ARS</span>
                      <strong>{formatMoney(summaryTotals.itemsARS, "ARS")}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Total equivalente ARS</span>
                      <strong>
                        {exchangeRateNumber > 0 || summaryTotals.itemsUSD === 0
                          ? formatMoney(summaryTotals.equivalentARS, "ARS")
                          : "Definí TC"}
                      </strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Pagado USD</span>
                      <strong>{formatMoney(summaryTotals.paidUSD, "USD")}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Pagado ARS</span>
                      <strong>{formatMoney(summaryTotals.paidARS, "ARS")}</strong>
                    </div>

                    <div className="sales-summary-metric">
                      <span>Pagado equivalente ARS</span>
                      <strong>
                        {exchangeRateNumber > 0 || summaryTotals.paidUSD === 0
                          ? formatMoney(summaryTotals.paidEquivalentARS, "ARS")
                          : "Definí TC"}
                      </strong>
                    </div>
                  </div>

                  <div className="sales-payment-box">
                    <label>Tipo de cambio USD → ARS</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={exchangeRate}
                      onChange={(e) => setExchangeRate(e.target.value)}
                      placeholder="Ej: 1200"
                    />

                    {requiresExchangeRate && exchangeRateNumber <= 0 && (
                      <div className="sales-payment-hint sales-payment-warning">
                        Ingresá el tipo de cambio solo si querés consolidar una operación mixta.
                      </div>
                    )}

                    {exchangeRateNumber > 0 && summaryTotals.itemsUSD > 0 && (
                      <div className="sales-payment-hint">
                        Equivalente de ítems USD en ARS: <strong>{formatMoney(convertedUsdToArs, "ARS")}</strong>
                      </div>
                    )}

                    <div className="sales-payment-total-line">
                      <span>Total equivalente ARS</span>
                      <strong>{formatMoney(totalEquivalentArs, "ARS")}</strong>
                    </div>
                  </div>

                  <div className="sales-payment-methods-box">
                    <div className="sales-payment-methods-head">
                      <span>Formas de pago</span>
                    </div>

                    <div className="sales-payment-form">
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      >
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="debit">Débito</option>
                        <option value="credit">Crédito</option>
                        <option value="mercadopago">Mercado Pago</option>
                        <option value="other">Otro</option>
                      </select>

                      <select
                        value={paymentDraftCurrency}
                        onChange={(e) => setPaymentDraftCurrency(e.target.value as CurrencyCode)}
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>

                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="Monto"
                      />

                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="Referencia (opcional)"
                      />

                      <button
                        type="button"
                        className="sales-secondary-btn"
                        onClick={addPayment}
                      >
                        Agregar pago
                      </button>
                    </div>

                    {payments.length === 0 ? (
                      <div className="sales-payment-empty">
                        Todavía no hay pagos cargados.
                      </div>
                    ) : (
                      <div className="sales-payment-list">
                        {payments.map((payment, index) => (
                          <div className="sales-payment-item" key={`${payment.method}-${payment.currency}-${index}`}>
                            <div className="sales-payment-item-copy">
                              <strong>{getPaymentMethodLabel(payment.method)}</strong>
                              <span>
                                {formatMoney(payment.amount, payment.currency)}
                                {payment.reference ? ` · ${payment.reference}` : ""}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="icon-btn danger"
                              onClick={() => removePayment(index)}
                              title="Eliminar pago"
                            >
                              🗑
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="sales-payment-detail-box">
                      <div className="sales-payment-methods-head">
                        <span>Detalle fino</span>
                      </div>

                      {summaryTotals.paymentBreakdown.length === 0 ? (
                        <div className="sales-payment-empty">Sin pagos cargados.</div>
                      ) : (
                        <div className="sales-payment-breakdown-list">
                          {summaryTotals.paymentBreakdown.map((row, index) => (
                            <div
                              className="sales-payment-breakdown-item"
                              key={`${row.method}-${row.currency}-${index}`}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "stretch",
                                gap: 4,
                                padding: "12px 14px",
                                borderRadius: 16,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(255,255,255,0.05)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 13,
                                  lineHeight: 1.2,
                                  fontWeight: 700,
                                  opacity: 0.88,
                                  whiteSpace: "normal",
                                  wordBreak: "break-word",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {getPaymentMethodLabel(row.method)}
                              </div>
                              <div
                                style={{
                                  fontSize: 15,
                                  lineHeight: 1.2,
                                  fontWeight: 800,
                                  textAlign: "right",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatMoney(row.amount, row.currency)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="sales-payment-balance">
                      <div>
                        <span>Total pagos ARS</span>
                        <strong>{formatMoney(summaryTotals.paidARS, "ARS")}</strong>
                      </div>

                      <div>
                        <span>Total pagos USD</span>
                        <strong>{formatMoney(summaryTotals.paidUSD, "USD")}</strong>
                      </div>

                      <div>
                        <span>Saldo ARS</span>
                        <strong className={summaryTotals.balanceARS === 0 ? "sales-balance-ok" : "sales-balance-pending"}>
                          {formatMoney(summaryTotals.balanceARS, "ARS")}
                        </strong>
                      </div>

                      <div>
                        <span>Saldo USD</span>
                        <strong className={summaryTotals.balanceUSD === 0 ? "sales-balance-ok" : "sales-balance-pending"}>
                          {formatMoney(summaryTotals.balanceUSD, "USD")}
                        </strong>
                      </div>

                      <div>
                        <span>Diferencia equivalente ARS</span>
                        <strong
                          className={
                            Math.abs(paymentDifferenceEquivalentArs) <= 0.01
                              ? "sales-balance-ok"
                              : "sales-balance-pending"
                          }
                        >
                          {formatMoney(paymentDifferenceEquivalentArs, "ARS")}
                        </strong>
                      </div>
                    </div>
                  </div>
                  <div className="sales-summary-actions">
                    <button
                      className="sales-ghost-btn"
                      onClick={closeSaleModal}
                      type="button"
                    >
                      Cancelar
                    </button>

                    <button
                      className="sales-primary-btn"
                      onClick={handleSubmitSale}
                      disabled={submittingSale}
                      type="button"
                    >
                      {submittingSale ? "Confirmando..." : "Confirmar venta"}
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="modal-overlay" onClick={closeCustomerModal}>
          <div
            className="modal-content sales-customer-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header sales-modal-header-pro">
              <div>
                <div className="sales-kicker">Alta rápida</div>
                <h2>Nuevo cliente</h2>
                <p>Crealo desde la venta y seguí el flujo sin salir del modal.</p>
              </div>

              <button
                className="icon-btn sales-close-btn"
                onClick={closeCustomerModal}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="sales-customer-body">
              <div className="sales-pro-card">
                <div className="sales-customer-grid">
                  <div className="sales-field">
                    <label>Nombre</label>
                    <input
                      type="text"
                      value={customerForm.first_name}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                      placeholder="Nombre"
                    />
                  </div>

                  <div className="sales-field">
                    <label>Apellido</label>
                    <input
                      type="text"
                      value={customerForm.last_name}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({
                          ...prev,
                          last_name: e.target.value,
                        }))
                      }
                      placeholder="Apellido"
                    />
                  </div>

                  <div className="sales-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="cliente@email.com"
                    />
                  </div>

                  <div className="sales-field">
                    <label>Teléfono</label>
                    <input
                      type="text"
                      value={customerForm.phone}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      placeholder="Teléfono"
                    />
                  </div>
                </div>
              </div>

              <div className="sales-customer-actions">
                <button
                  className="sales-ghost-btn"
                  onClick={closeCustomerModal}
                  type="button"
                >
                  Cancelar
                </button>

                <button
                  className="sales-primary-btn"
                  onClick={handleSubmitCustomer}
                  disabled={submittingCustomer}
                  type="button"
                >
                  {submittingCustomer ? "Guardando..." : "Guardar cliente"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

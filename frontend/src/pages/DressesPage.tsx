import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { DressForm } from "../components/forms/DressForm";
import { resolveMediaUrl } from "../lib/media";
import { formatCurrencyAmount, getCurrencySymbol } from "../utils/currency";
import "../styles/pro-pages.css";

type Dress = {
  id: string;
  tenant_id?: string;
  code: string;
  name: string;
  description?: string | null;
  size?: string | null;
  color?: string | null;
  status: string;
  main_image_url?: string | null;
  capsule_id?: string | null;
  capsule_name?: string | null;
  purchase_price?: number | string | null;
  rental_price?: number | string | null;
  rental_currency?: string | null;
  sale_price?: number | string | null;
  sale_currency?: string | null;
};

type Customer = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type PaginatedDressResponse = {
  items: Dress[];
  page: number;
  page_size: number;
  total: number;
};

type PaginatedCustomerResponse = {
  items: Customer[];
  page: number;
  page_size: number;
  total: number;
};

type OperationMode = "loan" | "rental" | null;

const PAGE_SIZE = 20;

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function normalizeCurrency(currency?: string | null) {
  return String(currency || "USD").toUpperCase().trim();
}

function currencyLabel(currency?: string | null) {
  const currencyCode = normalizeCurrency(currency);
  return `${getCurrencySymbol(currencyCode)} ${currencyCode}`;
}

function money(
  value?: number | string | null,
  currency?: string | null,
  locale = "es-AR"
) {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) return "—";

  const currencyCode = normalizeCurrency(currency);

  return formatCurrencyAmount(numericValue, {
    locale,
    currencyCode,
    symbol: getCurrencySymbol(currencyCode),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function generateCustomerCode() {
  return `CLI-${Date.now().toString().slice(-6)}`;
}

export default function DressesPage() {
  const { t, i18n } = useTranslation(["common", "dresses"]);
  const locale = i18n.language?.startsWith("en") ? "en-US" : "es-AR";

  const [rows, setRows] = useState<Dress[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingDress, setEditingDress] = useState<Dress | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [operationMode, setOperationMode] = useState<OperationMode>(null);
  const [selectedDress, setSelectedDress] = useState<Dress | null>(null);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [submittingOperation, setSubmittingOperation] = useState(false);

  const [showCustomerInlineForm, setShowCustomerInlineForm] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const [operationForm, setOperationForm] = useState({
    customer_id: "",
    start_date: todayIso(),
    expected_return_date: "",
    rental_value: "",
    notes: "",
  });

  const [customerForm, setCustomerForm] = useState({
    code: generateCustomerCode(),
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    notes: "",
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadDresses = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedDressResponse>("/dresses", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          status: statusFilter || undefined,
        },
      });

      setRows(Array.isArray(response.data.items) ? response.data.items : []);
      setTotal(Number(response.data.total || 0));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("dresses:edit.loadError"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await api.get<PaginatedCustomerResponse>("/customers", {
        params: {
          page: 1,
          page_size: 100,
        },
      });

      setCustomers(Array.isArray(response.data.items) ? response.data.items : []);
    } catch (err) {
      console.error("Could not load customers", err);
      setCustomers([]);
    }
  };

  useEffect(() => {
    void loadDresses();
  }, [page, search, statusFilter]);

  useEffect(() => {
    void loadCustomers();
  }, []);

  const resetOperationModal = () => {
    setShowOperationModal(false);
    setSelectedDress(null);
    setOperationMode(null);
    setShowCustomerInlineForm(false);
    setOperationForm({
      customer_id: "",
      start_date: todayIso(),
      expected_return_date: "",
      rental_value: "",
      notes: "",
    });
    setCustomerForm({
      code: generateCustomerCode(),
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      notes: "",
    });
  };

  const handleDeleteDress = async (id: string) => {
    const confirmed = window.confirm(t("dresses:delete.confirm"));
    if (!confirmed) return;

    try {
      await api.delete(`/dresses/${id}`);
      await loadDresses();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("dresses:delete.error"));
    }
  };

  const updateDressStatus = async (
    row: Dress,
    status: "AVAILABLE" | "CLEANING" | "MAINTENANCE"
  ) => {
    try {
      setError("");

      await api.put(`/dresses/${row.id}`, {
        code: row.code,
        name: row.name,
        description: row.description ?? "",
        size: row.size ?? "",
        color: row.color ?? "",
        status,
        capsule_id: row.capsule_id ?? null,
        sale_price: row.sale_price ?? 0,
        sale_currency: row.sale_currency || "USD",
        rental_price: row.rental_price ?? 0,
        rental_currency: row.rental_currency || "USD",
      });

      await loadDresses();
    } catch (err: any) {
      console.error("updateDressStatus error =>", err?.response?.data || err);

      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((item: any) => item.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        if (status === "AVAILABLE") {
          setError(t("dresses:errors.available"));
        } else if (status === "CLEANING") {
          setError(t("dresses:errors.cleaning"));
        } else {
          setError(t("dresses:errors.maintenance"));
        }
      }
    }
  };

  const handleSendToCleaning = async (row: Dress) => {
    await updateDressStatus(row, "CLEANING");
  };

  const handleSendToMaintenance = async (row: Dress) => {
    await updateDressStatus(row, "MAINTENANCE");
  };

  const handleBackToAvailable = async (row: Dress) => {
    await updateDressStatus(row, "AVAILABLE");
  };

  const openLoanModal = (row: Dress, mode: "loan" | "rental") => {
    setSelectedDress(row);
    setOperationMode(mode);
    setShowCustomerInlineForm(false);
    setOperationForm({
      customer_id: "",
      start_date: todayIso(),
      expected_return_date: "",
      rental_value: mode === "rental" ? String(row.rental_price ?? "") : "",
      notes: "",
    });
    setCustomerForm({
      code: generateCustomerCode(),
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      notes: "",
    });
    setShowOperationModal(true);
  };

  const handleLoan = (row: Dress) => {
    openLoanModal(row, "loan");
  };

  const handleRent = (row: Dress) => {
    openLoanModal(row, "rental");
  };

  const submitCreateCustomer = async () => {
    const payload = {
      code: customerForm.code?.trim() || generateCustomerCode(),
      first_name: customerForm.first_name?.trim() || "",
      last_name: customerForm.last_name?.trim() || "",
      email: customerForm.email?.trim() || null,
      phone: customerForm.phone?.trim() || null,
      notes: customerForm.notes?.trim() || null,
    };

    if (!payload.code) {
      setError(t("dresses:customer.validation.codeRequired"));
      return;
    }

    if (!payload.first_name) {
      setError(t("dresses:customer.validation.firstNameRequired"));
      return;
    }

    if (!payload.last_name) {
      setError(t("dresses:customer.validation.lastNameRequired"));
      return;
    }

    try {
      setCreatingCustomer(true);
      setError("");

      const response = await api.post("/customers", payload);
      const createdId = response.data?.id;

      await loadCustomers();

      if (createdId) {
        setOperationForm((prev) => ({
          ...prev,
          customer_id: createdId,
        }));
      }

      setCustomerForm({
        code: generateCustomerCode(),
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        notes: "",
      });

      setShowCustomerInlineForm(false);
    } catch (err: any) {
      console.error("POST /customers error =>", err?.response?.data || err);

      const detail = err?.response?.data?.detail;

      if (Array.isArray(detail)) {
        const message = detail
          .map((item: any) => {
            const field = Array.isArray(item.loc) ? item.loc.join(".") : "";
            return `${field}: ${item.msg}`;
          })
          .join(" | ");
        setError(message);
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError(t("dresses:customer.messages.createError"));
      }
    } finally {
      setCreatingCustomer(false);
    }
  };

  const submitLoanLikeOperation = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedDress || !operationMode) return;

    if (!operationForm.customer_id) {
      setError(t("dresses:operations.validation.customerRequired"));
      return;
    }

    if (!operationForm.start_date) {
      setError(t("dresses:operations.validation.startDateRequired"));
      return;
    }

    try {
      setSubmittingOperation(true);
      setError("");

      await api.post("/loans", {
        dress_id: selectedDress.id,
        customer_id: operationForm.customer_id,
        start_date: operationForm.start_date,
        expected_return_date: operationForm.expected_return_date || null,
        notes: operationForm.notes || null,
        loan_type: operationMode === "rental" ? "RENTAL" : "LOAN",
        amount:
          operationMode === "rental" && operationForm.rental_value.trim()
            ? Number(operationForm.rental_value)
            : null,
      });

      resetOperationModal();
      await loadDresses();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else {
        setError(
          operationMode === "rental"
            ? t("dresses:operations.messages.rentalError")
            : t("dresses:operations.messages.loanError")
        );
      }
    } finally {
      setSubmittingOperation(false);
    }
  };

  const operationTitle = useMemo(() => {
    if (operationMode === "loan") return t("dresses:operations.loanTitle");
    if (operationMode === "rental") return t("dresses:operations.rentalTitle");
    return "";
  }, [operationMode, t]);

  const operationSubtitle = useMemo(() => {
    if (!selectedDress) return "";
    return `${selectedDress.code} · ${selectedDress.name}`;
  }, [selectedDress]);

  const columns = useMemo<DataGridColumn<Dress>[]>(() => {
    return [
      {
        key: "image",
        label: "",
        render: (row) => {
          const photo = resolveMediaUrl(row.main_image_url);
          return photo ? (
            <div
              style={{
                width: 44,
                height: 58,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid var(--df-border, #e5e7eb)",
                background: "#fff",
              }}
            >
              <img
                src={photo}
                alt={row.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          ) : (
            <span style={{ color: "#6b7280", fontSize: 12 }}>—</span>
          );
        },
      },
      {
        key: "code",
        label: t("dresses:fields.code"),
        render: (row) => <strong>{row.code}</strong>,
      },
      {
        key: "name",
        label: t("dresses:fields.name"),
        render: (row) => row.name,
      },
      {
        key: "capsule_name",
        label: t("dresses:fields.capsule"),
        render: (row) => row.capsule_name || "—",
      },
      {
        key: "size",
        label: t("dresses:fields.size"),
        render: (row) => row.size || "-",
      },
      {
        key: "color",
        label: t("dresses:fields.color"),
        render: (row) => row.color || "-",
      },
      {
        key: "sale_price",
        label: t("dresses:fields.purchasePrice"),
        render: (row) => money(row.sale_price, row.sale_currency, locale),
      },
      {
        key: "rental_price",
        label: t("dresses:fields.rentalPrice"),
        render: (row) => money(row.rental_price, row.rental_currency, locale),
      },
      {
        key: "sale_currency",
        label: t("dresses:fields.saleCurrency", {
          defaultValue: t("dresses:fields.currency", { defaultValue: "Currency" }),
        }),
        render: (row) => currencyLabel(row.sale_currency),
      },
      {
        key: "status",
        label: t("dresses:fields.status"),
        render: (row) => (
          <span className={`df-status-badge df-status-badge--${row.status.toLowerCase()}`}>
            {t(`dresses:status.${row.status}`)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "",
        render: (row) => {
          const normalizedStatus = String(row.status || "").toUpperCase();
          const isAvailable = normalizedStatus === "AVAILABLE";
          const isInCare = ["CLEANING", "MAINTENANCE"].includes(normalizedStatus);

          return (
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {isAvailable && (
                <>
                  <button
                    type="button"
                    title={t("dresses:actions.loan")}
                    aria-label={t("dresses:actions.loan")}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoan(row);
                    }}
                    className="df-action-btn df-action-btn--loan"
                  >
                    📦
                  </button>

                  <button
                    type="button"
                    title={t("dresses:actions.rent")}
                    aria-label={t("dresses:actions.rent")}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRent(row);
                    }}
                    className="df-action-btn df-action-btn--rent"
                  >
                    👗
                  </button>

                  <button
                    type="button"
                    title={t("dresses:actions.cleaning")}
                    aria-label={t("dresses:actions.cleaning")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSendToCleaning(row);
                    }}
                    className="df-action-btn df-action-btn--cleaning"
                  >
                    🧼
                  </button>

                  <button
                    type="button"
                    title={t("dresses:actions.maintenance")}
                    aria-label={t("dresses:actions.maintenance")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSendToMaintenance(row);
                    }}
                    className="df-action-btn df-action-btn--maintenance"
                  >
                    ✂️
                  </button>
                </>
              )}

              {isInCare && (
                <button
                  type="button"
                  title={t("dresses:actions.available")}
                  aria-label={t("dresses:actions.available")}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleBackToAvailable(row);
                  }}
                  className="df-action-btn df-action-btn--available"
                >
                  ↺
                </button>
              )}

              <button
                type="button"
                title={t("common:actions.delete")}
                aria-label={t("common:actions.delete")}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDeleteDress(row.id);
                }}
                className="df-action-btn df-action-btn--delete"
              >
                <TrashIcon />
              </button>
            </div>
          );
        },
      },
    ];
  }, [t, locale]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          border: 1px solid #e5e7eb;
          background: #fff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.18s ease;
        }

        .df-action-btn:hover {
          background: #f9fafb;
          transform: translateY(-1px);
        }

        .df-action-btn--loan {
          color: #7a5af8;
          border-color: #d9d6fe;
        }

        .df-action-btn--rent {
          color: #b54708;
          border-color: #fcd5a0;
        }

        .df-action-btn--cleaning {
          color: #0f766e;
          border-color: #99f6e4;
        }

        .df-action-btn--maintenance {
          color: #b45309;
          border-color: #fcd34d;
        }

        .df-action-btn--delete {
          color: #b42318;
          border-color: #f1c0c0;
        }

        .df-inline-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .df-inline-form-field {
          display: grid;
          gap: 6px;
        }

        .df-inline-form-field label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-inline-form-field input,
        .df-inline-form-field select,
        .df-inline-form-field textarea {
          width: 100%;
          border: 1px solid #e7dfd6;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff;
          color: #3d3648;
          outline: none;
        }

        .df-inline-form-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .df-inline-form-field--full {
          grid-column: 1 / -1;
        }

        .df-operation-box {
          display: grid;
          gap: 6px;
          padding: 14px 16px;
          border-radius: 16px;
          background: #faf7f3;
          border: 1px solid #ece2d9;
          margin-bottom: 14px;
        }

        .df-operation-box__eyebrow {
          font-size: 11px;
          text-transform: uppercase;
          color: #8a7f73;
          letter-spacing: 0.12em;
          font-weight: 700;
        }

        .df-operation-box__title {
          font-size: 18px;
          font-weight: 800;
          color: #312b3b;
        }

        .df-operation-box__meta {
          font-size: 13px;
          color: #6c6676;
        }

        .df-inline-customer-card {
          display: grid;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          border: 1px dashed #d9cfc2;
          background: #fcfaf8;
        }

        .df-link-btn {
          appearance: none;
          border: none;
          background: transparent;
          color: #7a5af8;
          font-weight: 700;
          cursor: pointer;
          padding: 0;
        }
        
        .df-action-btn--available {
          color: #027a48;
          border-color: #a6f4c5;
        }

        .df-status-badge--cleaning {
          background: #e6fffa;
          color: #0f766e;
        }

        .df-status-badge--maintenance {
          background: #fff4e5;
          color: #b45309;
        }

        .df-status-badge--available {
          background: #e8f5e9;
          color: #256f3a;
        }

        @media (max-width: 720px) {
          .df-inline-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

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
          <p className="df-pro-page__eyebrow">{t("dresses:sections.inventory")}</p>
          <h1 className="df-pro-page__title">{t("dresses:title")}</h1>
          <p className="df-pro-page__subtitle">{t("dresses:hero.catalogSubtitle")}</p>
        </div>

        <PrimaryButton
          onClick={() => {
            setEditingDress(null);
            setShowModal(true);
          }}
          style={{ flexShrink: 0 }}
        >
          {t("dresses:actions.new")}
        </PrimaryButton>
      </header>

      <section className="df-pro-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="df-pro-filter-grid df-pro-filter-grid--4"
        >
          <div>
            <label className="df-pro-label">{t("dresses:filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("dresses:filters.searchPlaceholder")}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("dresses:filters.status")}</label>
            <select
              className="df-pro-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">{t("dresses:filters.allStatuses")}</option>
              <option value="AVAILABLE">{t("dresses:status.AVAILABLE")}</option>
              <option value="LOANED">{t("dresses:status.LOANED")}</option>
              <option value="RENTED">{t("dresses:status.RENTED")}</option>
              <option value="CLEANING">{t("dresses:status.CLEANING")}</option>
              <option value="MAINTENANCE">{t("dresses:status.MAINTENANCE")}</option>
              <option value="SOLD">{t("dresses:status.SOLD")}</option>
              <option value="RETIRED">{t("dresses:status.RETIRED")}</option>
            </select>
          </div>

          <button type="submit">{t("common:actions.search")}</button>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setStatusFilter("");
              setPage(1);
            }}
          >
            {t("common:actions.clear")}
          </button>
        </form>
      </section>

      {error && (
        <section className="df-pro-card">
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              background: "#fdecec",
              color: "#9a2f2f",
            }}
          >
            {error}
          </div>
        </section>
      )}

      <section className="df-pro-card">
        {loading ? (
          <p>{t("dresses:states.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("dresses:states.empty")}</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={(row) => {
              setEditingDress(row);
              setShowModal(true);
            }}
          />
        )}
      </section>

      <footer className="df-pro-pagination">
        <div>
          {t("common:pagination.showing")} {rows.length} / {total}
        </div>
        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            {t("common:pagination.previous")}
          </button>
          <span>
            {t("common:pagination.page")} {page} {t("common:pagination.of")} {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= totalPages}
          >
            {t("common:pagination.next")}
          </button>
        </div>
      </footer>

      <Modal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDress(null);
        }}
        title={editingDress ? t("dresses:edit.title") : t("dresses:actions.new")}
        width="min(1100px, 100%)"
      >
        <DressForm
          key={`${editingDress?.id || "new"}-${showModal ? "open" : "closed"}-${selectedDress?.tenant_id || "tenant"}`}
          mode={editingDress ? "edit" : "create"}
          initialData={
            editingDress
              ? {
                  id: editingDress.id,
                  code: editingDress.code,
                  name: editingDress.name,
                  description: editingDress.description ?? "",
                  size: editingDress.size ?? "",
                  color: editingDress.color ?? "",
                  status: editingDress.status,
                  main_image_url: editingDress.main_image_url ?? null,
                  capsule_id: editingDress.capsule_id ?? "",
                  sale_price:
                    editingDress.sale_price !== undefined && editingDress.sale_price !== null
                      ? String(editingDress.sale_price)
                      : "",
                  sale_currency: editingDress.sale_currency || "USD",
                  rental_price:
                    editingDress.rental_price !== undefined && editingDress.rental_price !== null
                      ? String(editingDress.rental_price)
                      : "",
                  rental_currency: editingDress.rental_currency || "USD",
                }
              : undefined
          }
          onCreated={async () => {
            setShowModal(false);
            setEditingDress(null);
            await loadDresses();
          }}
          onUpdated={async () => {
            setShowModal(false);
            setEditingDress(null);
            await loadDresses();
          }}
          onCancel={() => {
            setShowModal(false);
            setEditingDress(null);
          }}
        />
      </Modal>

      <Modal open={showOperationModal} onClose={resetOperationModal} title={operationTitle} width="min(760px, 100%)">
        <form onSubmit={submitLoanLikeOperation} style={{ display: "grid", gap: 14 }}>
          <div className="df-operation-box">
            <span className="df-operation-box__eyebrow">
              {operationMode === "rental" ? t("dresses:operations.rental") : t("dresses:operations.loan")}
            </span>
            <div className="df-operation-box__title">{selectedDress?.name || "—"}</div>
            <div className="df-operation-box__meta">
              {operationSubtitle}
              {operationMode === "rental" && selectedDress?.rental_price
                ? ` · ${t("dresses:operations.suggestedValue")}: ${money(
                    selectedDress.rental_price,
                    selectedDress.rental_currency,
                    locale
                  )}`
                : ""}
            </div>
          </div>

          <div className="df-inline-form-grid">
            <div className="df-inline-form-field">
              <label>{t("dresses:operations.customer")}</label>
              <select
                value={operationForm.customer_id}
                onChange={(e) =>
                  setOperationForm((prev) => ({ ...prev, customer_id: e.target.value }))
                }
                required
              >
                <option value="">{t("dresses:operations.selectCustomer")}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} · {customer.first_name} {customer.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-inline-form-field" style={{ alignContent: "end" }}>
              <label>&nbsp;</label>
              <button
                type="button"
                className="df-link-btn"
                onClick={() => {
                  setShowCustomerInlineForm((prev) => !prev);
                  if (!showCustomerInlineForm) {
                    setCustomerForm({
                      code: generateCustomerCode(),
                      first_name: "",
                      last_name: "",
                      email: "",
                      phone: "",
                      notes: "",
                    });
                  }
                }}
              >
                {showCustomerInlineForm ? t("dresses:customer.hideInlineCreate") : t("dresses:customer.newCustomer")}
              </button>
            </div>

            <div className="df-inline-form-field">
              <label>{t("dresses:operations.startDate")}</label>
              <input
                type="date"
                value={operationForm.start_date}
                onChange={(e) => setOperationForm((prev) => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>

            <div className="df-inline-form-field">
              <label>{t("dresses:operations.returnDate")}</label>
              <input
                type="date"
                value={operationForm.expected_return_date}
                onChange={(e) =>
                  setOperationForm((prev) => ({
                    ...prev,
                    expected_return_date: e.target.value,
                  }))
                }
              />
            </div>

            {operationMode === "rental" && (
              <div className="df-inline-form-field">
                <label>{t("dresses:operations.rentalValue")}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={operationForm.rental_value}
                  onChange={(e) =>
                    setOperationForm((prev) => ({
                      ...prev,
                      rental_value: e.target.value,
                    }))
                  }
                  placeholder={t("dresses:operations.rentalValuePlaceholder")}
                />
              </div>
            )}

            <div className="df-inline-form-field df-inline-form-field--full">
              <label>{t("dresses:operations.notes")}</label>
              <textarea
                value={operationForm.notes}
                onChange={(e) => setOperationForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={
                  operationMode === "rental"
                    ? t("dresses:operations.rentalNotesPlaceholder")
                    : t("dresses:operations.loanNotesPlaceholder")
                }
              />
            </div>

            {showCustomerInlineForm && (
              <div className="df-inline-form-field df-inline-form-field--full">
                <div className="df-inline-customer-card">
                  <div className="df-inline-form-grid">
                    <div className="df-inline-form-field">
                      <label>{t("dresses:customer.fields.code")}</label>
                      <input
                        value={customerForm.code}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            code: e.target.value,
                          }))
                        }
                        placeholder={t("dresses:customer.placeholders.code")}
                      />
                    </div>

                    <div className="df-inline-form-field">
                      <label>{t("dresses:customer.fields.firstName")}</label>
                      <input
                        value={customerForm.first_name}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            first_name: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="df-inline-form-field">
                      <label>{t("dresses:customer.fields.lastName")}</label>
                      <input
                        value={customerForm.last_name}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            last_name: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="df-inline-form-field">
                      <label>{t("dresses:customer.fields.email")}</label>
                      <input
                        type="email"
                        value={customerForm.email}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="df-inline-form-field">
                      <label>{t("dresses:customer.fields.phone")}</label>
                      <input
                        value={customerForm.phone}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="df-inline-form-field df-inline-form-field--full">
                      <label>{t("dresses:operations.notes")}</label>
                      <textarea
                        value={customerForm.notes}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        placeholder={t("dresses:customer.placeholders.notes")}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button type="button" onClick={() => setShowCustomerInlineForm(false)}>
                      {t("common:actions.cancel")}
                    </button>

                    <PrimaryButton type="button" onClick={submitCreateCustomer} disabled={creatingCustomer}>
                      {creatingCustomer ? t("dresses:customer.actions.creating") : t("dresses:customer.actions.create")}
                    </PrimaryButton>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={resetOperationModal}>
              {t("common:actions.cancel")}
            </button>
            <PrimaryButton type="submit" disabled={submittingOperation}>
              {submittingOperation
                ? operationMode === "rental"
                  ? t("dresses:operations.registeringRental")
                  : t("dresses:operations.registeringLoan")
                : operationMode === "rental"
                  ? t("dresses:operations.confirmRental")
                  : t("dresses:operations.confirmLoan")}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}

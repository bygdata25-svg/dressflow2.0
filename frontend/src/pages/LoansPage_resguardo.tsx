import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import "../styles/pro-pages.css";

type Dress = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
};

type Loan = {
  id: string;
  dress_id: string;
  customer_id: string;
  start_date: string;
  expected_return_date?: string | null;
  actual_return_date?: string | null;
  status: string;
  loan_type?: string | null;
  amount?: number | null;
  dress_code?: string | null;
  dress_name?: string | null;
  customer_full_name?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

const PAGE_SIZE = 20;

function money(value?: number | null) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n) || value == null) return "—";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function LoansPage() {
  const { t } = useTranslation(["common", "loans"]);
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<Loan[]>([]);
  const [error, setError] = useState("");

  const [dressId, setDressId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [loanType, setLoanType] = useState<"LOAN" | "RENTAL">("LOAN");
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loanTypeFilter, setLoanTypeFilter] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadReferenceData = async () => {
    const [dressesResponse, customersResponse] = await Promise.all([
      api.get<PaginatedResponse<Dress>>("/dresses", {
        params: { page: 1, page_size: 100 },
      }),
      api.get<PaginatedResponse<Customer>>("/customers", {
        params: { page: 1, page_size: 100 },
      }),
    ]);

    setDresses(dressesResponse.data.items);
    setCustomers(customersResponse.data.items);
  };

  const loadLoans = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedResponse<Loan>>("/loans", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
          status: statusFilter || undefined,
          loan_type: loanTypeFilter || undefined,
        },
      });

      setRows(response.data.items);
      setTotal(response.data.total);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("loans:messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    await Promise.all([loadReferenceData(), loadLoans()]);
  };

  useEffect(() => {
    void loadReferenceData();
  }, []);

  useEffect(() => {
    void loadLoans();
  }, [page, search, statusFilter, loanTypeFilter]);

  const createLoan = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setCreating(true);
      setError("");

      await api.post("/loans", {
        dress_id: dressId,
        customer_id: customerId,
        start_date: startDate,
        expected_return_date: expectedReturnDate || null,
        loan_type: loanType,
        amount: loanType === "RENTAL" && amount ? Number(amount) : null,
      });

      setDressId("");
      setCustomerId("");
      setStartDate("");
      setExpectedReturnDate("");
      setLoanType("LOAN");
      setAmount("");
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("loans:messages.createError"));
    } finally {
      setCreating(false);
    }
  };

  const returnLoan = async (loanId: string) => {
    try {
      setError("");
      await api.post(`/loans/${loanId}/return`);
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("loans:messages.returnError"));
    }
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatusFilter("");
    setLoanTypeFilter("");
    setPage(1);
  };

  const columns = useMemo<DataGridColumn<Loan>[]>(() => {
    return [
      {
        key: "loan_type",
        label: "Tipo",
        render: (row) => {
          const type = row.loan_type === "RENTAL" ? "rental" : "loan";
          return (
            <span className={`df-status-badge df-status-badge--${type}`}>
              {row.loan_type === "RENTAL" ? "Alquiler" : "Préstamo"}
            </span>
          );
        },
      },
      {
        key: "dress",
        label: t("loans:fields.dress"),
        render: (row) => (row.dress_code ? `${row.dress_code} - ${row.dress_name}` : "-"),
      },
      {
        key: "customer",
        label: t("loans:fields.customer"),
        render: (row) => row.customer_full_name || "-",
      },
      {
        key: "start_date",
        label: t("loans:fields.startDate"),
        render: (row) => row.start_date,
      },
      {
        key: "expected_return_date",
        label: t("loans:fields.expectedReturnDate"),
        render: (row) => row.expected_return_date || "-",
      },
      {
        key: "actual_return_date",
        label: t("loans:fields.actualReturnDate"),
        render: (row) => row.actual_return_date || "-",
      },
      {
        key: "amount",
        label: "Valor",
        render: (row) => (row.loan_type === "RENTAL" ? money(row.amount) : "—"),
      },
      {
        key: "status",
        label: t("loans:fields.status"),
        render: (row) => (
          <span className={`df-status-badge df-status-badge--${row.status.toLowerCase()}`}>
            {t(`loans:status.${row.status}`)}
          </span>
        ),
      },
      {
        key: "actions",
        label: t("common:actions.actions"),
        render: (row) =>
          row.status === "ACTIVE" ? (
            <button type="button" onClick={() => returnLoan(row.id)}>
              {t("loans:actions.return")}
            </button>
          ) : (
            "-"
          ),
      },
    ];
  }, [t]);

  return (
    <section className="df-pro-page">
      <style>{`
        .df-status-badge--loan {
          background: #f5f3ff;
          color: #7a5af8;
          border: 1px solid #d9d6fe;
        }

        .df-status-badge--rental {
          background: #fff7ed;
          color: #b54708;
          border: 1px solid #fed7aa;
        }
      `}</style>

      <header className="df-pro-page__hero">
        <div>
          <p className="df-pro-page__eyebrow">{t("loans:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">Préstamos / Alquileres</h1>
          <p className="df-pro-page__subtitle">{t("loans:hero.subtitle")}</p>
        </div>
      </header>

      <section className="df-pro-card">
        <form onSubmit={createLoan} className="df-pro-form-grid df-pro-form-grid--5">
          <div>
            <label className="df-pro-label">Tipo</label>
            <select
              className="df-pro-select"
              value={loanType}
              onChange={(e) => setLoanType(e.target.value as "LOAN" | "RENTAL")}
            >
              <option value="LOAN">Préstamo</option>
              <option value="RENTAL">Alquiler</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("loans:form.dress")}</label>
            <select className="df-pro-select" value={dressId} onChange={(e) => setDressId(e.target.value)}>
              <option value="">{t("loans:form.dressPlaceholder")}</option>
              {dresses
                .filter((dress) => dress.status === "AVAILABLE")
                .map((dress) => (
                  <option key={dress.id} value={dress.id}>
                    {dress.code} - {dress.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("loans:form.customer")}</label>
            <select className="df-pro-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{t("loans:form.customerPlaceholder")}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.first_name} {customer.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-pro-label">{t("loans:form.startDate")}</label>
            <input className="df-pro-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div>
            <label className="df-pro-label">{t("loans:form.expectedReturnDate")}</label>
            <input
              className="df-pro-input"
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </div>

          {loanType === "RENTAL" && (
            <div>
              <label className="df-pro-label">Valor del alquiler</label>
              <input
                className="df-pro-input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej: 150.00"
              />
            </div>
          )}

          <button type="submit" disabled={creating}>
            {creating ? t("common:status.saving") : loanType === "RENTAL" ? "Crear alquiler" : t("loans:form.create")}
          </button>
        </form>
      </section>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--4">
          <div>
            <label className="df-pro-label">{t("loans:filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("loans:filters.searchPlaceholder")}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("loans:filters.status")}</label>
            <select
              className="df-pro-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">{t("loans:filters.allStatuses")}</option>
              <option value="ACTIVE">{t("loans:status.ACTIVE")}</option>
              <option value="RETURNED">{t("loans:status.RETURNED")}</option>
              <option value="LATE">{t("loans:status.LATE")}</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">Tipo</label>
            <select
              className="df-pro-select"
              value={loanTypeFilter}
              onChange={(e) => {
                setPage(1);
                setLoanTypeFilter(e.target.value);
              }}
            >
              <option value="">Todos</option>
              <option value="LOAN">Préstamos</option>
              <option value="RENTAL">Alquileres</option>
            </select>
          </div>

          <button type="submit">{t("common:actions.search")}</button>
          <button type="button" onClick={handleClearFilters}>
            {t("common:actions.clear")}
          </button>
        </form>
      </section>

      {loading && <p>{t("common:status.loading")}</p>}
      {error && <p>{error}</p>}
      {!loading && !error && rows.length === 0 && <p>{t("loans:empty")}</p>}

      {!loading && !error && rows.length > 0 && (
        <section className="df-pro-card">
          <DataGrid rows={rows} columns={columns} getRowKey={(row) => row.id} />
        </section>
      )}

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
          <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={page >= totalPages}>
            {t("common:pagination.next")}
          </button>
        </div>
      </footer>
    </section>
  );
}

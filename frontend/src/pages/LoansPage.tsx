import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import "../styles/pro-pages.css";

type Dress = {
  id: string;
  code: string;
  name: string;
  status: string;
};

type Customer = {
  id: string;
  code?: string;
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function LoansPage() {
  const { t } = useTranslation(["common", "loans"]);

  const [dresses, setDresses] = useState<Dress[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<Loan[]>([]);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loanTypeFilter, setLoanTypeFilter] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [loanType, setLoanType] = useState<"LOAN" | "RENTAL">("LOAN");
  const [dressId, setDressId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetCreateForm = () => {
    setLoanType("LOAN");
    setDressId("");
    setCustomerId("");
    setStartDate(todayIso());
    setExpectedReturnDate("");
    setAmount("");
    setNotes("");
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetCreateForm();
  };

  const loadReferenceData = async () => {
    const [dressesResponse, customersResponse] = await Promise.all([
      api.get<PaginatedResponse<Dress>>("/dresses", {
        params: { page: 1, page_size: 100 },
      }),
      api.get<PaginatedResponse<Customer>>("/customers", {
        params: { page: 1, page_size: 100 },
      }),
    ]);

    setDresses(Array.isArray(dressesResponse.data.items) ? dressesResponse.data.items : []);
    setCustomers(Array.isArray(customersResponse.data.items) ? customersResponse.data.items : []);
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

      setRows(Array.isArray(response.data.items) ? response.data.items : []);
      setTotal(Number(response.data.total || 0));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("loans:messages.loadError", "No se pudieron cargar los préstamos."));
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

    if (!dressId) {
      setError("Seleccioná un vestido.");
      return;
    }

    if (!customerId) {
      setError("Seleccioná un cliente.");
      return;
    }

    if (!startDate) {
      setError("Ingresá la fecha de inicio.");
      return;
    }

    if (loanType === "RENTAL" && (!amount || Number(amount) <= 0)) {
      setError("Ingresá un valor de alquiler mayor a cero.");
      return;
    }

    try {
      setCreating(true);
      setError("");

      await api.post("/loans", {
        dress_id: dressId,
        customer_id: customerId,
        start_date: startDate,
        expected_return_date: expectedReturnDate || null,
        notes: notes.trim() || null,
        loan_type: loanType,
        amount: loanType === "RENTAL" ? Number(amount) : null,
      });

      closeCreateModal();
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((item: any) => item.msg).join(" | "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else if (detail?.message) {
        setError(detail.message);
      } else {
        setError(
          loanType === "RENTAL"
            ? "No se pudo crear el alquiler."
            : t("loans:messages.createError", "No se pudo crear el préstamo.")
        );
      }
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
      else setError(t("loans:messages.returnError", "No se pudo registrar la devolución."));
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

  const availableDresses = useMemo(
    () => dresses.filter((dress) => dress.status === "AVAILABLE"),
    [dresses]
  );

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
        label: t("loans:fields.dress", "Vestido"),
        render: (row) => (row.dress_code ? `${row.dress_code} - ${row.dress_name}` : "—"),
      },
      {
        key: "customer",
        label: t("loans:fields.customer", "Cliente"),
        render: (row) => row.customer_full_name || "—",
      },
      {
        key: "start_date",
        label: t("loans:fields.startDate", "Fecha inicio"),
        render: (row) => row.start_date,
      },
      {
        key: "expected_return_date",
        label: t("loans:fields.expectedReturnDate", "Fecha esperada devolución"),
        render: (row) => row.expected_return_date || "—",
      },
      {
        key: "actual_return_date",
        label: t("loans:fields.actualReturnDate", "Fecha devolución"),
        render: (row) => row.actual_return_date || "—",
      },
      {
        key: "amount",
        label: "Valor",
        render: (row) => (row.loan_type === "RENTAL" ? money(row.amount) : "—"),
      },
      {
        key: "status",
        label: t("loans:fields.status", "Estado"),
        render: (row) => (
          <span className={`df-status-badge df-status-badge--${row.status.toLowerCase()}`}>
            {t(`loans:status.${row.status}`, row.status)}
          </span>
        ),
      },
      {
        key: "actions",
        label: t("common:actions.actions", "Acciones"),
        render: (row) =>
          row.status === "ACTIVE" ? (
            <button type="button" onClick={() => returnLoan(row.id)}>
              {t("loans:actions.return", "Devolver")}
            </button>
          ) : (
            "—"
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

        .df-loans-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .df-loans-modal-field {
          display: grid;
          gap: 6px;
        }

        .df-loans-modal-field--full {
          grid-column: 1 / -1;
        }

        .df-loans-modal-field label {
          font-size: 12px;
          font-weight: 700;
          color: #6b6472;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .df-loans-modal-field input,
        .df-loans-modal-field select,
        .df-loans-modal-field textarea {
          width: 100%;
          border: 1px solid #e7dfd6;
          border-radius: 14px;
          padding: 12px 14px;
          background: #fff;
          color: #3d3648;
          outline: none;
        }

        .df-loans-modal-field textarea {
          min-height: 100px;
          resize: vertical;
        }

        .df-loans-modal-note {
          padding: 14px 16px;
          border-radius: 16px;
          background: #faf7f3;
          border: 1px solid #ece2d9;
          color: #51495d;
          line-height: 1.5;
        }

        @media (max-width: 720px) {
          .df-loans-modal-grid {
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
          <p className="df-pro-page__eyebrow">{t("loans:hero.eyebrow", "Operaciones")}</p>
          <h1 className="df-pro-page__title">Préstamos / Alquileres</h1>
          <p className="df-pro-page__subtitle">
            {t(
              "loans:hero.subtitle",
              "Gestioná préstamos activos, devoluciones y operaciones con clientes con un flujo editorial y limpio."
            )}
          </p>
        </div>

        <PrimaryButton
          type="button"
          onClick={() => {
            setError("");
            setShowCreateModal(true);
          }}
        >
          Nuevo préstamo / alquiler
        </PrimaryButton>
      </header>

      <section className="df-pro-card">
        <form onSubmit={handleSearchSubmit} className="df-pro-filter-grid df-pro-filter-grid--4">
          <div>
            <label className="df-pro-label">{t("loans:filters.search", "Buscar")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("loans:filters.searchPlaceholder", "Buscar por vestido o cliente")}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("loans:filters.status", "Estado")}</label>
            <select
              className="df-pro-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">{t("loans:filters.allStatuses", "Todos los estados")}</option>
              <option value="ACTIVE">{t("loans:status.ACTIVE", "Activo")}</option>
              <option value="RETURNED">{t("loans:status.RETURNED", "Devuelto")}</option>
              <option value="LATE">{t("loans:status.LATE", "Vencido")}</option>
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

          <button type="submit">{t("common:actions.search", "Buscar")}</button>
          <button type="button" onClick={handleClearFilters}>
            {t("common:actions.clear", "Limpiar")}
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

      {loading ? (
        <section className="df-pro-card">
          <p>{t("common:status.loading", "Cargando...")}</p>
        </section>
      ) : rows.length === 0 ? (
        <section className="df-pro-card">
          <p>{t("loans:empty", "No hay registros para mostrar.")}</p>
        </section>
      ) : (
        <section className="df-pro-card">
          <DataGrid rows={rows} columns={columns} getRowKey={(row) => row.id} />
        </section>
      )}

      <footer className="df-pro-pagination">
        <div>
          {t("common:pagination.showing", "Mostrando")} {rows.length} / {total}
        </div>

        <div className="df-pro-actions-row">
          <button type="button" onClick={() => setPage((prev) => prev - 1)} disabled={page <= 1}>
            {t("common:pagination.previous", "Anterior")}
          </button>
          <span>
            {t("common:pagination.page", "Página")} {page} {t("common:pagination.of", "de")}{" "}
            {totalPages}
          </span>
          <button type="button" onClick={() => setPage((prev) => prev + 1)} disabled={page >= totalPages}>
            {t("common:pagination.next", "Siguiente")}
          </button>
        </div>
      </footer>

      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title={loanType === "RENTAL" ? "Nuevo alquiler" : "Nuevo préstamo"}
        width="min(820px, 100%)"
      >
        <form onSubmit={createLoan} style={{ display: "grid", gap: 16 }}>
          <div className="df-loans-modal-note">
            Registrá una salida de vestido como <strong>préstamo</strong> o <strong>alquiler</strong> desde el mismo flujo.
          </div>

          <div className="df-loans-modal-grid">
            <div className="df-loans-modal-field">
              <label>Tipo</label>
              <select value={loanType} onChange={(e) => setLoanType(e.target.value as "LOAN" | "RENTAL")}>
                <option value="LOAN">Préstamo</option>
                <option value="RENTAL">Alquiler</option>
              </select>
            </div>

            <div className="df-loans-modal-field">
              <label>{t("loans:form.dress", "Vestido")}</label>
              <select value={dressId} onChange={(e) => setDressId(e.target.value)}>
                <option value="">{t("loans:form.dressPlaceholder", "Seleccionar vestido")}</option>
                {availableDresses.map((dress) => (
                  <option key={dress.id} value={dress.id}>
                    {dress.code} - {dress.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-loans-modal-field">
              <label>{t("loans:form.customer", "Cliente")}</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t("loans:form.customerPlaceholder", "Seleccionar cliente")}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code ? `${customer.code} · ` : ""}
                    {customer.first_name} {customer.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="df-loans-modal-field">
              <label>{t("loans:form.startDate", "Fecha de inicio")}</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="df-loans-modal-field">
              <label>{t("loans:form.expectedReturnDate", "Fecha esperada de devolución")}</label>
              <input
                type="date"
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
              />
            </div>

            {loanType === "RENTAL" && (
              <div className="df-loans-modal-field">
                <label>Valor del alquiler</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 150.00"
                />
              </div>
            )}

            <div className="df-loans-modal-field df-loans-modal-field--full">
              <label>Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones internas de la operación"
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={closeCreateModal}>
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={creating}>
              {creating
                ? t("common:status.saving", "Guardando...")
                : loanType === "RENTAL"
                ? "Crear alquiler"
                : "Crear préstamo"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </section>
  );
}

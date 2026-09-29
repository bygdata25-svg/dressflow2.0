import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { PrimaryButton } from "../components/common/buttons";
import { SupplierForm } from "../components/forms/SupplierForm";
import type { Supplier } from "../types/supplier";
import "../styles/pro-pages.css";

type PaginatedSupplierResponse = {
  items: Supplier[];
  page: number;
  page_size: number;
  total: number;
};

type SupplierContact = {
  id: string;
  tenant_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  email?: string | null;
  role?: string | null;
  is_supplier_manager: boolean;
  is_active: boolean;
  notes?: string | null;
};

type PaginatedSupplierContactResponse = {
  items: SupplierContact[];
  page: number;
  page_size: number;
  total: number;
};

type SupplierContactForm = {
  first_name: string;
  last_name: string;
  phone: string;
  whatsapp_phone: string;
  email: string;
  role: string;
  is_supplier_manager: boolean;
  is_active: boolean;
  notes: string;
};

const emptySupplierContactForm = (): SupplierContactForm => ({
  first_name: "",
  last_name: "",
  phone: "",
  whatsapp_phone: "",
  email: "",
  role: "",
  is_supplier_manager: false,
  is_active: true,
  notes: "",
});

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

export default function SuppliersPage() {
  const { t } = useTranslation(["common", "suppliers"]);

  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContact | null>(null);
  const [contactForm, setContactForm] = useState<SupplierContactForm>(emptySupplierContactForm());
  const [contactSaving, setContactSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const supplierTypeLabel = (value?: string | null) => {
    const raw = String(value || "").toUpperCase();

    if (raw === "FABRIC_SUPPLIER") return t("suppliers:types.FABRIC_SUPPLIER");
    if (raw === "WORKSHOP") return t("suppliers:types.WORKSHOP");
    if (raw === "BOTH") return t("suppliers:types.BOTH");

    return value || "—";
  };

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await api.get<PaginatedSupplierResponse>("/suppliers", {
        params: {
          page,
          page_size: PAGE_SIZE,
          search: search || undefined,
        },
      });

      setRows(Array.isArray(response.data?.items) ? response.data.items : []);
      setTotal(Number(response.data?.total || 0));
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("suppliers:messages.loadError"));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSuppliers();
  }, [page, search]);

  const loadSupplierContacts = async (supplierId: string) => {
    try {
      setContactsLoading(true);
      setContactsError("");

      const response = await api.get<PaginatedSupplierContactResponse>("/supplier-contacts", {
        params: {
          supplier_id: supplierId,
          page: 1,
          page_size: 100,
          active_only: false,
        },
      });

      setContacts(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err: any) {
      setContactsError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "No se pudieron cargar los contactos del proveedor."
      );
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const resetContactEditor = () => {
    setEditingContact(null);
    setContactForm(emptySupplierContactForm());
    setShowContactForm(false);
  };

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm(emptySupplierContactForm());
    setShowContactForm(true);
  };

  const openEditContact = (contact: SupplierContact) => {
    setEditingContact(contact);
    setContactForm({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      phone: contact.phone || "",
      whatsapp_phone: contact.whatsapp_phone || "",
      email: contact.email || "",
      role: contact.role || "",
      is_supplier_manager: Boolean(contact.is_supplier_manager),
      is_active: Boolean(contact.is_active),
      notes: contact.notes || "",
    });
    setShowContactForm(true);
  };

  const saveContact = async () => {
    if (!editingSupplier?.id) return;

    const firstName = contactForm.first_name.trim();
    if (!firstName) {
      setContactsError("El nombre del contacto es obligatorio.");
      return;
    }

    try {
      setContactSaving(true);
      setContactsError("");

      const payload = {
        supplier_id: editingSupplier.id,
        first_name: firstName,
        last_name: contactForm.last_name.trim() || null,
        phone: contactForm.phone.trim() || null,
        whatsapp_phone: contactForm.whatsapp_phone.trim() || null,
        email: contactForm.email.trim() || null,
        role: contactForm.role.trim() || null,
        is_supplier_manager: contactForm.is_supplier_manager,
        is_active: contactForm.is_active,
        notes: contactForm.notes.trim() || null,
      };

      if (editingContact?.id) {
        await api.put(`/supplier-contacts/${editingContact.id}`, payload);
      } else {
        await api.post("/supplier-contacts", payload);
      }

      await loadSupplierContacts(String(editingSupplier.id));
      resetContactEditor();
    } catch (err: any) {
      setContactsError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "No se pudo guardar el contacto."
      );
    } finally {
      setContactSaving(false);
    }
  };

  const deleteContact = async (contact: SupplierContact) => {
    if (!editingSupplier?.id) return;

    const fullName = `${contact.first_name} ${contact.last_name || ""}`.trim();
    if (!window.confirm(`¿Eliminar el contacto ${fullName}?`)) return;

    try {
      setContactsError("");
      await api.delete(`/supplier-contacts/${contact.id}`);
      await loadSupplierContacts(String(editingSupplier.id));

      if (editingContact?.id === contact.id) {
        resetContactEditor();
      }
    } catch (err: any) {
      setContactsError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "No se pudo eliminar el contacto."
      );
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setShowModal(true);
    resetContactEditor();

    if (supplier.id) {
      void loadSupplierContacts(String(supplier.id));
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm(t("suppliers:delete.confirm"))) return;

    try {
      await api.delete(`/suppliers/${id}`);
      await loadSuppliers();
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("suppliers:delete.error"));
    }
  };

  const columns = useMemo<DataGridColumn<Supplier>[]>(() => {
    return [
      {
        key: "name",
        label: t("suppliers:fields.name"),
        render: (row) => (
          <div style={{ display: "grid", gap: 4 }}>
            <strong style={{ color: "#32273c", fontSize: 14 }}>{row.name}</strong>
            <span style={{ color: "#8b8193", fontSize: 12 }}>
              {row.supplier_code || t("suppliers:fields.noCode")}
            </span>
          </div>
        ),
      },
      {
        key: "supplier_type",
        label: t("suppliers:fields.supplierType"),
        render: (row) => (
          <span className="df-status-badge df-status-badge--active">
            {supplierTypeLabel(row.supplier_type)}
          </span>
        ),
      },
      {
        key: "origin",
        label: t("suppliers:fields.origin"),
        render: (row) => row.origin || "—",
      },
      {
        key: "email",
        label: t("suppliers:fields.email"),
        render: (row) => row.email || "—",
      },
      {
        key: "phone",
        label: t("suppliers:fields.phone"),
        render: (row) => row.phone || "—",
      },
      {
        key: "actions",
        label: "",
        render: (row) => (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button
              type="button"
              title={t("common:actions.delete")}
              aria-label={t("common:actions.delete")}
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(row.id);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid #f1c0c0",
                background: "#fff",
                color: "#b42318",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 160ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#fee2e2";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#fff";
              }}
            >
              <TrashIcon />
            </button>
          </div>
        ),
      },
    ];
  }, [t]);

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
          <p className="df-pro-page__eyebrow">{t("suppliers:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("suppliers:title")}</h1>
          <p className="df-pro-page__subtitle">
            {t("suppliers:hero.subtitle")}
          </p>
        </div>

        <PrimaryButton
          onClick={() => {
            setEditingSupplier(null);
            setContacts([]);
            setContactsError("");
            resetContactEditor();
            setShowModal(true);
          }}
          style={{ flexShrink: 0 }}
        >
          {t("suppliers:actions.new")}
        </PrimaryButton>
      </header>

      <section className="df-pro-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="df-pro-filter-grid df-pro-filter-grid--3"
        >
          <div>
            <label className="df-pro-label">{t("suppliers:filters.search")}</label>
            <input
              className="df-pro-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("suppliers:filters.searchPlaceholder")}
            />
          </div>

          <button type="submit">{t("common:actions.search")}</button>
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            {t("common:actions.clear")}
          </button>
        </form>
      </section>

      {error ? (
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
      ) : null}

      <section className="df-pro-card">
        {loading ? (
          <p>{t("suppliers:states.loading")}</p>
        ) : rows.length === 0 ? (
          <p>{t("suppliers:empty")}</p>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(r) => String(r.id || r.name)}
            onRowClick={(supplier) => handleEdit(supplier)}
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
          setEditingSupplier(null);
        }}
        title={editingSupplier ? t("suppliers:modal.editTitle") : t("suppliers:modal.createTitle")}
        width="min(920px, 100%)"
      >
        <div style={{ display: "grid", gap: 22 }}>
          <SupplierForm
            supplier={editingSupplier}
            onSuccess={async () => {
              setShowModal(false);
              setEditingSupplier(null);
              setContacts([]);
              resetContactEditor();
              await loadSuppliers();
            }}
            onCancel={() => {
              setShowModal(false);
              setEditingSupplier(null);
              setContacts([]);
              resetContactEditor();
            }}
          />

          {editingSupplier?.id ? (
            <section
              style={{
                borderTop: "1px solid #eee8f2",
                paddingTop: 20,
                display: "grid",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color: "#32273c", fontSize: 18 }}>
                    Contactos del proveedor
                  </h3>
                  <p style={{ margin: "5px 0 0", color: "#81768a", fontSize: 13 }}>
                    Personas de contacto asociadas al proveedor.
                  </p>
                </div>
                <button type="button" onClick={openNewContact}>
                  + Nuevo contacto
                </button>
              </div>

              {contactsError ? (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#fdecec",
                    color: "#9a2f2f",
                  }}
                >
                  {contactsError}
                </div>
              ) : null}

              {contactsLoading ? (
                <p style={{ margin: 0 }}>Cargando contactos...</p>
              ) : contacts.length === 0 ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: "1px dashed #d8cfde",
                    color: "#81768a",
                  }}
                >
                  Este proveedor todavía no tiene contactos registrados.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {contacts.map((contact) => {
                    const fullName = `${contact.first_name} ${contact.last_name || ""}`.trim();

                    return (
                      <div
                        key={contact.id}
                        style={{
                          border: "1px solid #e8e1ec",
                          borderRadius: 12,
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 14,
                          alignItems: "flex-start",
                          background: contact.is_active ? "#fff" : "#faf8fb",
                          opacity: contact.is_active ? 1 : 0.72,
                        }}
                      >
                        <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <strong style={{ color: "#32273c" }}>{fullName}</strong>
                            {contact.is_supplier_manager ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "3px 7px",
                                  borderRadius: 999,
                                  background: "#efe8f4",
                                  color: "#654f72",
                                }}
                              >
                                Encargado
                              </span>
                            ) : null}
                            {!contact.is_active ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "3px 7px",
                                  borderRadius: 999,
                                  background: "#f2f2f2",
                                  color: "#666",
                                }}
                              >
                                Inactivo
                              </span>
                            ) : null}
                          </div>

                          <div style={{ color: "#81768a", fontSize: 12 }}>
                            {contact.role || "Sin rol informado"}
                          </div>

                          <div style={{ color: "#5f5665", fontSize: 12 }}>
                            WhatsApp: {contact.whatsapp_phone || "—"} · Teléfono: {contact.phone || "—"}
                          </div>

                          {contact.email ? (
                            <div style={{ color: "#5f5665", fontSize: 12 }}>{contact.email}</div>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button type="button" onClick={() => openEditContact(contact)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteContact(contact)}
                            style={{ color: "#b42318" }}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showContactForm ? (
                <div
                  style={{
                    border: "1px solid #e8e1ec",
                    borderRadius: 14,
                    padding: 16,
                    display: "grid",
                    gap: 14,
                    background: "#fcfbfd",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <strong style={{ color: "#32273c" }}>
                      {editingContact ? "Editar contacto" : "Nuevo contacto"}
                    </strong>
                    <button type="button" onClick={resetContactEditor}>
                      Cerrar
                    </button>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label className="df-pro-label">Nombre *</label>
                      <input
                        className="df-pro-input"
                        value={contactForm.first_name}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, first_name: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="df-pro-label">Apellido</label>
                      <input
                        className="df-pro-input"
                        value={contactForm.last_name}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, last_name: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="df-pro-label">Rol / función</label>
                      <input
                        className="df-pro-input"
                        value={contactForm.role}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, role: e.target.value }))
                        }
                        placeholder="Ej.: Modista, Encargado, Bordadora"
                      />
                    </div>

                    <div>
                      <label className="df-pro-label">WhatsApp</label>
                      <input
                        className="df-pro-input"
                        value={contactForm.whatsapp_phone}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, whatsapp_phone: e.target.value }))
                        }
                        placeholder="+54 9 11 ..."
                      />
                    </div>

                    <div>
                      <label className="df-pro-label">Teléfono</label>
                      <input
                        className="df-pro-input"
                        value={contactForm.phone}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                      />
                    </div>

                    <div>
                      <label className="df-pro-label">Email</label>
                      <input
                        className="df-pro-input"
                        type="email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={contactForm.is_supplier_manager}
                        onChange={(e) =>
                          setContactForm((prev) => ({
                            ...prev,
                            is_supplier_manager: e.target.checked,
                          }))
                        }
                      />
                      Encargado / responsable general del proveedor
                    </label>

                    <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={contactForm.is_active}
                        onChange={(e) =>
                          setContactForm((prev) => ({ ...prev, is_active: e.target.checked }))
                        }
                      />
                      Activo
                    </label>
                  </div>

                  <div>
                    <label className="df-pro-label">Notas</label>
                    <textarea
                      className="df-pro-input"
                      rows={3}
                      value={contactForm.notes}
                      onChange={(e) =>
                        setContactForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                    <button type="button" onClick={resetContactEditor} disabled={contactSaving}>
                      Cancelar
                    </button>
                    <PrimaryButton
                      type="button"
                      onClick={() => void saveContact()}
                      disabled={contactSaving}
                    >
                      {contactSaving ? "Guardando..." : "Guardar contacto"}
                    </PrimaryButton>
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#f8f5fa",
                color: "#81768a",
                fontSize: 13,
              }}
            >
              Guardá primero el proveedor. Después podrás cargar sus contactos.
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}

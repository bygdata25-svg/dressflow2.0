import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { DataGrid, type DataGridColumn } from "../components/data-grid/DataGrid";
import { Modal } from "../components/common/Modal";
import { FormActions } from "../components/common/FormActions";
import { PrimaryButton } from "../components/common/buttons";
import { useFieldConfig } from "../hooks/useFieldConfig";
import { buildDynamicColumns } from "../lib/buildDynamicColumns";
import "../styles/pro-pages.css";

type Fabric = {
  id: string;
  name: string;
};

type Supplier = {
  id: string;
  name: string;
};

type FabricRoll = {
  id: string;
  tenant_id?: string;
  fabric_id: string;
  supplier_id?: string | null;
  roll_code: string;
  piece_type?: string | null;
  legacy_slot?: string | null;
  initial_length: number;
  current_length: number;
  reserved_length: number;
  unit: string;
  status: string;
  price_per_meter?: number | null;
  currency?: string | null;
  purchase_date?: string | null;
  location?: string | null;
  is_scrap: boolean;
  notes?: string | null;
  fabric_name?: string | null;
  fabric_color?: string | null;
  fabric_code?: string | null;
  supplier_name?: string | null;
};

type PaginatedResponse<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};

type RollFormState = {
  fabric_id: string;
  supplier_id: string;
  roll_code: string;
  initial_length: string;
  price_per_meter: string;
  purchase_date: string;
  unit: string;
  notes: string;
  location: string;
};

const PAGE_SIZE = 20;

const initialForm: RollFormState = {
  fabric_id: "",
  supplier_id: "",
  roll_code: "",
  initial_length: "",
  price_per_meter: "",
  purchase_date: "",
  unit: "meters",
  notes: "",
  location: "",
};

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

export default function FabricRollsPage() {
  const { t } = useTranslation(["common", "fabric-rolls"]);
  const fc = useFieldConfig("fabric_roll");

  const [rows, setRows] = useState<FabricRoll[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RollFormState>(initialForm);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isFieldReadOnlyOnEdit = (fieldName: string) =>
    Boolean(fc.getUiProps(fieldName)?.read_only_on_edit);

  const isFieldDisabled = (fieldName: string) =>
    !fc.isEditable(fieldName) || (Boolean(editingId) && isFieldReadOnlyOnEdit(fieldName));

  const readOnlyHint = (
    <small style={{ display: "block", marginTop: 6, color: "#667085" }}>
      Solo editable al crear.
    </small>
  );

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [rollsResponse, fabricsResponse, suppliersResponse] = await Promise.all([
        api.get<PaginatedResponse<FabricRoll>>("/fabric-rolls", {
          params: {
            page,
            page_size: PAGE_SIZE,
            search: search || undefined,
            status: statusFilter || undefined,
          },
        }),
        api.get<Fabric[]>("/fabrics"),
        api.get<PaginatedResponse<Supplier>>("/suppliers", {
          params: { page: 1, page_size: 100 },
        }),
      ]);

      setRows(Array.isArray(rollsResponse.data?.items) ? rollsResponse.data.items : []);
      setTotal(Number(rollsResponse.data?.total || 0));
      setFabrics(Array.isArray(fabricsResponse.data) ? fabricsResponse.data : []);
      setSuppliers(
        Array.isArray(suppliersResponse.data?.items) ? suppliersResponse.data.items : []
      );
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("fabric-rolls:form.messages.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [page, search, statusFilter]);

  function resetForm() {
    setForm(initialForm);
    setError("");
  }

  function handleOpenCreate() {
    setEditingId(null);
    resetForm();
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingId(null);
    resetForm();
  }

  function handleEdit(row: FabricRoll) {
    setEditingId(row.id);
    setError("");
    setForm({
      fabric_id: row.fabric_id || "",
      supplier_id: row.supplier_id || "",
      roll_code: row.roll_code || "",
      initial_length: row.initial_length != null ? String(row.initial_length) : "",
      price_per_meter: row.price_per_meter != null ? String(row.price_per_meter) : "",
      purchase_date: row.purchase_date || "",
      unit: row.unit || "meters",
      notes: row.notes || "",
      location: row.location || "",
    });
    setShowModal(true);
  }

  async function saveRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (fc.isRequired("fabric_id") && !form.fabric_id) {
      setError("La tela es obligatoria.");
      return;
    }

    if (fc.isRequired("roll_code") && !form.roll_code.trim()) {
      setError("El código de rollo es obligatorio.");
      return;
    }

    if (fc.isRequired("initial_length") && !form.initial_length) {
      setError("El metraje inicial es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        fabric_id: form.fabric_id,
        supplier_id: form.supplier_id || null,
        roll_code: form.roll_code.trim(),
        initial_length: Number(form.initial_length),
        price_per_meter: form.price_per_meter ? Number(form.price_per_meter) : null,
        purchase_date: form.purchase_date || null,
        unit: form.unit,
        notes: form.notes.trim() || null,
        location: form.location.trim() || null,
      };

      if (editingId) {
        await api.patch(`/fabric-rolls/${editingId}`, payload);
      } else {
        await api.post("/fabric-rolls", payload);
      }

      handleCloseModal();
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("fabric-rolls:form.messages.error"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRoll(id: string) {
    const confirmed = window.confirm(t("fabric-rolls:delete.confirm"));
    if (!confirmed) return;

    try {
      await api.delete(`/fabric-rolls/${id}`);
      await loadAll();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") setError(detail);
      else if (detail?.message) setError(detail.message);
      else setError(t("fabric-rolls:delete.error"));
    }
  }

  const renderers = useMemo(
    () => ({
      roll_code: (row: FabricRoll) => row.roll_code,
      fabric_id: (row: FabricRoll) => row.fabric_name || "-",
      fabric_name: (row: FabricRoll) => row.fabric_name || "-",
      fabric_color: (row: FabricRoll) => row.fabric_color || "-",
      fabric_code: (row: FabricRoll) => row.fabric_code || "-",
      supplier_id: (row: FabricRoll) => row.supplier_name || "-",
      initial_length: (row: FabricRoll) => `${row.initial_length} m`,
      current_length: (row: FabricRoll) => `${row.current_length} m`,
      reserved_length: (row: FabricRoll) => `${row.reserved_length} m`,
      status: (row: FabricRoll) => (
        <span className={`df-status-badge df-status-badge--${String(row.status).toLowerCase()}`}>
          {t(`fabric-rolls:status.${row.status}`)}
        </span>
      ),
      price_per_meter: (row: FabricRoll) =>
        row.price_per_meter != null ? `$ ${Number(row.price_per_meter).toFixed(2)}` : "-",
      purchase_date: (row: FabricRoll) => row.purchase_date || "-",
      unit: (row: FabricRoll) => row.unit || "-",
      location: (row: FabricRoll) => row.location || "-",
      is_scrap: (row: FabricRoll) => (row.is_scrap ? "Sí" : "No"),
      notes: (row: FabricRoll) => row.notes || "-",
    }),
    [t]
  );

  const actionColumn: DataGridColumn<FabricRoll> = useMemo(
    () => ({
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
              void deleteRoll(row.id);
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
    }),
    [t]
  );

  const columns = useMemo(() => {
    return buildDynamicColumns<FabricRoll>({
      fields: fc.fields,
      renderers,
      includeActions: actionColumn,
    });
  }, [fc.fields, renderers, actionColumn]);

  const showEstimatedValue =
    fc.isFormVisible("initial_length") || fc.isFormVisible("price_per_meter");

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
          <p className="df-pro-page__eyebrow">{t("fabric-rolls:hero.eyebrow")}</p>
          <h1 className="df-pro-page__title">{t("fabric-rolls:title")}</h1>
          <p className="df-pro-page__subtitle">{t("fabric-rolls:hero.subtitle")}</p>
        </div>

        <PrimaryButton onClick={handleOpenCreate} style={{ flexShrink: 0 }}>
          Nuevo rollo
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
            <label className="df-pro-label">{t("fabric-rolls:filters.search")}</label>
            <input
              className="df-pro-input"
              placeholder={t("fabric-rolls:filters.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div>
            <label className="df-pro-label">{t("fabric-rolls:filters.status")}</label>
            <select
              className="df-pro-select"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value);
              }}
            >
              <option value="">{t("fabric-rolls:filters.allStatuses")}</option>
              <option value="AVAILABLE">{t("fabric-rolls:status.AVAILABLE")}</option>
              <option value="DEPLETED">{t("fabric-rolls:status.DEPLETED")}</option>
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

      {(loading || fc.loading) && <p>{t("common:status.loading")}</p>}
      {error && !showModal && <p>{error}</p>}

      {!loading && !fc.loading && rows.length > 0 && (
        <section className="df-pro-card">
          <DataGrid
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.id}
            onRowClick={handleEdit}
          />
        </section>
      )}

      {!loading && !fc.loading && rows.length === 0 && <p>{t("fabric-rolls:empty")}</p>}

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
        title={editingId ? "Editar rollo" : "Nuevo rollo"}
        onClose={handleCloseModal}
        width="min(980px, 100%)"
      >
        <form
          onSubmit={saveRoll}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
          }}
        >
          {fc.isFormVisible("fabric_id") && (
            <div style={{ gridColumn: "span 4" }}>
              <label className="df-pro-label">
                {fc.getLabel("fabric_id", "Tela")}
                {fc.isRequired("fabric_id") ? " *" : ""}
              </label>
              <select
                className="df-pro-select"
                value={form.fabric_id}
                onChange={(e) => setForm((prev) => ({ ...prev, fabric_id: e.target.value }))}
                disabled={isFieldDisabled("fabric_id")}
                required={fc.isRequired("fabric_id")}
              >
                <option value="">Seleccionar tela</option>
                {fabrics.map((fabric) => (
                  <option key={fabric.id} value={fabric.id}>
                    {fabric.name}
                  </option>
                ))}
              </select>
              {Boolean(editingId) && isFieldReadOnlyOnEdit("fabric_id") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("supplier_id") && (
            <div style={{ gridColumn: "span 4" }}>
              <label className="df-pro-label">{fc.getLabel("supplier_id", "Proveedor")}</label>
              <select
                className="df-pro-select"
                value={form.supplier_id}
                onChange={(e) => setForm((prev) => ({ ...prev, supplier_id: e.target.value }))}
                disabled={isFieldDisabled("supplier_id")}
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {Boolean(editingId) && isFieldReadOnlyOnEdit("supplier_id") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("roll_code") && (
            <div style={{ gridColumn: "span 4" }}>
              <label className="df-pro-label">
                {fc.getLabel("roll_code", "Código de rollo")}
                {fc.isRequired("roll_code") ? " *" : ""}
              </label>
              <input
                className="df-pro-input"
                value={form.roll_code}
                onChange={(e) => setForm((prev) => ({ ...prev, roll_code: e.target.value }))}
                placeholder={fc.getUiProps("roll_code")?.placeholder || "R-001"}
                disabled={isFieldDisabled("roll_code")}
                required={fc.isRequired("roll_code")}
              />
              {Boolean(editingId) && isFieldReadOnlyOnEdit("roll_code") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("initial_length") && (
            <div style={{ gridColumn: "span 3" }}>
              <label className="df-pro-label">
                {fc.getLabel("initial_length", "Metraje inicial")}
                {fc.isRequired("initial_length") ? " *" : ""}
              </label>
              <input
                className="df-pro-input"
                type="number"
                step={fc.getValidationRules("initial_length")?.step ?? "0.01"}
                min={fc.getValidationRules("initial_length")?.min_value}
                max={fc.getValidationRules("initial_length")?.max_value}
                value={form.initial_length}
                onChange={(e) => setForm((prev) => ({ ...prev, initial_length: e.target.value }))}
                placeholder={fc.getUiProps("initial_length")?.placeholder || "25"}
                disabled={isFieldDisabled("initial_length")}
                required={fc.isRequired("initial_length")}
              />
              {Boolean(editingId) && isFieldReadOnlyOnEdit("initial_length") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("price_per_meter") && (
            <div style={{ gridColumn: "span 3" }}>
              <label className="df-pro-label">
                {fc.getLabel("price_per_meter", "Precio / metro")}
              </label>
              <input
                className="df-pro-input"
                type="number"
                step={fc.getValidationRules("price_per_meter")?.step ?? "0.01"}
                min={fc.getValidationRules("price_per_meter")?.min_value}
                max={fc.getValidationRules("price_per_meter")?.max_value}
                value={form.price_per_meter}
                onChange={(e) => setForm((prev) => ({ ...prev, price_per_meter: e.target.value }))}
                placeholder={fc.getUiProps("price_per_meter")?.placeholder || "18.00"}
                disabled={isFieldDisabled("price_per_meter")}
              />
              {Boolean(editingId) && isFieldReadOnlyOnEdit("price_per_meter") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("unit") && (
            <div style={{ gridColumn: "span 3" }}>
              <label className="df-pro-label">{fc.getLabel("unit", "Unidad")}</label>
              <select
                className="df-pro-select"
                value={form.unit}
                onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                disabled={isFieldDisabled("unit")}
              >
                <option value="meters">metros</option>
                <option value="yards">yards</option>
              </select>
              {Boolean(editingId) && isFieldReadOnlyOnEdit("unit") ? readOnlyHint : null}
            </div>
          )}

          {showEstimatedValue && (
            <div style={{ gridColumn: "span 3" }}>
              <label className="df-pro-label">Valor estimado</label>
              <div
                style={{
                  minHeight: 44,
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "#fafafa",
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                ${" "}
                {(
                  (Number(form.initial_length || 0) || 0) *
                  (Number(form.price_per_meter || 0) || 0)
                ).toFixed(2)}
              </div>
            </div>
          )}

          {fc.isFormVisible("purchase_date") && (
            <div style={{ gridColumn: "span 4" }}>
              <label className="df-pro-label">
                {fc.getLabel("purchase_date", "Fecha compra")}
              </label>
              <input
                className="df-pro-input"
                type="date"
                value={form.purchase_date}
                onChange={(e) => setForm((prev) => ({ ...prev, purchase_date: e.target.value }))}
                disabled={isFieldDisabled("purchase_date")}
              />
              {Boolean(editingId) && isFieldReadOnlyOnEdit("purchase_date") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("location") && (
            <div style={{ gridColumn: "span 4" }}>
              <label className="df-pro-label">
                {fc.getLabel("location", "Ubicación")}
                {fc.isRequired("location") ? " *" : ""}
              </label>
              <input
                className="df-pro-input"
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder={
                  fc.getUiProps("location")?.placeholder || "Depósito A / Estante 3"
                }
                disabled={isFieldDisabled("location")}
                required={fc.isRequired("location")}
              />
              {Boolean(editingId) && isFieldReadOnlyOnEdit("location") ? readOnlyHint : null}
            </div>
          )}

          {fc.isFormVisible("notes") && (
            <div style={{ gridColumn: "span 8" }}>
              <label className="df-pro-label">{fc.getLabel("notes", "Notas")}</label>
              <input
                className="df-pro-input"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={fc.getUiProps("notes")?.placeholder || "Observaciones"}
                disabled={isFieldDisabled("notes")}
              />
              {Boolean(editingId) && isFieldReadOnlyOnEdit("notes") ? readOnlyHint : null}
            </div>
          )}

          {error && (
            <div style={{ gridColumn: "1 / -1" }}>
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
            </div>
          )}

          <FormActions
            saving={saving}
            submitLabel={editingId ? t("common:actions.update") : t("common:actions.create")}
            onClear={resetForm}
            onCancel={handleCloseModal}
          />
        </form>
      </Modal>
    </section>
  );
}

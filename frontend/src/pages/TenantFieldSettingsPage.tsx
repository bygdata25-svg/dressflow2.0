import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import "../styles/pro-pages.css";

type EntityOption = "supplier" | "fabric" | "fabric_roll" | "customer";

type Tenant = {
  id: string;
  name: string;
  slug?: string | null;
  status?: string;
  email?: string | null;
  phone?: string | null;
  currency?: string;
  timezone?: string;
};

type PaginatedTenantResponse = {
  items: Tenant[];
  page: number;
  page_size: number;
  total: number;
};

type ValidationRules = {
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  step?: number;
  pattern?: string;
};

type UiProps = {
  placeholder?: string;
  read_only_on_edit?: boolean;
};

type FieldConfig = {
  field_name: string;
  label: string;
  field_type: string;
  visible: boolean;
  required: boolean;
  editable: boolean;
  list_visible: boolean;
  form_visible: boolean;
  order_index: number;
  help_text?: string | null;
  validation_rules?: ValidationRules | null;
  ui_props?: UiProps | null;
};

type FieldConfigRow = FieldConfig & {
  label_override: string;
  validation_rules_override?: ValidationRules | null;
  ui_props_override?: UiProps | null;
};

type FilterMode = "all" | "visible" | "list" | "form" | "required";

const ENTITY_OPTIONS: Array<{ value: EntityOption; label: string }> = [
  { value: "supplier", label: "Proveedores" },
  { value: "fabric", label: "Telas" },
  { value: "fabric_roll", label: "Rollos" },
  { value: "customer", label: "Clientes" },
];

export default function TenantFieldSettingsPage() {
  const [entityName, setEntityName] = useState<EntityOption>("supplier");

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>("");

  const [rows, setRows] = useState<FieldConfigRow[]>([]);
  const [originalRows, setOriginalRows] = useState<FieldConfigRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [searchText, setSearchText] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  async function loadTenants() {
    try {
      setLoadingTenants(true);
      setError("");

      const res = await api.get<PaginatedTenantResponse>("/superadmin/tenants", {
        params: { page: 1, page_size: 100 },
      });

      const data = Array.isArray(res.data?.items) ? res.data.items : [];
      setTenants(data);

      if (data.length > 0) {
        setSelectedTenantId((prev) => {
          if (prev && data.some((tenant) => tenant.id === prev)) return prev;
          return data[0].id;
        });
      } else {
        setSelectedTenantId("");
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudieron cargar los tenants.");
      setTenants([]);
      setSelectedTenantId("");
    } finally {
      setLoadingTenants(false);
    }
  }

  async function loadConfig(entity: EntityOption, tenantId: string) {
    if (!tenantId) {
      setRows([]);
      setOriginalRows([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const res = await api.get<FieldConfig[]>(`/ui-config/${entity}`, {
        params: { tenant_id: tenantId },
      });

      const incoming = Array.isArray(res.data) ? res.data : [];

      const mapped = incoming
        .sort((a, b) => a.order_index - b.order_index)
        .map((item) => ({
          ...item,
          label_override: item.label || "",
          validation_rules_override: item.validation_rules || {},
          ui_props_override: item.ui_props || {},
        }));

      setRows(mapped);
      setOriginalRows(mapped);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo cargar la configuración.");
      setRows([]);
      setOriginalRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, []);

  useEffect(() => {
    if (selectedTenantId) {
      void loadConfig(entityName, selectedTenantId);
    } else {
      setRows([]);
      setOriginalRows([]);
    }
  }, [entityName, selectedTenantId]);

  function updateRow(index: number, patch: Partial<FieldConfigRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateValidationRule(
    index: number,
    key: keyof ValidationRules,
    value: string
  ) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const nextRules = { ...(row.validation_rules_override || {}) };

        if (value === "") {
          delete nextRules[key];
        } else {
          nextRules[key] =
            key === "pattern" ? value : Number(value);
        }

        return {
          ...row,
          validation_rules_override: nextRules,
        };
      })
    );
  }

  function updateUiProp(
    index: number,
    key: keyof UiProps,
    value: string | boolean
  ) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const nextUi = { ...(row.ui_props_override || {}) };

        if (value === "") {
          delete nextUi[key];
        } else {
          nextUi[key] = value as never;
        }

        return {
          ...row,
          ui_props_override: nextUi,
        };
      })
    );
  }

  function moveRow(index: number, direction: "up" | "down") {
    setRows((prev) => {
      const sorted = [...prev].sort((a, b) => a.order_index - b.order_index);
      const targetFieldName = prev[index]?.field_name;
      const currentIndex = sorted.findIndex((r) => r.field_name === targetFieldName);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) return prev;

      const current = sorted[currentIndex];
      const target = sorted[targetIndex];
      const currentOrder = current.order_index;

      current.order_index = target.order_index;
      target.order_index = currentOrder;

      return [...sorted].sort((a, b) => a.order_index - b.order_index);
    });
  }

  function restoreDefaults() {
    if (!originalRows.length) return;
    setRows(originalRows.map((row) => ({ ...row })));
    setSuccess("");
    setError("");
  }

  async function handleSave() {
    if (!selectedTenantId) {
      setError("Seleccioná un tenant antes de guardar.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const normalizedRows = [...rows]
        .sort((a, b) => Number(a.order_index) - Number(b.order_index))
        .map((row, idx) => ({
          ...row,
          order_index: idx + 1,
        }));

      const payload = {
        entity_name: entityName,
        items: normalizedRows.map((row) => ({
          field_name: row.field_name,
          visible: row.visible,
          required: row.required,
          editable: row.editable,
          list_visible: row.list_visible,
          form_visible: row.form_visible,
          order_index: row.order_index,
          label_override: row.label_override?.trim() || null,
          help_text: row.help_text?.trim() || null,
          validation_rules_override:
            row.validation_rules_override &&
            Object.keys(row.validation_rules_override).length > 0
              ? row.validation_rules_override
              : null,
          ui_props_override:
            row.ui_props_override &&
            Object.keys(row.ui_props_override).length > 0
              ? row.ui_props_override
              : null,
        })),
      };

      await api.put(`/ui-config/${entityName}`, payload, {
        params: { tenant_id: selectedTenantId },
      });

      setSuccess("Configuración guardada correctamente.");
      await loadConfig(entityName, selectedTenantId);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "No se pudo guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Number(a.order_index) - Number(b.order_index)),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return sortedRows.filter((row) => {
      const matchesSearch =
        !q ||
        row.field_name.toLowerCase().includes(q) ||
        (row.label_override || row.label || "").toLowerCase().includes(q) ||
        (row.help_text || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      switch (filterMode) {
        case "visible":
          return row.visible;
        case "list":
          return row.visible && row.list_visible;
        case "form":
          return row.visible && row.form_visible;
        case "required":
          return row.required;
        default:
          return true;
      }
    });
  }, [sortedRows, searchText, filterMode]);

  const previewListFields = useMemo(
    () => sortedRows.filter((r) => r.visible && r.list_visible),
    [sortedRows]
  );

  const previewFormFields = useMemo(
    () => sortedRows.filter((r) => r.visible && r.form_visible),
    [sortedRows]
  );

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(originalRows), [rows, originalRows]);

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
          <p className="df-pro-page__eyebrow">Superadmin</p>
          <h1 className="df-pro-page__title">Configuración de campos</h1>
          <p className="df-pro-page__subtitle">
            Definí visibilidad, labels, orden, validaciones y props UI por tenant.
          </p>
        </div>

        <div className="df-pro-actions-row">
          <button
            type="button"
            className="gf-btn gf-btn-secondary"
            onClick={() => void loadConfig(entityName, selectedTenantId)}
            disabled={!selectedTenantId || loading || loadingTenants || saving}
          >
            Actualizar
          </button>

          <button
            type="button"
            className="gf-btn gf-btn-secondary"
            onClick={restoreDefaults}
            disabled={!dirty || saving || loading}
          >
            Restaurar defaults
          </button>

          <button
            type="button"
            className="gf-btn gf-btn-primary"
            onClick={handleSave}
            disabled={!selectedTenantId || saving || loadingTenants}
          >
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </header>

      <section className="df-pro-card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
            gap: 16,
            alignItems: "end",
          }}
        >
          <div style={{ gridColumn: "span 4" }}>
            <label className="df-pro-label">Tenant</label>
            <select
              className="df-pro-select"
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              disabled={loadingTenants}
            >
              {tenants.length === 0 ? (
                <option value="">
                  {loadingTenants ? "Cargando tenants..." : "Sin tenants"}
                </option>
              ) : (
                tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ gridColumn: "span 3" }}>
            <label className="df-pro-label">Entidad</label>
            <select
              className="df-pro-select"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value as EntityOption)}
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: "span 5" }}>
            <label className="df-pro-label">Buscar / filtrar</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
              <input
                className="df-pro-input"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar campo o label"
              />
              <select
                className="df-pro-select"
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              >
                <option value="all">Todos</option>
                <option value="visible">Visibles</option>
                <option value="list">En listado</option>
                <option value="form">En formulario</option>
                <option value="required">Obligatorios</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <section className="df-pro-card">
          <div style={errorBoxStyle}>{error}</div>
        </section>
      ) : null}

      {success ? (
        <section className="df-pro-card">
          <div style={successBoxStyle}>{success}</div>
        </section>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.45fr) minmax(360px, 0.85fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <section className="df-pro-card">
          {loading ? (
            <p>Cargando configuración...</p>
          ) : !selectedTenantId ? (
            <p>No hay tenants disponibles.</p>
          ) : filteredRows.length === 0 ? (
            <p>No hay campos que coincidan con el filtro.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredRows.map((row) => {
                const originalIndex = rows.findIndex((r) => r.field_name === row.field_name);
                const rules = row.validation_rules_override || {};
                const ui = row.ui_props_override || {};

                return (
                  <div key={row.field_name} style={cardStyle}>
                    <div style={cardHeaderStyle}>
                      <div>
                        <div style={{ fontWeight: 800, color: "#111827" }}>{row.field_name}</div>
                        <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>
                          {row.field_type}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="gf-btn gf-btn-secondary"
                          style={miniBtnStyle}
                          onClick={() => moveRow(originalIndex, "up")}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="gf-btn gf-btn-secondary"
                          style={miniBtnStyle}
                          onClick={() => moveRow(originalIndex, "down")}
                        >
                          ↓
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
                        gap: 12,
                      }}
                    >
                      <div style={{ gridColumn: "span 4" }}>
                        <label className="df-pro-label">Label</label>
                        <input
                          className="df-pro-input"
                          value={row.label_override}
                          onChange={(e) =>
                            updateRow(originalIndex, { label_override: e.target.value })
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 4" }}>
                        <label className="df-pro-label">Help text</label>
                        <input
                          className="df-pro-input"
                          value={row.help_text || ""}
                          onChange={(e) =>
                            updateRow(originalIndex, { help_text: e.target.value })
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 4" }}>
                        <label className="df-pro-label">Placeholder</label>
                        <input
                          className="df-pro-input"
                          value={ui.placeholder || ""}
                          onChange={(e) =>
                            updateUiProp(originalIndex, "placeholder", e.target.value)
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 12" }}>
                        <div style={toggleGridStyle}>
                          <ToggleCard
                            label="Visible"
                            checked={row.visible}
                            onChange={(checked) => updateRow(originalIndex, { visible: checked })}
                          />
                          <ToggleCard
                            label="Listado"
                            checked={row.list_visible}
                            disabled={!row.visible}
                            onChange={(checked) => updateRow(originalIndex, { list_visible: checked })}
                          />
                          <ToggleCard
                            label="Formulario"
                            checked={row.form_visible}
                            disabled={!row.visible}
                            onChange={(checked) => updateRow(originalIndex, { form_visible: checked })}
                          />
                          <ToggleCard
                            label="Obligatorio"
                            checked={row.required}
                            disabled={!row.form_visible}
                            onChange={(checked) => updateRow(originalIndex, { required: checked })}
                          />
                          <ToggleCard
                            label="Editable"
                            checked={row.editable}
                            onChange={(checked) => updateRow(originalIndex, { editable: checked })}
                          />
                        </div>
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="df-pro-label">Min length</label>
                        <input
                          className="df-pro-input"
                          type="number"
                          value={rules.min_length ?? ""}
                          onChange={(e) =>
                            updateValidationRule(originalIndex, "min_length", e.target.value)
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="df-pro-label">Max length</label>
                        <input
                          className="df-pro-input"
                          type="number"
                          value={rules.max_length ?? ""}
                          onChange={(e) =>
                            updateValidationRule(originalIndex, "max_length", e.target.value)
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="df-pro-label">Min value</label>
                        <input
                          className="df-pro-input"
                          type="number"
                          value={rules.min_value ?? ""}
                          onChange={(e) =>
                            updateValidationRule(originalIndex, "min_value", e.target.value)
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="df-pro-label">Max value</label>
                        <input
                          className="df-pro-input"
                          type="number"
                          value={rules.max_value ?? ""}
                          onChange={(e) =>
                            updateValidationRule(originalIndex, "max_value", e.target.value)
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="df-pro-label">Step</label>
                        <input
                          className="df-pro-input"
                          type="number"
                          step="0.01"
                          value={rules.step ?? ""}
                          onChange={(e) =>
                            updateValidationRule(originalIndex, "step", e.target.value)
                          }
                        />
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label className="df-pro-label">Readonly edit</label>
                        <select
                          className="df-pro-select"
                          value={String(ui.read_only_on_edit ?? "")}
                          onChange={(e) =>
                            updateUiProp(
                              originalIndex,
                              "read_only_on_edit",
                              e.target.value === "" ? "" : e.target.value === "true"
                            )
                          }
                        >
                          <option value="">No definido</option>
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      </div>

                      <div style={{ gridColumn: "span 12" }}>
                        <label className="df-pro-label">Pattern</label>
                        <input
                          className="df-pro-input"
                          value={rules.pattern ?? ""}
                          onChange={(e) =>
                            updateValidationRule(originalIndex, "pattern", e.target.value)
                          }
                          placeholder="^[A-Za-z0-9\\s-]+$"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div style={{ display: "grid", gap: 20 }}>
          <section className="df-pro-card">
            <div style={previewHeaderStyle}>
              <div>
                <h3 style={previewTitleStyle}>Preview listado</h3>
                <p style={previewSubtitleStyle}>Así se vería la grilla del tenant.</p>
              </div>
            </div>

            {previewListFields.length === 0 ? (
              <div style={emptyPreviewStyle}>No hay campos visibles en listado.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      {previewListFields.map((field) => (
                        <th key={field.field_name} style={previewThStyle}>
                          {field.label_override || field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {previewListFields.map((field) => (
                        <td key={field.field_name} style={previewTdStyle}>
                          {sampleValue(field)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="df-pro-card">
            <div style={previewHeaderStyle}>
              <div>
                <h3 style={previewTitleStyle}>Preview formulario</h3>
                <p style={previewSubtitleStyle}>Así se vería el modal del tenant.</p>
              </div>
            </div>

            {previewFormFields.length === 0 ? (
              <div style={emptyPreviewStyle}>No hay campos visibles en formulario.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                {previewFormFields.map((field) => {
                  const isTextarea = field.field_type === "textarea";
                  const isCheckbox = field.field_type === "checkbox";
                  const rules = field.validation_rules_override || {};
                  const ui = field.ui_props_override || {};

                  return (
                    <div
                      key={field.field_name}
                      style={{
                        gridColumn: isTextarea ? "1 / -1" : "auto",
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          marginBottom: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#344054",
                        }}
                      >
                        {field.label_override || field.label}
                        {field.required ? " *" : ""}
                      </label>

                      {isCheckbox ? (
                        <div
                          style={{
                            minHeight: 44,
                            border: "1px solid #e5e7eb",
                            borderRadius: 14,
                            display: "flex",
                            alignItems: "center",
                            padding: "0 14px",
                            background: field.editable ? "#fff" : "#f9fafb",
                            color: "#667085",
                          }}
                        >
                          <input type="checkbox" disabled checked={false} />
                          <span style={{ marginLeft: 10 }}>Checkbox</span>
                        </div>
                      ) : isTextarea ? (
                        <textarea
                          rows={4}
                          disabled
                          placeholder={ui.placeholder || placeholderByType(field)}
                          style={previewInputStyle(field.editable)}
                        />
                      ) : field.field_type === "select" ? (
                        <select disabled style={previewInputStyle(field.editable)}>
                          <option>{ui.placeholder || "Seleccionar"}</option>
                        </select>
                      ) : (
                        <input
                          disabled
                          type={inputTypeByField(field)}
                          placeholder={ui.placeholder || placeholderByType(field)}
                          style={previewInputStyle(field.editable)}
                          minLength={rules.min_length}
                          maxLength={rules.max_length}
                          min={rules.min_value}
                          max={rules.max_value}
                          step={rules.step}
                          pattern={rules.pattern}
                        />
                      )}

                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {rules.min_length != null && <PreviewTag text={`minLen ${rules.min_length}`} />}
                        {rules.max_length != null && <PreviewTag text={`maxLen ${rules.max_length}`} />}
                        {rules.min_value != null && <PreviewTag text={`min ${rules.min_value}`} />}
                        {rules.max_value != null && <PreviewTag text={`max ${rules.max_value}`} />}
                        {rules.step != null && <PreviewTag text={`step ${rules.step}`} />}
                        {rules.pattern ? <PreviewTag text="pattern" /> : null}
                      </div>

                      {field.help_text ? (
                        <small
                          style={{
                            display: "block",
                            marginTop: 6,
                            color: "#667085",
                            fontSize: 12,
                          }}
                        >
                          {field.help_text}
                        </small>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={toggleCardStyle(disabled)}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#344054" }}>{label}</span>
      <label style={{ opacity: disabled ? 0.45 : 1 }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
      </label>
    </div>
  );
}

function PreviewTag({ text }: { text: string }) {
  return <span style={previewTagStyle}>{text}</span>;
}

function sampleValue(field: FieldConfigRow) {
  switch (field.field_type) {
    case "email":
      return "cliente@dressflow.ai";
    case "number":
    case "virtual_number":
      return "123.45";
    case "date":
      return "2026-04-13";
    case "checkbox":
      return "Sí";
    case "select":
      return "Seleccionado";
    case "textarea":
      return "Texto descriptivo";
    default:
      return "Ejemplo";
  }
}

function inputTypeByField(field: FieldConfigRow) {
  if (field.field_type === "email") return "email";
  if (field.field_type === "date") return "date";
  if (field.field_type === "number" || field.field_type === "virtual_number") return "number";
  return "text";
}

function placeholderByType(field: FieldConfigRow) {
  switch (field.field_type) {
    case "email":
      return "nombre@empresa.com";
    case "number":
    case "virtual_number":
      return "0.00";
    case "date":
      return "YYYY-MM-DD";
    case "textarea":
      return "Escribí aquí...";
    case "select":
      return "Seleccionar";
    default:
      return "Ingresar valor";
  }
}

function previewInputStyle(editable: boolean): React.CSSProperties {
  return {
    width: "100%",
    minHeight: 44,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: editable ? "#fff" : "#f9fafb",
    color: editable ? "#111827" : "#667085",
    padding: "0 14px",
    outline: "none",
  };
}

const errorBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fdecec",
  color: "#9a2f2f",
};

const successBoxStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  background: "#ecfdf3",
  color: "#027a48",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #eaecf0",
  borderRadius: 18,
  padding: 16,
  background: "#fff",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const toggleGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 10,
};

const toggleCardStyle = (disabled: boolean): React.CSSProperties => ({
  border: "1px solid #eaecf0",
  borderRadius: 14,
  padding: "12px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: disabled ? "#f9fafb" : "#fff",
  opacity: disabled ? 0.7 : 1,
});

const previewTagStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  background: "#f2f4f7",
  color: "#344054",
};

const miniBtnStyle: React.CSSProperties = {
  minWidth: 32,
  height: 32,
  padding: 0,
  borderRadius: 10,
};

const previewHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const previewTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  color: "#111827",
};

const previewSubtitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 13,
  color: "#667085",
};

const previewThStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#667085",
  borderBottom: "1px solid #eaecf0",
  background: "#fcfcfd",
};

const previewTdStyle: React.CSSProperties = {
  padding: "12px",
  fontSize: 14,
  color: "#344054",
  borderBottom: "1px solid #f2f4f7",
};

const emptyPreviewStyle: React.CSSProperties = {
  minHeight: 120,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px dashed #d0d5dd",
  borderRadius: 16,
  color: "#667085",
  background: "#fafafa",
};

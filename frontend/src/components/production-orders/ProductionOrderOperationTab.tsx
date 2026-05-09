import { useEffect, useMemo, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import { api } from "../../lib/api";
import "../../styles/production-orders.css";

type ProductionOrder = {
  id: string;
  order_number: string;
  workshop_supplier_name?: string | null;
  target_dress_name: string;
  target_dress_code?: string | null;
  target_size?: string | null;
  target_color?: string | null;
  planned_quantity: number;
  produced_quantity: number;
  status: string;
  priority: string;
  due_date?: string | null;
  notes?: string | null;
  received_notes?: string | null;
  labor_cost: string;
  additional_cost: string;
  estimated_total_cost: string;
  actual_total_cost: string;
  currency: string;
  design_photo_url?: string | null;
};

type Material = {
  id: string;
  production_order_id: string;
  material_type: string;
  description_snapshot?: string | null;
  planned_quantity: string;
  delivered_quantity: string;
  consumed_quantity: string;
  returned_quantity: string;
  waste_quantity: string;
  unit: string;
  unit_cost_snapshot?: string | null;
  notes?: string | null;
  roll_code?: string | null;
  roll_current_length?: string | null;
  roll_reserved_length?: string | null;
  issued_at?: string | null;
  returned_at?: string | null;
};

type OutputItem = {
  id: string;
  production_order_id: string;
  dress_id?: string | null;
  name: string;
  code?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
  unit_cost?: string | null;
  notes?: string | null;
};

type Trim = {
  id: string;
  code: string;
  name: string;
  unit: string;
};

type Fabric = {
  id: string;
  name: string;
  color?: string | null;
};

type FabricAvailabilityRoll = {
  id: string;
  roll_code: string;
  available_length: string;
  current_length: string;
  reserved_length: string;
  status: string;
};

type FabricAvailability = {
  fabric_id: string;
  fabric_name: string;
  status: "ok" | "warning" | "error";
  message: string;
  required_meters: string;
  total_available: string;
  largest_roll: string;
  matching_rolls: FabricAvailabilityRoll[];
  all_rolls: FabricAvailabilityRoll[];
};

type FabricForm = {
  fabric_id: string;
  fabric_roll_id: string;
  planned_quantity: string;
  unit: string;
  notes: string;
};

type TrimForm = {
  trim_id: string;
  planned_quantity: string;
  notes: string;
};


type OutputForm = {
  name: string;
  code: string;
  size: string;
  color: string;
  quantity: string;
  unit_cost: string;
  notes: string;
  create_dress_records: boolean;
};

type MaterialCard = Material & {
  planned: number;
  delivered: number;
  current: number;
  reserved: number;
  free: number;
  isIssued: boolean;
  isReserved: boolean;
  totalCost: number;
  canReserve: boolean;
  canIssue: boolean;
  badgeLabel: string;
};

type AvailableRollOption = {
  id: string;
  roll_code: string;
  current_length: string;
  reserved_length: string;
  free_length: string;
  status: string;
};


type Supplier = {
  id: string;
  name: string;
  supplier_type?: string | null;
};

type ProductionProcessType = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  sort_order: number;
  color?: string | null;
  icon?: string | null;
  active: boolean;
};

type ProductionOrderAssignment = {
  id: string;
  tenant_id: string;
  production_order_id: string;
  supplier_id: string;
  process_type_id: string;
  status: string;
  estimated_cost: string;
  actual_cost: string;
  started_at?: string | null;
  finished_at?: string | null;
  notes?: string | null;
  supplier_name?: string | null;
  process_code?: string | null;
  process_name?: string | null;
  process_color?: string | null;
  process_icon?: string | null;
};

type AssignmentForm = {
  process_type_id: string;
  supplier_id: string;
  status: string;
  estimated_cost: string;
  actual_cost: string;
  started_at: string;
  finished_at: string;
  notes: string;
};

type Props = {
  t: any;
  order: ProductionOrder;
  fabrics: Fabric[];
  fabricForm: FabricForm;
  setFabricForm: Dispatch<SetStateAction<FabricForm>>;
  trimForm: TrimForm;
  setTrimForm: Dispatch<SetStateAction<TrimForm>>;
  outputForm: OutputForm;
  setOutputForm: Dispatch<SetStateAction<OutputForm>>;
  fabricAvailability: FabricAvailability | null;
  checkingAvailability: boolean;
  availableRollOptions: AvailableRollOption[];
  trims: Trim[];
  fabricMaterials: MaterialCard[];
  trimMaterials: MaterialCard[];
  outputs: OutputItem[];
  addFabricMaterial: (event: FormEvent) => Promise<void>;
  addTrimMaterial: (event: FormEvent) => Promise<void>;
  reserveMaterial: (materialId: string) => Promise<void>;
  removeMaterial: (materialId: string) => Promise<void>;
  issueMaterial: (materialId: string) => Promise<void>;
  issueAllMaterials: () => Promise<void>;
  issuingAll: boolean;
  createOutput: (event: FormEvent) => Promise<void>;
  materialStatusClass: (status: string) => string;
};


type TranslateFn = ((key: string, fallback?: string, options?: Record<string, unknown>) => string) | null | undefined;

function tr(t: TranslateFn, key: string, fallback: string, options?: Record<string, unknown>) {
  if (typeof t !== "function") return fallback;
  return t(key, fallback, options);
}

function translateUnit(t: TranslateFn, unit?: string | null) {
  const raw = String(unit || "").trim();
  const key = raw.toLowerCase();

  const map: Record<string, string> = {
    meter: "meter",
    meters: "meters",
    metro: "meter",
    metros: "meters",
    m: "meters",
    unit: "unit",
    units: "units",
    unidad: "unit",
    unidades: "units",
    piece: "piece",
    pieces: "pieces",
    pieza: "piece",
    piezas: "pieces",
    pcs: "pieces",
  };

  const normalized = map[key];
  if (!normalized) return raw;

  return tr(t, `production-orders:units.${normalized}`, raw);
}

function translateMaterialType(t: TranslateFn, materialType?: string | null) {
  const key = String(materialType || "").trim().toUpperCase();

  if (key === "TRIM") return tr(t, "production-orders:materials.trim", "Avío");
  if (key === "FABRIC_ROLL") return tr(t, "production-orders:materials.fabric", "Tela");

  return tr(t, "production-orders:fields.material", "Material");
}

function translateMaterialBadge(t: TranslateFn, badge?: string | null) {
  const key = String(badge || "").trim().toUpperCase();

  const map: Record<string, string> = {
    ENTREGADO: "ISSUED",
    RESERVADO: "RESERVED",
    PENDIENTE: "PENDING",
    BORRADOR: "DRAFT",
  };

  const normalized = map[key] || key;

  const fallbackMap: Record<string, string> = {
    ISSUED: "Entregado",
    RESERVED: "Reservado",
    PENDING: "Pendiente",
    DRAFT: "Borrador",
  };

  return tr(t, `production-orders:materialStatus.${normalized}`, fallbackMap[normalized] || badge || "-");
}

function CompactMaterialCard({
  t,
  material,
  onReserve,
  onIssue,
  onRemove,
  materialStatusClass,
}: {
  t: TranslateFn;
  material: MaterialCard;
  onReserve: (id: string) => void;
  onIssue: (id: string) => void;
  onRemove: (id: string) => void;
  materialStatusClass: (status: string) => string;
}) {
  return (
    <article className="po-compact-card">
      <div className="po-compact-card__top">
        <div>
          <div className="po-compact-card__title">
            {material.description_snapshot || translateMaterialType(t, material.material_type)}
          </div>
          <div className="po-compact-card__meta">
            <span>
              {material.planned_quantity} {translateUnit(t, material.unit)}
            </span>

            {material.roll_code ? <span>{material.roll_code}</span> : null}

            {material.material_type === "FABRIC_ROLL" ? (
              <span>
                {tr(t, "production-orders:materials.free", "Libre")} {Number(material.free || 0).toFixed(2)} {translateUnit(t, material.unit)}
              </span>
            ) : null}

            {/* 🔥 NUEVO */}
            {material.unit_cost_snapshot ? (
              <span>
                $ {Number(material.unit_cost_snapshot).toLocaleString("es-AR")} / {translateUnit(t, material.unit)}
              </span>
            ) : null}

            {/* 🔥 COSTO TOTAL */}
            <span style={{ fontWeight: 600 }}>
              {tr(t, "production-orders:materials.total", "Total")}: ${material.totalCost.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        <span className={materialStatusClass(material.badgeLabel)}>{translateMaterialBadge(t, material.badgeLabel)}</span>
      </div>

      <div className="po-compact-card__actions">
        {material.canReserve ? (
          <button type="button" className="po-secondary-btn" onClick={() => onReserve(material.id)}>
            {tr(t, "production-orders:actions.reserve", "Reservar")}
          </button>
        ) : null}

        {material.canIssue ? (
          <button type="button" className="po-primary-btn" onClick={() => onIssue(material.id)}>
            {tr(t, "production-orders:actions.issue", "Entregar")}
          </button>
        ) : null}

        <button type="button" className="po-ghost-btn" onClick={() => onRemove(material.id)}>
          {tr(t, "production-orders:actions.remove", "Quitar")}
        </button>
      </div>
    </article>
  );
}

function RailAccordion({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="po-rail-accordion">
      <button
        type="button"
        className={`po-rail-accordion__toggle ${open ? "is-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="po-rail-accordion__left">
          <span className="po-rail-accordion__title">{title}</span>
          <span className="po-rail-accordion__count">{count}</span>
        </div>
        <span className="po-rail-accordion__icon">{open ? "−" : "+"}</span>
      </button>

      {open ? <div className="po-rail-accordion__body">{children}</div> : null}
    </section>
  );
}

function getProgressPercent(planned: number, produced: number) {
  if (!planned || planned <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((produced / planned) * 100)));
}


function assignmentStatusLabel(t: TranslateFn, status?: string | null) {
  const key = String(status || "PENDING").trim().toUpperCase();

  const fallback: Record<string, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En progreso",
    COMPLETED: "Completado",
    PAUSED: "Pausado",
    CANCELLED: "Cancelado",
  };

  return tr(t, `production-orders:assignments.status.${key}`, fallback[key] || key);
}

function assignmentStatusTone(status?: string | null) {
  const key = String(status || "PENDING").trim().toUpperCase();

  if (key === "COMPLETED") return "completed";
  if (key === "IN_PROGRESS") return "progress";
  if (key === "PAUSED") return "paused";
  if (key === "CANCELLED") return "cancelled";

  return "pending";
}

function assignmentIcon(icon?: string | null, code?: string | null) {
  const normalizedIcon = String(icon || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim().toUpperCase();

  const iconMap: Record<string, string> = {
    scissors: "✂",
    shirt: "◈",
    sparkles: "✦",
    gem: "◆",
    wand: "✧",
    "badge-check": "✓",
    check: "✓",
  };

  if (iconMap[normalizedIcon]) return iconMap[normalizedIcon];

  const codeMap: Record<string, string> = {
    CUTTING: "✂",
    SEWING: "◈",
    EMBROIDERY: "✦",
    BEADING: "◆",
    FINISHING: "✧",
    QUALITY_CONTROL: "✓",
  };

  return codeMap[normalizedCode] || "•";
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function toApiDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function emptyAssignmentForm(): AssignmentForm {
  return {
    process_type_id: "",
    supplier_id: "",
    status: "PENDING",
    estimated_cost: "0",
    actual_cost: "0",
    started_at: "",
    finished_at: "",
    notes: "",
  };
}

function resolveDesignPhotoUrl(photoUrl?: string | null) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("blob:") || photoUrl.startsWith("data:")) return photoUrl;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;

  const apiBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, "")?.replace(/\/$/, "") || "";

  return `${apiBaseUrl}/${photoUrl.replace(/^\/+/, "")}`;
}


function ProcessTimeline({
  t,
  assignments,
  processTypes,
  suppliers,
  loading,
  saving,
  form,
  setForm,
  openForm,
  setOpenForm,
  error,
  onSubmit,
  onStatusChange,
  onDelete,
}: {
  t: TranslateFn;
  assignments: ProductionOrderAssignment[];
  processTypes: ProductionProcessType[];
  suppliers: Supplier[];
  loading: boolean;
  saving: boolean;
  form: AssignmentForm;
  setForm: Dispatch<SetStateAction<AssignmentForm>>;
  openForm: boolean;
  setOpenForm: Dispatch<SetStateAction<boolean>>;
  error: string;
  onSubmit: (event: FormEvent) => Promise<void>;
  onStatusChange: (assignment: ProductionOrderAssignment, status: string) => Promise<void>;
  onDelete: (assignmentId: string) => Promise<void>;
}) {
  const assignedProcessTypeIds = new Set(assignments.map((item) => item.process_type_id));

  const availableProcessTypes = processTypes.filter(
    (processType) => processType.active && !assignedProcessTypeIds.has(processType.id)
  );

  const sortedAssignments = [...assignments].sort((a, b) => {
    const aProcess = processTypes.find((item) => item.id === a.process_type_id);
    const bProcess = processTypes.find((item) => item.id === b.process_type_id);
    return Number(aProcess?.sort_order || 999) - Number(bProcess?.sort_order || 999);
  });

  return (
    <section className="po-section-card po-process-card">
      <div className="po-section-head po-process-head">
        <div>
          <h3>{tr(t, "production-orders:assignments.title", "Procesos")}</h3>
          <p>
            {tr(
              t,
              "production-orders:assignments.subtitle",
              "Timeline operativo por etapa, taller y estado de avance."
            )}
          </p>
        </div>

        <button
          type="button"
          className="po-primary-btn"
          onClick={() => setOpenForm((prev) => !prev)}
        >
          {openForm
            ? tr(t, "production-orders:assignments.closeForm", "Cerrar")
            : tr(t, "production-orders:assignments.add", "Asignar proceso")}
        </button>
      </div>

      {error ? <div className="po-inline-error">{error}</div> : null}

      {openForm ? (
        <form className="po-process-form" onSubmit={onSubmit}>
          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.process", "Proceso")}
            </label>
            <select
              className="df-pro-select"
              value={form.process_type_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, process_type_id: event.target.value }))
              }
              required
            >
              <option value="">
                {tr(t, "production-orders:assignments.selectProcess", "Seleccionar proceso")}
              </option>
              {availableProcessTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.supplier", "Taller / proveedor")}
            </label>
            <select
              className="df-pro-select"
              value={form.supplier_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, supplier_id: event.target.value }))
              }
              required
            >
              <option value="">
                {tr(t, "production-orders:assignments.selectSupplier", "Seleccionar taller")}
              </option>
              {suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.status", "Estado")}
            </label>
            <select
              className="df-pro-select"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="PENDING">{assignmentStatusLabel(t, "PENDING")}</option>
              <option value="IN_PROGRESS">{assignmentStatusLabel(t, "IN_PROGRESS")}</option>
              <option value="COMPLETED">{assignmentStatusLabel(t, "COMPLETED")}</option>
              <option value="PAUSED">{assignmentStatusLabel(t, "PAUSED")}</option>
              <option value="CANCELLED">{assignmentStatusLabel(t, "CANCELLED")}</option>
            </select>
          </div>

          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.estimatedCost", "Costo estimado")}
            </label>
            <input
              className="df-pro-input"
              type="number"
              step="0.01"
              min="0"
              value={form.estimated_cost}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, estimated_cost: event.target.value }))
              }
            />
          </div>

          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.actualCost", "Costo real")}
            </label>
            <input
              className="df-pro-input"
              type="number"
              step="0.01"
              min="0"
              value={form.actual_cost}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, actual_cost: event.target.value }))
              }
            />
          </div>

          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.startedAt", "Inicio")}
            </label>
            <input
              className="df-pro-input"
              type="date"
              value={form.started_at}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, started_at: event.target.value }))
              }
            />
          </div>

          <div>
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.finishedAt", "Fin")}
            </label>
            <input
              className="df-pro-input"
              type="date"
              value={form.finished_at}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, finished_at: event.target.value }))
              }
            />
          </div>

          <div className="po-process-form__wide">
            <label className="df-pro-label">
              {tr(t, "production-orders:assignments.notes", "Notas")}
            </label>
            <input
              className="df-pro-input"
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder={tr(
                t,
                "production-orders:assignments.notesPlaceholder",
                "Ej. bordado de mangas pendiente"
              )}
            />
          </div>

          <div className="po-process-form__actions">
            <button type="submit" className="po-primary-btn" disabled={saving}>
              {saving
                ? tr(t, "production-orders:assignments.saving", "Guardando...")
                : tr(t, "production-orders:assignments.save", "Guardar proceso")}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="po-empty-state">
          {tr(t, "common:status.loading", "Cargando...")}
        </div>
      ) : sortedAssignments.length === 0 ? (
        <div className="po-process-empty">
          <strong>{tr(t, "production-orders:assignments.emptyTitle", "Sin procesos asignados")}</strong>
          <span>
            {tr(
              t,
              "production-orders:assignments.emptyHint",
              "Asigná corte, costura, bordado u otras etapas para convertir la orden en un workflow operativo."
            )}
          </span>
        </div>
      ) : (
        <div className="po-process-timeline">
          {sortedAssignments.map((assignment) => {
            const tone = assignmentStatusTone(assignment.status);
            const icon = assignmentIcon(assignment.process_icon, assignment.process_code);

            return (
              <article key={assignment.id} className={`po-process-step po-process-step--${tone}`}>
                <div className="po-process-step__rail">
                  <span
                    className="po-process-step__marker"
                    style={{
                      background: assignment.process_color || undefined,
                    }}
                  >
                    {icon}
                  </span>
                </div>

                <div className="po-process-step__card">
                  <div className="po-process-step__top">
                    <div>
                      <h4>{assignment.process_name || "-"}</h4>
                      <p>{assignment.supplier_name || "-"}</p>
                    </div>

                    <span className={`po-process-status po-process-status--${tone}`}>
                      {assignmentStatusLabel(t, assignment.status)}
                    </span>
                  </div>

                  <div className="po-process-step__meta">
                    <span>
                      {tr(t, "production-orders:assignments.startedAt", "Inicio")}:{" "}
                      {toDateInputValue(assignment.started_at) || "-"}
                    </span>
                    <span>
                      {tr(t, "production-orders:assignments.finishedAt", "Fin")}:{" "}
                      {toDateInputValue(assignment.finished_at) || "-"}
                    </span>
                    <span>
                      {tr(t, "production-orders:assignments.estimatedCost", "Costo estimado")}:{" "}
                      {Number(assignment.estimated_cost || 0).toLocaleString("es-AR")}
                    </span>
                  </div>

                  {assignment.notes ? (
                    <div className="po-process-step__notes">{assignment.notes}</div>
                  ) : null}

                  <div className="po-process-step__actions">
                    <select
                      className="df-pro-select"
                      value={assignment.status}
                      onChange={(event) => void onStatusChange(assignment, event.target.value)}
                    >
                      <option value="PENDING">{assignmentStatusLabel(t, "PENDING")}</option>
                      <option value="IN_PROGRESS">{assignmentStatusLabel(t, "IN_PROGRESS")}</option>
                      <option value="COMPLETED">{assignmentStatusLabel(t, "COMPLETED")}</option>
                      <option value="PAUSED">{assignmentStatusLabel(t, "PAUSED")}</option>
                      <option value="CANCELLED">{assignmentStatusLabel(t, "CANCELLED")}</option>
                    </select>

                    <button
                      type="button"
                      className="po-ghost-btn"
                      onClick={() => void onDelete(assignment.id)}
                    >
                      {tr(t, "production-orders:actions.remove", "Quitar")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}


function ProductionWorkflowPipeline({
  t,
  assignments,
  processTypes,
}: {
  t: TranslateFn;
  assignments: ProductionOrderAssignment[];
  processTypes: ProductionProcessType[];
}) {
  const orderedAssignments = [...assignments].sort((a, b) => {
    const aProcess = processTypes.find((process) => process.id === a.process_type_id);
    const bProcess = processTypes.find((process) => process.id === b.process_type_id);

    return Number(aProcess?.sort_order || 999) - Number(bProcess?.sort_order || 999);
  });

  if (orderedAssignments.length === 0) {
    return null;
  }

  return (
    <section className="po-workflow-pipeline">
      <div className="po-workflow-pipeline__header">
        <div>
          <h3>
            {tr(
              t,
              "production-orders:workflow.title",
              "Workflow de producción"
            )}
          </h3>

          <p>
            {tr(
              t,
              "production-orders:workflow.subtitle",
              "Visualizá el avance operativo completo de la orden."
            )}
          </p>
        </div>
      </div>

      <div className="po-workflow-pipeline__track">
        {orderedAssignments.map((assignment, index) => {
          const tone = assignmentStatusTone(assignment.status);

          return (
            <div
              key={assignment.id}
              className={`po-workflow-step po-workflow-step--${tone}`}
            >
              <div
                className="po-workflow-step__icon"
                style={{
                  background: assignment.process_color || "#2f2940",
                }}
              >
                {assignmentIcon(
                  assignment.process_icon,
                  assignment.process_code
                )}
              </div>

              <div className="po-workflow-step__content">
                <strong>{assignment.process_name || "-"}</strong>
                <span>{assignment.supplier_name || "-"}</span>
                <small>{assignmentStatusLabel(t, assignment.status)}</small>
              </div>

              {index < orderedAssignments.length - 1 ? (
                <div className="po-workflow-step__connector" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function ProductionOrderOperationTab({
  t,
  order,
  fabrics,
  fabricForm,
  setFabricForm,
  trimForm,
  setTrimForm,
  outputForm,
  setOutputForm,
  fabricAvailability,
  checkingAvailability,
  availableRollOptions,
  trims,
  fabricMaterials,
  trimMaterials,
  outputs,
  addFabricMaterial,
  addTrimMaterial,
  reserveMaterial,
  removeMaterial,
  issueMaterial,
  issueAllMaterials,
  issuingAll,
  createOutput,
  materialStatusClass,
}: Props) {
  const outputCount = useMemo(
    () => outputs.reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    [outputs]
  );

  const assignedCount = fabricMaterials.length + trimMaterials.length;
  const progressPercent = getProgressPercent(order.planned_quantity, order.produced_quantity);
  const quickIssueReadyCount =
    fabricMaterials.filter((m) => m.canIssue).length +
    trimMaterials.filter((m) => m.canIssue).length;

  const [designPreview, setDesignPreview] = useState<string | null>(() =>
    resolveDesignPhotoUrl(order.design_photo_url)
  );
  const [uploadingDesignImage, setUploadingDesignImage] = useState(false);
  const [designImageError, setDesignImageError] = useState("");

  const [processTypes, setProcessTypes] = useState<ProductionProcessType[]>([]);
  const [assignments, setAssignments] = useState<ProductionOrderAssignment[]>([]);
  const [assignmentSuppliers, setAssignmentSuppliers] = useState<Supplier[]>([]);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [openAssignmentForm, setOpenAssignmentForm] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(() => emptyAssignmentForm());

  const loadWorkflow = async () => {
    try {
      setLoadingWorkflow(true);
      setAssignmentError("");

      const [processTypesResponse, assignmentsResponse, suppliersResponse] =
        await Promise.all([
          api.get<ProductionProcessType[]>("/production-process-types"),
          api.get<ProductionOrderAssignment[]>(
            `/production-orders/${order.id}/assignments`
          ),
          api.get<{ items: Supplier[] }>("/suppliers", {
            params: { page: 1, page_size: 100 },
          }),
        ]);

      setProcessTypes(Array.isArray(processTypesResponse.data) ? processTypesResponse.data : []);
      setAssignments(Array.isArray(assignmentsResponse.data) ? assignmentsResponse.data : []);

      const supplierItems = Array.isArray(suppliersResponse.data?.items)
        ? suppliersResponse.data.items
        : [];

      setAssignmentSuppliers(
        supplierItems.filter(
          (item) => item.supplier_type === "WORKSHOP" || item.supplier_type === "BOTH"
        )
      );
    } catch (err: any) {
      setAssignmentError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          tr(
            t,
            "production-orders:assignments.loadError",
            "No se pudieron cargar los procesos de la orden."
          )
      );
    } finally {
      setLoadingWorkflow(false);
    }
  };

  useEffect(() => {
    setDesignPreview(resolveDesignPhotoUrl(order.design_photo_url));
  }, [order.id, order.design_photo_url]);

  useEffect(() => {
    void loadWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const createAssignment = async (event: FormEvent) => {
    event.preventDefault();

    try {
      setSavingAssignment(true);
      setAssignmentError("");

      await api.post(`/production-orders/${order.id}/assignments`, {
        process_type_id: assignmentForm.process_type_id,
        supplier_id: assignmentForm.supplier_id,
        status: assignmentForm.status,
        estimated_cost: Number(assignmentForm.estimated_cost || 0),
        actual_cost: Number(assignmentForm.actual_cost || 0),
        started_at: toApiDateTime(assignmentForm.started_at),
        finished_at: toApiDateTime(assignmentForm.finished_at),
        notes: assignmentForm.notes || null,
      });

      setAssignmentForm(emptyAssignmentForm());
      setOpenAssignmentForm(false);
      await loadWorkflow();
    } catch (err: any) {
      setAssignmentError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          tr(
            t,
            "production-orders:assignments.saveError",
            "No se pudo guardar el proceso."
          )
      );
    } finally {
      setSavingAssignment(false);
    }
  };

  const updateAssignmentStatus = async (
    assignment: ProductionOrderAssignment,
    nextStatus: string
  ) => {
    try {
      setAssignmentError("");

      await api.put(`/production-order-assignments/${assignment.id}`, {
        status: nextStatus,
        finished_at:
          nextStatus === "COMPLETED"
            ? new Date().toISOString()
            : assignment.finished_at || null,
        started_at:
          nextStatus === "IN_PROGRESS" && !assignment.started_at
            ? new Date().toISOString()
            : assignment.started_at || null,
      });

      await loadWorkflow();
    } catch (err: any) {
      setAssignmentError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          tr(
            t,
            "production-orders:assignments.updateError",
            "No se pudo actualizar el proceso."
          )
      );
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      setAssignmentError("");
      await api.delete(`/production-order-assignments/${assignmentId}`);
      await loadWorkflow();
    } catch (err: any) {
      setAssignmentError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          tr(
            t,
            "production-orders:assignments.deleteError",
            "No se pudo quitar el proceso."
          )
      );
    }
  };

  const handleUploadDesignImage = async (file: File) => {
    const localPreviewUrl = URL.createObjectURL(file);
    setDesignPreview(localPreviewUrl);
    setDesignImageError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingDesignImage(true);

      const response = await api.post(
        `/production-orders/${order.id}/design-image`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const uploadedUrl =
        response.data?.design_photo_url ||
        response.data?.photo_url ||
        response.data?.url ||
        response.data?.file_url ||
        null;

      if (uploadedUrl) {
        setDesignPreview(resolveDesignPhotoUrl(uploadedUrl));
      }
    } catch (err) {
      console.error("Error uploading production order design image:", err);
      setDesignImageError(
        tr(
          t,
          "production-orders:design.uploadError",
          "No se pudo subir la imagen de diseño."
        )
      );
    } finally {
      setUploadingDesignImage(false);
    }
  };

  return (
    <>
      <style>{`
        .po-file-upload-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid #d8cfc3;
          border-radius: 14px;
          background: #fff;
          color: #2f2940;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(20, 20, 20, 0.05);
          transition: transform 0.16s ease, box-shadow 0.16s ease;
        }

        .po-file-upload-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(20, 20, 20, 0.08);
        }

        .po-design-card {
          position: relative;
          overflow: hidden;
        }

        .po-design-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(195, 140, 122, 0.12), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(251, 250, 248, 0.92) 100%);
          pointer-events: none;
        }

        .po-design-card > * {
          position: relative;
          z-index: 1;
        }

        .po-design-body {
          display: grid;
          grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
          gap: 18px;
          align-items: stretch;
        }

        .po-design-preview {
          min-height: 170px;
          border: 1px solid rgba(216, 207, 195, 0.95);
          border-radius: 22px;
          overflow: hidden;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 16px 34px rgba(52, 41, 58, 0.06);
        }

        .po-design-preview img {
          width: 100%;
          height: 100%;
          min-height: 170px;
          object-fit: cover;
          display: block;
        }

        .po-design-empty {
          display: grid;
          place-items: center;
          gap: 8px;
          min-height: 170px;
          width: 100%;
          color: #8a7f73;
          font-size: 13px;
          text-align: center;
          padding: 18px;
          background:
            linear-gradient(135deg, rgba(250, 247, 243, 0.92), rgba(255, 255, 255, 0.92));
        }

        .po-design-empty strong {
          color: #30283c;
          font-size: 14px;
        }

        .po-design-actions {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
          border: 1px solid rgba(216, 207, 195, 0.95);
          border-radius: 22px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.72);
        }

        .po-design-actions__text {
          display: grid;
          gap: 6px;
        }

        .po-design-actions__text strong {
          color: #30283c;
          font-size: 15px;
        }

        .po-design-actions__text span {
          color: #8a7f73;
          font-size: 13px;
          line-height: 1.45;
        }

        .po-design-upload-error {
          color: #a33a3a;
          font-size: 13px;
          font-weight: 700;
        }

        .po-process-card {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, rgba(212, 175, 55, 0.10), transparent 34%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(252, 249, 245, 0.95));
        }

        .po-process-head {
          align-items: flex-start;
          justify-content: space-between;
        }

        .po-process-form {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          padding: 14px;
          margin-bottom: 18px;
          border: 1px solid rgba(216, 207, 195, 0.88);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.76);
        }

        .po-process-form__wide {
          grid-column: span 2;
        }

        .po-process-form__actions {
          grid-column: span 4;
          display: flex;
          justify-content: flex-end;
        }

        .po-process-empty {
          display: grid;
          gap: 8px;
          padding: 20px;
          border: 1px dashed rgba(188, 164, 142, 0.7);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.66);
          color: #81766d;
        }

        .po-process-empty strong {
          color: #30283c;
          font-size: 15px;
        }

        .po-process-timeline {
          position: relative;
          display: grid;
          gap: 14px;
        }

        .po-process-step {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr);
          gap: 12px;
          position: relative;
        }

        .po-process-step:not(:last-child)::before {
          content: "";
          position: absolute;
          left: 23px;
          top: 46px;
          bottom: -18px;
          width: 1px;
          background: linear-gradient(180deg, rgba(92, 74, 58, 0.26), rgba(92, 74, 58, 0.04));
        }

        .po-process-step__rail {
          display: flex;
          justify-content: center;
          padding-top: 4px;
        }

        .po-process-step__marker {
          width: 42px;
          height: 42px;
          border-radius: 16px;
          display: inline-grid;
          place-items: center;
          background: #30283c;
          color: #fff;
          font-size: 17px;
          font-weight: 900;
          box-shadow: 0 14px 28px rgba(48, 40, 60, 0.18);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .po-process-step__card {
          border: 1px solid rgba(216, 207, 195, 0.88);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.82);
          padding: 14px;
          box-shadow: 0 14px 34px rgba(52, 41, 58, 0.06);
        }

        .po-process-step__top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .po-process-step__top h4 {
          margin: 0;
          color: #2f2940;
          font-size: 16px;
          letter-spacing: -0.03em;
        }

        .po-process-step__top p {
          margin: 4px 0 0;
          color: #8a7f73;
          font-size: 13px;
          font-weight: 700;
        }

        .po-process-status {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border: 1px solid rgba(216, 207, 195, 0.9);
          background: #fff;
          white-space: nowrap;
        }

        .po-process-status--completed {
          background: #ecfdf3;
          color: #276749;
          border-color: rgba(74, 163, 107, 0.3);
        }

        .po-process-status--progress {
          background: #fff7e8;
          color: #8a5e12;
          border-color: rgba(211, 177, 115, 0.34);
        }

        .po-process-status--paused {
          background: #f4f2ff;
          color: #5b4f9b;
          border-color: rgba(124, 104, 190, 0.25);
        }

        .po-process-status--cancelled {
          background: #fff0f3;
          color: #9a4659;
          border-color: rgba(217, 154, 162, 0.34);
        }

        .po-process-status--pending {
          background: #f8f6f3;
          color: #7a6d62;
        }

        .po-process-step__meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .po-process-step__meta span {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(250, 247, 243, 0.86);
          color: #746a62;
          font-size: 12px;
          font-weight: 800;
        }

        .po-process-step__notes {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 16px;
          background: rgba(250, 247, 243, 0.86);
          color: #5f554d;
          font-size: 13px;
          line-height: 1.45;
        }

        .po-process-step__actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 12px;
        }

        .po-process-step__actions .df-pro-select {
          width: min(220px, 100%);
          min-height: 36px;
        }

        @media (max-width: 920px) {
          .po-process-form {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .po-process-form__wide,
          .po-process-form__actions {
            grid-column: span 2;
          }
        }

        @media (max-width: 780px) {
          .po-design-body {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="po-op-rail-layout">
        <div className="po-op-work">
          <ProductionWorkflowPipeline
            t={t}
            assignments={assignments}
            processTypes={processTypes}
          />

          <ProcessTimeline
            t={t}
            assignments={assignments}
            processTypes={processTypes}
            suppliers={assignmentSuppliers}
            loading={loadingWorkflow}
            saving={savingAssignment}
            form={assignmentForm}
            setForm={setAssignmentForm}
            openForm={openAssignmentForm}
            setOpenForm={setOpenAssignmentForm}
            error={assignmentError}
            onSubmit={createAssignment}
            onStatusChange={updateAssignmentStatus}
            onDelete={deleteAssignment}
          />

          <section className="po-section-card po-design-card">
            <div className="po-section-head">
              <h3>{tr(t, "production-orders:design.title", "Imagen de diseño")}</h3>
              <p>
                {tr(
                  t,
                  "production-orders:design.subtitle",
                  "Referencia visual de la prenda para taller, control interno y PDF."
                )}
              </p>
            </div>

            <div className="po-design-body">
              <div className="po-design-actions">
                <div className="po-design-actions__text">
                  <strong>{tr(t, "production-orders:design.reference", "Referencia de diseño")}</strong>
                  <span>
                    {tr(
                      t,
                      "production-orders:design.help",
                      "Subí una imagen para que la orden tenga una referencia visual clara."
                    )}
                  </span>
                </div>

                <label className="po-file-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={uploadingDesignImage}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleUploadDesignImage(file);
                      event.target.value = "";
                    }}
                  />
                  {uploadingDesignImage
                    ? tr(t, "production-orders:design.uploading", "Subiendo...")
                    : designPreview
                      ? tr(t, "production-orders:design.replace", "Reemplazar imagen")
                      : tr(t, "production-orders:design.upload", "Subir imagen")}
                </label>

                {designImageError ? (
                  <div className="po-design-upload-error">{designImageError}</div>
                ) : null}
              </div>

              <div className="po-design-preview">
                {designPreview ? (
                  <img
                    src={designPreview}
                    alt={tr(t, "production-orders:design.alt", "Imagen de diseño")}
                  />
                ) : (
                  <div className="po-design-empty">
                    <strong>{tr(t, "production-orders:design.empty", "Sin imagen")}</strong>
                    <span>
                      {tr(
                        t,
                        "production-orders:design.emptyHint",
                        "La imagen aparecerá en la orden y en la ficha PDF."
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="po-section-card">
            <div className="po-section-head">
              <h3>{tr(t, "production-orders:output.title", "Producción registrada")}</h3>
              <p>
                {tr(
                  t,
                  "production-orders:output.registerProductionHint",
                  "Registrá la producción terminada. Se crearán automáticamente los vestidos disponibles para la venta."
                )}
              </p>
            </div>

            <form onSubmit={createOutput} className="po-op-output-form">
              <div>
                <label className="df-pro-label">
                  {tr(t, "production-orders:fields.producedQuantity", "Cantidad producida")}
                </label>
                <input
                  className="df-pro-input"
                  type="number"
                  min="1"
                  value={outputForm.quantity}
                  onChange={(e) =>
                    setOutputForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="df-pro-label">
                  {tr(t, "production-orders:fields.notes", "Notas")}
                </label>
                <input
                  className="df-pro-input"
                  placeholder={tr(t, "production-orders:fields.notes", "Notas")}
                  value={outputForm.notes}
                  onChange={(e) =>
                    setOutputForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>

              <button type="submit" className="po-primary-btn">
                {tr(t, "production-orders:actions.registerProduction", "Registrar Producción")}
              </button>
            </form>

            <div className="po-op-output-list">
              {outputs.length === 0 ? (
                <div className="po-empty-state">
                  {tr(
                    t,
                    "production-orders:output.emptyProduction",
                    "Todavía no hay vestidos generados."
                  )}
                </div>
              ) : (
                outputs.map((output) => (
                  <article key={output.id} className="po-op-output-card">
                    <div className="po-op-output-card__top">
                      <strong>{output.name}</strong>
                      <span className="df-status-badge df-status-badge--available">
                        {tr(t, "production-orders:status.AVAILABLE", "Disponible")}
                      </span>
                    </div>

                    <div className="po-op-output-card__meta">
                      {output.code ? (
                        <span>
                          {tr(t, "production-orders:fields.codeShort", "Cód.")} {output.code}
                        </span>
                      ) : null}
                      {output.size ? (
                        <span>
                          {tr(t, "production-orders:fields.size", "Talle")} {output.size}
                        </span>
                      ) : null}
                      {output.color ? <span>{output.color}</span> : null}
                      <span>{output.quantity} u.</span>
                    </div>

                    {output.dress_id ? (
                      <div className="po-op-output-card__notes">
                        {tr(
                          t,
                          "production-orders:output.readyForSale",
                          "Vestido creado y disponible para la venta."
                        )}
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section> 
          <div className="po-op-entry-grid">
            <section className="po-section-card po-material-entry-card">
              <div className="po-section-head">
                <h3>{tr(t, "production-orders:materials.addFabric", "Agregar tela")}</h3>
                <p>{tr(t, "production-orders:materials.addFabricHint", "Cargá el insumo principal de la orden.")}</p>
              </div>

              <form onSubmit={addFabricMaterial} className="po-material-entry-form">
                <div className="po-material-entry-form__grid">
                  <div className="po-material-entry-form__field">
                  <label className="df-pro-label">{tr(t, "production-orders:materials.fabric", "Tela")}</label>
                  <select
                    className="df-pro-select"
                    value={fabricForm.fabric_id}
                    onChange={(e) =>
                      setFabricForm((prev) => ({
                        ...prev,
                        fabric_id: e.target.value,
                        fabric_roll_id: "",
                      }))
                    }
                  >
                    <option value="">{tr(t, "production-orders:materials.selectFabric", "Seleccionar tela")}</option>
                    {fabrics.map((fabric) => (
                      <option key={fabric.id} value={fabric.id}>
                        {fabric.name} {fabric.color ? `· ${fabric.color}` : ""}
                      </option>
                    ))}
                  </select>
                  </div>

                  <div className="po-material-entry-form__field">
                    <label className="df-pro-label">{tr(t, "production-orders:materials.roll", "Rollo")}</label>
                  <select
                    className="df-pro-select"
                    value={fabricForm.fabric_roll_id}
                    onChange={(e) =>
                      setFabricForm((prev) => ({ ...prev, fabric_roll_id: e.target.value }))
                    }
                  >
                    <option value="">{tr(t, "production-orders:materials.rollPlaceholder", "Seleccionar rollo")}</option>
                    {availableRollOptions.map((roll) => (
                      <option key={roll.id} value={roll.id}>
                        {roll.roll_code} · {tr(t, "production-orders:materials.free", "Libre")} {Number(roll.free_length).toFixed(2)} m
                      </option>
                    ))}
                  </select>
                  </div>

                  <div className="po-material-entry-form__field--small">
                    <label className="df-pro-label">{tr(t, "production-orders:fields.quantity", "Cantidad")}</label>
                  <input
                    className="df-pro-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={fabricForm.planned_quantity}
                    onChange={(e) =>
                      setFabricForm((prev) => ({ ...prev, planned_quantity: e.target.value }))
                    }
                  />
                  </div>

                  <div className="po-material-entry-form__field--small">
                    <label className="df-pro-label">{tr(t, "production-orders:fields.unit", "Unidad")}</label>
                  <input
                    className="df-pro-input"
                    value={translateUnit(t, fabricForm.unit || "meters")}
                    readOnly
                    onChange={(e) =>
                      setFabricForm((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    placeholder={tr(t, "production-orders:units.meters", "metros")}
                  />
                  </div>
                </div>

                <div className="po-material-entry-form__actions">
                  <button type="submit" className="po-primary-btn">
                    {tr(t, "production-orders:actions.addFabric", "Agregar tela")}
                  </button>
                </div>
              </form>

              {fabricAvailability ? (
                <div className="po-op-inline-alert">
                  <strong>{fabricAvailability.fabric_name}</strong>
                  <span>{fabricAvailability.message}</span>
                  <small>
                    {tr(t, "production-orders:materials.requires", "Requiere")} {fabricAvailability.required_meters} m · {tr(t, "production-orders:materials.available", "Disponible")}{" "}
                    {fabricAvailability.total_available} m
                  </small>
                </div>
              ) : checkingAvailability ? (
                <div className="po-soft-text">{tr(t, "production-orders:materials.checkingAvailability", "Validando disponibilidad...")}</div>
              ) : null}
            </section>

            <section className="po-section-card po-material-entry-card">
              <div className="po-section-head">
                <h3>{tr(t, "production-orders:materials.addTrim", "Agregar avío")}</h3>
                <p>{tr(t, "production-orders:materials.addTrimHint", "Cargá insumos complementarios.")}</p>
              </div>

              <form onSubmit={addTrimMaterial} className="po-material-entry-form">
                <div className="po-material-entry-form__grid">
                  <div className="po-material-entry-form__field--wide">
                  <label className="df-pro-label">{tr(t, "production-orders:materials.trim", "Avío")}</label>
                  <select
                    className="df-pro-select"
                    value={trimForm.trim_id}
                    onChange={(e) => setTrimForm((prev) => ({ ...prev, trim_id: e.target.value }))}
                  >
                    <option value="">{tr(t, "production-orders:materials.selectTrim", "Seleccionar avío")}</option>
                    {trims.map((trim) => (
                      <option key={trim.id} value={trim.id}>
                        {trim.name} · {trim.code}
                      </option>
                    ))}
                  </select>
                  </div>

                  <div className="po-material-entry-form__field--small">
                    <label className="df-pro-label">{tr(t, "production-orders:fields.quantity", "Cantidad")}</label>
                  <input
                    className="df-pro-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={trimForm.planned_quantity}
                    onChange={(e) =>
                      setTrimForm((prev) => ({ ...prev, planned_quantity: e.target.value }))
                    }
                  />
                  </div>
                </div>

                <div className="po-material-entry-form__actions">
                  <button type="submit" className="po-primary-btn">
                    {tr(t, "production-orders:actions.addTrim", "Agregar avío")}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>

        <aside className="po-op-rail">
          <div className="po-op-rail__sticky">
            <section className="po-section-card">
              <div className="po-section-head">
                <h3>{tr(t, "production-orders:operation.assigned.title", "Asignado")}</h3>
                <p>{tr(t, "production-orders:operation.assigned.hint", "{{count}} ítems vinculados a la orden.", { count: assignedCount })}</p>
              </div>

              <div className="po-op-rail-groups">
                <RailAccordion title={tr(t, "production-orders:materials.fabrics", "Telas")} count={fabricMaterials.length} defaultOpen>
                  <div className="po-compact-list">
                    {fabricMaterials.length === 0 ? (
                      <div className="po-empty-state">{tr(t, "production-orders:materials.noFabrics", "No hay telas asignadas.")}</div>
                    ) : (
                      fabricMaterials.map((material) => (
                        <CompactMaterialCard
                          key={material.id}
                          t={t}
                          material={material}
                          onReserve={reserveMaterial}
                          onIssue={issueMaterial}
                          onRemove={removeMaterial}
                          materialStatusClass={materialStatusClass}
                        />
                      ))
                    )}
                  </div>
                </RailAccordion>

                <RailAccordion title={tr(t, "production-orders:materials.trims", "Avíos")} count={trimMaterials.length}>
                  <div className="po-compact-list">
                    {trimMaterials.length === 0 ? (
                      <div className="po-empty-state">{tr(t, "production-orders:materials.noTrims", "No hay avíos asignados.")}</div>
                    ) : (
                      trimMaterials.map((material) => (
                        <CompactMaterialCard
                          key={material.id}
                          t={t}
                          material={material}
                          onReserve={reserveMaterial}
                          onIssue={issueMaterial}
                          onRemove={removeMaterial}
                          materialStatusClass={materialStatusClass}
                        />
                      ))
                    )}
                  </div>
                </RailAccordion>
              </div>
            </section>

            <section className="po-section-card po-quick-rail-card">
              <div className="po-section-head">
                <h3>{tr(t, "production-orders:operation.quickActions.title", "Acciones rápidas")}</h3>
              </div>

              <div className="po-quick-rail">
                <button
                  type="button"
                  className="po-primary-btn"
                  disabled={issuingAll}
                  onClick={issueAllMaterials}
                >
                  {issuingAll ? tr(t, "production-orders:actions.issuing", "Entregando...") : tr(t, "production-orders:actions.issueReserved", "Entregar reservados")}
                </button>

                <div className="po-quick-rail__hint">
                  {quickIssueReadyCount > 0
                    ? tr(t, "production-orders:operation.quickActions.readyToIssue", "{{count}} materiales listos para entregar", { count: quickIssueReadyCount })
                    : tr(t, "production-orders:operation.quickActions.noneReady", "No hay materiales reservados listos")}
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>

      <div className="po-bottom-bar">
        <div className="po-bottom-bar__stats">
          <div className="po-bottom-bar__stat">
            <span>{tr(t, "production-orders:operation.assigned.title", "Asignado")}</span>
            <strong>{assignedCount}</strong>
          </div>

          <div className="po-bottom-bar__stat">
            <span>{tr(t, "production-orders:output.title", "Producción")}</span>
            <strong>{outputCount}</strong>
          </div>

          <div className="po-bottom-bar__stat po-bottom-bar__stat--wide">
            <span>{tr(t, "production-orders:operation.summary.progress", "Progreso")}</span>
            <div className="po-bottom-bar__progress">
              <div className="po-progress-track">
                <div className="po-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <strong>{progressPercent}%</strong>
            </div>
          </div>
        </div>

        <div className="po-bottom-bar__actions">
          <button
            type="button"
            className="po-secondary-btn"
            disabled={issuingAll}
            onClick={issueAllMaterials}
          >
            {issuingAll ? tr(t, "production-orders:actions.issuing", "Entregando...") : tr(t, "production-orders:actions.issueReserved", "Entregar reservados")}
          </button>
        </div>
      </div>
    </>
  );
}

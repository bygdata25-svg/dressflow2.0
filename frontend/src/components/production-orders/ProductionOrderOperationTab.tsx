import { useMemo, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";

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

type ReceiveForm = {
  produced_quantity: string;
  status: string;
  received_notes: string;
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

type Props = {
  t: any;
  i18n: any;
  order: ProductionOrder;
  designPhoto: string | null;
  uploadingDesignImage: boolean;
  designImageError: string;
  uploadDesignImage: (file: File) => Promise<void>;
  fabrics: Fabric[];
  fabricForm: FabricForm;
  setFabricForm: Dispatch<SetStateAction<FabricForm>>;
  trimForm: TrimForm;
  setTrimForm: Dispatch<SetStateAction<TrimForm>>;
  outputForm: OutputForm;
  setOutputForm: Dispatch<SetStateAction<OutputForm>>;
  receiveForm: ReceiveForm;
  setReceiveForm: Dispatch<SetStateAction<ReceiveForm>>;
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
  receiveOrder: (event: FormEvent) => Promise<void>;
  formatMoney: (value?: string | number | null, currency?: string) => string;
  materialStatusClass: (status: string) => string;
};

function CompactMaterialCard({
  material,
  onReserve,
  onIssue,
  onRemove,
  materialStatusClass,
}: {
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
            {material.description_snapshot || (material.material_type === "TRIM" ? "Avío" : "Tela")}
          </div>
          <div className="po-compact-card__meta">
            <span>
              {material.planned_quantity} {material.unit}
            </span>

            {material.roll_code ? <span>{material.roll_code}</span> : null}

            {material.material_type === "FABRIC_ROLL" ? (
              <span>
                Libre {Number(material.free || 0).toFixed(2)} {material.unit}
              </span>
            ) : null}

            {/* 🔥 NUEVO */}
            {material.unit_cost_snapshot ? (
              <span>
                $ {Number(material.unit_cost_snapshot).toLocaleString("es-AR")} / {material.unit}
              </span>
            ) : null}

            {/* 🔥 COSTO TOTAL */}
            <span style={{ fontWeight: 600 }}>
              Total: ${material.totalCost.toLocaleString("es-AR")}
            </span>
          </div>
        </div>

        <span className={materialStatusClass(material.badgeLabel)}>{material.badgeLabel}</span>
      </div>

      <div className="po-compact-card__actions">
        {material.canReserve ? (
          <button type="button" className="po-secondary-btn" onClick={() => onReserve(material.id)}>
            Reservar
          </button>
        ) : null}

        {material.canIssue ? (
          <button type="button" className="po-primary-btn" onClick={() => onIssue(material.id)}>
            Entregar
          </button>
        ) : null}

        <button type="button" className="po-ghost-btn" onClick={() => onRemove(material.id)}>
          Quitar
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

export default function ProductionOrderOperationTab({
  order,
  designPhoto,
  uploadingDesignImage,
  designImageError,
  uploadDesignImage,
  fabrics,
  fabricForm,
  setFabricForm,
  trimForm,
  setTrimForm,
  outputForm,
  setOutputForm,
  receiveForm,
  setReceiveForm,
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
  receiveOrder,
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

  return (
    <>
      <div className="po-op-rail-layout">
        <div className="po-op-work">
          <section className="po-section-card">
            <div className="po-section-head">
              <h3>Diseño</h3>
            </div>

            <div className="po-op-hero">
              <div className="po-op-hero__image">
                {designPhoto ? (
                  <img src={designPhoto} alt={order.target_dress_name} />
                ) : (
                  <div className="po-op-hero__empty">Sin imagen de referencia</div>
                )}
              </div>

              <div className="po-op-hero__info">
                <div className="po-op-hero__card">
                  <span className="po-op-hero__label">Vestido</span>
                  <strong>{order.target_dress_name}</strong>
                  <div className="po-op-hero__chips">
                    {order.target_dress_code ? <span>Cód. {order.target_dress_code}</span> : null}
                    {order.target_size ? <span>Talle {order.target_size}</span> : null}
                    {order.target_color ? <span>{order.target_color}</span> : null}
                  </div>
                </div>

                <div className="po-op-hero__card">
                  <span className="po-op-hero__label">Referencia</span>
                  <div className="po-op-upload-row">
                    <input
                      className="df-pro-input"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadDesignImage(file);
                      }}
                    />
                  </div>
                  {uploadingDesignImage ? <div className="po-soft-text">Subiendo imagen...</div> : null}
                  {designImageError ? <div className="po-inline-error">{designImageError}</div> : null}
                </div>

                <div className="po-op-hero__card">
                  <span className="po-op-hero__label">Observaciones</span>
                  <div className="po-op-notes">{order.notes || "Sin observaciones."}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="po-op-entry-grid">
            <section className="po-section-card">
              <div className="po-section-head">
                <h3>Agregar tela</h3>
                <p>Cargá el insumo principal de la orden.</p>
              </div>

              <form onSubmit={addFabricMaterial} className="po-op-entry-form">
                <div>
                  <label className="df-pro-label">Tela</label>
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
                    <option value="">Seleccionar tela</option>
                    {fabrics.map((fabric) => (
                      <option key={fabric.id} value={fabric.id}>
                        {fabric.name} {fabric.color ? `· ${fabric.color}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="df-pro-label">Rollo</label>
                  <select
                    className="df-pro-select"
                    value={fabricForm.fabric_roll_id}
                    onChange={(e) =>
                      setFabricForm((prev) => ({ ...prev, fabric_roll_id: e.target.value }))
                    }
                  >
                    <option value="">Seleccionar rollo</option>
                    {availableRollOptions.map((roll) => (
                      <option key={roll.id} value={roll.id}>
                        {roll.roll_code} · Libre {Number(roll.free_length).toFixed(2)} m
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="df-pro-label">Cantidad</label>
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

                <div>
                  <label className="df-pro-label">Unidad</label>
                  <input
                    className="df-pro-input"
                    value={fabricForm.unit || "metros"}
                    onChange={(e) =>
                      setFabricForm((prev) => ({ ...prev, unit: e.target.value }))
                    }
                    placeholder="metros"
                  />
                </div>

                <div className="po-op-entry-form__action">
                  <button type="submit" className="po-primary-btn">
                    Agregar tela
                  </button>
                </div>
              </form>

              {fabricAvailability ? (
                <div className="po-op-inline-alert">
                  <strong>{fabricAvailability.fabric_name}</strong>
                  <span>{fabricAvailability.message}</span>
                  <small>
                    Requiere {fabricAvailability.required_meters} m · Disponible{" "}
                    {fabricAvailability.total_available} m
                  </small>
                </div>
              ) : checkingAvailability ? (
                <div className="po-soft-text">Validando disponibilidad...</div>
              ) : null}
            </section>

            <section className="po-section-card">
              <div className="po-section-head">
                <h3>Agregar avío</h3>
                <p>Cargá insumos complementarios.</p>
              </div>

              <form onSubmit={addTrimMaterial} className="po-op-entry-form po-op-entry-form--trim">
                <div>
                  <label className="df-pro-label">Avío</label>
                  <select
                    className="df-pro-select"
                    value={trimForm.trim_id}
                    onChange={(e) => setTrimForm((prev) => ({ ...prev, trim_id: e.target.value }))}
                  >
                    <option value="">Seleccionar avío</option>
                    {trims.map((trim) => (
                      <option key={trim.id} value={trim.id}>
                        {trim.name} · {trim.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="df-pro-label">Cantidad</label>
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

                <div className="po-op-entry-form__action">
                  <button type="submit" className="po-primary-btn">
                    Agregar avío
                  </button>
                </div>
              </form>
            </section>
          </div>

          <section className="po-section-card">
            <div className="po-section-head">
              <h3>Outputs</h3>
              <p>{outputCount} unidades registradas</p>
            </div>

            <form onSubmit={createOutput} className="po-op-output-form">
              <input
                className="df-pro-input"
                placeholder="Nombre"
                value={outputForm.name}
                onChange={(e) => setOutputForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="df-pro-input"
                placeholder="Código"
                value={outputForm.code}
                onChange={(e) => setOutputForm((prev) => ({ ...prev, code: e.target.value }))}
              />
              <input
                className="df-pro-input"
                placeholder="Talle"
                value={outputForm.size}
                onChange={(e) => setOutputForm((prev) => ({ ...prev, size: e.target.value }))}
              />
              <input
                className="df-pro-input"
                placeholder="Color"
                value={outputForm.color}
                onChange={(e) => setOutputForm((prev) => ({ ...prev, color: e.target.value }))}
              />
              <input
                className="df-pro-input"
                type="number"
                min="1"
                placeholder="Cantidad"
                value={outputForm.quantity}
                onChange={(e) => setOutputForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
              <button type="submit" className="po-primary-btn">
                Agregar output
              </button>
            </form>

            <div className="po-op-output-list">
              {outputs.length === 0 ? (
                <div className="po-empty-state">Todavía no hay outputs creados.</div>
              ) : (
                outputs.map((output) => (
                  <article key={output.id} className="po-op-output-card">
                    <div className="po-op-output-card__top">
                      <strong>{output.name}</strong>
                      <span className="df-status-badge df-status-badge--completed">
                        {output.quantity} u.
                      </span>
                    </div>

                    <div className="po-op-output-card__meta">
                      {output.code ? <span>Cód. {output.code}</span> : null}
                      {output.size ? <span>Talle {output.size}</span> : null}
                      {output.color ? <span>{output.color}</span> : null}
                    </div>

                    {output.notes ? (
                      <div className="po-op-output-card__notes">{output.notes}</div>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="po-op-rail">
          <div className="po-op-rail__sticky">
            <section className="po-section-card">
              <div className="po-section-head">
                <h3>Asignado</h3>
                <p>{assignedCount} ítems vinculados a la orden.</p>
              </div>

              <div className="po-op-rail-groups">
                <RailAccordion title="Telas" count={fabricMaterials.length} defaultOpen>
                  <div className="po-compact-list">
                    {fabricMaterials.length === 0 ? (
                      <div className="po-empty-state">No hay telas asignadas.</div>
                    ) : (
                      fabricMaterials.map((material) => (
                        <CompactMaterialCard
                          key={material.id}
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

                <RailAccordion title="Avíos" count={trimMaterials.length}>
                  <div className="po-compact-list">
                    {trimMaterials.length === 0 ? (
                      <div className="po-empty-state">No hay avíos asignados.</div>
                    ) : (
                      trimMaterials.map((material) => (
                        <CompactMaterialCard
                          key={material.id}
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
                <h3>Acciones rápidas</h3>
              </div>

              <div className="po-quick-rail">
                <button
                  type="button"
                  className="po-primary-btn"
                  disabled={issuingAll}
                  onClick={issueAllMaterials}
                >
                  {issuingAll ? "Entregando..." : "Entregar reservados"}
                </button>

                <div className="po-quick-rail__hint">
                  {quickIssueReadyCount > 0
                    ? `${quickIssueReadyCount} materiales listos para entregar`
                    : "No hay materiales reservados listos"}
                </div>

                <form onSubmit={receiveOrder} className="po-op-side-form">
                  <input
                    className="df-pro-input"
                    type="number"
                    min="0"
                    placeholder="Cantidad producida"
                    value={receiveForm.produced_quantity}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, produced_quantity: e.target.value }))
                    }
                  />

                  <select
                    className="df-pro-select"
                    value={receiveForm.status}
                    onChange={(e) => setReceiveForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="PARTIALLY_RECEIVED">Parcialmente recibida</option>
                    <option value="COMPLETED">Completada</option>
                  </select>

                  <input
                    className="df-pro-input"
                    placeholder="Notas de recepción"
                    value={receiveForm.received_notes}
                    onChange={(e) =>
                      setReceiveForm((prev) => ({ ...prev, received_notes: e.target.value }))
                    }
                  />

                  <button type="submit" className="po-secondary-btn">
                    Registrar recepción
                  </button>
                </form>
              </div>
            </section>
          </div>
        </aside>
      </div>

      <div className="po-bottom-bar">
        <div className="po-bottom-bar__stats">
          <div className="po-bottom-bar__stat">
            <span>Asignado</span>
            <strong>{assignedCount}</strong>
          </div>

          <div className="po-bottom-bar__stat">
            <span>Outputs</span>
            <strong>{outputCount}</strong>
          </div>

          <div className="po-bottom-bar__stat po-bottom-bar__stat--wide">
            <span>Progreso</span>
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
            {issuingAll ? "Entregando..." : "Entregar reservados"}
          </button>
        </div>
      </div>
    </>
  );
}

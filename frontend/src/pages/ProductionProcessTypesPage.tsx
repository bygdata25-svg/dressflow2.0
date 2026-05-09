import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  CircleDot,
  Gem,
  GripVertical,
  Package,
  Scissors,
  Shirt,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { api } from "../lib/api";

import "../styles/pro-pages.css";
import "../styles/production-process-types.css";

type ProductionProcessType = {
  id: string;
  tenant_id?: string;
  name: string;
  code: string;
  sort_order: number;
  active: boolean;
  color?: string | null;
  icon?: string | null;
};

type FormState = {
  name: string;
  code: string;
  sort_order: string;
  color: string;
  icon: string;
  active: boolean;
};

const INITIAL_FORM: FormState = {
  name: "",
  code: "",
  sort_order: "100",
  color: "#2f2940",
  icon: "scissors",
  active: true,
};

type TemplateProcess = {
  code: string;
  icon: string;
  color: string;
};

type WorkflowTemplate = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  processes: TemplateProcess[];
};

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "hauteCouture",
    titleKey: "templates.items.hauteCouture.title",
    descriptionKey: "templates.items.hauteCouture.description",
    processes: [
      { code: "PATTERN_MAKING", icon: "shirt", color: "#5B4B8A" },
      { code: "CUTTING", icon: "scissors", color: "#2F2940" },
      { code: "SEWING", icon: "shirt", color: "#3F4E4F" },
      { code: "EMBROIDERY", icon: "sparkles", color: "#7C3AED" },
      { code: "BEADING", icon: "gem", color: "#BE185D" },
      { code: "FINISHING", icon: "wand", color: "#D97706" },
      { code: "QUALITY_CONTROL", icon: "badge-check", color: "#059669" },
    ],
  },
  {
    id: "bridal",
    titleKey: "templates.items.bridal.title",
    descriptionKey: "templates.items.bridal.description",
    processes: [
      { code: "PATTERN_MAKING", icon: "shirt", color: "#6D5B7B" },
      { code: "CUTTING", icon: "scissors", color: "#2F2940" },
      { code: "SEWING", icon: "shirt", color: "#3F4E4F" },
      { code: "FITTING", icon: "badge-check", color: "#8A6F3D" },
      { code: "ALTERATIONS", icon: "wand", color: "#D97706" },
      { code: "FINISHING", icon: "sparkles", color: "#7C3AED" },
      { code: "QUALITY_CONTROL", icon: "badge-check", color: "#059669" },
    ],
  },
  {
    id: "tailoring",
    titleKey: "templates.items.tailoring.title",
    descriptionKey: "templates.items.tailoring.description",
    processes: [
      { code: "PATTERN_MAKING", icon: "shirt", color: "#5B4B8A" },
      { code: "CUTTING", icon: "scissors", color: "#2F2940" },
      { code: "SEWING", icon: "shirt", color: "#3F4E4F" },
      { code: "FITTING", icon: "badge-check", color: "#8A6F3D" },
      { code: "ALTERATIONS", icon: "wand", color: "#D97706" },
      { code: "QUALITY_CONTROL", icon: "badge-check", color: "#059669" },
    ],
  },
  {
    id: "streetwear",
    titleKey: "templates.items.streetwear.title",
    descriptionKey: "templates.items.streetwear.description",
    processes: [
      { code: "CUTTING", icon: "scissors", color: "#2F2940" },
      { code: "PRINTING", icon: "sparkles", color: "#7C3AED" },
      { code: "SUBLIMATION", icon: "wand", color: "#D97706" },
      { code: "SEWING", icon: "shirt", color: "#3F4E4F" },
      { code: "QUALITY_CONTROL", icon: "badge-check", color: "#059669" },
      { code: "PACKAGING", icon: "package", color: "#64748B" },
    ],
  },
  {
    id: "uniforms",
    titleKey: "templates.items.uniforms.title",
    descriptionKey: "templates.items.uniforms.description",
    processes: [
      { code: "CUTTING", icon: "scissors", color: "#2F2940" },
      { code: "SEWING", icon: "shirt", color: "#3F4E4F" },
      { code: "QUALITY_CONTROL", icon: "badge-check", color: "#059669" },
      { code: "PACKAGING", icon: "package", color: "#64748B" },
      { code: "DISPATCH", icon: "package", color: "#0F766E" },
    ],
  },
];

const ICON_MAP: Record<string, LucideIcon> = {
  scissors: Scissors,
  shirt: Shirt,
  sparkles: Sparkles,
  gem: Gem,
  wand: Wand2,
  "badge-check": BadgeCheck,
  check: BadgeCheck,
  package: Package,
  needle: CircleDot,
};

const CODE_ICON_MAP: Record<string, LucideIcon> = {
  PATTERN_MAKING: Shirt,
  CUTTING: Scissors,
  SEWING: Shirt,
  EMBROIDERY: Sparkles,
  BEADING: Gem,
  FITTING: BadgeCheck,
  ALTERATIONS: Wand2,
  FINISHING: Wand2,
  QUALITY_CONTROL: BadgeCheck,
  PACKAGING: Package,
  DISPATCH: Package,
  PRINTING: Sparkles,
  SUBLIMATION: Wand2,
};

function ProcessIcon({
  icon,
  code,
  size = 22,
}: {
  icon?: string | null;
  code?: string | null;
  size?: number;
}) {
  const normalizedIcon = String(icon || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim().toUpperCase();

  const Icon = ICON_MAP[normalizedIcon] || CODE_ICON_MAP[normalizedCode] || CircleDot;

  return <Icon size={size} strokeWidth={2.2} />;
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
}

export default function ProductionProcessTypesPage() {
  const { t } = useTranslation(["production-process-types"]);

  const [items, setItems] = useState<ProductionProcessType[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionProcessType | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("hauteCouture");
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  const sortedItems = useMemo(() => {
    return [...items].sort(
      (a, b) => Number(a.sort_order || 999) - Number(b.sort_order || 999)
    );
  }, [items]);

  const selectedTemplate = useMemo(() => {
    return (
      WORKFLOW_TEMPLATES.find((template) => template.id === selectedTemplateId) ||
      WORKFLOW_TEMPLATES[0]
    );
  }, [selectedTemplateId]);

  const existingCodes = useMemo(() => {
    return new Set(items.map((item) => item.code));
  }, [items]);

  const loadItems = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/production-process-types");
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("errors.load")
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewModal = () => {
    setEditing(null);
    setForm(INITIAL_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (item: ProductionProcessType) => {
    setEditing(item);
    setForm({
      name: item.name || "",
      code: item.code || "",
      sort_order: String(item.sort_order ?? 100),
      color: item.color || "#2f2940",
      icon: item.icon || "scissors",
      active: Boolean(item.active),
    });

    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditing(null);
    setForm(INITIAL_FORM);
  };

  const saveProcess = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        code: normalizeCode(form.code),
        sort_order: Number(form.sort_order || 100),
        color: form.color || null,
        icon: form.icon || null,
        active: form.active,
      };

      if (editing) {
        await api.put(`/production-process-types/${editing.id}`, payload);
      } else {
        await api.post("/production-process-types", payload);
      }

      setModalOpen(false);
      setEditing(null);
      setForm(INITIAL_FORM);
      await loadItems();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("errors.save")
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: ProductionProcessType) => {
    try {
      setError("");

      await api.put(`/production-process-types/${item.id}`, {
        active: !item.active,
      });

      await loadItems();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("errors.toggle")
      );
    }
  };

  const reorderItems = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;

    const updated = [...sortedItems];
    const draggedIndex = updated.findIndex((item) => item.id === draggedId);
    const targetIndex = updated.findIndex((item) => item.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [removed] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, removed);

    const normalized = updated.map((item, index) => ({
      ...item,
      sort_order: (index + 1) * 10,
    }));

    setItems(normalized);

    try {
      setError("");

      await Promise.all(
        normalized.map((item) =>
          api.put(`/production-process-types/${item.id}`, {
            sort_order: item.sort_order,
          })
        )
      );
    } catch (err) {
      console.error(err);
      setError(t("errors.reorder"));
      await loadItems();
    }
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setApplyingTemplate(true);
      setError("");

      const currentMaxOrder = Math.max(
        0,
        ...items.map((item) => Number(item.sort_order || 0))
      );

      const missingProcesses = selectedTemplate.processes.filter(
        (process) => !existingCodes.has(process.code)
      );

      await Promise.all(
        missingProcesses.map((process, index) =>
          api.post("/production-process-types", {
            code: process.code,
            name: t(`templates.processNames.${process.code}`),
            sort_order: currentMaxOrder + (index + 1) * 10,
            icon: process.icon,
            color: process.color,
            active: true,
          })
        )
      );

      setTemplateModalOpen(false);
      await loadItems();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("templates.errors.apply")
      );
    } finally {
      setApplyingTemplate(false);
    }
  };

  return (
    <div className="pp-types-page">
      <section className="pp-types-hero">
        <div className="pp-types-hero__content">
          <div>
            <h1>{t("title")}</h1>
            <p>{t("subtitle")}</p>
          </div>

          <div className="pp-types-hero__actions">
            <button
              type="button"
              className="po-secondary-btn"
              onClick={() => setTemplateModalOpen(true)}
            >
              {t("templates.apply")}
            </button>

            <button type="button" className="po-primary-btn" onClick={openNewModal}>
              {t("new")}
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="po-inline-error">{error}</div> : null}

      {loading ? (
        <section className="df-pro-card">
          <p>{t("loading")}</p>
        </section>
      ) : sortedItems.length === 0 ? (
        <section className="df-pro-card">
          <p>{t("empty")}</p>
        </section>
      ) : (
        <div className="pp-types-grid">
          {sortedItems.map((item) => (
            <article
              key={item.id}
              draggable
              onDragStart={() => setDraggingId(item.id)}
              onDragEnd={() => setDraggingId(null)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingId) {
                  void reorderItems(draggingId, item.id);
                }
              }}
              className={`pp-type-card ${
                draggingId === item.id ? "pp-type-card--dragging" : ""
              }`}
            >
              <div className="pp-type-card__drag">
                <GripVertical size={18} strokeWidth={2.2} />
              </div>

              <div className="pp-type-card__top">
                <div className="pp-type-card__identity">
                  <div
                    className="pp-type-card__icon"
                    style={{ background: item.color || "#2f2940" }}
                  >
                    <ProcessIcon icon={item.icon} code={item.code} />
                  </div>

                  <div>
                    <h3 className="pp-type-card__title">{item.name}</h3>
                  </div>
                </div>

                <span
                  className={
                    item.active
                      ? "pp-type-status pp-type-status--active"
                      : "pp-type-status pp-type-status--inactive"
                  }
                >
                  {item.active ? t("active") : t("inactive")}
                </span>
              </div>

              <div className="pp-type-card__actions">
                <button
                  type="button"
                  className="po-secondary-btn"
                  onClick={() => openEditModal(item)}
                >
                  {t("edit")}
                </button>

                <button
                  type="button"
                  className="po-ghost-btn"
                  onClick={() => void toggleActive(item)}
                >
                  {item.active ? t("deactivate") : t("activate")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen ? (
        <div className="pp-modal-backdrop" role="presentation">
          <form className="pp-modal" onSubmit={saveProcess}>
            <div className="pp-modal__head">
              <div>
                <h2>{editing ? t("edit") : t("new")}</h2>
                <p>{t("workflowDescription")}</p>
              </div>

              <button type="button" className="po-ghost-btn" onClick={closeModal}>
                {t("close")}
              </button>
            </div>

            <div className="pp-form-grid">
              <div className="pp-form-field">
                <label>{t("fields.name")}</label>

                <input
                  value={form.name}
                  onChange={(event) => {
                    const nextName = event.target.value;

                    setForm((prev) => ({
                      ...prev,
                      name: nextName,
                      code: editing ? prev.code : normalizeCode(nextName),
                    }));
                  }}
                  placeholder={t("placeholder.name")}
                  required
                />
              </div>

              <div className="pp-form-field">
                <label>{t("fields.code")}</label>

                <input
                  value={form.code}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      code: normalizeCode(event.target.value),
                    }))
                  }
                  placeholder={t("placeholder.code")}
                  required
                />
              </div>

              <div className="pp-form-field--small pp-form-field--color">
                <label>{t("fields.sortOrder")}</label>

                <input
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      sort_order: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="pp-form-field--small">
                <label>{t("fields.color")}</label>
                <label className="pp-color-picker">
                  <span
                    className="pp-color-picker__preview"
                    style={{
                      background: form.color,
                    }}
                  />

                  <span className="pp-color-picker__value">
                    {form.color}
                  </span>

                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        color: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="pp-form-field">
                <label>{t("fields.icon")}</label>

                <select
                  value={form.icon}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      icon: event.target.value,
                    }))
                  }
                >
                  <option value="scissors">{t("icons.scissors")}</option>
                  <option value="shirt">{t("icons.shirt")}</option>
                  <option value="sparkles">{t("icons.sparkles")}</option>
                  <option value="gem">{t("icons.gem")}</option>
                  <option value="wand">{t("icons.wand")}</option>
                  <option value="badge-check">{t("icons.badgeCheck")}</option>
                  <option value="package">{t("icons.package")}</option>
                  <option value="needle">{t("icons.needle")}</option>
                </select>
              </div>

              <div className="pp-form-field">
                <label>{t("fields.status")}</label>

                <select
                  value={form.active ? "ACTIVE" : "INACTIVE"}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      active: event.target.value === "ACTIVE",
                    }))
                  }
                >
                  <option value="ACTIVE">{t("active")}</option>
                  <option value="INACTIVE">{t("inactive")}</option>
                </select>
              </div>

              <div className="pp-form-field--full">
                <label>{t("preview")}</label>

                <article className="pp-type-card" style={{ marginTop: 0 }}>
                  <div className="pp-type-card__top">
                    <div className="pp-type-card__identity">
                      <div
                        className="pp-type-card__icon"
                        style={{ background: form.color || "#2f2940" }}
                      >
                        <ProcessIcon icon={form.icon} code={form.code} />
                      </div>

                      <div>
                        <h3 className="pp-type-card__title">
                          {form.name || t("placeholder.nameFallback")}
                        </h3>

                        <div className="pp-type-card__code">
                          {normalizeCode(form.code) || t("placeholder.codeFallback")}
                        </div>
                      </div>
                    </div>

                    <span
                      className={
                        form.active
                          ? "pp-type-status pp-type-status--active"
                          : "pp-type-status pp-type-status--inactive"
                      }
                    >
                      {form.active ? t("active") : t("inactive")}
                    </span>
                  </div>

                  <div className="pp-type-card__meta">
                    <span>{t("orderLabel", { value: form.sort_order || 100 })}</span>
                  </div>
                </article>
              </div>
            </div>

            {error ? <div className="po-inline-error">{error}</div> : null}

            <div className="pp-modal__actions">
              <button
                type="button"
                className="po-secondary-btn"
                onClick={closeModal}
                disabled={saving}
              >
                {t("cancel")}
              </button>

              <button type="submit" className="po-primary-btn" disabled={saving}>
                {saving ? t("saving") : t("save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {templateModalOpen ? (
        <div className="pp-modal-backdrop" role="presentation">
          <div className="pp-modal">
            <div className="pp-modal__head">
              <div>
                <h2>{t("templates.title")}</h2>
                <p>{t("templates.subtitle")}</p>
              </div>

              <button
                type="button"
                className="po-ghost-btn"
                onClick={() => setTemplateModalOpen(false)}
                disabled={applyingTemplate}
              >
                {t("close")}
              </button>
            </div>

            <div className="pp-template-grid">
              {WORKFLOW_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`pp-template-card ${
                    selectedTemplateId === template.id ? "pp-template-card--active" : ""
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="pp-template-card__top">
                    <div>
                      <h3>{t(template.titleKey)}</h3>
                      <p>{t(template.descriptionKey)}</p>
                    </div>
                  </div>

                  <div className="pp-template-preview">
                    {template.processes.map((process) => {
                      const exists = existingCodes.has(process.code);

                      return (
                        <span key={process.code} className={exists ? "is-existing" : ""}>
                          {t(`templates.processNames.${process.code}`)} ·{" "}
                          {exists
                            ? t("templates.alreadyConfigured")
                            : t("templates.willBeAdded")}
                        </span>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>

            <div className="pp-modal__actions">
              <button
                type="button"
                className="po-secondary-btn"
                onClick={() => setTemplateModalOpen(false)}
                disabled={applyingTemplate}
              >
                {t("templates.cancel")}
              </button>

              <button
                type="button"
                className="po-primary-btn"
                onClick={() => void applyTemplate()}
                disabled={applyingTemplate}
              >
                {applyingTemplate
                  ? t("templates.applying")
                  : t("templates.applySelected")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

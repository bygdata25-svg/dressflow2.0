import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useFieldConfig } from "../hooks/useFieldConfig";
import "../styles/fabrics.css";

type FabricListItem = {
  id: string;
  name: string;
  fabric_type?: string | null;
  color?: string | null;
  total_stock_meters: number;
  total_rolls: number;
  largest_roll_length: number;
  photo_url?: string | null;
  notes?: string | null;
};

type RollListItem = {
  id: string;
  code: string;
  initial_length: number;
  current_length: number;
  status: string;
};

type FabricFormState = {
  name: string;
  fabric_type: string;
  color: string;
  notes: string;
};

function formatMeters(value?: number | null) {
  return `${Number(value || 0).toFixed(2)} m`;
}

function statusClass(status: string) {
  switch (status) {
    case "AVAILABLE":
      return "gf-badge gf-badge-green";
    case "RESERVED":
      return "gf-badge gf-badge-blue";
    case "USED":
      return "gf-badge gf-badge-default";
    case "EMPTY":
      return "gf-badge gf-badge-red";
    default:
      return "gf-badge gf-badge-default";
  }
}

function translateRollStatus(status: string, t: any) {
  return t(`rollStatus.${status}`, { defaultValue: status });
}

function resolvePhoto(photoUrl?: string | null) {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http://") || photoUrl.startsWith("https://")) return photoUrl;
  return `/${photoUrl.replace(/^\/+/, "")}`;
}

const initialForm: FabricFormState = {
  name: "",
  fabric_type: "",
  color: "",
  notes: "",
};

export default function FabricsPage() {
  const { t } = useTranslation("fabrics");
  const fc = useFieldConfig("fabric");

  const [fabrics, setFabrics] = useState<FabricListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedFabricId, setExpandedFabricId] = useState<string | null>(null);
  const [rollsByFabric, setRollsByFabric] = useState<Record<string, RollListItem[]>>({});
  const [loadingRollsId, setLoadingRollsId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<FabricFormState>(initialForm);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  const isFieldReadOnlyOnEdit = (fieldName: string) =>
    Boolean(fc.getUiProps(fieldName)?.read_only_on_edit);

  const isFieldDisabled = (fieldName: string) =>
    !fc.isEditable(fieldName) || (Boolean(editingId) && isFieldReadOnlyOnEdit(fieldName));

  const readOnlyHint = (
    <small style={{ display: "block", marginTop: 6, color: "#667085" }}>
      {t("form.readOnlyOnCreate")}
    </small>
  );

  async function loadFabrics() {
    try {
      setLoading(true);
      setError("");
      const res = await api.get<FabricListItem[]>("/fabrics");
      setFabrics(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.detail || t("messages.error"));
    } finally {
      setLoading(false);
    }
  }

  async function loadRolls(fabricId: string) {
    try {
      setLoadingRollsId(fabricId);
      const res = await api.get<RollListItem[]>(`/fabrics/${fabricId}/rolls`);
      setRollsByFabric((prev) => ({
        ...prev,
        [fabricId]: Array.isArray(res.data) ? res.data : [],
      }));
    } catch {
      setRollsByFabric((prev) => ({
        ...prev,
        [fabricId]: [],
      }));
    } finally {
      setLoadingRollsId(null);
    }
  }

  async function toggleFabricRows(fabricId: string) {
    if (expandedFabricId === fabricId) {
      setExpandedFabricId(null);
      return;
    }

    if (!rollsByFabric[fabricId]) {
      await loadRolls(fabricId);
    }

    setExpandedFabricId(fabricId);
  }

  function resetImageState() {
    setSelectedFile(null);
    setImagePreview("");
  }

  function openCreateModal() {
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
    resetImageState();
    setShowCreateModal(true);
  }

  function openEditModal(fabric: FabricListItem) {
    setEditingId(fabric.id);
    setForm({
      name: fabric.name || "",
      fabric_type: fabric.fabric_type || "",
      color: fabric.color || "",
      notes: fabric.notes || "",
    });
    setFormError("");
    setSelectedFile(null);
    setImagePreview(resolvePhoto(fabric.photo_url) || "");
    setShowCreateModal(true);
  }

  function closeModal() {
    setShowCreateModal(false);
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
    resetImageState();
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);

    if (!file) {
      setImagePreview(editingId ? imagePreview : "");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
  }

  async function saveFabric(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (fc.isRequired("name") && !form.name.trim()) {
      setFormError(t("form.requiredName"));
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const formData = new FormData();
      formData.append("name", form.name.trim());
      formData.append("fabric_type", form.fabric_type.trim() || "");
      formData.append("color", form.color.trim() || "");
      formData.append("notes", form.notes.trim() || "");

      if (selectedFile) {
        formData.append("file", selectedFile);
      }

      if (editingId) {
        await api.patch(`/fabrics/${editingId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await api.post("/fabrics", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      closeModal();
      await loadFabrics();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || t("form.error"));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadFabrics();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const filteredFabrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fabrics;

    const searchableFields = [
      fc.isListVisible("name") ? "name" : null,
      fc.isListVisible("color") ? "color" : null,
      fc.isListVisible("fabric_type") ? "fabric_type" : null,
    ].filter(Boolean) as Array<"name" | "color" | "fabric_type">;

    return fabrics.filter((fabric) =>
      searchableFields
        .map((field) => String(fabric[field] || ""))
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [fabrics, search, fc]);

  const showName = fc.isListVisible("name");
  const showFabricType = fc.isListVisible("fabric_type");
  const showColor = fc.isListVisible("color");
  const showTotalStock = fc.isListVisible("total_stock_meters");
  const showTotalRolls = fc.isListVisible("total_rolls");
  const showLargestRoll = fc.isListVisible("largest_roll_length");

  const detailColSpan =
    (showName ? 1 : 0) +
    (showFabricType ? 1 : 0) +
    (showColor ? 1 : 0) +
    (showTotalStock ? 1 : 0) +
    (showTotalRolls ? 1 : 0) +
    (showLargestRoll ? 1 : 0) +
    1;

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t("hero.eyebrow")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle">{t("hero.subtitle")}</p>
        </div>

        <div className="page-header-actions">
          <button className="gf-btn gf-btn-primary" onClick={openCreateModal}>
            {t("actions.new")}
          </button>

          <button className="gf-btn gf-btn-secondary" onClick={loadFabrics}>
            {t("actions.refresh")}
          </button>
        </div>
      </div>

      <div className="fabric-page-card">
        <div className="fabric-toolbar">
          <div className="fabric-toolbar-left">
            <input
              className="gf-input"
              type="text"
              placeholder={t("search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="fabric-toolbar-right">
            <div className="fabric-stat-pill">
              <span className="fabric-stat-pill-label">
                {t("stats.count", { count: filteredFabrics.length })}
              </span>
            </div>
          </div>
        </div>

        {loading || fc.loading ? (
          <div className="gf-empty-state">{t("messages.loading")}</div>
        ) : error ? (
          <div className="gf-alert gf-alert-error">{error}</div>
        ) : filteredFabrics.length === 0 ? (
          <div className="gf-empty-state">{t("messages.empty")}</div>
        ) : (
          <div className="table-wrap">
            <table className="fabrics-table">
              <thead>
                <tr>
                  {showName && <th>{t("fields.name")}</th>} 

                  {showFabricType && (
                    <th style={{ width: 160 }}>
                      {t("fields.fabricType")} 
                    </th>
                  )}

                  {showColor && (
                    <th style={{ width: 160 }}>
                      {t("fields.color")}
                    </th>
                  )}

                  {showTotalStock && (
                    <th style={{ width: 150 }}>
                      {t("fields.totalStock")}
                    </th>
                  )}

                  {showTotalRolls && (
                    <th style={{ width: 120 }}>
                      {t("fields.rolls")}
                    </th>
                  )}

                  {showLargestRoll && (
                    <th style={{ width: 170 }}>
                      {t("fields.largestRoll")}
                    </th>
                  )}

                  <th style={{ width: 110 }} />
                </tr>
              </thead>

              <tbody>
                {filteredFabrics.map((fabric) => {
                  const expanded = expandedFabricId === fabric.id;
                  const fabricRolls = rollsByFabric[fabric.id] || [];
                  const isLoadingRolls = loadingRollsId === fabric.id;
                  const photo = resolvePhoto(fabric.photo_url);

                  return (
                    <Fragment key={fabric.id}>
                      <tr
                        className={`fabric-main-row ${expanded ? "is-expanded" : ""}`}
                        onClick={() => void toggleFabricRows(fabric.id)}
                      >
                        {showName && (
                          <td>
                            <div
                              className="fabric-name-cell"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              {photo ? (
                                <div
                                  style={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    flexShrink: 0,
                                    border: "1px solid #e5e7eb",
                                    background: "#fff",
                                  }}
                                >
                                  <img
                                    src={photo}
                                    alt={fabric.name}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      display: "block",
                                      transition: "transform 220ms ease",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.transform = "scale(1.8)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.transform = "scale(1)";
                                    }}
                                  />
                                </div>
                              ) : (
                                <div
                                  style={{
                                    width: 50,
                                    height: 50,
                                    background: "#eee",
                                    borderRadius: 8,
                                    flexShrink: 0,
                                  }}
                                />
                              )}

                              <div className="fabric-name">{fabric.name}</div>
                            </div>
                          </td>
                        )}

                        {showFabricType && <td>{fabric.fabric_type || "—"}</td>}
                        {showColor && <td>{fabric.color || "—"}</td>}

                        {showTotalStock && (
                          <td>
                            <strong>{formatMeters(fabric.total_stock_meters)}</strong>
                          </td>
                        )}

                        {showTotalRolls && <td>{fabric.total_rolls}</td>}

                        {showLargestRoll && (
                          <td>{formatMeters(fabric.largest_roll_length)}</td>
                        )}

                        <td>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              justifyContent: "flex-end",
                            }}
                          >
                            <button
                              type="button"
                              className="expand-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(fabric);
                              }}
                              aria-label={t("actions.edit")}
                              title={t("actions.edit")}
                            >
                              ✏️
                            </button>

                            <button
                              type="button"
                              className="expand-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                void toggleFabricRows(fabric.id);
                              }}
                              aria-label={
                                expanded ? t("actions.collapse") : t("actions.expand")
                              }
                              title={
                                expanded
                                  ? t("actions.collapseRolls")
                                  : t("actions.expandRolls")
                              }
                            >
                              {expanded ? "−" : "+"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="fabric-rolls-row">
                          <td colSpan={detailColSpan}>
                            <div className="fabric-rolls-panel">
                              <div className="fabric-rolls-panel-header">
                                <div>
                                  <h3>{t("rolls.title", { name: fabric.name })}</h3>
                                  <p>
                                    {t("rolls.totalAvailable")}{" "}
                                    <strong>
                                      {formatMeters(fabric.total_stock_meters)}
                                    </strong>
                                  </p>
                                </div>
                              </div>

                              {isLoadingRolls ? (
                                <div className="gf-empty-state">
                                  {t("messages.loadingRolls")}
                                </div>
                              ) : fabricRolls.length === 0 ? (
                                <div className="gf-empty-state">
                                  {t("messages.noRolls")}
                                </div>
                              ) : (
                                <div className="subtable-wrap">
                                  <table className="gf-subtable">
                                    <thead>
                                      <tr>
                                        <th style={{ width: 200 }}>
                                          {t("rolls.columns.code")}
                                        </th>
                                        <th style={{ width: 180 }}>
                                          {t("rolls.columns.current")}
                                        </th>
                                        <th style={{ width: 180 }}>
                                          {t("rolls.columns.initial")}
                                        </th>
                                        <th style={{ width: 180 }}>
                                          {t("rolls.columns.status")}
                                        </th>
                                      </tr>
                                    </thead>

                                    <tbody>
                                      {fabricRolls.map((roll) => (
                                        <tr key={roll.id}>
                                          <td>
                                            <strong>{roll.code}</strong>
                                          </td>
                                          <td>{formatMeters(roll.current_length)}</td>
                                          <td>{formatMeters(roll.initial_length)}</td>
                                          <td>
                                            <span className={statusClass(roll.status)}>
                                              {translateRollStatus(roll.status, t)}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="gf-modal-backdrop" onClick={closeModal}>
          <div
            className="gf-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 860 }}
          >
            <div className="gf-modal-header">
              <h2>{editingId ? t("form.edit") : t("form.create")}</h2>

              <button type="button" className="gf-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <form className="gf-form" onSubmit={saveFabric}>
              <div className="gf-form-grid">
                {fc.isFormVisible("name") && (
                  <div>
                    <label>
                      {t("fields.name")}
                      {fc.isRequired("name") ? " *" : ""}
                    </label>

                    <input
                      type="text"
                      value={form.name}
                      minLength={fc.getValidationRules("name")?.min_length}
                      maxLength={fc.getValidationRules("name")?.max_length}
                      pattern={fc.getValidationRules("name")?.pattern}
                      placeholder={fc.getUiProps("name")?.placeholder || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required={fc.isRequired("name")}
                      disabled={isFieldDisabled("name")}
                    />

                    {Boolean(editingId) && isFieldReadOnlyOnEdit("name")
                      ? readOnlyHint
                      : null}
                  </div>
                )}

                {fc.isFormVisible("fabric_type") && (
                  <div>
                    <label>{t("fields.fabricType")}</label>

                    <input
                      type="text"
                      value={form.fabric_type}
                      minLength={fc.getValidationRules("fabric_type")?.min_length}
                      maxLength={fc.getValidationRules("fabric_type")?.max_length}
                      pattern={fc.getValidationRules("fabric_type")?.pattern}
                      placeholder={fc.getUiProps("fabric_type")?.placeholder || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          fabric_type: e.target.value,
                        }))
                      }
                      disabled={isFieldDisabled("fabric_type")}
                    />

                    {Boolean(editingId) && isFieldReadOnlyOnEdit("fabric_type")
                      ? readOnlyHint
                      : null}
                  </div>
                )}

                {fc.isFormVisible("color") && (
                  <div>
                    <label>{t("fields.color")}</label>

                    <input
                      type="text"
                      value={form.color}
                      minLength={fc.getValidationRules("color")?.min_length}
                      maxLength={fc.getValidationRules("color")?.max_length}
                      pattern={fc.getValidationRules("color")?.pattern}
                      placeholder={fc.getUiProps("color")?.placeholder || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                      disabled={isFieldDisabled("color")}
                    />

                    {Boolean(editingId) && isFieldReadOnlyOnEdit("color")
                      ? readOnlyHint
                      : null}
                  </div>
                )}

                <div className="gf-form-grid-full">
                  <label>{t("form.image")}</label>
                    <div className="df-file-upload">
                      <input
                        id="fabric-file"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                      />

                      <label htmlFor="fabric-file" className="df-file-upload-btn">
                        {t("form.selectFile")}
                      </label>

                      <span className="df-file-upload-name">
                        {selectedFile
                          ? selectedFile.name
                          : t("form.noFileSelected")}
                      </span>
                    </div>
                </div>

                {imagePreview ? (
                  <div className="gf-form-grid-full">
                    <label>{t("form.preview")}</label>

                    <img
                      src={imagePreview}
                      alt={t("form.previewAlt")}
                      style={{
                        width: 140,
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 18,
                        border: "1px solid #ece6f1",
                      }}
                    />
                  </div>
                ) : null}

                {fc.isFormVisible("notes") && (
                  <div className="gf-form-grid-full">
                    <label>{t("fields.notes")}</label>

                    <textarea
                      rows={4}
                      value={form.notes}
                      minLength={fc.getValidationRules("notes")?.min_length}
                      maxLength={fc.getValidationRules("notes")?.max_length}
                      placeholder={fc.getUiProps("notes")?.placeholder || ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      disabled={isFieldDisabled("notes")}
                    />

                    {Boolean(editingId) && isFieldReadOnlyOnEdit("notes")
                      ? readOnlyHint
                      : null}
                  </div>
                )}
              </div>

              {formError ? (
                <div className="gf-alert gf-alert-error">{formError}</div>
              ) : null}

              <div className="gf-modal-actions">
                <button
                  type="button"
                  className="gf-btn gf-btn-secondary"
                  onClick={closeModal}
                >
                  {t("form.cancel")}
                </button>

                <button type="submit" className="gf-btn gf-btn-primary" disabled={saving}>
                  {saving
                    ? t("form.saving")
                    : editingId
                    ? t("form.update")
                    : t("form.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

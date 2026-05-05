import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";

type PreviewRow = {
  row_number: number;
  codigo?: string | null;
  fabric_name?: string | null;
  supplier_name?: string | null;
  supplier_created?: boolean;
  fabric_created?: boolean;
  pieces_detected?: number;
  has_scraps?: boolean;
};

type ImportStats = {
  total_rows: number;
  created_suppliers: number;
  reused_suppliers: number;
  created_fabrics: number;
  reused_fabrics: number;
  created_rolls: number;
  skipped_rolls: number;
  errors_count: number;
};

type ImportError = {
  row_number: number;
  codigo?: string | null;
  error: string;
};

type ImportResponse = {
  ok?: boolean;
  dry_run: boolean;
  import_batch?: string | null;
  stats: ImportStats;
  errors: ImportError[];
  preview: PreviewRow[];
  message?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
};

export default function FabricImportModal({ open, onClose, onImported }: Props) {
  const { t } = useTranslation(["imports", "common"]);

  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportResponse | null>(null);
  const [executeData, setExecuteData] = useState<ImportResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canExecute = useMemo(
    () => !!file && !!previewData && !loadingExecute,
    [file, previewData, loadingExecute]
  );

  if (!open) return null;

  function resetState() {
    setFile(null);
    setPreviewData(null);
    setExecuteData(null);
    setLoadingPreview(false);
    setLoadingExecute(false);
    setErrorMsg(null);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function doPreview() {
    if (!file) {
      setErrorMsg(t("imports:modal.errors.noFilePreview"));
      return;
    }

    setLoadingPreview(true);
    setErrorMsg(null);
    setPreviewData(null);
    setExecuteData(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await api.post("/fabric-import/preview", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setPreviewData(res.data);
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("imports:modal.errors.preview")
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function doExecute() {
    if (!file) {
      setErrorMsg(t("imports:modal.errors.noFileExecute"));
      return;
    }

    setLoadingExecute(true);
    setErrorMsg(null);
    setExecuteData(null);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("confirm", "true");

      const res = await api.post("/fabric-import/execute", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setExecuteData(res.data);

      if (res.data?.ok) {
        onImported?.();
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail?.message ||
          err?.response?.data?.detail ||
          t("imports:modal.errors.execute")
      );
    } finally {
      setLoadingExecute(false);
    }
  }

  const stats = executeData?.stats || previewData?.stats;
  const errors = executeData?.errors || previewData?.errors || [];
  const previewRows = previewData?.preview || [];

  return (
    <div className="df-modal-backdrop" onClick={handleClose}>
      <div
        className="df-modal df-modal-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="df-modal-header">
          <div>
            <h2>{t("imports:modal.title")}</h2>
            <p className="df-modal-subtitle">
              {t("imports:modal.subtitle")}
            </p>
          </div>

          <button className="df-icon-btn" onClick={handleClose} type="button">
            ✕
          </button>
        </div>

        <div className="df-modal-body">
          <div className="df-import-card">
            <div className="df-import-upload-row">
              <div className="df-import-filebox">
                <label className="df-import-label">
                  {t("imports:modal.file.label")}
                </label>

                <div
                  className="df-file-upload"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    id="fabric-import-file"
                    type="file"
                    accept=".xlsx,.csv,.ods"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const selected = e.target.files?.[0] || null;
                      setFile(selected);
                      setPreviewData(null);
                      setExecuteData(null);
                      setErrorMsg(null);
                    }}
                  />

                  <label
                    htmlFor="fabric-import-file"
                    className="gf-btn gf-btn-secondary"
                    style={{ cursor: "pointer" }}
                  >
                    {t("imports:modal.file.select")}
                  </label>

                  <span
                    className="df-file-name"
                    style={{
                      fontSize: 13,
                      color: "#667085",
                    }}
                  >
                    {file ? file.name : t("imports:modal.file.empty")}
                  </span>
                </div>

                <small className="df-import-help">
                  {t("imports:modal.file.formats")}
                </small>
              </div>

              <div className="df-import-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={doPreview}
                  disabled={!file || loadingPreview || loadingExecute}
                >
                  {loadingPreview
                    ? t("imports:modal.actions.previewLoading")
                    : t("imports:modal.actions.preview")}
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={doExecute}
                  disabled={!canExecute}
                >
                  {loadingExecute
                    ? t("imports:modal.actions.importing")
                    : t("imports:modal.actions.confirm")}
                </button>
              </div>
            </div>

            {file && (
              <div className="df-import-selected-file">
                <strong>{t("imports:modal.file.selected")}:</strong> {file.name}
              </div>
            )}

            {errorMsg && <div className="df-import-error">{errorMsg}</div>}
          </div>

          {stats && (
            <div className="df-import-stats-grid">
              <div className="df-stat-card">
                <span>{t("imports:modal.stats.rows")}</span>
                <strong>{stats.total_rows}</strong>
              </div>
              <div className="df-stat-card">
                <span>{t("imports:modal.stats.newSuppliers")}</span>
                <strong>{stats.created_suppliers}</strong>
              </div>
              <div className="df-stat-card">
                <span>{t("imports:modal.stats.newFabrics")}</span>
                <strong>{stats.created_fabrics}</strong>
              </div>
              <div className="df-stat-card">
                <span>{t("imports:modal.stats.newRolls")}</span>
                <strong>{stats.created_rolls}</strong>
              </div>
              <div className="df-stat-card">
                <span>{t("imports:modal.stats.skippedRolls")}</span>
                <strong>{stats.skipped_rolls}</strong>
              </div>
              <div className="df-stat-card">
                <span>{t("imports:modal.stats.errors")}</span>
                <strong>{stats.errors_count}</strong>
              </div>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="df-import-section">
              <div className="df-section-head">
                <h3>{t("imports:modal.preview.title")}</h3>
                <span>{t("imports:modal.preview.subtitle")}</span>
              </div>

              <div className="df-table-wrap">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>{t("imports:modal.preview.columns.row")}</th>
                      <th>{t("imports:modal.preview.columns.code")}</th>
                      <th>{t("imports:modal.preview.columns.fabric")}</th>
                      <th>{t("imports:modal.preview.columns.supplier")}</th>
                      <th>{t("imports:modal.preview.columns.pieces")}</th>
                      <th>{t("imports:modal.preview.columns.newSupplier")}</th>
                      <th>{t("imports:modal.preview.columns.newFabric")}</th>
                      <th>{t("imports:modal.preview.columns.scraps")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={`${row.row_number}-${row.codigo || row.fabric_name || "row"}`}>
                        <td>{row.row_number}</td>
                        <td>{row.codigo || "-"}</td>
                        <td>{row.fabric_name || "-"}</td>
                        <td>{row.supplier_name || "-"}</td>
                        <td>{row.pieces_detected ?? 0}</td>
                        <td>
                          {row.supplier_created
                            ? t("common:yes", { defaultValue: "Yes" })
                            : t("common:no", { defaultValue: "No" })}
                        </td>
                        <td>
                          {row.fabric_created
                            ? t("common:yes", { defaultValue: "Yes" })
                            : t("common:no", { defaultValue: "No" })}
                        </td>
                        <td>
                          {row.has_scraps
                            ? t("common:yes", { defaultValue: "Yes" })
                            : t("common:no", { defaultValue: "No" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <div className="df-import-section">
              <div className="df-section-head">
                <h3>{t("imports:modal.errors.title")}</h3>
              </div>

              <div className="df-table-wrap">
                <table className="df-table">
                  <thead>
                    <tr>
                      <th>{t("imports:modal.errors.columns.row")}</th>
                      <th>{t("imports:modal.errors.columns.code")}</th>
                      <th>{t("imports:modal.errors.columns.error")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((err, idx) => (
                      <tr key={`${err.row_number}-${idx}`}>
                        <td>{err.row_number}</td>
                        <td>{err.codigo || "-"}</td>
                        <td>{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {executeData?.ok && (
            <div className="df-import-success">
              {t("imports:modal.success")}
            </div>
          )}
        </div>

        <div className="df-modal-footer">
          <button type="button" className="btn btn-ghost" onClick={handleClose}>
            {t("imports:modal.actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}

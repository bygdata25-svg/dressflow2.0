import { useState } from "react";
import { useTranslation } from "react-i18next";
import FabricImportModal from "../components/fabrics/FabricImportModal";

export default function ImportSettingsPage() {
  const { t } = useTranslation("imports");

  const [openFabricImport, setOpenFabricImport] = useState(false);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">{t("hero.eyebrow")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle">{t("hero.subtitle")}</p>
        </div>
      </div>

      <div className="df-cards-grid">
        <div className="df-card">
          <h3>{t("cards.fabrics.title")}</h3>
          <p>{t("cards.fabrics.description")}</p>

          <button
            className="gf-btn gf-btn-primary"
            onClick={() => setOpenFabricImport(true)}
          >
            {t("cards.fabrics.action")}
          </button>
        </div>
      </div>

      <FabricImportModal
        open={openFabricImport}
        onClose={() => setOpenFabricImport(false)}
        onImported={() => {
          setOpenFabricImport(false);
        }}
      />
    </div>
  );
}

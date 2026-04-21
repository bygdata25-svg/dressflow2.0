import { useTranslation } from "react-i18next";

type ViewToggleProps = {
  value: "table" | "grid";
  onChange: (value: "table" | "grid") => void;
};

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const { t } = useTranslation("common");

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => onChange("grid")}
        style={{
          opacity: value === "grid" ? 1 : 0.7
        }}
      >
        {t("viewMode.grid")}
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        style={{
          opacity: value === "table" ? 1 : 0.7
        }}
      >
        {t("viewMode.table")}
      </button>
    </div>
  );
}

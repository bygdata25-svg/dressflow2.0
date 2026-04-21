import { useTranslation } from "react-i18next";
import { resolveMediaUrl } from "../../lib/media";

type Dress = {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  size?: string | null;
  color?: string | null;
  status: string;
  main_image_url?: string | null;
  capsule_id?: string | null;
  capsule_name?: string | null;
};

type DressCardProps = {
  dress: Dress;
};

export function DressCard({ dress }: DressCardProps) {
  const { t } = useTranslation(["common", "dresses"]);
  const imageUrl = resolveMediaUrl(dress.main_image_url);

  return (
    <article
      style={{
        border: "1px solid var(--df-border, #e5e7eb)",
        borderRadius: 22,
        background: "#ffffff",
        padding: 14,
        overflow: "hidden",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: 320,
          maxHeight: 320,
          borderRadius: 18,
          overflow: "hidden",
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          marginBottom: 14,
          position: "relative",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={dress.name}
            style={{
              width: "100%",
              height: "100%",
              minWidth: 0,
              minHeight: 0,
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6b7280",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {t("dresses:images.noImage")}
          </div>
        )}
      </div>

      <div>
        <div style={{ marginBottom: 10 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              lineHeight: 1.2,
              fontWeight: 800,
              color: "var(--df-text-strong, #111827)",
            }}
          >
            {dress.name}
          </h3>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className={`df-status-badge df-status-badge--${dress.status.toLowerCase()}`}>
              {t(`dresses:status.${dress.status}`)}
            </span>

            {dress.capsule_name && (
              <span className="df-capsule-badge">{dress.capsule_name}</span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div>
            <small style={{ display: "block", color: "#6b7280", marginBottom: 4 }}>
              {t("dresses:fields.code")}
            </small>
            <strong style={{ color: "var(--df-text-strong, #111827)" }}>{dress.code}</strong>
          </div>

          <div>
            <small style={{ display: "block", color: "#6b7280", marginBottom: 4 }}>
              {t("dresses:fields.color")}
            </small>
            <strong style={{ color: "var(--df-text-strong, #111827)" }}>
              {dress.color || "-"}
            </strong>
          </div>

          <div>
            <small style={{ display: "block", color: "#6b7280", marginBottom: 4 }}>
              {t("dresses:fields.size")}
            </small>
            <strong style={{ color: "var(--df-text-strong, #111827)" }}>
              {dress.size || "-"}
            </strong>
          </div>
        </div>
      </div>
    </article>
  );
}

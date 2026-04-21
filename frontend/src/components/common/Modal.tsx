import { useEffect, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
};

export function Modal({
  open,
  title,
  onClose,
  children,
  width = "min(900px, 100%)",
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.50)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width,
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          borderRadius: 28,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,247,250,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 40px 100px rgba(15, 23, 42, 0.28)",
          padding: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            padding: "22px 28px",
            borderBottom: "1px solid rgba(229,231,235,0.95)",
            position: "sticky",
            top: 0,
            background: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 2,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "var(--df-text-strong, #111827)",
            }}
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              border: "1px solid rgba(209,213,219,0.95)",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              color: "#111827",
              boxShadow: "0 10px 22px rgba(15, 23, 42, 0.08)",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

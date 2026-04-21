import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fullWidth?: boolean;
};

function getBaseStyle(fullWidth?: boolean): CSSProperties {
  return {
    height: 40,
    padding: "0 18px",
    borderRadius: 14,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    transition: "all 180ms ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: fullWidth ? "100%" : undefined,
    whiteSpace: "nowrap",
  };
}

export function PrimaryButton({
  children,
  style,
  fullWidth,
  disabled,
  type = "button",
  ...props
}: BaseButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...getBaseStyle(fullWidth),
        border: "1px solid #0f172a",
        background: disabled ? "#94a3b8" : "#0f172a",
        color: "#ffffff",
        boxShadow: disabled ? "none" : "0 10px 24px rgba(15, 23, 42, 0.16)",
        opacity: disabled ? 0.8 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  style,
  fullWidth,
  disabled,
  type = "button",
  ...props
}: BaseButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...getBaseStyle(fullWidth),
        border: "1px solid #d7dce5",
        background: "#ffffff",
        color: "#111827",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  style,
  fullWidth,
  disabled,
  type = "button",
  ...props
}: BaseButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      style={{
        ...getBaseStyle(fullWidth),
        height: 36,
        padding: "0 14px",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
        background: "#ffffff",
        color: "#111827",
        fontSize: 14,
        fontWeight: 600,
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}

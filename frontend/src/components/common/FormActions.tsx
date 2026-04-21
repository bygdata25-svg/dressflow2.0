import { PrimaryButton, SecondaryButton } from "./buttons";

type FormActionsProps = {
  saving?: boolean;
  submitLabel: string;
  onCancel?: () => void;
  onClear?: () => void;
};

export function FormActions({
  saving = false,
  submitLabel,
  onCancel,
  onClear,
}: FormActionsProps) {
  return (
    <div
      style={{
        gridColumn: "1 / -1",
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        flexWrap: "wrap",
        paddingTop: 4,
      }}
    >
      {onClear && (
        <SecondaryButton type="button" onClick={onClear} disabled={saving}>
          Limpiar
        </SecondaryButton>
      )}

      {onCancel && (
        <SecondaryButton type="button" onClick={onCancel} disabled={saving}>
          Cancelar
        </SecondaryButton>
      )}

      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Guardando..." : submitLabel}
      </PrimaryButton>
    </div>
  );
}

import type { ReactNode } from "react";
import type { FieldConfig } from "../../hooks/useFieldConfig";

export type DynamicSelectOption = {
  value: string;
  label: string;
};

type DynamicFormProps<TValues extends Record<string, any>> = {
  fields: FieldConfig[];
  values: TValues;
  onChange: <K extends keyof TValues>(field: K, value: TValues[K]) => void;
  selectOptions?: Record<string, DynamicSelectOption[]>;
  fieldOverrides?: Partial<Record<keyof TValues | string, ReactNode>>;
  columns?: number;
  isEditing?: boolean;
};

function isFieldDisabled(field: FieldConfig, isEditing: boolean) {
  const ui = field.ui_props || {};
  if (!field.editable) return true;
  if (isEditing && ui.read_only_on_edit === true) return true;
  return false;
}

function renderDefaultInput<TValues extends Record<string, any>>(
  field: FieldConfig,
  values: TValues,
  onChange: <K extends keyof TValues>(field: K, value: TValues[K]) => void,
  selectOptions: Record<string, DynamicSelectOption[]> | undefined,
  isEditing: boolean
) {
  const fieldName = field.field_name as keyof TValues;
  const value = values[fieldName];

  const rules = field.validation_rules || {};
  const ui = field.ui_props || {};

  const disabled = isFieldDisabled(field, isEditing);

  const commonProps = {
    disabled,
    required: field.required,
  };

  if (field.field_type === "textarea") {
    return (
      <textarea
        rows={4}
        value={value ?? ""}
        onChange={(e) => onChange(fieldName, e.target.value as TValues[keyof TValues])}
        minLength={rules.min_length}
        maxLength={rules.max_length}
        placeholder={ui.placeholder || ""}
        {...commonProps}
      />
    );
  }

  if (field.field_type === "select") {
    const options = selectOptions?.[field.field_name] || [];
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(fieldName, e.target.value as TValues[keyof TValues])}
        {...commonProps}
      >
        <option value="">{ui.placeholder || "Seleccionar"}</option>
        {options.map((opt) => (
          <option key={`${field.field_name}-${opt.value}`} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.field_type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(fieldName, e.target.checked as TValues[keyof TValues])}
        disabled={disabled}
      />
    );
  }

  if (field.field_type === "number" || field.field_type === "virtual_number") {
    return (
      <input
        type="number"
        step={rules.step ?? "any"}
        min={rules.min_value}
        max={rules.max_value}
        value={value ?? ""}
        onChange={(e) => onChange(fieldName, e.target.value as TValues[keyof TValues])}
        placeholder={ui.placeholder || ""}
        {...commonProps}
      />
    );
  }

  if (field.field_type === "date") {
    return (
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(fieldName, e.target.value as TValues[keyof TValues])}
        placeholder={ui.placeholder || ""}
        {...commonProps}
      />
    );
  }

  if (field.field_type === "email") {
    return (
      <input
        type="email"
        value={value ?? ""}
        onChange={(e) => onChange(fieldName, e.target.value as TValues[keyof TValues])}
        minLength={rules.min_length}
        maxLength={rules.max_length}
        pattern={rules.pattern}
        placeholder={ui.placeholder || ""}
        {...commonProps}
      />
    );
  }

  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange(fieldName, e.target.value as TValues[keyof TValues])}
      minLength={rules.min_length}
      maxLength={rules.max_length}
      pattern={rules.pattern}
      placeholder={ui.placeholder || ""}
      {...commonProps}
    />
  );
}

export function DynamicForm<TValues extends Record<string, any>>({
  fields,
  values,
  onChange,
  selectOptions,
  fieldOverrides,
  isEditing = false,
}: DynamicFormProps<TValues>) {
  const visibleFields = fields
    .filter((f) => f.visible && f.form_visible)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="gf-form-grid">
      {visibleFields.map((field) => {
        const override = fieldOverrides?.[field.field_name];
        const isTextarea = field.field_type === "textarea";
        const ui = field.ui_props || {};
        const disabled = isFieldDisabled(field, isEditing);

        return (
          <div
            key={field.field_name}
            className={isTextarea ? "gf-form-grid-full" : undefined}
          >
            <label>
              {field.label}
              {field.required ? " *" : ""}
            </label>

            {override ??
              renderDefaultInput(field, values, onChange, selectOptions, isEditing)}

            {ui.read_only_on_edit && isEditing ? (
              <small style={{ display: "block", marginTop: 6, color: "#667085" }}>
                Solo editable al crear.
              </small>
            ) : null}

            {field.help_text ? (
              <small style={{ display: "block", marginTop: 6, color: "#667085" }}>
                {field.help_text}
              </small>
            ) : null}

            {disabled && !ui.read_only_on_edit ? (
              <small style={{ display: "block", marginTop: 6, color: "#98a2b3" }}>
                Campo no editable.
              </small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

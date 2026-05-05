import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
  i18nNamespace?: string;
};

function isFieldDisabled(field: FieldConfig, isEditing: boolean) {
  const ui = field.ui_props || {};

  if (!field.editable) return true;
  if (isEditing && ui.read_only_on_edit === true) return true;

  return false;
}

function translateFieldLabel(
  t: (key: string, options?: any) => string,
  field: FieldConfig,
  i18nNamespace?: string
) {
  if (i18nNamespace) {
    return t(`${i18nNamespace}:form.fields.${field.field_name}`, {
      defaultValue: field.label || field.field_name,
    });
  }

  if (field.label?.includes(":")) {
    return t(field.label, {
      defaultValue: field.label,
    });
  }

  return field.label || field.field_name;
}

function translateFieldPlaceholder(
  t: (key: string, options?: any) => string,
  field: FieldConfig,
  i18nNamespace?: string
) {
  const ui = field.ui_props || {};
  const rawPlaceholder = ui.placeholder ? String(ui.placeholder) : "";

  if (i18nNamespace) {
    return t(`${i18nNamespace}:form.placeholders.${field.field_name}`, {
      defaultValue: rawPlaceholder,
    });
  }

  if (rawPlaceholder.includes(":")) {
    return t(rawPlaceholder, {
      defaultValue: rawPlaceholder,
    });
  }

  return rawPlaceholder;
}

function translateHelpText(
  t: (key: string, options?: any) => string,
  field: FieldConfig
) {
  const helpText = field.help_text ? String(field.help_text) : "";

  if (!helpText) return null;

  if (helpText.includes(":")) {
    return t(helpText, {
      defaultValue: helpText,
    });
  }

  return helpText;
}

function renderDefaultInput<TValues extends Record<string, any>>(
  field: FieldConfig,
  values: TValues,
  onChange: <K extends keyof TValues>(field: K, value: TValues[K]) => void,
  selectOptions: Record<string, DynamicSelectOption[]> | undefined,
  isEditing: boolean,
  t: (key: string, options?: any) => string,
  i18nNamespace?: string
) {
  const fieldName = field.field_name as keyof TValues;
  const value = values[fieldName];

  const rules = field.validation_rules || {};
  const disabled = isFieldDisabled(field, isEditing);
  const placeholder = translateFieldPlaceholder(t, field, i18nNamespace);

  const commonProps = {
    disabled,
    required: field.required,
  };

  if (field.field_type === "textarea") {
    return (
      <textarea
        rows={4}
        value={value ?? ""}
        onChange={(e) =>
          onChange(fieldName, e.target.value as TValues[keyof TValues])
        }
        minLength={rules.min_length}
        maxLength={rules.max_length}
        placeholder={placeholder}
        {...commonProps}
      />
    );
  }

  if (field.field_type === "select") {
    const options = selectOptions?.[field.field_name] || [];

    return (
      <select
        value={value ?? ""}
        onChange={(e) =>
          onChange(fieldName, e.target.value as TValues[keyof TValues])
        }
        {...commonProps}
      >
        <option value="">
          {placeholder ||
            t("common:actions.select", {
              defaultValue: "Select",
            })}
        </option>

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
        onChange={(e) =>
          onChange(fieldName, e.target.checked as TValues[keyof TValues])
        }
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
        onChange={(e) =>
          onChange(fieldName, e.target.value as TValues[keyof TValues])
        }
        placeholder={placeholder}
        {...commonProps}
      />
    );
  }

  if (field.field_type === "date") {
    return (
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) =>
          onChange(fieldName, e.target.value as TValues[keyof TValues])
        }
        placeholder={placeholder}
        {...commonProps}
      />
    );
  }

  if (field.field_type === "email") {
    return (
      <input
        type="email"
        value={value ?? ""}
        onChange={(e) =>
          onChange(fieldName, e.target.value as TValues[keyof TValues])
        }
        minLength={rules.min_length}
        maxLength={rules.max_length}
        pattern={rules.pattern}
        placeholder={placeholder}
        {...commonProps}
      />
    );
  }

  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) =>
        onChange(fieldName, e.target.value as TValues[keyof TValues])
      }
      minLength={rules.min_length}
      maxLength={rules.max_length}
      pattern={rules.pattern}
      placeholder={placeholder}
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
  i18nNamespace,
}: DynamicFormProps<TValues>) {
  const { t } = useTranslation();

  const visibleFields = fields
    .filter((field) => field.visible && field.form_visible)
    .sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="gf-form-grid">
      {visibleFields.map((field) => {
        const override = fieldOverrides?.[field.field_name];
        const isTextarea = field.field_type === "textarea";
        const ui = field.ui_props || {};
        const disabled = isFieldDisabled(field, isEditing);

        const translatedLabel = translateFieldLabel(t, field, i18nNamespace);
        const translatedHelpText = translateHelpText(t, field);

        return (
          <div
            key={field.field_name}
            className={isTextarea ? "gf-form-grid-full" : undefined}
          >
            <label>
              {translatedLabel}
              {field.required ? " *" : ""}
            </label>

            {override ??
              renderDefaultInput(
                field,
                values,
                onChange,
                selectOptions,
                isEditing,
                t,
                i18nNamespace
              )}

            {ui.read_only_on_edit && isEditing ? (
              <small
                style={{
                  display: "block",
                  marginTop: 6,
                  color: "#667085",
                }}
              >
                {t("common:states.readOnlyOnEdit", {
                  defaultValue: "Only editable on creation.",
                })}
              </small>
            ) : null}

            {translatedHelpText ? (
              <small
                style={{
                  display: "block",
                  marginTop: 6,
                  color: "#667085",
                }}
              >
                {translatedHelpText}
              </small>
            ) : null}

            {disabled && !ui.read_only_on_edit ? (
              <small
                style={{
                  display: "block",
                  marginTop: 6,
                  color: "#98a2b3",
                }}
              >
                {t("common:states.notEditable", {
                  defaultValue: "This field is not editable.",
                })}
              </small>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

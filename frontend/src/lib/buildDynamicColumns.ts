import type { ReactNode } from "react";
import i18n from "../i18n";
import { type DataGridColumn } from "../components/data-grid/DataGrid";
import type { FieldConfig } from "../hooks/useFieldConfig";

type BuildDynamicColumnsParams<T extends Record<string, any>> = {
  fields: FieldConfig[];
  renderers?: Partial<Record<string, (row: T) => ReactNode>>;
  includeActions?: DataGridColumn<T>;
  i18nNamespace?: string;
};

function translateColumnLabel(field: FieldConfig, i18nNamespace?: string) {
  const label = String(field.label || "");

  if (label.includes(":")) {
    return i18n.t(label, { defaultValue: label });
  }

  if (i18nNamespace) {
    return i18n.t(`${i18nNamespace}:form.fields.${field.field_name}`, {
      defaultValue: label || field.field_name,
    });
  }

  return label || field.field_name;
}

export function buildDynamicColumns<T extends Record<string, any>>({
  fields,
  renderers,
  includeActions,
  i18nNamespace,
}: BuildDynamicColumnsParams<T>): DataGridColumn<T>[] {
  const columns: DataGridColumn<T>[] = fields
    .filter((field) => field.visible && field.list_visible)
    .sort((a, b) => a.order_index - b.order_index)
    .map((field) => ({
      key: field.field_name,
      label: translateColumnLabel(field, i18nNamespace),
      render: (row: T) => {
        const customRenderer = renderers?.[field.field_name];

        if (customRenderer) {
          return customRenderer(row);
        }

        const value = row[field.field_name];

        if (value === null || value === undefined || value === "") {
          return "—";
        }

        return String(value);
      },
    }));

  if (includeActions) {
    columns.push(includeActions);
  }

  return columns;
}

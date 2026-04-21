import type { DataGridColumn } from "../components/data-grid/DataGrid";

export type FieldConfig = {
  field_name: string;
  label: string;
  field_type: string;
  visible: boolean;
  list_visible: boolean;
  form_visible: boolean;
  required: boolean;
  editable: boolean;
  order_index: number;
};

type RendererMap<T> = Record<string, (row: T) => React.ReactNode>;

type BuildColumnsParams<T> = {
  fields: FieldConfig[];
  renderers: RendererMap<T>;
  includeActions?: DataGridColumn<T> | null;
};

export function buildDynamicColumns<T>({
  fields,
  renderers,
  includeActions = null,
}: BuildColumnsParams<T>): DataGridColumn<T>[] {
  const visibleFields = fields
    .filter((f) => f.visible && f.list_visible)
    .sort((a, b) => a.order_index - b.order_index);

  const columns: DataGridColumn<T>[] = visibleFields
    .filter((field) => renderers[field.field_name])
    .map((field) => ({
      key: field.field_name,
      label: field.label,
      render: renderers[field.field_name],
    }));

  if (includeActions) {
    columns.push(includeActions);
  }

  return columns;
}

import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export type FieldConfig = {
  field_name: string;
  label: string;
  field_type: string;
  visible: boolean;
  required: boolean;
  editable: boolean;
  list_visible: boolean;
  form_visible: boolean;
  order_index: number;
  help_text?: string | null;
  validation_rules?: Record<string, any> | null;
  ui_props?: Record<string, any> | null;
};

const DEFAULT_SUPPLIER_FIELDS: FieldConfig[] = [
  {
    field_name: "name",
    label: "Nombre",
    field_type: "text",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 1,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "supplier_code",
    label: "Código",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 2,
    help_text: null,
    validation_rules: { max_length: 40 },
    ui_props: { placeholder: "COD-001" },
  },
  {
    field_name: "supplier_type",
    label: "Tipo",
    field_type: "select",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 3,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "origin",
    label: "Origen",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 4,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "email",
    label: "Email",
    field_type: "email",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 5,
    help_text: null,
    validation_rules: {
      max_length: 150,
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    },
    ui_props: { placeholder: "proveedor@empresa.com" },
  },
  {
    field_name: "phone",
    label: "Teléfono",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 6,
    help_text: null,
    validation_rules: null,
    ui_props: { placeholder: "+54 11 5555 5555" },
  },
  {
    field_name: "notes",
    label: "Notas",
    field_type: "textarea",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 7,
    help_text: null,
    validation_rules: { max_length: 2000 },
    ui_props: { placeholder: "Observaciones" },
  },
];

const DEFAULT_FABRIC_FIELDS: FieldConfig[] = [
  {
    field_name: "name",
    label: "Nombre",
    field_type: "text",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 1,
    help_text: null,
    validation_rules: { min_length: 2, max_length: 120 },
    ui_props: { placeholder: "Crepe Seda" },
  },
  {
    field_name: "fabric_type",
    label: "Tipo de tela",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 2,
    help_text: null,
    validation_rules: { max_length: 120 },
    ui_props: { placeholder: "Sastrero" },
  },
  {
    field_name: "color",
    label: "Color",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 3,
    help_text: null,
    validation_rules: { max_length: 80 },
    ui_props: { placeholder: "Negro" },
  },
  {
    field_name: "notes",
    label: "Notas",
    field_type: "textarea",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 4,
    help_text: null,
    validation_rules: { max_length: 2000 },
    ui_props: { placeholder: "Composición / uso / observaciones" },
  },
  {
    field_name: "total_stock_meters",
    label: "Stock total",
    field_type: "virtual_number",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 20,
    help_text: "Suma de metros actuales de los rollos de esta tela",
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "total_rolls",
    label: "Rollos",
    field_type: "virtual_number",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 21,
    help_text: "Cantidad total de rollos asociados",
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "largest_roll_length",
    label: "Mayor rollo",
    field_type: "virtual_number",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 22,
    help_text: "Longitud del rollo más grande",
    validation_rules: null,
    ui_props: null,
  },
];

const DEFAULT_FABRIC_ROLL_FIELDS: FieldConfig[] = [
  {
    field_name: "roll_code",
    label: "Código de rollo",
    field_type: "text",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 1,
    help_text: null,
    validation_rules: { min_length: 1, max_length: 100 },
    ui_props: { placeholder: "R-001" },
  },
  {
    field_name: "fabric_id",
    label: "Tela",
    field_type: "select",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 2,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "supplier_id",
    label: "Proveedor",
    field_type: "select",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 3,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "initial_length",
    label: "Metraje inicial",
    field_type: "number",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 4,
    help_text: null,
    validation_rules: { min_value: 0, step: 0.01 },
    ui_props: { placeholder: "0.00" },
  },
  {
    field_name: "current_length",
    label: "Metraje actual",
    field_type: "number",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 5,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "status",
    label: "Estado",
    field_type: "select",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 6,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "price_per_meter",
    label: "Precio / metro",
    field_type: "number",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 7,
    help_text: null,
    validation_rules: { min_value: 0, step: 0.01 },
    ui_props: { placeholder: "0.00" },
  },
  {
    field_name: "purchase_date",
    label: "Fecha compra",
    field_type: "date",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 8,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "unit",
    label: "Unidad",
    field_type: "select",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 9,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "notes",
    label: "Notas",
    field_type: "textarea",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 10,
    help_text: null,
    validation_rules: { max_length: 2000 },
    ui_props: { placeholder: "Observaciones" },
  },
  {
    field_name: "location",
    label: "Ubicación",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 11,
    help_text: null,
    validation_rules: { max_length: 120 },
    ui_props: { placeholder: "Depósito A / Estante 3" },
  },
  {
    field_name: "reserved_length",
    label: "Metros reservados",
    field_type: "virtual_number",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 12,
    help_text: null,
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "fabric_name",
    label: "Tela",
    field_type: "virtual_text",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 30,
    help_text: "Nombre de la tela asociada",
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "fabric_color",
    label: "Color tela",
    field_type: "virtual_text",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 31,
    help_text: "Color de la tela asociada",
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "fabric_code",
    label: "Código tela",
    field_type: "virtual_text",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 32,
    help_text: "Código interno de la tela asociada",
    validation_rules: null,
    ui_props: null,
  },
];

export const DEFAULT_CUSTOMER_FIELDS: FieldConfig[] = [
  {
    field_name: "code",
    label: "Código",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 1,
    help_text: null,
    validation_rules: { max_length: 40 },
    ui_props: { placeholder: "CLI-001" },
  },
  {
    field_name: "first_name",
    label: "Nombre",
    field_type: "text",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 2,
    help_text: null,
    validation_rules: { min_length: 2, max_length: 120 },
    ui_props: { placeholder: "María" },
  },
  {
    field_name: "last_name",
    label: "Apellido",
    field_type: "text",
    visible: true,
    required: true,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 3,
    help_text: null,
    validation_rules: { min_length: 2, max_length: 120 },
    ui_props: { placeholder: "González" },
  },
  {
    field_name: "full_name",
    label: "Nombre completo",
    field_type: "virtual_text",
    visible: true,
    required: false,
    editable: false,
    list_visible: true,
    form_visible: false,
    order_index: 4,
    help_text: "Campo virtual: Nombre + Apellido",
    validation_rules: null,
    ui_props: null,
  },
  {
    field_name: "email",
    label: "Email",
    field_type: "email",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 5,
    help_text: null,
    validation_rules: {
      max_length: 150,
      pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
    },
    ui_props: { placeholder: "cliente@empresa.com" },
  },
  {
    field_name: "phone",
    label: "Teléfono",
    field_type: "text",
    visible: true,
    required: false,
    editable: true,
    list_visible: true,
    form_visible: true,
    order_index: 6,
    help_text: null,
    validation_rules: { max_length: 40 },
    ui_props: { placeholder: "+54 11 5555 5555" },
  },
  {
    field_name: "notes",
    label: "Notas",
    field_type: "textarea",
    visible: true,
    required: false,
    editable: true,
    list_visible: false,
    form_visible: true,
    order_index: 7,
    help_text: null,
    validation_rules: { max_length: 2000 },
    ui_props: { placeholder: "Preferencias / observaciones" },
  },
];

function getDefaultConfig(entityName: string): FieldConfig[] {
  switch (entityName) {
    case "supplier":
      return DEFAULT_SUPPLIER_FIELDS;
    case "fabric":
      return DEFAULT_FABRIC_FIELDS;
    case "fabric_roll":
      return DEFAULT_FABRIC_ROLL_FIELDS;
    case "customer":
      return DEFAULT_CUSTOMER_FIELDS;
    default:
      return [];
  }
}

export function useFieldConfig(entityName: string) {
  const [fields, setFields] = useState<FieldConfig[]>(getDefaultConfig(entityName));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const res = await api.get<FieldConfig[]>(`/my-ui-config/${entityName}`);
        const incoming = Array.isArray(res.data) ? res.data : [];

        if (!mounted) return;

        if (incoming.length > 0) {
          setFields(incoming.sort((a, b) => a.order_index - b.order_index));
        } else {
          setFields(getDefaultConfig(entityName));
        }
      } catch {
        if (mounted) {
          setFields(getDefaultConfig(entityName));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [entityName]);

  const helpers = useMemo(() => {
    const byName = new Map(fields.map((f) => [f.field_name, f]));

    const getField = (fieldName: string) => byName.get(fieldName);

    const isVisible = (fieldName: string) => {
      const field = getField(fieldName);
      return field ? field.visible : true;
    };

    const isListVisible = (fieldName: string) => {
      const field = getField(fieldName);
      return field ? field.visible && field.list_visible : true;
    };

    const isFormVisible = (fieldName: string) => {
      const field = getField(fieldName);
      return field ? field.visible && field.form_visible : true;
    };

    const isRequired = (fieldName: string) => !!getField(fieldName)?.required;

    const isEditable = (fieldName: string) => {
      const field = getField(fieldName);
      return field ? field.editable : true;
    };

    const getLabel = (fieldName: string, fallback: string) =>
      getField(fieldName)?.label || fallback;

    const getHelpText = (fieldName: string) =>
      getField(fieldName)?.help_text || null;

    const getValidationRules = (fieldName: string) =>
      getField(fieldName)?.validation_rules || null;

    const getUiProps = (fieldName: string) =>
      getField(fieldName)?.ui_props || null;

    return {
      getField,
      isVisible,
      isListVisible,
      isFormVisible,
      isRequired,
      isEditable,
      getLabel,
      getHelpText,
      getValidationRules,
      getUiProps,
    };
  }, [fields]);

  return {
    fields,
    loading,
    ...helpers,
  };
}

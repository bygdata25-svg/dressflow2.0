import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

type ProductionOrder = {
  id: string;
  order_number: string;
  workshop_supplier_name?: string | null;
  target_dress_name: string;
  target_dress_code?: string | null;
  target_size?: string | null;
  target_color?: string | null;
  planned_quantity: number;
  produced_quantity: number;
  status: string;
  priority: string;
  due_date?: string | null;
  notes?: string | null;
  received_notes?: string | null;
  currency?: string | null;
  design_photo_url?: string | null;
  tenant_name?: string | null;
  tenant_logo_url?: string | null;
  tenant_primary_color?: string | null;
};

type Material = {
  id: string;
  material_type: string;
  description_snapshot?: string | null;
  planned_quantity: string;
  delivered_quantity: string;
  unit: string;
  unit_cost_snapshot?: string | null;
  notes?: string | null;
  roll_code?: string | null;
};

type CostSummary = {
  estimated_material_cost: string;
  actual_material_cost: string;
  labor_cost: string;
  additional_cost: string;
  estimated_total_cost: string;
  actual_total_cost: string;
  estimated_unit_cost: string;
  actual_unit_cost: string;
  currency: string;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function resolvePhoto(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `/${url}`;
}

function formatMoney(value?: string | number | null, currency = "USD") {
  return `${Number(value || 0).toFixed(2)} ${currency}`;
}

export default function ProductionOrderPrintPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const mode = params.get("mode") || "operation";
  const returnTo = params.get("returnTo");

  const printedRef = useRef(false);

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.classList.add("po-print-mode-active");

    return () => {
      document.body.classList.remove("po-print-mode-active");
    };
  }, []);

  useEffect(() => {
    async function load() {
      const [o, m, c] = await Promise.all([
        api.get(`/production-orders/${id}`),
        api.get(`/production-orders/${id}/materials`),
        mode === "finance"
          ? api.get(`/production-orders/${id}/cost-summary`)
          : Promise.resolve({ data: null }),
      ]);

      setOrder(o.data);
      setMaterials(m.data || []);
      setCostSummary(c.data);
      setLoading(false);
    }

    load();
  }, [id, mode]);

  const handlePrint = () => {
    if (printedRef.current) return;
    printedRef.current = true;

    const goBack = () => {
      if (returnTo) navigate(decodeURIComponent(returnTo));
      else navigate(-1);
    };

    const afterPrint = () => {
      window.removeEventListener("afterprint", afterPrint);
      goBack();
    };

    window.addEventListener("afterprint", afterPrint);
    window.print();
  };

  const fabrics = useMemo(
    () => materials.filter((m) => m.material_type === "FABRIC_ROLL"),
    [materials]
  );

  const trims = useMemo(
    () => materials.filter((m) => m.material_type === "TRIM"),
    [materials]
  );

  if (loading || !order) return null;

  const logo = resolvePhoto(order.tenant_logo_url);
  const image = resolvePhoto(order.design_photo_url);
  const currency = costSummary?.currency || order.currency || "USD";

  return (
    <>
      <style>{`
        body { margin:0; font-family:Arial; }

        .page {
          width:210mm;
          margin:auto;
          padding:20mm;
          background:white;
        }

        .toolbar {
          display:flex;
          justify-content:space-between;
          margin-bottom:20px;
        }

        .btn {
          padding:10px 14px;
          border-radius:10px;
          border:1px solid #ccc;
          cursor:pointer;
          font-weight:600;
        }

        .btn-primary {
          background:black;
          color:white;
        }

        .header {
          display:flex;
          justify-content:space-between;
          border-bottom:1px solid #ddd;
          padding-bottom:10px;
        }

        table {
          width:100%;
          border-collapse:collapse;
          margin-top:10px;
        }

        th, td {
          border-bottom:1px solid #eee;
          padding:6px;
        }

        @media print {
          .no-print { display:none; }
        }
      `}</style>

      <div className="po-print-area">
        <div className="page">

          <div className="toolbar no-print">
            <button
              className="btn"
              onClick={() =>
                returnTo
                  ? navigate(decodeURIComponent(returnTo))
                  : navigate(-1)
              }
            >
              Volver
            </button>

            <button className="btn btn-primary" onClick={handlePrint}>
              Imprimir
            </button>
          </div>

          <div className="header">
            <div>
              <h2>
                Orden de Producción {mode === "finance" && "· Costos"}
              </h2>
              <div>{order.target_dress_name}</div>
            </div>

            <div>
              <strong>{order.order_number}</strong>
              <div>{order.workshop_supplier_name}</div>
            </div>
          </div>

          {image && (
            <img
              src={image}
              style={{ width: "100%", marginTop: 20 }}
            />
          )}

          <h3>Telas</h3>
          <table>
            <tbody>
              {fabrics.map((f) => (
                <tr key={f.id}>
                  <td>{f.description_snapshot}</td>
                  <td>{f.planned_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Avíos</h3>
          <table>
            <tbody>
              {trims.map((t) => (
                <tr key={t.id}>
                  <td>{t.description_snapshot}</td>
                  <td>{t.planned_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {mode === "finance" && costSummary && (
            <div style={{ marginTop: 20 }}>
              <h3>Costos</h3>
              <p>Total: {formatMoney(costSummary.actual_total_cost, currency)}</p>
              <p>Unitario: {formatMoney(costSummary.actual_unit_cost, currency)}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

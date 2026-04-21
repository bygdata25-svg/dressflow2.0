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
  labor_cost: string;
  additional_cost: string;
  estimated_total_cost: string;
  actual_total_cost: string;
  currency: string;
  design_photo_url?: string | null;
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

type CostForm = {
  labor_cost: string;
  additional_cost: string;
  currency: string;
  price_multiplier: string;
};

type Props = {
  t: any;
  order: ProductionOrder;
  costSummary: CostSummary | null;
  costForm: CostForm;
  setCostForm: React.Dispatch<React.SetStateAction<CostForm>>;
  saveCosts: (event: React.FormEvent) => Promise<void>;
  formatMoney: (value?: string | number | null, currency?: string) => string;
  calculateSuggestedPrice: (
    unitCost?: string | number | null,
    multiplier?: string | number | null
  ) => number;
};

export default function ProductionOrderFinanceTab({
  order,
  costSummary,
  costForm,
  setCostForm,
  saveCosts,
  formatMoney,
  calculateSuggestedPrice,
}: Props) {
  const effectiveCurrency = costForm.currency || costSummary?.currency || order.currency;

  const highlightedSuggestedPrice = calculateSuggestedPrice(
    costSummary?.actual_unit_cost || costSummary?.estimated_unit_cost || 0,
    costForm.price_multiplier
  );

  return (
    <div className="po-fin-shell">
      <section className="po-fin-hero">
        <div className="po-fin-hero__highlight">
          <span className="po-fin-hero__label">Precio sugerido por unidad</span>
          <strong className="po-fin-hero__value">
            {formatMoney(highlightedSuggestedPrice, effectiveCurrency)}
          </strong>
          <small className="po-fin-hero__hint">
            Basado en costo unitario {costSummary?.actual_unit_cost ? "real" : "estimado"} × multiplicador
          </small>
        </div>

        <div className="po-fin-kpis">
          <div className="po-fin-kpi">
            <span>Material estimado</span>
            <strong>
              {formatMoney(costSummary?.estimated_material_cost, effectiveCurrency)}
            </strong>
          </div>

          <div className="po-fin-kpi">
            <span>Material real</span>
            <strong>
              {formatMoney(costSummary?.actual_material_cost, effectiveCurrency)}
            </strong>
          </div>

          <div className="po-fin-kpi">
            <span>Total estimado</span>
            <strong>
              {formatMoney(costSummary?.estimated_total_cost, effectiveCurrency)}
            </strong>
          </div>

          <div className="po-fin-kpi">
            <span>Total real</span>
            <strong>
              {formatMoney(costSummary?.actual_total_cost, effectiveCurrency)}
            </strong>
          </div>

          <div className="po-fin-kpi">
            <span>Unitario estimado</span>
            <strong>
              {formatMoney(costSummary?.estimated_unit_cost, effectiveCurrency)}
            </strong>
          </div>

          <div className="po-fin-kpi">
            <span>Unitario real</span>
            <strong>
              {formatMoney(costSummary?.actual_unit_cost, effectiveCurrency)}
            </strong>
          </div>
        </div>
      </section>

      <div className="po-fin-layout">
        <section className="po-section-card">
          <div className="po-section-head">
            <h3>Actualizar costos</h3>
            <p>Solo variables económicas de la orden.</p>
          </div>

          <form onSubmit={saveCosts} className="po-fin-form">
            <div className="po-fin-form__grid">
              <div>
                <label className="df-pro-label">Mano de obra</label>
                <input
                  className="df-pro-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costForm.labor_cost}
                  onChange={(e) =>
                    setCostForm((prev) => ({ ...prev, labor_cost: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="df-pro-label">Costos adicionales</label>
                <input
                  className="df-pro-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costForm.additional_cost}
                  onChange={(e) =>
                    setCostForm((prev) => ({ ...prev, additional_cost: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="df-pro-label">Moneda</label>
                <input
                  className="df-pro-input"
                  value={costForm.currency}
                  onChange={(e) =>
                    setCostForm((prev) => ({ ...prev, currency: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className="df-pro-label">Multiplicador</label>
                <input
                  className="df-pro-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costForm.price_multiplier}
                  onChange={(e) =>
                    setCostForm((prev) => ({ ...prev, price_multiplier: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="po-fin-form__actions">
              <button type="submit" className="po-primary-btn">
                Guardar costos
              </button>
            </div>
          </form>
        </section>

        <section className="po-section-card">
          <div className="po-section-head">
            <h3>Resumen económico</h3>
            <p>Contexto comercial de la orden.</p>
          </div>

          <div className="po-fin-summary">
            <div className="po-fin-summary__item">
              <span>Orden</span>
              <strong>{order.order_number}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Vestido</span>
              <strong>{order.target_dress_name}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Taller</span>
              <strong>{order.workshop_supplier_name || "-"}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Planificado</span>
              <strong>{order.planned_quantity}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Producido</span>
              <strong>{order.produced_quantity}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Moneda</span>
              <strong>{effectiveCurrency}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Mano de obra</span>
              <strong>{formatMoney(costSummary?.labor_cost, effectiveCurrency)}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Costos adicionales</span>
              <strong>{formatMoney(costSummary?.additional_cost, effectiveCurrency)}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Precio sugerido</span>
              <strong>{formatMoney(highlightedSuggestedPrice, effectiveCurrency)}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

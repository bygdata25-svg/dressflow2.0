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
  exchange_rate: string;
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

function toNumber(value?: string | number | null) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value?: string | number | null, currency = "USD") {
  const n = toNumber(value);

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} ${currency}`;
}

export default function ProductionOrderFinanceTab({
  order,
  costSummary,
  costForm,
  setCostForm,
  saveCosts,
  calculateSuggestedPrice,
}: Props) {
  const effectiveCurrency = (costForm.currency || costSummary?.currency || order.currency || "USD").toUpperCase();

  const estimatedMaterialCost = toNumber(costSummary?.estimated_material_cost);
  const actualMaterialCost = toNumber(costSummary?.actual_material_cost);
  const laborCost = toNumber(costSummary?.labor_cost);
  const additionalCost = toNumber(costSummary?.additional_cost);
  const laborAndOtherCosts = laborCost + additionalCost;

  // Para pantalla usamos el material real solo cuando ya existe consumo real.
  // Mientras no haya consumo, mostramos el estimado para evitar importes en cero.
  const visibleMaterialCost = actualMaterialCost > 0 ? actualMaterialCost : estimatedMaterialCost;
  const visibleTotalEstimated = estimatedMaterialCost + laborAndOtherCosts;

  const unitCostForSuggestedPrice =
    actualMaterialCost > 0
      ? costSummary?.actual_unit_cost || 0
      : costSummary?.estimated_unit_cost || 0;

  const highlightedSuggestedPrice = calculateSuggestedPrice(
    unitCostForSuggestedPrice,
    costForm.price_multiplier
  );

  const exchangeRate = Math.max(toNumber(costForm.exchange_rate), 1);

  const suggestedARS =
    effectiveCurrency === "ARS"
      ? highlightedSuggestedPrice
      : highlightedSuggestedPrice * exchangeRate;

  const suggestedUSD =
    effectiveCurrency === "USD"
      ? highlightedSuggestedPrice
      : highlightedSuggestedPrice / exchangeRate;

  const realTotal = toNumber(
    actualMaterialCost > 0
      ? costSummary?.actual_total_cost
      : costSummary?.estimated_total_cost
  );

  const suggestedInEffectiveCurrency =
    effectiveCurrency === "ARS" ? suggestedARS : suggestedUSD;

  const estimatedMargin = suggestedInEffectiveCurrency - realTotal;
  const estimatedMarginPercent = realTotal > 0 ? (estimatedMargin / realTotal) * 100 : 0;

  const marginTone =
    estimatedMarginPercent >= 30
      ? "good"
      : estimatedMarginPercent >= 10
        ? "warning"
        : "bad";

  const marginLabel =
    marginTone === "good"
      ? "Rentable"
      : marginTone === "warning"
        ? "Margen bajo"
        : "Riesgo";

  const marginIcon =
    marginTone === "good" ? "🟢" : marginTone === "warning" ? "🟡" : "🔴";

  return (
    <div className="po-fin-shell">
      <section className="po-fin-hero">
        <div className="po-fin-hero__highlight">
          <span className="po-fin-hero__label">Precio sugerido por unidad</span>

          <strong className="po-fin-hero__value">
            {formatCurrency(suggestedARS, "ARS")}
          </strong>

          <small className="po-fin-hero__hint">
            Equivalente aprox. {formatCurrency(suggestedUSD, "USD")} · basado en costo unitario{" "}
            {actualMaterialCost > 0 ? "real" : "estimado"} × multiplicador
          </small>

          <div
            className={`po-fin-margin po-fin-margin--${marginTone}`}
            style={{
              marginTop: 14,
              display: "grid",
              gap: 6,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.16)",
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.78 }}>Margen estimado</span>
            <strong style={{ fontSize: 18, lineHeight: 1.15 }}>
              {marginIcon} {marginLabel} · {formatCurrency(estimatedMargin, effectiveCurrency)}
            </strong>
            <small style={{ opacity: 0.78 }}>
              {estimatedMarginPercent.toFixed(1)}% sobre costo total estimado/real disponible
            </small>
          </div>
        </div>

        <div className="po-fin-kpis">
          <div className="po-fin-kpi">
            <span>Costo material</span>
            <strong>{formatCurrency(visibleMaterialCost, effectiveCurrency)}</strong>
          </div>

          <div className="po-fin-kpi">
            <span>Mano de obra / otros</span>
            <strong>{formatCurrency(laborAndOtherCosts, effectiveCurrency)}</strong>
          </div>

          <div className="po-fin-kpi">
            <span>Total estimado</span>
            <strong>{formatCurrency(visibleTotalEstimated, effectiveCurrency)}</strong>
          </div>
        </div>
      </section>

      <div className="po-fin-layout">
        <section className="po-section-card">
          <div className="po-section-head">
            <h3>Actualizar costos</h3>
            <p>Mano de obra, costos adicionales, moneda y parámetros comerciales.</p>
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
                <label className="df-pro-label">Moneda de costos</label>
                <select
                  className="df-pro-select"
                  value={costForm.currency}
                  onChange={(e) =>
                    setCostForm((prev) => ({ ...prev, currency: e.target.value }))
                  }
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </div>

              <div>
                <label className="df-pro-label">Tipo de cambio</label>
                <input
                  className="df-pro-input"
                  type="number"
                  step="0.01"
                  min="1"
                  value={costForm.exchange_rate}
                  onChange={(e) =>
                    setCostForm((prev) => ({ ...prev, exchange_rate: e.target.value }))
                  }
                  placeholder="Ej. 1000"
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
            <p>Lectura rápida del costo comercial de la orden.</p>
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
              <span>Costo material</span>
              <strong>{formatCurrency(visibleMaterialCost, effectiveCurrency)}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Mano de obra / otros</span>
              <strong>{formatCurrency(laborAndOtherCosts, effectiveCurrency)}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Total estimado</span>
              <strong>{formatCurrency(visibleTotalEstimated, effectiveCurrency)}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Margen estimado</span>
              <strong>
                {marginIcon} {formatCurrency(estimatedMargin, effectiveCurrency)}
              </strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Rentabilidad estimada</span>
              <strong>{estimatedMarginPercent.toFixed(1)}%</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Precio sugerido ARS</span>
              <strong>{formatCurrency(suggestedARS, "ARS")}</strong>
            </div>

            <div className="po-fin-summary__item">
              <span>Precio sugerido USD</span>
              <strong>{formatCurrency(suggestedUSD, "USD")}</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

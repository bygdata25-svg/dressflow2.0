export type CurrencyFormatOptions = {
  locale?: string;
  currencyCode?: string;
  symbol?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export function formatCurrencyAmount(
  amount: number | string | null | undefined,
  options: CurrencyFormatOptions = {}
) {
  const {
    locale = "es-AR",
    currencyCode = "ARS",
    symbol,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options;

  const numericValue = Number(amount ?? 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeValue);

  if (symbol) {
    return `${symbol} ${formatted}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(safeValue);
  } catch {
    return `${currencyCode} ${formatted}`;
  }
}

export function getCurrencySymbol(currencyCode?: string | null) {
  const code = String(currencyCode || "").toUpperCase();

  const symbols: Record<string, string> = {
    ARS: "$",
    USD: "US$",
    EUR: "€",
    CLP: "$",
    MXN: "$",
  };

  return symbols[code] || "$";
}

from decimal import Decimal
from typing import Any


DEFAULT_SYMBOLS = {
    "ARS": "$",
    "USD": "US$",
    "EUR": "€",
    "CLP": "$",
    "MXN": "$",
}


def get_currency_symbol(currency_code: str | None, fallback: str = "$") -> str:
    code = str(currency_code or "").upper().strip()
    return DEFAULT_SYMBOLS.get(code, fallback)


def format_money(
    value: Any,
    currency_code: str | None = "USD",
    symbol: str | None = None,
) -> str:
    try:
        amount = Decimal(str(value or 0))
    except Exception:
        amount = Decimal("0")

    code = str(currency_code or "USD").upper()
    final_symbol = symbol or get_currency_symbol(code)

    formatted = f"{amount:,.2f}"
    formatted = formatted.replace(",", "X").replace(".", ",").replace("X", ".")

    return f"{final_symbol} {formatted}"

from sqlalchemy.orm import Session

from app.models.tenant_currency_rule import TenantCurrencyRule


DEFAULT_CURRENCY_RULES = [
    ("dresses", "sale_price"),
    ("dresses", "rental_price"),

    ("accessories", "sale_price"),
    ("accessories", "cost_price"),

    ("fabrics", "purchase_price"),
    ("fabric_rolls", "purchase_price"),

    ("trims", "purchase_price"),

    ("production", "labor_cost"),
    ("production", "additional_cost"),
]


def create_default_currency_rules(
    db: Session,
    tenant_id,
    base_currency: str,
):
    base_currency = base_currency.upper()

    for module, price_type in DEFAULT_CURRENCY_RULES:
        exists = (
            db.query(TenantCurrencyRule)
            .filter(
                TenantCurrencyRule.tenant_id == tenant_id,
                TenantCurrencyRule.module == module,
                TenantCurrencyRule.price_type == price_type,
            )
            .first()
        )

        if exists:
            continue

        rule = TenantCurrencyRule(
            tenant_id=tenant_id,
            module=module,
            price_type=price_type,
            default_currency=base_currency,
            allow_override=True,
        )

        db.add(rule)

    db.commit()

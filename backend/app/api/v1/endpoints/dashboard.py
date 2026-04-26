from datetime import date, timedelta, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc, text
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.models.dress import Dress
from app.models.fabric_roll import FabricRoll
from app.models.fabric_movement import FabricMovement
from app.models.loan import Loan
from app.models.customer import Customer
from app.models.fabric import Fabric
from app.models.accessory import Accessory
from app.models.trim import Trim

from app.models.production_order import ProductionOrder
from app.models.supplier import Supplier

from app.models.dress_status_history import DressStatusHistory

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# =========================
# SMART ALERTS / INSIGHTS
# =========================

ALERT_CATEGORY_LABELS = {
    "loans": "Préstamos",
    "stock": "Stock",
    "production": "Producción",
    "inventory": "Inventario",
    "financial": "Finanzas",
    "general": "General",
}

ALERT_CATEGORY_ORDER = {
    "production": 1,
    "stock": 2,
    "loans": 3,
    "inventory": 4,
    "financial": 5,
    "general": 9,
}

ALERT_LEVEL_PRIORITY = {
    "high": 1,
    "medium": 2,
    "warning": 2,
    "low": 3,
    "info": 4,
}


def _to_float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _alert_category(alert_type: str | None) -> str:
    raw = (alert_type or "").upper()

    if raw.startswith("PRODUCTION"):
        return "production"
    if "STOCK" in raw or "FABRIC" in raw or "ROLL" in raw or "MATERIAL" in raw:
        return "stock"
    if "LOAN" in raw or "RETURN" in raw:
        return "loans"
    if "DRESS" in raw or "IDLE" in raw:
        return "inventory"
    if "COST" in raw or "PROFIT" in raw or "MARGIN" in raw:
        return "financial"

    return "general"


def _alert_priority(alert: dict) -> tuple[int, int, str]:
    level = str(alert.get("level") or "info").lower()
    category = str(alert.get("category") or _alert_category(alert.get("type")))
    title = str(alert.get("title") or "")

    return (
        ALERT_LEVEL_PRIORITY.get(level, 4),
        ALERT_CATEGORY_ORDER.get(category, 9),
        title,
    )


def _prepare_alerts(alerts: list[dict]) -> list[dict]:
    prepared: list[dict] = []

    for alert in alerts:
        category = alert.get("category") or _alert_category(alert.get("type"))
        level = str(alert.get("level") or "info").lower()

        prepared.append(
            {
                **alert,
                "level": level,
                "category": category,
                "category_label": ALERT_CATEGORY_LABELS.get(category, "General"),
                "priority": ALERT_LEVEL_PRIORITY.get(level, 4),
            }
        )

    return sorted(prepared, key=_alert_priority)


def get_stock_predictions(db: Session, tenant_id):
    """Predice agotamiento de telas según consumo de los últimos 30 días."""
    start_date = datetime.utcnow() - timedelta(days=30)

    rows = db.execute(
        text("""
            SELECT
                f.id AS fabric_id,
                f.name AS fabric_name,
                f.color AS fabric_color,
                COALESCE(SUM(fr.current_length), 0) AS current_stock_meters,
                COALESCE(consumed.consumed_30d, 0) AS consumed_30d
            FROM fabrics f
            LEFT JOIN fabric_rolls fr
                ON fr.fabric_id = f.id
               AND fr.tenant_id = :tenant_id
               AND fr.deleted_at IS NULL
               AND COALESCE(fr.is_active, TRUE) = TRUE
            LEFT JOIN (
                SELECT
                    fr2.fabric_id,
                    SUM(ABS(COALESCE(fm.quantity, 0))) AS consumed_30d
                FROM fabric_movements fm
                JOIN fabric_rolls fr2
                    ON fr2.id = fm.fabric_roll_id
                WHERE fm.tenant_id = :tenant_id
                  AND fm.created_at >= :start_date
                  AND (
                    UPPER(COALESCE(fm.type, '')) IN ('OUT', 'ISSUE', 'CONSUMPTION')
                    OR UPPER(COALESCE(fm.movement_reason, '')) IN ('PRODUCTION_ISSUE', 'PRODUCTION_CONSUMPTION')
                  )
                GROUP BY fr2.fabric_id
            ) consumed
                ON consumed.fabric_id = f.id
            WHERE f.tenant_id = :tenant_id
              AND f.deleted_at IS NULL
            GROUP BY f.id, f.name, f.color, consumed.consumed_30d
            ORDER BY current_stock_meters ASC, f.name ASC
        """),
        {"tenant_id": tenant_id, "start_date": start_date},
    ).mappings().all()

    alerts: list[dict] = []
    insights: list[dict] = []

    for row in rows:
        current_stock = _to_float(row["current_stock_meters"])
        consumed_30d = _to_float(row["consumed_30d"])

        if consumed_30d <= 0:
            continue

        daily_usage = consumed_30d / 30
        if daily_usage <= 0:
            continue

        days_left = current_stock / daily_usage if current_stock > 0 else 0
        fabric_label = row["fabric_name"] or "Tela sin nombre"
        if row["fabric_color"]:
            fabric_label = f"{fabric_label} {row['fabric_color']}"

        if days_left <= 15:
            alerts.append(
                {
                    "type": "STOCK_PREDICTION",
                    "category": "stock",
                    "level": "high" if days_left <= 7 else "medium",
                    "title": f"Stock proyectado bajo: {fabric_label}",
                    "message": (
                        f"Stock actual {current_stock:.2f} m. "
                        f"Al ritmo actual se agotaría en {max(0, int(round(days_left)))} día(s)."
                    ),
                    "action": {"label": "Ver rollos", "url": "/fabric-rolls"},
                    "meta": {
                        "fabric_id": str(row["fabric_id"]),
                        "current_stock_meters": current_stock,
                        "consumed_30d": consumed_30d,
                        "daily_usage": daily_usage,
                        "days_left": days_left,
                    },
                }
            )

    if alerts:
        most_urgent = sorted(alerts, key=lambda item: item.get("meta", {}).get("days_left", 999))[0]
        insights.append(
            {
                "type": "STOCK_FORECAST",
                "title": "Riesgo de stock",
                "value": most_urgent["title"].replace("Stock proyectado bajo: ", ""),
                "description": most_urgent["message"],
                "tone": "danger" if most_urgent["level"] == "high" else "warning",
            }
        )

    return alerts, insights


def get_production_smart_alerts(db: Session, tenant_id):
    today = date.today()
    stale_limit = datetime.utcnow() - timedelta(days=7)

    rows = db.execute(
        text("""
            SELECT
                po.id,
                po.order_number,
                po.status,
                po.priority,
                po.due_date,
                po.updated_at,
                po.estimated_total_cost,
                po.actual_total_cost,
                po.target_dress_name,
                COALESCE(materials.pending_materials, 0) AS pending_materials
            FROM production_orders po
            LEFT JOIN (
                SELECT
                    production_order_id,
                    COUNT(*) AS pending_materials
                FROM production_order_materials
                WHERE tenant_id = :tenant_id
                  AND COALESCE(planned_quantity, 0) > COALESCE(delivered_quantity, 0)
                GROUP BY production_order_id
            ) materials
                ON materials.production_order_id = po.id
            WHERE po.tenant_id = :tenant_id
              AND po.deleted_at IS NULL
              AND UPPER(COALESCE(po.status, '')) NOT IN ('COMPLETED', 'CANCELLED')
            ORDER BY po.due_date ASC NULLS LAST, po.updated_at ASC
        """),
        {"tenant_id": tenant_id},
    ).mappings().all()

    alerts: list[dict] = []
    insights: list[dict] = []
    delayed_count = 0
    stale_count = 0
    material_pending_count = 0
    cost_overrun_count = 0

    for row in rows:
        order_code = row["order_number"] or "Orden sin número"
        order_url = f"/production-orders/{row['id']}"
        due_date = row["due_date"]
        updated_at = row["updated_at"]
        status = (row["status"] or "").upper()

        if due_date and due_date < today:
            delayed_count += 1
            days_late = (today - due_date).days
            alerts.append(
                {
                    "type": "PRODUCTION_OVERDUE",
                    "category": "production",
                    "level": "high",
                    "title": f"Orden atrasada {order_code}",
                    "message": f"La orden está vencida hace {days_late} día(s).",
                    "action": {"label": "Ver orden", "url": order_url},
                    "meta": {"order_id": str(row["id"]), "days_late": days_late},
                }
            )
        elif due_date and due_date <= today + timedelta(days=3):
            days_to_due = (due_date - today).days
            alerts.append(
                {
                    "type": "PRODUCTION_DUE_SOON",
                    "category": "production",
                    "level": "medium",
                    "title": f"Orden por vencer {order_code}",
                    "message": f"Tiene fecha de entrega en {days_to_due} día(s).",
                    "action": {"label": "Ver orden", "url": order_url},
                    "meta": {"order_id": str(row["id"]), "days_to_due": days_to_due},
                }
            )

        if updated_at and updated_at <= stale_limit and status in {"DRAFT", "APPROVED", "MATERIALS_RESERVED", "IN_PRODUCTION"}:
            stale_count += 1
            alerts.append(
                {
                    "type": "PRODUCTION_STALE",
                    "category": "production",
                    "level": "medium",
                    "title": f"Orden sin avance {order_code}",
                    "message": "No registra actualización en los últimos 7 días.",
                    "action": {"label": "Revisar orden", "url": order_url},
                    "meta": {"order_id": str(row["id"]), "status": row["status"]},
                }
            )

        pending_materials = int(row["pending_materials"] or 0)
        if pending_materials > 0 and status in {"APPROVED", "MATERIALS_RESERVED", "IN_PRODUCTION"}:
            material_pending_count += 1
            alerts.append(
                {
                    "type": "PRODUCTION_PENDING_MATERIALS",
                    "category": "production",
                    "level": "medium",
                    "title": f"Material pendiente {order_code}",
                    "message": f"Tiene {pending_materials} material(es) con entrega incompleta.",
                    "action": {"label": "Ver materiales", "url": order_url},
                    "meta": {"order_id": str(row["id"]), "pending_materials": pending_materials},
                }
            )

        estimated_cost = _to_float(row["estimated_total_cost"])
        actual_cost = _to_float(row["actual_total_cost"])
        if estimated_cost > 0 and actual_cost > estimated_cost * 1.2:
            cost_overrun_count += 1
            overrun_pct = ((actual_cost - estimated_cost) / estimated_cost) * 100
            alerts.append(
                {
                    "type": "PRODUCTION_COST_OVERRUN",
                    "category": "financial",
                    "level": "high" if overrun_pct >= 40 else "medium",
                    "title": f"Costo desviado {order_code}",
                    "message": f"El costo real supera al estimado en {overrun_pct:.1f}%.",
                    "action": {"label": "Ver costos", "url": order_url},
                    "meta": {
                        "order_id": str(row["id"]),
                        "estimated_total_cost": estimated_cost,
                        "actual_total_cost": actual_cost,
                        "overrun_pct": overrun_pct,
                    },
                }
            )

    if delayed_count > 0:
        insights.append(
            {
                "type": "PRODUCTION_DELAYS",
                "title": "Producción en riesgo",
                "value": delayed_count,
                "description": "Orden(es) atrasadas que pueden afectar entregas o disponibilidad.",
                "tone": "danger",
            }
        )
    elif stale_count > 0:
        insights.append(
            {
                "type": "PRODUCTION_STALE",
                "title": "Órdenes sin avance",
                "value": stale_count,
                "description": "Orden(es) abiertas sin actualización reciente.",
                "tone": "warning",
            }
        )

    if material_pending_count > 0:
        insights.append(
            {
                "type": "MATERIALS_PENDING",
                "title": "Materiales pendientes",
                "value": material_pending_count,
                "description": "Orden(es) con materiales aún no entregados completamente.",
                "tone": "warning",
            }
        )

    if cost_overrun_count > 0:
        insights.append(
            {
                "type": "COST_OVERRUNS",
                "title": "Desvíos de costo",
                "value": cost_overrun_count,
                "description": "Orden(es) con costo real por encima del estimado.",
                "tone": "danger",
            }
        )

    return alerts, insights


def get_profitability_insights(db: Session, tenant_id):
    """Lectura estimada de rentabilidad por moneda: ventas vs costos de producción."""
    sales_rows = db.execute(
        text("""
            SELECT
                UPPER(COALESCE(si.currency, 'ARS')) AS currency,
                COALESCE(SUM(COALESCE(si.line_total, 0)), 0) AS revenue
            FROM sales s
            LEFT JOIN sale_items si
                ON si.sale_id = s.id
            WHERE s.tenant_id = :tenant_id
              AND COALESCE(s.status, 'COMPLETED') != 'CANCELLED'
            GROUP BY UPPER(COALESCE(si.currency, 'ARS'))
        """),
        {"tenant_id": tenant_id},
    ).mappings().all()

    cost_rows = db.execute(
        text("""
            SELECT
                UPPER(COALESCE(currency, 'ARS')) AS currency,
                COALESCE(SUM(COALESCE(actual_total_cost, estimated_total_cost, 0)), 0) AS cost
            FROM production_orders
            WHERE tenant_id = :tenant_id
              AND deleted_at IS NULL
              AND UPPER(COALESCE(status, '')) NOT IN ('CANCELLED')
            GROUP BY UPPER(COALESCE(currency, 'ARS'))
        """),
        {"tenant_id": tenant_id},
    ).mappings().all()

    revenue_by_currency = {row["currency"]: _to_float(row["revenue"]) for row in sales_rows}
    cost_by_currency = {row["currency"]: _to_float(row["cost"]) for row in cost_rows}

    insights: list[dict] = []

    for currency in sorted(set(revenue_by_currency) | set(cost_by_currency)):
        revenue = revenue_by_currency.get(currency, 0.0)
        cost = cost_by_currency.get(currency, 0.0)

        if revenue <= 0:
            continue

        profit = revenue - cost
        margin = (profit / revenue) * 100 if revenue > 0 else 0

        insights.append(
            {
                "type": f"PROFITABILITY_{currency}",
                "title": f"Rentabilidad {currency}",
                "value": f"{margin:.1f}%",
                "description": f"Ingresos {revenue:,.2f} {currency} vs costos {cost:,.2f} {currency}.",
                "tone": "success" if margin >= 25 else "warning" if margin > 0 else "danger",
            }
        )

    return insights


@router.get("/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    tenant_id = membership.tenant_id

    dresses_available = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "AVAILABLE",
        )
    ).scalar_one()

    dresses_loaned = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "LOANED",
        )
    ).scalar_one()

    dresses_maintenance = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "MAINTENANCE",
        )
    ).scalar_one()

    dresses_sold = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "SOLD",
        )
    ).scalar_one()

    rolls_available = db.execute(
        select(func.count()).select_from(FabricRoll).where(
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.deleted_at.is_(None),
            FabricRoll.status == "AVAILABLE",
        )
    ).scalar_one()

    rolls_depleted = db.execute(
        select(func.count()).select_from(FabricRoll).where(
            FabricRoll.tenant_id == tenant_id,
            FabricRoll.deleted_at.is_(None),
            FabricRoll.status == "DEPLETED",
        )
    ).scalar_one()

    loans_active = db.execute(
        select(func.count()).select_from(Loan).where(
            Loan.tenant_id == tenant_id,
            Loan.deleted_at.is_(None),
            Loan.status == "ACTIVE",
        )
    ).scalar_one()

    today = date.today()
    due_soon_limit = today + timedelta(days=3)

    loans_overdue = db.execute(
        select(func.count()).select_from(Loan).where(
            Loan.tenant_id == tenant_id,
            Loan.deleted_at.is_(None),
            Loan.status == "ACTIVE",
            Loan.expected_return_date.is_not(None),
            Loan.expected_return_date < today,
        )
    ).scalar_one()

    loans_due_soon = db.execute(
        select(func.count()).select_from(Loan).where(
            Loan.tenant_id == tenant_id,
            Loan.deleted_at.is_(None),
            Loan.status == "ACTIVE",
            Loan.expected_return_date.is_not(None),
            Loan.expected_return_date >= today,
            Loan.expected_return_date <= due_soon_limit,
        )
    ).scalar_one()

    cleaning_delayed = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "CLEANING",
            Dress.updated_at <= datetime.utcnow() - timedelta(days=2),
        )
    ).scalar_one()

    maintenance_delayed = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "MAINTENANCE",
            Dress.updated_at <= datetime.utcnow() - timedelta(days=5),
        )
    ).scalar_one()

# =========================
# KPIs NEGOCIO (VENTAS)
# =========================

    month_start = today.replace(day=1)

    monthly_revenue = db.execute(
        select(func.coalesce(func.sum(Dress.sale_price), 0)).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "SOLD",
        )
    ).scalar_one()

    sales_count = db.execute(
        select(func.count()).select_from(Dress).where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status == "SOLD",
        )
    ).scalar_one()

    avg_ticket = float(monthly_revenue / sales_count) if sales_count else 0

# =========================
# TOP DRESSES (más usados)
# =========================

    top_dresses_rows = db.execute(
        select(
            Dress.id,
            Dress.name,
            func.count(Loan.id).label("loan_count"),
        )
        .join(Loan, Loan.dress_id == Dress.id)
        .where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Loan.deleted_at.is_(None),
        )
        .group_by(Dress.id, Dress.name)
        .order_by(desc("loan_count"))
        .limit(5)
    ).all()

    top_dresses = [
        {
            "id": str(row.id),
            "name": row.name,
            "loan_count": int(row.loan_count),
        }
        for row in top_dresses_rows
    ]

# =========================
# IDLE DRESSES
# =========================

    idle_limit = today - timedelta(days=60)

    idle_dresses_rows = db.execute(
        select(Dress)
        .where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
            Dress.status != "SOLD",
            func.date(Dress.updated_at) <= idle_limit,
        )
        .order_by(Dress.updated_at.asc())
        .limit(5)
    ).scalars().all()

    idle_dresses = []

    for dress in idle_dresses_rows:
        base_date = dress.updated_at.date() if dress.updated_at else dress.created_at.date()
        idle_dresses.append(
            {
                "id": str(dress.id),
                "name": dress.name,
                "code": dress.code,
                "days_without_movement": (today - base_date).days,
            }
        )

    recent_movements_rows = db.execute(
        select(FabricMovement)
        .where(FabricMovement.tenant_id == tenant_id)
        .order_by(FabricMovement.created_at.desc())
        .limit(5)
    ).scalars().all()

    recent_movements = []
    for movement in recent_movements_rows:
        roll = db.execute(
            select(FabricRoll).where(FabricRoll.id == movement.fabric_roll_id)
        ).scalar_one_or_none()

        fabric_name = None
        roll_code = None

        if roll:
            roll_code = roll.roll_code
            fabric = db.execute(
                select(Fabric).where(Fabric.id == roll.fabric_id)
            ).scalar_one_or_none()
            fabric_name = fabric.name if fabric else None

        recent_movements.append(
            {
                "id": str(movement.id),
                "roll_code": roll_code,
                "fabric": fabric_name,
                "type": movement.type,
                "quantity": float(movement.quantity),
                "reference": movement.reference,
            }
        )

    recent_loans_rows = db.execute(
        select(Loan)
        .where(
            Loan.tenant_id == tenant_id,
            Loan.deleted_at.is_(None),
        )
        .order_by(Loan.created_at.desc())
        .limit(5)
    ).scalars().all()

    recent_loans = []
    for loan in recent_loans_rows:
        dress = db.execute(
            select(Dress).where(Dress.id == loan.dress_id)
        ).scalar_one_or_none()

        customer = db.execute(
            select(Customer).where(Customer.id == loan.customer_id)
        ).scalar_one_or_none()

        recent_loans.append(
            {
                "id": str(loan.id),
                "customer": (
                    f"{customer.first_name} {customer.last_name}" if customer else None
                ),
                "dress": dress.name if dress else None,
                "status": loan.status,
                "expected_return_date": (
                    str(loan.expected_return_date) if loan.expected_return_date else None
                ),
            }
        )

    featured_dresses_rows = db.execute(
        select(Dress)
        .where(
            Dress.tenant_id == tenant_id,
            Dress.deleted_at.is_(None),
        )
        .order_by(Dress.created_at.desc())
        .limit(3)
    ).scalars().all()

    featured_dresses = []
    for dress in featured_dresses_rows:
        featured_dresses.append(
            {
                "id": str(dress.id),
                "name": dress.name,
                "code": dress.code,
                "status": dress.status,
                "main_image_url": None,
            }
        )

    alerts = []

    if loans_overdue > 0:
        alerts.append(
            {
                "type": "OVERDUE_LOANS",
                "category": "loans",
                "level": "high",
                "title": "Préstamos vencidos",
                "message": f"{loans_overdue} préstamo(s) requieren acción inmediata.",
                "action": {"label": "Ver préstamos", "url": "/loans"},
            }
        )

    if loans_due_soon > 0:
        alerts.append(
            {
                "type": "LOANS_DUE_SOON",
                "category": "loans",
                "level": "medium",
                "title": "Devoluciones próximas",
                "message": f"{loans_due_soon} devolución(es) en los próximos días.",
                "action": {"label": "Ver agenda", "url": "/loans"},
            }
        )

    if rolls_depleted > 0:
        alerts.append(
            {
                "type": "FABRIC_ROLLS_DEPLETED",
                "category": "stock",
                "level": "low",
                "title": "Rollos agotados",
                "message": f"{rolls_depleted} rollo(s) sin stock.",
                "action": {"label": "Ver rollos", "url": "/fabric-rolls"},
            }
        )

    if idle_dresses:
        alerts.append(
            {
                "type": "IDLE_DRESSES",
                "category": "inventory",
                "level": "low",
                "title": "Vestidos sin movimiento",
                "message": f"{len(idle_dresses)} vestido(s) sin uso en 60+ días.",
                "action": {"label": "Ver vestidos", "url": "/dresses"},
            }
        )

    if cleaning_delayed > 0:
        alerts.append(
            {
                "type": "DRESSES_CLEANING_DELAYED",
                "category": "inventory",
                "level": "medium",
                "title": "Vestidos en limpieza",
                "message": f"{cleaning_delayed} vestido(s) llevan más de 48 hs en limpieza.",
                "action": {"label": "Ver vestidos", "url": "/dresses"},
            }
        )

    if maintenance_delayed > 0:
        alerts.append(
            {
                "type": "DRESSES_MAINTENANCE_DELAYED",
                "category": "inventory",
                "level": "high",
                "title": "Vestidos en mantenimiento",
                "message": f"{maintenance_delayed} vestido(s) llevan varios días en reparación.",
                "action": {"label": "Ver vestidos", "url": "/dresses"},
            }
        )

    stock_prediction_alerts, stock_prediction_insights = get_stock_predictions(db, tenant_id)
    production_smart_alerts, production_smart_insights = get_production_smart_alerts(db, tenant_id)
    profitability_insights = get_profitability_insights(db, tenant_id)

    alerts.extend(stock_prediction_alerts)
    alerts.extend(production_smart_alerts)
    alerts = _prepare_alerts(alerts)

    insights = []

    if avg_ticket > 0:
        insights.append(
            {
                "type": "AVG_TICKET",
                "title": "Ticket promedio",
                "value": round(avg_ticket, 2),
                "description": "Valor promedio histórico por vestido vendido.",
                "tone": "neutral",
            }
        )

    if top_dresses:
        insights.append(
            {
                "type": "TOP_DRESS",
                "title": "Vestido más demandado",
                "value": top_dresses[0]["name"],
                "description": f"{top_dresses[0]['loan_count']} préstamo(s). Evaluá cápsulas similares o reposición.",
                "tone": "success",
            }
        )

    if idle_dresses:
        insights.append(
            {
                "type": "IDLE_INVENTORY",
                "title": "Inventario inmovilizado",
                "value": len(idle_dresses),
                "description": "Vestidos sin rotación. Revisá fotos, precio o estrategia comercial.",
                "tone": "warning",
            }
        )

    insights.extend(stock_prediction_insights)
    insights.extend(production_smart_insights)
    insights.extend(profitability_insights)

    return {
     "dresses": {
         "available": dresses_available,
         "loaned": dresses_loaned,
         "maintenance": dresses_maintenance,
         "sold": dresses_sold,
     },
     "rolls": {
         "available": rolls_available,
         "depleted": rolls_depleted,
     },
     "loans": {
         "active": loans_active,
         "overdue": loans_overdue,
         "due_soon": loans_due_soon,
     },
 
     # NUEVO
     "kpis": {
         "monthly_revenue": float(monthly_revenue),
         "avg_ticket": avg_ticket,
         "sales_count": sales_count,
     },
 
     "recent_movements": recent_movements,
     "recent_loans": recent_loans,
     "featured_dresses": featured_dresses,
 
     # NUEVO
     "top_dresses": top_dresses,
     "idle_dresses": idle_dresses,
 
     "alerts": alerts,
     "insights": insights,
    }

@router.get("/financial-summary")
def financial_summary(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    tenant_id = membership.tenant_id

    summary = db.execute(
        text("""
            SELECT
                COUNT(DISTINCT s.id) AS sales_count,

                COALESCE(SUM(
                    CASE
                        WHEN si.currency = 'ARS' THEN si.line_total
                        ELSE 0
                    END
                ), 0) AS total_ars,

                COALESCE(SUM(
                    CASE
                        WHEN si.currency = 'USD' THEN si.line_total
                        ELSE 0
                    END
                ), 0) AS total_usd,

                COALESCE(AVG(
                    CASE
                        WHEN sale_totals.items_total_ars > 0 THEN sale_totals.items_total_ars
                        ELSE NULL
                    END
                ), 0) AS avg_ticket_ars,

                COALESCE(AVG(
                    CASE
                        WHEN sale_totals.items_total_usd > 0 THEN sale_totals.items_total_usd
                        ELSE NULL
                    END
                ), 0) AS avg_ticket_usd,

                COALESCE(SUM(
                    CASE
                        WHEN sale_totals.items_total_ars > 0 THEN 1
                        ELSE 0
                    END
                ), 0) AS sales_count_ars,

                COALESCE(SUM(
                    CASE
                        WHEN sale_totals.items_total_usd > 0 THEN 1
                        ELSE 0
                    END
                ), 0) AS sales_count_usd

            FROM sales s
            LEFT JOIN sale_items si
                ON si.sale_id = s.id
            LEFT JOIN (
                SELECT
                    sale_id,
                    SUM(CASE WHEN currency = 'ARS' THEN line_total ELSE 0 END) AS items_total_ars,
                    SUM(CASE WHEN currency = 'USD' THEN line_total ELSE 0 END) AS items_total_usd
                FROM sale_items
                GROUP BY sale_id
            ) sale_totals
                ON sale_totals.sale_id = s.id
            WHERE s.tenant_id = :tenant_id
              AND COALESCE(s.status, 'COMPLETED') != 'CANCELLED'
        """),
        {"tenant_id": str(tenant_id)},
    ).mappings().first()

    monthly_rows = db.execute(
        text("""
            SELECT
                DATE_TRUNC('month', s.sale_date) AS month,
                COALESCE(SUM(CASE WHEN si.currency = 'ARS' THEN si.line_total ELSE 0 END), 0) AS total_ars,
                COALESCE(SUM(CASE WHEN si.currency = 'USD' THEN si.line_total ELSE 0 END), 0) AS total_usd,
                COUNT(DISTINCT s.id) AS sales_count
            FROM sales s
            LEFT JOIN sale_items si
                ON si.sale_id = s.id
            WHERE s.tenant_id = :tenant_id
              AND s.sale_date IS NOT NULL
              AND COALESCE(s.status, 'COMPLETED') != 'CANCELLED'
            GROUP BY DATE_TRUNC('month', s.sale_date)
            ORDER BY DATE_TRUNC('month', s.sale_date)
        """),
        {"tenant_id": str(tenant_id)},
    ).mappings().all()

    payment_method_rows = db.execute(
        text("""
            SELECT
                COALESCE(payment_method, 'other') AS payment_method,
                COUNT(*) AS operations_count,
                COALESCE(SUM(CASE WHEN currency = 'ARS' THEN amount ELSE 0 END), 0) AS total_ars,
                COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount ELSE 0 END), 0) AS total_usd
            FROM sale_payments
            WHERE tenant_id = :tenant_id
            GROUP BY COALESCE(payment_method, 'other')
            ORDER BY operations_count DESC, payment_method ASC
        """),
        {"tenant_id": str(tenant_id)},
    ).mappings().all()

    return {
        "sales_count": int(summary["sales_count"] or 0),
        "total_ars": float(summary["total_ars"] or 0),
        "total_usd": float(summary["total_usd"] or 0),
        "avg_ticket_ars": float(summary["avg_ticket_ars"] or 0),
        "avg_ticket_usd": float(summary["avg_ticket_usd"] or 0),
        "sales_count_ars": int(summary["sales_count_ars"] or 0),
        "sales_count_usd": int(summary["sales_count_usd"] or 0),
        "monthly": [
            {
                "month": row["month"].strftime("%Y-%m") if row["month"] else "",
                "total_ars": float(row["total_ars"] or 0),
                "total_usd": float(row["total_usd"] or 0),
                "sales_count": int(row["sales_count"] or 0),
            }
            for row in monthly_rows
        ],
        "payment_methods": [
            {
                "payment_method": row["payment_method"],
                "operations_count": int(row["operations_count"] or 0),
                "total_ars": float(row["total_ars"] or 0),
                "total_usd": float(row["total_usd"] or 0),
            }
            for row in payment_method_rows
        ],
    }

@router.get("/operational-summary")
def operational_summary(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
):
    tenant_id = membership.tenant_id
    today = date.today()
    due_soon_limit = today + timedelta(days=3)

    orders_rows = db.execute(
        select(ProductionOrder).where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.deleted_at.is_(None),
        )
    ).scalars().all()

    active_orders = 0
    delayed_orders = 0
    due_soon_orders = 0

    workshops_map: dict[str, int] = {}
    orders: list[dict] = []

    for order in orders_rows:
        status = (order.status or "").upper()
        is_open = status not in {"COMPLETED", "CANCELLED"}

        workshop_name = None
        if order.workshop_supplier_id:
            supplier = db.execute(
                select(Supplier).where(
                    Supplier.id == order.workshop_supplier_id,
                    Supplier.tenant_id == tenant_id,
                    Supplier.deleted_at.is_(None),
                )
            ).scalar_one_or_none()
            workshop_name = supplier.name if supplier else None

        days_late = 0
        due_state = "normal"

        if is_open:
            active_orders += 1

            if order.due_date:
                if order.due_date < today:
                    delayed_orders += 1
                    days_late = (today - order.due_date).days
                    due_state = "delayed"
                elif order.due_date <= due_soon_limit:
                    due_soon_orders += 1
                    due_state = "due_soon"

            if workshop_name:
                workshops_map[workshop_name] = workshops_map.get(workshop_name, 0) + 1

        orders.append(
            {
                "id": str(order.id),
                "code": order.order_number,
                "status": order.status,
                "priority": order.priority,
                "workshop": workshop_name,
                "target_name": order.target_dress_name,
                "target_code": order.target_dress_code,
                "due_date": str(order.due_date) if order.due_date else None,
                "days_late": days_late,
                "due_state": due_state,
            }
        )

    workshops = [
        {"name": name, "active_orders": qty}
        for name, qty in sorted(workshops_map.items(), key=lambda item: item[1], reverse=True)
    ]

    accessories_low = db.execute(
        select(func.count()).select_from(Accessory).where(
            Accessory.tenant_id == tenant_id,
            Accessory.deleted_at.is_(None),
            Accessory.stock <= Accessory.min_stock,
        )
    ).scalar_one()

    trims_low = db.execute(
        select(func.count()).select_from(Trim).where(
            Trim.tenant_id == tenant_id,
            Trim.deleted_at.is_(None),
            Trim.current_stock <= Trim.min_stock,
        )
    ).scalar_one()

    recent_open_orders = sorted(
        [row for row in orders if (row["status"] or "").upper() not in {"COMPLETED", "CANCELLED"}],
        key=lambda row: (
            0 if row["due_state"] == "delayed" else 1 if row["due_state"] == "due_soon" else 2,
            row["due_date"] or "9999-12-31",
            row["code"] or "",
        ),
    )[:8]

    return {
        "production": {
            "active": active_orders,
            "delayed": delayed_orders,
            "due_soon": due_soon_orders,
        },
        "stock_alerts": {
            "accessories_low": int(accessories_low or 0),
            "trims_low": int(trims_low or 0),
        },
        "workshops": workshops,
        "orders": recent_open_orders,
    }

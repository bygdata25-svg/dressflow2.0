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
        alerts.append({
            "type": "OVERDUE_LOANS",
            "level": "high",
            "title": "Préstamos vencidos",
            "message": f"{loans_overdue} préstamo(s) requieren acción inmediata.",
            "action": {
                "label": "Ver préstamos",
                "url": "/loans?filter=overdue"
            }
        })

    if loans_due_soon > 0:
        alerts.append(
            {
                "level": "medium",
                "title": "Devoluciones próximas",
                "message": f"{loans_due_soon} devolución(es) en los próximos días.",
            }
        )

    if rolls_depleted > 0:
           alerts.append({
               "type": "FABRIC_DEPLETED",
               "level": "medium",
               "title": "Rollos sin stock",
               "message": f"{rolls_depleted} rollo(s) agotados.",
               "action": {
                   "label": "Ver telas",
                   "url": "/fabric-rolls"
               }
           })
            
    if idle_dresses:
          alerts.append({
              "type": "IDLE_DRESSES",
              "level": "low",
              "title": "Vestidos sin movimiento",
              "message": f"{len(idle_dresses)} vestidos sin uso en 60+ días.",
              "action": {
                  "label": "Ver vestidos",
                  "url": "/dresses?filter=idle"
              }
          }) 

    if cleaning_delayed > 0:
        alerts.append({
            "level": "medium",
            "title": "Vestidos en limpieza",
            "message": f"{cleaning_delayed} vestido(s) llevan más de 48 hs en limpieza.",
        })

    if maintenance_delayed > 0:
        alerts.append({
            "level": "high",
            "title": "Vestidos en mantenimiento",
            "message": f"{maintenance_delayed} vestido(s) llevan varios días en reparación.",
        })

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

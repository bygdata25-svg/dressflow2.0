from datetime import date, datetime, time, timezone
from uuid import UUID as UUIDType

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.database import get_db
from app.core.exceptions import AppException
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.dress import Dress
from app.models.loan import Loan
from app.schemas.loan import LoanCreate, LoanResponse
from app.services.audit_service import create_audit_log

router = APIRouter(prefix="/loans", tags=["loans"])


def build_loan_response(db: Session, loan: Loan) -> LoanResponse:
    dress = db.execute(
        select(Dress).where(Dress.id == loan.dress_id)
    ).scalar_one_or_none()

    customer = db.execute(
        select(Customer).where(Customer.id == loan.customer_id)
    ).scalar_one_or_none()

    return LoanResponse(
        id=loan.id,
        tenant_id=loan.tenant_id,
        dress_id=loan.dress_id,
        customer_id=loan.customer_id,
        start_date=loan.start_date,
        expected_return_date=loan.expected_return_date,
        actual_return_date=loan.actual_return_date,
        status=loan.status,
        loan_type=loan.loan_type,
        amount=float(loan.amount) if loan.amount is not None else None,
        notes=loan.notes,
        dress_code=dress.code if dress else None,
        dress_name=dress.name if dress else None,
        customer_full_name=(
            f"{customer.first_name} {customer.last_name}" if customer else None
        ),
    )


def build_return_appointment_start_at(expected_return_date: date) -> datetime:
    return datetime.combine(
        expected_return_date,
        time(hour=18, minute=0),
        tzinfo=timezone.utc,
    )


@router.get("")
def list_loans(
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager", "staff")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    search: str | None = None,
    loan_type: str | None = None,
    dress_id: UUIDType | None = None,
):
    query = select(Loan).where(
        Loan.tenant_id == membership.tenant_id,
        Loan.deleted_at.is_(None),
    )

    if status:
        query = query.where(Loan.status == status)

    if loan_type:
        query = query.where(Loan.loan_type == loan_type.strip().upper())

    if dress_id:
        query = query.where(Loan.dress_id == dress_id)

    if search:
        like_value = f"%{search}%"

        matching_dress_ids = db.execute(
            select(Dress.id).where(
                Dress.tenant_id == membership.tenant_id,
                Dress.deleted_at.is_(None),
                or_(
                    Dress.code.ilike(like_value),
                    Dress.name.ilike(like_value),
                ),
            )
        ).scalars().all()

        matching_customer_ids = db.execute(
            select(Customer.id).where(
                Customer.tenant_id == membership.tenant_id,
                Customer.deleted_at.is_(None),
                or_(
                    Customer.first_name.ilike(like_value),
                    Customer.last_name.ilike(like_value),
                    Customer.email.ilike(like_value),
                    Customer.phone.ilike(like_value),
                ),
            )
        ).scalars().all()

        if matching_dress_ids or matching_customer_ids:
            query = query.where(
                or_(
                    Loan.dress_id.in_(matching_dress_ids or [None]),
                    Loan.customer_id.in_(matching_customer_ids or [None]),
                    Loan.notes.ilike(like_value),
                )
            )
        else:
            query = query.where(False)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()

    rows = db.execute(
        query.order_by(Loan.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()

    return {
        "items": [build_loan_response(db, row).model_dump(mode="json") for row in rows],
        "page": page,
        "page_size": page_size,
        "total": total,
    }


@router.post("", response_model=LoanResponse)
def create_loan(
    payload: LoanCreate,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    dress = db.execute(
        select(Dress).where(
            Dress.id == payload.dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    customer = db.execute(
        select(Customer).where(
            Customer.id == payload.customer_id,
            Customer.tenant_id == membership.tenant_id,
            Customer.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not customer:
        raise AppException(404, "Customer not found", "CUSTOMER_NOT_FOUND")

    active_loan = db.execute(
        select(Loan).where(
            Loan.tenant_id == membership.tenant_id,
            Loan.dress_id == payload.dress_id,
            Loan.status == "ACTIVE",
            Loan.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if active_loan or dress.status == "LOANED":
        raise AppException(400, "Dress is already loaned", "LOAN_DRESS_ALREADY_LOANED")

    normalized_type = payload.loan_type.strip().upper()

    if normalized_type == "RENTAL" and (payload.amount is None or payload.amount <= 0):
        raise AppException(
            400,
            "Rental amount must be greater than zero",
            "LOAN_RENTAL_AMOUNT_REQUIRED",
        )

    loan = Loan(
        tenant_id=membership.tenant_id,
        dress_id=payload.dress_id,
        customer_id=payload.customer_id,
        start_date=payload.start_date,
        expected_return_date=payload.expected_return_date,
        notes=payload.notes,
        status="ACTIVE",
        loan_type=normalized_type,
        amount=payload.amount,
    )

    dress.status = "RENTED" if normalized_type == "RENTAL" else "LOANED"

    db.add(loan)
    db.flush()

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="loan",
        entity_id=loan.id,
        action="create",
        payload={
            "dress_id": str(loan.dress_id),
            "customer_id": str(loan.customer_id),
            "start_date": str(loan.start_date),
            "loan_type": loan.loan_type,
            "amount": float(loan.amount) if loan.amount is not None else None,
        },
    )

    if loan.expected_return_date:
        appointment = Appointment(
            tenant_id=membership.tenant_id,
            title=dress.code or dress.name or "Dress",
            description=None,
            appointment_type="RETURN",
            status="SCHEDULED",
            start_at=build_return_appointment_start_at(loan.expected_return_date),
            end_at=None,
            customer_id=loan.customer_id,
            dress_id=loan.dress_id,
            loan_id=loan.id,
            production_order_id=None,
            assigned_user_id=None,
            color=None,
            notes=None,
        )

        db.add(appointment)

    db.commit()
    db.refresh(loan)

    return build_loan_response(db, loan)


@router.post("/{loan_id}/return", response_model=LoanResponse)
def return_loan(
    loan_id: UUIDType,
    db: Session = Depends(get_db),
    membership=Depends(require_roles("admin", "manager")),
):
    loan = db.execute(
        select(Loan).where(
            Loan.id == loan_id,
            Loan.tenant_id == membership.tenant_id,
            Loan.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not loan:
        raise AppException(404, "Loan not found", "LOAN_NOT_FOUND")

    if loan.status != "ACTIVE":
        raise AppException(400, "Loan is not active", "LOAN_NOT_ACTIVE")

    dress = db.execute(
        select(Dress).where(
            Dress.id == loan.dress_id,
            Dress.tenant_id == membership.tenant_id,
            Dress.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if not dress:
        raise AppException(404, "Dress not found", "DRESS_NOT_FOUND")

    loan.status = "RETURNED"
    loan.actual_return_date = datetime.now(timezone.utc)
    dress.status = "AVAILABLE"

    create_audit_log(
        db=db,
        tenant_id=membership.tenant_id,
        user_id=membership.user_id,
        entity_type="loan",
        entity_id=loan.id,
        action="return",
        payload={
            "returned_at": str(loan.actual_return_date),
            "loan_type": loan.loan_type,
            "amount": float(loan.amount) if loan.amount is not None else None,
        },
    )

    db.commit()
    db.refresh(loan)

    return build_loan_response(db, loan)

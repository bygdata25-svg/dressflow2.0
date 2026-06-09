"""
Carga incremental de datos demo premium para DressFlow.

Objetivo:
- Agregar datos sobre el tenant demo sin borrar ni pisar datos existentes.
- Generar volumen realista para lucir dashboards, agenda, ventas, producción y reportes.
- Ser idempotente: si se ejecuta más de una vez, no duplica los registros creados por este script.

Uso sugerido desde la raíz del backend:

    python scripts/append_demo_premium_data.py --tenant-slug demo

Opcional:

    python scripts/append_demo_premium_data.py --tenant-slug demo --dry-run

Notas:
- No elimina registros.
- Usa prefijos DMP-* para identificar la carga premium.
- Requiere que el backend tenga configurado SessionLocal en app.core.database o app.db.session.
"""

from __future__ import annotations

import argparse
import random
import sys
import uuid
from pathlib import Path
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable, Sequence

from sqlalchemy import text
from sqlalchemy.orm import Session


def ensure_backend_on_path() -> None:
    """Permite ejecutar el script desde la raíz del proyecto o desde /backend."""
    current_file = Path(__file__).resolve()
    candidate_roots = [Path.cwd(), current_file.parent, *current_file.parents]

    for root in candidate_roots:
        for candidate in (root, root / "backend"):
            if (candidate / "app").is_dir():
                candidate_str = str(candidate)
                if candidate_str not in sys.path:
                    sys.path.insert(0, candidate_str)
                return


ensure_backend_on_path()

try:
    from app.core.database import SessionLocal
except Exception:  # pragma: no cover
    try:
        from app.db.session import SessionLocal  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "No pude importar SessionLocal. Revisá si está en app.core.database o app.db.session."
        ) from exc

from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.capsule import Capsule
from app.models.dress import Dress
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll
from app.models.trim import Trim
from app.models.accessory import Accessory
from app.models.loan import Loan
from app.models.sale import Sale
from app.models.sale_item import SaleItem
from app.models.sale_payment import SalePayment
from app.models.production_order import ProductionOrder
from app.models.production_order_material import ProductionOrderMaterial
from app.models.production_order_output import ProductionOrderOutput
from app.models.production_order_event import ProductionOrderEvent
from app.models.appointment import Appointment

PREFIX = "DMP"
DEFAULT_TENANT_SLUG = "demo"
RANDOM_SEED = 20260609

random.seed(RANDOM_SEED)


@dataclass(frozen=True)
class DemoCustomerSpec:
    first_name: str
    last_name: str
    email: str
    phone: str
    notes: str


@dataclass(frozen=True)
class DemoDressSpec:
    name: str
    size: str
    color: str
    status: str
    sale_price: Decimal
    rental_price: Decimal
    currency: str
    description: str


@dataclass(frozen=True)
class DemoFabricSpec:
    code: str
    name: str
    fabric_type: str
    color: str
    composition: str
    origin: str
    width_meters: float
    price_per_meter: Decimal
    currency: str


@dataclass(frozen=True)
class DemoTrimSpec:
    code: str
    name: str
    category: str
    unit: str
    stock: Decimal
    min_stock: Decimal
    unit_cost: Decimal
    currency: str


@dataclass(frozen=True)
class DemoAccessorySpec:
    code: str
    name: str
    category: str
    color: str
    stock: int
    min_stock: int
    unit_cost: Decimal
    sale_price: Decimal
    currency: str


@dataclass(frozen=True)
class DemoSupplierSpec:
    code: str
    name: str
    supplier_type: str
    origin: str
    phone: str
    email: str


CUSTOMERS: list[DemoCustomerSpec] = [
    DemoCustomerSpec("Laura", "Martínez", "laura.martinez.demo@example.com", "+34 600 100 001", "Novia. Interesada en línea sirena premium."),
    DemoCustomerSpec("Sofía", "Fernández", "sofia.fernandez.demo@example.com", "+34 600 100 002", "Novia. Busca vestido corte A con encaje."),
    DemoCustomerSpec("Camila", "Torres", "camila.torres.demo@example.com", "+34 600 100 003", "Vestido civil y velo corto."),
    DemoCustomerSpec("Valentina", "Ruiz", "valentina.ruiz.demo@example.com", "+34 600 100 004", "Prueba final pendiente."),
    DemoCustomerSpec("Marina", "Delgado", "marina.delgado.demo@example.com", "+34 600 100 005", "Ajuste de largo y cintura."),
    DemoCustomerSpec("Lucía", "Herrera", "lucia.herrera.demo@example.com", "+34 600 100 006", "Madrina. Vestido azul noche."),
    DemoCustomerSpec("Clara", "Molina", "clara.molina.demo@example.com", "+34 600 100 007", "Showroom novia Madrid."),
    DemoCustomerSpec("Ana", "Beltrán", "ana.beltran.demo@example.com", "+34 600 100 008", "Segunda prueba agendada."),
    DemoCustomerSpec("Paula", "Navarro", "paula.navarro.demo@example.com", "+34 600 100 009", "Interesada en vestido princesa."),
    DemoCustomerSpec("Isabel", "Romero", "isabel.romero.demo@example.com", "+34 600 100 010", "Vestido invitada premium."),
    DemoCustomerSpec("Martina", "Vidal", "martina.vidal.demo@example.com", "+34 600 100 011", "Novia. Colección cápsula 2026."),
    DemoCustomerSpec("Carolina", "Suárez", "carolina.suarez.demo@example.com", "+34 600 100 012", "Entrega próxima semana."),
    DemoCustomerSpec("Elena", "Castro", "elena.castro.demo@example.com", "+34 600 100 013", "Vestido corte A con tul bordado."),
    DemoCustomerSpec("Victoria", "León", "victoria.leon.demo@example.com", "+34 600 100 014", "Novia curvy. Prueba inicial."),
    DemoCustomerSpec("Natalia", "Ortega", "natalia.ortega.demo@example.com", "+34 600 100 015", "Vestido sirena con pedrería."),
    DemoCustomerSpec("Marta", "Santos", "marta.santos.demo@example.com", "+34 600 100 016", "Vestido fiesta verde oliva."),
    DemoCustomerSpec("Alicia", "Pérez", "alicia.perez.demo@example.com", "+34 600 100 017", "Velo catedral y tocado."),
    DemoCustomerSpec("Teresa", "Moreno", "teresa.moreno.demo@example.com", "+34 600 100 018", "Madrina. Ajuste hombros."),
    DemoCustomerSpec("Beatriz", "García", "beatriz.garcia.demo@example.com", "+34 600 100 019", "Novia. Presupuesto alto."),
    DemoCustomerSpec("Inés", "Ramos", "ines.ramos.demo@example.com", "+34 600 100 020", "Vestido midi civil."),
    DemoCustomerSpec("Javier", "Romero", "javier.romero.demo@example.com", "+34 600 100 021", "Traje novio ceremonia."),
    DemoCustomerSpec("Álvaro", "Núñez", "alvaro.nunez.demo@example.com", "+34 600 100 022", "Chaqué padrino."),
    DemoCustomerSpec("Miguel", "Serrano", "miguel.serrano.demo@example.com", "+34 600 100 023", "Esmoquin negro."),
    DemoCustomerSpec("Pablo", "Iglesias", "pablo.iglesias.demo@example.com", "+34 600 100 024", "Traje invitado azul noche."),
    DemoCustomerSpec("Diego", "Cabrera", "diego.cabrera.demo@example.com", "+34 600 100 025", "Ajuste traje novio."),
    DemoCustomerSpec("Nuria", "Blanco", "nuria.blanco.demo@example.com", "+34 600 100 026", "Vestido ceremonia corto."),
    DemoCustomerSpec("Rocío", "Vega", "rocio.vega.demo@example.com", "+34 600 100 027", "Alquiler vestido fiesta."),
    DemoCustomerSpec("Sara", "Campos", "sara.campos.demo@example.com", "+34 600 100 028", "Entrega vestido invitada."),
    DemoCustomerSpec("Carmen", "Gil", "carmen.gil.demo@example.com", "+34 600 100 029", "Prueba showroom Barcelona."),
    DemoCustomerSpec("Julia", "Reyes", "julia.reyes.demo@example.com", "+34 600 100 030", "Novia. Diseño personalizado."),
]

SUPPLIERS: list[DemoSupplierSpec] = [
    DemoSupplierSpec("DMP-SUP-001", "Taller Costura Madrid", "WORKSHOP", "Madrid", "+34 910 100 001", "taller.madrid.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-002", "Bordados Elena", "WORKSHOP", "Valencia", "+34 910 100 002", "bordados.elena.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-003", "Textiles Barcelona", "FABRIC_SUPPLIER", "Barcelona", "+34 910 100 003", "textiles.barcelona.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-004", "Encajes del Sur", "FABRIC_SUPPLIER", "Sevilla", "+34 910 100 004", "encajes.sur.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-005", "Sastrería Martín", "WORKSHOP", "Madrid", "+34 910 100 005", "sastreria.martin.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-006", "Cristales y Pedrería Europa", "TRIM_SUPPLIER", "Barcelona", "+34 910 100 006", "cristales.europa.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-007", "Atelier Interno Premium", "WORKSHOP", "Madrid", "+34 910 100 007", "atelier.interno.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-008", "Modista Externa Carmen", "WORKSHOP", "Málaga", "+34 910 100 008", "carmen.modista.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-009", "Tules y Organza Valencia", "FABRIC_SUPPLIER", "Valencia", "+34 910 100 009", "tules.valencia.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-010", "Avíos Nupciales Murcia", "TRIM_SUPPLIER", "Murcia", "+34 910 100 010", "avios.murcia.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-011", "Planchado Final Sevilla", "SERVICE_PROVIDER", "Sevilla", "+34 910 100 011", "planchado.sevilla.demo@example.com"),
    DemoSupplierSpec("DMP-SUP-012", "Control Calidad Bridal", "SERVICE_PROVIDER", "Madrid", "+34 910 100 012", "calidad.bridal.demo@example.com"),
]

FABRICS: list[DemoFabricSpec] = [
    DemoFabricSpec("DMP-FAB-001", "Mikado premium", "MIKADO", "Ivory", "100% seda", "Italia", 1.50, Decimal("52.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-002", "Crepe couture", "CREPE", "Off white", "Seda y viscosa", "España", 1.45, Decimal("38.50"), "EUR"),
    DemoFabricSpec("DMP-FAB-003", "Tul ilusión", "TUL", "Blanco natural", "Poliamida", "Francia", 3.00, Decimal("18.20"), "EUR"),
    DemoFabricSpec("DMP-FAB-004", "Encaje chantilly", "ENCAJE", "Ivory", "Algodón y nylon", "Francia", 1.20, Decimal("64.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-005", "Organza bridal", "ORGANZA", "Champagne", "Seda", "Italia", 1.50, Decimal("42.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-006", "Satén fluido", "SATEN", "Nude", "Poliéster premium", "España", 1.50, Decimal("24.90"), "EUR"),
    DemoFabricSpec("DMP-FAB-007", "Gasa ceremonia", "GASA", "Rosa empolvado", "Poliéster", "España", 1.50, Decimal("16.80"), "EUR"),
    DemoFabricSpec("DMP-FAB-008", "Guipur floral", "GUIPUR", "Ivory", "Algodón", "Portugal", 1.30, Decimal("49.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-009", "Raso sastrería", "RASO", "Azul noche", "Viscosa", "España", 1.50, Decimal("21.50"), "EUR"),
    DemoFabricSpec("DMP-FAB-010", "Jacquard madrina", "JACQUARD", "Verde oliva", "Poliéster y algodón", "Italia", 1.40, Decimal("35.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-011", "Brocado fiesta", "BROCADO", "Dorado", "Poliéster premium", "España", 1.40, Decimal("28.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-012", "Forro premium", "FORRO", "Ivory", "Acetato", "España", 1.50, Decimal("8.90"), "EUR"),
    DemoFabricSpec("DMP-FAB-013", "Tul bordado perlas", "TUL_BORDADO", "Ivory", "Poliamida y perlas", "Francia", 1.30, Decimal("78.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-014", "Paño ceremonia", "SASTRERIA", "Negro", "Lana fría", "Italia", 1.50, Decimal("44.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-015", "Lino ceremonia", "LINO", "Arena", "Lino y algodón", "España", 1.50, Decimal("19.80"), "EUR"),
    DemoFabricSpec("DMP-FAB-016", "Encaje 3D floral", "ENCAJE", "Ivory", "Poliéster y algodón", "Italia", 1.20, Decimal("82.00"), "EUR"),
    DemoFabricSpec("DMP-FAB-017", "Tul soft capas", "TUL", "Blush", "Poliamida", "España", 3.00, Decimal("14.90"), "EUR"),
    DemoFabricSpec("DMP-FAB-018", "Crepe sastrería", "CREPE", "Marfil", "Viscosa premium", "Portugal", 1.45, Decimal("32.00"), "EUR"),
]

TRIMS: list[DemoTrimSpec] = [
    DemoTrimSpec("DMP-TRM-001", "Cierre invisible ivory", "CLOSURE", "unit", Decimal("120"), Decimal("20"), Decimal("1.40"), "EUR"),
    DemoTrimSpec("DMP-TRM-002", "Botón forrado seda", "BUTTON", "unit", Decimal("240"), Decimal("30"), Decimal("0.85"), "EUR"),
    DemoTrimSpec("DMP-TRM-003", "Perlas 4 mm", "BEADING", "unit", Decimal("3500"), Decimal("500"), Decimal("0.03"), "EUR"),
    DemoTrimSpec("DMP-TRM-004", "Cristal Swarovski", "BEADING", "unit", Decimal("1800"), Decimal("250"), Decimal("0.12"), "EUR"),
    DemoTrimSpec("DMP-TRM-005", "Canutillo plata", "BEADING", "grams", Decimal("950"), Decimal("120"), Decimal("0.09"), "EUR"),
    DemoTrimSpec("DMP-TRM-006", "Broche corsetería", "CLOSURE", "unit", Decimal("70"), Decimal("10"), Decimal("2.20"), "EUR"),
    DemoTrimSpec("DMP-TRM-007", "Ballena flexible", "STRUCTURE", "meters", Decimal("180"), Decimal("30"), Decimal("1.10"), "EUR"),
    DemoTrimSpec("DMP-TRM-008", "Copa interior", "STRUCTURE", "pair", Decimal("80"), Decimal("12"), Decimal("3.60"), "EUR"),
    DemoTrimSpec("DMP-TRM-009", "Entretela fina", "INTERLINING", "meters", Decimal("220"), Decimal("40"), Decimal("2.10"), "EUR"),
    DemoTrimSpec("DMP-TRM-010", "Cinta gross", "RIBBON", "meters", Decimal("300"), Decimal("50"), Decimal("0.55"), "EUR"),
    DemoTrimSpec("DMP-TRM-011", "Aplique floral ivory", "APPLIQUE", "unit", Decimal("95"), Decimal("15"), Decimal("4.80"), "EUR"),
    DemoTrimSpec("DMP-TRM-012", "Puntilla chantilly", "LACE", "meters", Decimal("160"), Decimal("25"), Decimal("6.40"), "EUR"),
]

ACCESSORIES: list[DemoAccessorySpec] = [
    DemoAccessorySpec("DMP-ACC-001", "Velo catedral ivory", "VELO", "Ivory", 12, 2, Decimal("82.00"), Decimal("280.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-002", "Velo corto civil", "VELO", "Off white", 15, 3, Decimal("36.00"), Decimal("140.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-003", "Tocado perlas premium", "TOCADO", "Ivory", 20, 4, Decimal("42.00"), Decimal("160.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-004", "Cinturón pedrería", "BELT", "Plata", 18, 3, Decimal("28.00"), Decimal("120.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-005", "Funda vestido premium", "PACKAGING", "Blanco", 35, 8, Decimal("12.00"), Decimal("45.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-006", "Capa tul soft", "CAPE", "Ivory", 8, 2, Decimal("65.00"), Decimal("220.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-007", "Guantes ceremonia", "GLOVES", "Ivory", 25, 5, Decimal("9.50"), Decimal("45.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-008", "Peineta floral", "HAIR", "Dorado", 18, 4, Decimal("18.00"), Decimal("78.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-009", "Lazo desmontable", "DETAIL", "Ivory", 10, 2, Decimal("22.00"), Decimal("90.00"), "EUR"),
    DemoAccessorySpec("DMP-ACC-010", "Bolero encaje", "BOLERO", "Ivory", 7, 2, Decimal("58.00"), Decimal("190.00"), "EUR"),
]

DRESS_NAMES = [
    "Vestido novia sirena Amalfi",
    "Vestido princesa Verona",
    "Vestido corte A Siena",
    "Vestido civil Capri",
    "Vestido midi Roma",
    "Vestido madrina Florencia",
    "Vestido invitada Toscana",
    "Vestido curvy Milano",
    "Vestido tul bordado Lucca",
    "Vestido minimal Como",
    "Traje novio ceremonia Napoli",
    "Chaqué padrino Torino",
    "Esmoquin negro Palermo",
    "Traje azul noche Genova",
    "Mono ceremonia Ravenna",
]

SIZES = ["XS", "S", "M", "L", "XL", "38", "40", "42", "44", "46", "48", "50"]
COLORS = ["Ivory", "Off white", "Blanco natural", "Champagne", "Nude", "Azul noche", "Verde oliva", "Negro", "Rosa empolvado"]
DRESS_STATUSES = ["AVAILABLE", "AVAILABLE", "AVAILABLE", "SOLD", "LOANED", "MAINTENANCE", "CLEANING"]

PRODUCTION_STATUSES = [
    "DRAFT",
    "APPROVED",
    "MATERIALS_RESERVED",
    "IN_PRODUCTION",
    "RECEIVED_PARTIAL",
    "COMPLETED",
]

PRODUCTION_PROCESSES = [
    ("MOLDERIA", "Moldería"),
    ("CUTTING", "Corte"),
    ("SEWING", "Costura"),
    ("EMBROIDERY", "Bordado"),
    ("BEADING", "Pedrería"),
    ("FITTING", "Prueba"),
    ("ADJUSTMENTS", "Ajustes"),
    ("FINISHING", "Terminación"),
    ("QUALITY_CONTROL", "Control de calidad"),
]

PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "BIZUM", "MERCADO_PAGO"]


def as_decimal(value: Any) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today() -> date:
    return date.today()


def get_tenant_id(db: Session, tenant_slug: str) -> uuid.UUID:
    row = db.execute(
        text("SELECT id FROM tenants WHERE slug = :slug LIMIT 1"),
        {"slug": tenant_slug},
    ).first()

    if not row:
        raise RuntimeError(f"No encontré tenant con slug '{tenant_slug}'.")

    return row[0]


def get_first_user_id(db: Session, tenant_id: uuid.UUID) -> uuid.UUID | None:
    # Primero intenta user_tenants, que es el modelo más habitual en DressFlow multi-tenant.
    try:
        row = db.execute(
            text(
                """
                SELECT u.id
                FROM users u
                JOIN user_tenants ut ON ut.user_id = u.id
                WHERE ut.tenant_id = :tenant_id
                ORDER BY u.created_at NULLS LAST
                LIMIT 1
                """
            ),
            {"tenant_id": tenant_id},
        ).first()
        if row:
            return row[0]
    except Exception:
        db.rollback()

    try:
        row = db.execute(
            text("SELECT id FROM users ORDER BY created_at NULLS LAST LIMIT 1")
        ).first()
        return row[0] if row else None
    except Exception:
        db.rollback()
        return None


def get_or_create(db: Session, model: type, defaults: dict[str, Any] | None = None, **lookup: Any):
    instance = db.query(model).filter_by(**lookup).first()

    if instance:
        return instance, False

    data = {**lookup, **(defaults or {})}
    instance = model(**data)
    db.add(instance)
    db.flush()
    return instance, True


def create_customers(db: Session, tenant_id: uuid.UUID) -> tuple[list[Customer], int]:
    created = 0
    customers: list[Customer] = []

    for index, spec in enumerate(CUSTOMERS, start=1):
        code = f"{PREFIX}-CUS-{index:04d}"
        customer, was_created = get_or_create(
            db,
            Customer,
            tenant_id=tenant_id,
            code=code,
            defaults={
                "first_name": spec.first_name,
                "last_name": spec.last_name,
                "email": spec.email,
                "phone": spec.phone,
                "tax_id": f"DMP{index:08d}",
                "notes": f"Demo Premium · {spec.notes}",
            },
        )
        customers.append(customer)
        created += int(was_created)

    return customers, created


def create_suppliers(db: Session, tenant_id: uuid.UUID) -> tuple[list[Supplier], int]:
    created = 0
    suppliers: list[Supplier] = []

    for spec in SUPPLIERS:
        supplier, was_created = get_or_create(
            db,
            Supplier,
            tenant_id=tenant_id,
            supplier_code=spec.code,
            defaults={
                "name": spec.name,
                "supplier_type": spec.supplier_type,
                "origin": spec.origin,
                "phone": spec.phone,
                "email": spec.email,
                "is_active": True,
                "notes": "Demo Premium · Proveedor para presentación comercial.",
            },
        )
        suppliers.append(supplier)
        created += int(was_created)

    return suppliers, created


def create_capsule(db: Session, tenant_id: uuid.UUID) -> tuple[Capsule, bool]:
    capsule, was_created = get_or_create(
        db,
        Capsule,
        tenant_id=tenant_id,
        name="Demo Premium Bridal 2026",
        defaults={
            "description": "Colección demo premium para presentaciones DressFlow.",
            "is_active": True,
        },
    )
    return capsule, was_created


def create_fabrics_and_rolls(
    db: Session,
    tenant_id: uuid.UUID,
    suppliers: Sequence[Supplier],
) -> tuple[list[Fabric], list[FabricRoll], int, int]:
    fabric_suppliers = [supplier for supplier in suppliers if supplier.supplier_type == "FABRIC_SUPPLIER"] or list(suppliers)
    created_fabrics = 0
    created_rolls = 0
    fabrics: list[Fabric] = []
    rolls: list[FabricRoll] = []

    for index, spec in enumerate(FABRICS, start=1):
        supplier = fabric_suppliers[index % len(fabric_suppliers)]
        fabric, was_created = get_or_create(
            db,
            Fabric,
            tenant_id=tenant_id,
            code=spec.code,
            defaults={
                "name": spec.name,
                "fabric_type": spec.fabric_type,
                "color": spec.color,
                "supplier_id": supplier.id,
                "notes": "Demo Premium · Tela cargada para tablero y reportes.",
                "base_name": spec.name,
                "base_code": spec.code,
                "supplier_color": spec.color,
                "supplier_reference": f"REF-{spec.code}",
                "composition": spec.composition,
                "origin": spec.origin,
                "width_meters": spec.width_meters,
                "default_location": random.choice(["Madrid", "Barcelona", "Valencia", "Sevilla"]),
                "has_scraps": index % 4 == 0,
                "is_active": True,
            },
        )
        fabrics.append(fabric)
        created_fabrics += int(was_created)

        for roll_index in range(1, 3 + (index % 2)):
            initial_length = as_decimal(random.choice([18, 22, 24, 28, 32, 36]))
            reserved_length = as_decimal(random.choice([0, 0, 2.5, 4.0, 6.0]))
            consumed = as_decimal(random.choice([0, 1.5, 3.0, 5.0]))
            current_length = max(Decimal("0.00"), initial_length - reserved_length - consumed)
            roll_code = f"{spec.code}-R{roll_index:02d}"
            roll, roll_was_created = get_or_create(
                db,
                FabricRoll,
                tenant_id=tenant_id,
                roll_code=roll_code,
                defaults={
                    "fabric_id": fabric.id,
                    "supplier_id": supplier.id,
                    "initial_length": initial_length,
                    "current_length": current_length,
                    "reserved_length": reserved_length,
                    "unit": "meters",
                    "status": "AVAILABLE" if current_length > Decimal("3") else "LOW_STOCK",
                    "price_per_meter": spec.price_per_meter,
                    "purchase_date": today() - timedelta(days=random.randint(20, 160)),
                    "notes": "Demo Premium · Rollo para stock, reservas y consumo.",
                    "piece_type": "ROLL",
                    "location": random.choice(["Depósito Madrid", "Showroom Barcelona", "Taller Valencia"]),
                    "is_scrap": False,
                    "is_active": True,
                    "currency": spec.currency,
                    "import_batch": "DMP-2026",
                },
            )
            rolls.append(roll)
            created_rolls += int(roll_was_created)

    return fabrics, rolls, created_fabrics, created_rolls


def create_trims(db: Session, tenant_id: uuid.UUID, suppliers: Sequence[Supplier]) -> tuple[list[Trim], int]:
    trim_suppliers = [supplier for supplier in suppliers if supplier.supplier_type == "TRIM_SUPPLIER"] or list(suppliers)
    created = 0
    trims: list[Trim] = []

    for index, spec in enumerate(TRIMS, start=1):
        supplier = trim_suppliers[index % len(trim_suppliers)]
        trim, was_created = get_or_create(
            db,
            Trim,
            tenant_id=tenant_id,
            code=spec.code,
            defaults={
                "name": spec.name,
                "category": spec.category,
                "unit": spec.unit,
                "current_stock": spec.stock,
                "reserved_stock": as_decimal(random.choice([0, 5, 12, 30])),
                "min_stock": spec.min_stock,
                "supplier_id": supplier.id,
                "unit_cost": spec.unit_cost,
                "unit_cost_currency": spec.currency,
                "notes": "Demo Premium · Avío para producción y alertas de stock.",
            },
        )
        trims.append(trim)
        created += int(was_created)

    return trims, created


def create_accessories(db: Session, tenant_id: uuid.UUID) -> tuple[list[Accessory], int]:
    created = 0
    accessories: list[Accessory] = []

    for spec in ACCESSORIES:
        accessory, was_created = get_or_create(
            db,
            Accessory,
            tenant_id=tenant_id,
            code=spec.code,
            defaults={
                "name": spec.name,
                "description": "Demo Premium · Accesorio para ventas mixtas y stock.",
                "category": spec.category,
                "color": spec.color,
                "size": None,
                "unit_cost": spec.unit_cost,
                "unit_cost_currency": spec.currency,
                "sale_price": spec.sale_price,
                "sale_price_currency": spec.currency,
                "stock": spec.stock,
                "min_stock": spec.min_stock,
                "status": "ACTIVE",
                "notes": "Demo Premium · Ideal para mostrar ventas de accesorios.",
            },
        )
        accessories.append(accessory)
        created += int(was_created)

    return accessories, created


def create_dresses(
    db: Session,
    tenant_id: uuid.UUID,
    capsule: Capsule,
) -> tuple[list[Dress], int]:
    created = 0
    dresses: list[Dress] = []

    for index in range(1, 46):
        name = DRESS_NAMES[(index - 1) % len(DRESS_NAMES)]
        is_menswear = any(word in name.lower() for word in ["traje", "chaqué", "esmoquin"])
        base_price = Decimal(random.choice([620, 780, 950, 1200, 1600, 2200, 2800, 3400]))
        if is_menswear:
            base_price = Decimal(random.choice([690, 780, 950, 1250]))

        status = DRESS_STATUSES[(index - 1) % len(DRESS_STATUSES)]
        code = f"{PREFIX}-DRE-{index:04d}"
        dress, was_created = get_or_create(
            db,
            Dress,
            tenant_id=tenant_id,
            code=code,
            defaults={
                "capsule_id": capsule.id,
                "name": f"{name} {index:02d}",
                "description": "Demo Premium · Prenda para catálogo interno, ventas, alquileres y agenda.",
                "size": random.choice(SIZES),
                "color": random.choice(COLORS),
                "status": status,
                "sale_price": base_price,
                "sale_currency": "EUR",
                "rental_price": (base_price * Decimal("0.22")).quantize(Decimal("0.01")),
                "rental_currency": "EUR",
            },
        )
        dresses.append(dress)
        created += int(was_created)

    return dresses, created


def create_production_orders(
    db: Session,
    tenant_id: uuid.UUID,
    suppliers: Sequence[Supplier],
    rolls: Sequence[FabricRoll],
    trims: Sequence[Trim],
    created_by_user_id: uuid.UUID | None,
) -> tuple[list[ProductionOrder], int, int, int, int]:
    workshops = [supplier for supplier in suppliers if supplier.supplier_type in {"WORKSHOP", "SERVICE_PROVIDER"}] or list(suppliers)
    created_orders = 0
    created_materials = 0
    created_outputs = 0
    created_events = 0
    orders: list[ProductionOrder] = []
    base_day = today()

    for index in range(1, 19):
        status = PRODUCTION_STATUSES[(index - 1) % len(PRODUCTION_STATUSES)]
        planned_qty = random.choice([1, 1, 1, 2, 3])
        produced_qty = planned_qty if status == "COMPLETED" else random.choice([0, 0, 1])
        due_date = base_day + timedelta(days=random.randint(-10, 35))
        order_number = f"{PREFIX}-OP-{index:04d}"
        target_name = random.choice(DRESS_NAMES)
        workshop = workshops[index % len(workshops)]
        labor = Decimal(random.choice([180, 240, 320, 450, 620, 780]))
        additional = Decimal(random.choice([0, 45, 80, 120, 180]))
        estimated = labor + additional + Decimal(random.choice([220, 380, 520, 700]))
        actual = estimated + Decimal(random.choice([-40, 0, 65, 120]))

        order, was_created = get_or_create(
            db,
            ProductionOrder,
            tenant_id=tenant_id,
            order_number=order_number,
            defaults={
                "workshop_supplier_id": workshop.id,
                "target_dress_name": target_name,
                "target_dress_code": f"DMP-PROD-{index:04d}",
                "target_size": random.choice(SIZES),
                "target_color": random.choice(COLORS),
                "planned_quantity": planned_qty,
                "produced_quantity": produced_qty,
                "status": status,
                "priority": random.choice(["LOW", "NORMAL", "HIGH", "URGENT"]),
                "due_date": due_date,
                "started_at": now_utc() - timedelta(days=random.randint(3, 25)) if status in {"IN_PRODUCTION", "RECEIVED_PARTIAL", "COMPLETED"} else None,
                "finished_at": now_utc() - timedelta(days=random.randint(1, 8)) if status == "COMPLETED" else None,
                "notes": "Demo Premium · Orden de producción para mostrar workflow, materiales y costos.",
                "received_notes": "Recepción demo con control de calidad." if produced_qty else None,
                "labor_cost": labor,
                "additional_cost": additional,
                "estimated_total_cost": estimated,
                "actual_total_cost": actual,
                "currency": "EUR",
                "created_by_user_id": created_by_user_id,
            },
        )
        orders.append(order)
        created_orders += int(was_created)

        # Materiales: solo se crean si no existían para la OP.
        if was_created:
            selected_rolls = list(rolls)[index : index + 2] or list(rolls)[:2]
            for roll in selected_rolls:
                planned = as_decimal(random.choice([2.5, 3.0, 4.0, 5.5, 7.0]))
                consumed = planned if status in {"RECEIVED_PARTIAL", "COMPLETED"} else as_decimal(random.choice([0, 1.5, 2.0]))
                material = ProductionOrderMaterial(
                    tenant_id=tenant_id,
                    production_order_id=order.id,
                    material_type="FABRIC",
                    fabric_roll_id=roll.id,
                    trim_id=None,
                    description_snapshot=getattr(roll, "roll_code", "Tela demo"),
                    planned_quantity=planned,
                    delivered_quantity=planned if status != "DRAFT" else Decimal("0.00"),
                    consumed_quantity=consumed,
                    returned_quantity=Decimal("0.00"),
                    waste_quantity=as_decimal(random.choice([0, 0.2, 0.4])),
                    unit="meters",
                    unit_cost_snapshot=roll.price_per_meter,
                    notes="Demo Premium · Material textil asignado a OP.",
                    issued_at=now_utc() - timedelta(days=random.randint(1, 18)) if status != "DRAFT" else None,
                )
                db.add(material)
                created_materials += 1

            selected_trims = list(trims)[index : index + 2] or list(trims)[:2]
            for trim in selected_trims:
                planned = as_decimal(random.choice([5, 10, 20, 35, 80]))
                material = ProductionOrderMaterial(
                    tenant_id=tenant_id,
                    production_order_id=order.id,
                    material_type="TRIM",
                    fabric_roll_id=None,
                    trim_id=trim.id,
                    description_snapshot=getattr(trim, "name", "Avío demo"),
                    planned_quantity=planned,
                    delivered_quantity=planned if status != "DRAFT" else Decimal("0.00"),
                    consumed_quantity=planned if status == "COMPLETED" else Decimal("0.00"),
                    returned_quantity=Decimal("0.00"),
                    waste_quantity=Decimal("0.00"),
                    unit=trim.unit,
                    unit_cost_snapshot=trim.unit_cost,
                    notes="Demo Premium · Avío asignado a OP.",
                    issued_at=now_utc() - timedelta(days=random.randint(1, 18)) if status != "DRAFT" else None,
                )
                db.add(material)
                created_materials += 1

            if status in {"RECEIVED_PARTIAL", "COMPLETED"}:
                output = ProductionOrderOutput(
                    tenant_id=tenant_id,
                    production_order_id=order.id,
                    dress_id=None,
                    name=target_name,
                    code=f"DMP-OUT-{index:04d}",
                    size=order.target_size,
                    color=order.target_color,
                    quantity=max(1, produced_qty),
                    unit_cost=actual / max(1, produced_qty or 1),
                    notes="Demo Premium · Output de producción recibido.",
                )
                db.add(output)
                created_outputs += 1

            event_types = ["CREATED", "APPROVED", "MATERIALS_ISSUED", "IN_PROGRESS"]
            if status in {"RECEIVED_PARTIAL", "COMPLETED"}:
                event_types.append("RECEIVED")
            if status == "COMPLETED":
                event_types.append("COMPLETED")

            for event_index, event_type in enumerate(event_types):
                event = ProductionOrderEvent(
                    tenant_id=tenant_id,
                    production_order_id=order.id,
                    event_type=event_type,
                    payload={
                        "source": "append_demo_premium_data",
                        "label": event_type,
                        "demo_order_number": order_number,
                    },
                    created_by_user_id=created_by_user_id,
                    created_at=now_utc() - timedelta(days=max(1, 20 - event_index * 3)),
                )
                db.add(event)
                created_events += 1

    return orders, created_orders, created_materials, created_outputs, created_events


def distribute_sale_dates(total: int) -> list[datetime]:
    # Distribuye ventas entre los últimos 6 meses con tendencia creciente.
    weights = [8, 10, 12, 15, 18, 12]
    month_starts: list[date] = []
    current = today().replace(day=1)
    for offset in range(5, -1, -1):
        year = current.year
        month = current.month - offset
        while month <= 0:
            month += 12
            year -= 1
        month_starts.append(date(year, month, 1))

    dates: list[datetime] = []
    for month_start, count in zip(month_starts, weights):
        for _ in range(count):
            day = random.randint(1, 25)
            hour = random.randint(10, 19)
            minute = random.choice([0, 15, 30, 45])
            dates.append(datetime(month_start.year, month_start.month, min(day, 25), hour, minute))

    while len(dates) < total:
        dates.append(datetime.now() - timedelta(days=random.randint(1, 180)))

    return dates[:total]


def create_sales(
    db: Session,
    tenant_id: uuid.UUID,
    customers: Sequence[Customer],
    dresses: Sequence[Dress],
    accessories: Sequence[Accessory],
) -> tuple[list[Sale], int, int, int]:
    total_sales = 65
    sale_dates = distribute_sale_dates(total_sales)
    created_sales = 0
    created_items = 0
    created_payments = 0
    sales: list[Sale] = []

    for index in range(1, total_sales + 1):
        sale_number = f"{PREFIX}-SAL-{index:04d}"
        existing = db.query(Sale).filter_by(tenant_id=tenant_id, sale_number=sale_number).first()
        if existing:
            sales.append(existing)
            continue

        customer = customers[(index - 1) % len(customers)]
        currency = random.choices(["EUR", "USD", "ARS"], weights=[76, 12, 12], k=1)[0]
        is_accessory_only = index % 5 == 0
        has_accessory = index % 3 == 0 or is_accessory_only
        item_count = 1 + int(has_accessory)
        discount = as_decimal(random.choice([0, 0, 50, 80, 120]))
        total = Decimal("0.00")
        sale = Sale(
            tenant_id=tenant_id,
            sale_number=sale_number,
            customer_id=customer.id,
            sale_date=sale_dates[index - 1],
            currency=currency,
            exchange_rate=Decimal("1.0000") if currency == "EUR" else (Decimal("0.9200") if currency == "USD" else Decimal("0.0010")),
            status=random.choices(["COMPLETED", "PARTIAL", "PENDING"], weights=[80, 15, 5], k=1)[0],
            subtotal_amount=Decimal("0.00"),
            discount_amount=discount,
            total_amount=Decimal("0.00"),
            notes="Demo Premium · Venta multimoneda para dashboard financiero.",
        )
        db.add(sale)
        db.flush()
        sales.append(sale)
        created_sales += 1

        if not is_accessory_only:
            dress = dresses[(index - 1) % len(dresses)]
            price = as_decimal(dress.sale_price or random.choice([780, 1200, 2200, 2800]))
            if currency == "USD":
                price = (price * Decimal("1.08")).quantize(Decimal("0.01"))
            elif currency == "ARS":
                price = (price * Decimal("1200")).quantize(Decimal("0.01"))
            item = SaleItem(
                tenant_id=tenant_id,
                sale_id=sale.id,
                item_type="DRESS",
                dress_id=dress.id,
                accessory_id=None,
                code_snapshot=dress.code,
                description_snapshot=dress.name,
                quantity=1,
                unit_price=price,
                currency=currency,
                line_total=price,
                notes="Demo Premium · Prenda vendida.",
            )
            db.add(item)
            total += price
            created_items += 1

        if has_accessory:
            accessory = accessories[(index - 1) % len(accessories)]
            price = as_decimal(accessory.sale_price or random.choice([80, 120, 180, 280]))
            if currency == "USD":
                price = (price * Decimal("1.08")).quantize(Decimal("0.01"))
            elif currency == "ARS":
                price = (price * Decimal("1200")).quantize(Decimal("0.01"))
            quantity = random.choice([1, 1, 1, 2])
            line_total = price * quantity
            item = SaleItem(
                tenant_id=tenant_id,
                sale_id=sale.id,
                item_type="ACCESSORY",
                dress_id=None,
                accessory_id=accessory.id,
                code_snapshot=accessory.code,
                description_snapshot=accessory.name,
                quantity=quantity,
                unit_price=price,
                currency=currency,
                line_total=line_total,
                notes="Demo Premium · Accesorio vendido.",
            )
            db.add(item)
            total += line_total
            created_items += 1

        sale.subtotal_amount = total
        sale.discount_amount = min(discount, total)
        sale.total_amount = total - sale.discount_amount

        payment_plan = random.choice(["single", "two", "three"])
        methods = random.sample(PAYMENT_METHODS, 3)
        if payment_plan == "single" or sale.total_amount < Decimal("400"):
            payments = [(methods[0], sale.total_amount)]
        elif payment_plan == "two":
            first = (sale.total_amount * Decimal("0.40")).quantize(Decimal("0.01"))
            payments = [(methods[0], first), (methods[1], sale.total_amount - first)]
        else:
            first = (sale.total_amount * Decimal("0.30")).quantize(Decimal("0.01"))
            second = (sale.total_amount * Decimal("0.35")).quantize(Decimal("0.01"))
            payments = [(methods[0], first), (methods[1], second), (methods[2], sale.total_amount - first - second)]

        for payment_index, (method, amount) in enumerate(payments, start=1):
            payment = SalePayment(
                tenant_id=tenant_id,
                sale_id=sale.id,
                payment_method=method,
                amount=amount,
                currency=currency,
                reference=f"{sale_number}-PAY-{payment_index}",
                notes="Demo Premium · Pago demo para dashboard por forma de pago.",
            )
            db.add(payment)
            created_payments += 1

    return sales, created_sales, created_items, created_payments


def create_loans(
    db: Session,
    tenant_id: uuid.UUID,
    customers: Sequence[Customer],
    dresses: Sequence[Dress],
) -> tuple[list[Loan], int]:
    created = 0
    loans: list[Loan] = []
    statuses = ["OPEN", "OPEN", "RETURNED", "OVERDUE", "CANCELLED"]

    for index in range(1, 19):
        code_marker = f"{PREFIX}-LOAN-{index:04d}"
        existing = db.query(Loan).filter(
            Loan.tenant_id == tenant_id,
            Loan.notes.ilike(f"%{code_marker}%"),
        ).first()
        if existing:
            loans.append(existing)
            continue

        start_date = today() - timedelta(days=random.randint(2, 24))
        expected_return = start_date + timedelta(days=random.randint(3, 12))
        status = statuses[(index - 1) % len(statuses)]
        actual_return = expected_return - timedelta(days=random.randint(0, 2)) if status == "RETURNED" else None
        loan = Loan(
            tenant_id=tenant_id,
            dress_id=dresses[(index + 4) % len(dresses)].id,
            customer_id=customers[(index + 7) % len(customers)].id,
            start_date=start_date,
            expected_return_date=expected_return,
            actual_return_date=actual_return,
            status=status,
            loan_type="RENT" if index % 2 == 0 else "LOAN",
            amount=as_decimal(random.choice([0, 120, 180, 260, 420])),
            notes=f"{code_marker} · Demo Premium · Préstamo/alquiler para agenda y reportes.",
        )
        db.add(loan)
        db.flush()
        loans.append(loan)
        created += 1

    return loans, created


def create_appointments(
    db: Session,
    tenant_id: uuid.UUID,
    customers: Sequence[Customer],
    dresses: Sequence[Dress],
    orders: Sequence[ProductionOrder],
    loans: Sequence[Loan],
    assigned_user_id: uuid.UUID | None,
) -> tuple[list[Appointment], int]:
    created = 0
    appointments: list[Appointment] = []
    week_start = today() - timedelta(days=today().weekday())

    manual_events = [
        ("Primera prueba", "FITTING", 0, 10, "CONFIRMED"),
        ("Showroom novia Madrid", "SHOWROOM", 0, 12, "SCHEDULED"),
        ("Segunda prueba", "FITTING", 1, 16, "CONFIRMED"),
        ("Entrega vestido", "DELIVERY", 1, 17, "SCHEDULED"),
        ("Prueba final", "FITTING", 2, 9, "CONFIRMED"),
        ("Ajuste de largo", "TASK", 2, 15, "SCHEDULED"),
        ("Cita showroom Barcelona", "SHOWROOM", 3, 11, "SCHEDULED"),
        ("Entrega traje novio", "DELIVERY", 4, 13, "CONFIRMED"),
        ("Control accesorios", "TASK", 4, 17, "SCHEDULED"),
        ("Seguimiento comercial", "TASK", 5, 10, "SCHEDULED"),
    ]

    # Semana actual + próximas 4 semanas.
    event_index = 1
    for week_offset in range(0, 5):
        for title, event_type, day_offset, hour, status in manual_events:
            current_day = week_start + timedelta(days=day_offset + week_offset * 7)
            start_at = datetime.combine(current_day, datetime.min.time()).replace(hour=hour, minute=random.choice([0, 15, 30]))
            customer = customers[event_index % len(customers)]
            dress = dresses[event_index % len(dresses)]
            unique_title = f"{title} - {customer.first_name} {customer.last_name}"
            existing = db.query(Appointment).filter_by(
                tenant_id=tenant_id,
                title=unique_title,
                start_at=start_at,
            ).first()
            if existing:
                appointments.append(existing)
                event_index += 1
                continue

            appointment = Appointment(
                tenant_id=tenant_id,
                title=unique_title,
                description="Demo Premium · Evento manual para agenda Fashion.",
                appointment_type=event_type,
                status=status,
                source_type="MANUAL",
                source_id=None,
                start_at=start_at,
                end_at=start_at + timedelta(hours=1),
                customer_id=customer.id,
                dress_id=dress.id,
                loan_id=None,
                production_order_id=None,
                assigned_user_id=assigned_user_id,
                priority=random.choice(["LOW", "MEDIUM", "HIGH"]),
                color=None,
                notes="Demo Premium · Cita de ejemplo para presentación.",
            )
            db.add(appointment)
            db.flush()
            appointments.append(appointment)
            created += 1
            event_index += 1

    # Eventos de producción all-day.
    for index, order in enumerate(orders[:18], start=1):
        process_code, process_label = PRODUCTION_PROCESSES[index % len(PRODUCTION_PROCESSES)]
        day = week_start + timedelta(days=(index % 7) + (index // 7) * 7)
        start_at = datetime.combine(day, datetime.min.time()).replace(hour=9)
        title = f"{process_label} {order.order_number}"
        existing = db.query(Appointment).filter_by(
            tenant_id=tenant_id,
            title=title,
            production_order_id=order.id,
            start_at=start_at,
        ).first()
        if existing:
            appointments.append(existing)
            continue

        appointment = Appointment(
            tenant_id=tenant_id,
            title=title,
            description=f"Demo Premium · Etapa {process_label} para {order.order_number}.",
            appointment_type="PRODUCTION_STAGE",
            status=random.choice(["SCHEDULED", "CONFIRMED"]),
            source_type="PRODUCTION_ORDER",
            source_id=order.id,
            process_type_id=None,
            start_at=start_at,
            end_at=start_at + timedelta(hours=8),
            customer_id=None,
            dress_id=None,
            loan_id=None,
            production_order_id=order.id,
            assigned_user_id=assigned_user_id,
            priority=random.choice(["MEDIUM", "HIGH"]),
            color=random.choice(["#7c5cff", "#b8b0c7", "#c38c7a"]),
            notes=f"Proceso demo: {process_code}",
        )
        db.add(appointment)
        db.flush()
        appointments.append(appointment)
        created += 1

    # Eventos vinculados a préstamos/alquileres.
    for index, loan in enumerate(loans[:18], start=1):
        if not loan.expected_return_date:
            continue
        start_at = datetime.combine(loan.expected_return_date, datetime.min.time()).replace(hour=random.choice([11, 16, 18]))
        title = f"Devolución alquiler {PREFIX}-LOAN-{index:04d}"
        existing = db.query(Appointment).filter_by(
            tenant_id=tenant_id,
            title=title,
            loan_id=loan.id,
        ).first()
        if existing:
            appointments.append(existing)
            continue
        appointment = Appointment(
            tenant_id=tenant_id,
            title=title,
            description="Demo Premium · Devolución asociada a préstamo/alquiler.",
            appointment_type="RETURN",
            status="SCHEDULED" if loan.status != "RETURNED" else "COMPLETED",
            source_type="LOAN",
            source_id=loan.id,
            start_at=start_at,
            end_at=start_at + timedelta(minutes=45),
            customer_id=loan.customer_id,
            dress_id=loan.dress_id,
            loan_id=loan.id,
            production_order_id=None,
            assigned_user_id=assigned_user_id,
            priority="MEDIUM",
            color="#d5aa68",
            notes="Demo Premium · Evento de devolución para agenda.",
        )
        db.add(appointment)
        db.flush()
        appointments.append(appointment)
        created += 1

    return appointments, created


def print_summary(summary: dict[str, int], dry_run: bool) -> None:
    mode = "DRY RUN" if dry_run else "APLICADO"
    print(f"\n=== DressFlow Demo Premium Incremental · {mode} ===")
    for key, value in summary.items():
        print(f"{key:<34} {value:>5}")
    print("==============================================\n")


def run(tenant_slug: str, dry_run: bool = False) -> None:
    db: Session = SessionLocal()
    summary: dict[str, int] = {}

    try:
        tenant_id = get_tenant_id(db, tenant_slug)
        user_id = get_first_user_id(db, tenant_id)

        customers, created_customers = create_customers(db, tenant_id)
        summary["clientes_nuevos"] = created_customers

        suppliers, created_suppliers = create_suppliers(db, tenant_id)
        summary["proveedores_nuevos"] = created_suppliers

        capsule, capsule_created = create_capsule(db, tenant_id)
        summary["capsulas_nuevas"] = int(capsule_created)

        fabrics, rolls, created_fabrics, created_rolls = create_fabrics_and_rolls(db, tenant_id, suppliers)
        summary["telas_nuevas"] = created_fabrics
        summary["rollos_nuevos"] = created_rolls

        trims, created_trims = create_trims(db, tenant_id, suppliers)
        summary["avios_nuevos"] = created_trims

        accessories, created_accessories = create_accessories(db, tenant_id)
        summary["accesorios_nuevos"] = created_accessories

        dresses, created_dresses = create_dresses(db, tenant_id, capsule)
        summary["prendas_nuevas"] = created_dresses

        orders, created_orders, created_materials, created_outputs, created_events = create_production_orders(
            db,
            tenant_id,
            suppliers,
            rolls,
            trims,
            user_id,
        )
        summary["ordenes_produccion_nuevas"] = created_orders
        summary["materiales_op_nuevos"] = created_materials
        summary["outputs_op_nuevos"] = created_outputs
        summary["eventos_op_nuevos"] = created_events

        sales, created_sales, created_sale_items, created_payments = create_sales(
            db,
            tenant_id,
            customers,
            dresses,
            accessories,
        )
        summary["ventas_nuevas"] = created_sales
        summary["items_venta_nuevos"] = created_sale_items
        summary["pagos_nuevos"] = created_payments

        loans, created_loans = create_loans(db, tenant_id, customers, dresses)
        summary["prestamos_alquileres_nuevos"] = created_loans

        appointments, created_appointments = create_appointments(
            db,
            tenant_id,
            customers,
            dresses,
            orders,
            loans,
            user_id,
        )
        summary["eventos_agenda_nuevos"] = created_appointments

        if dry_run:
            db.rollback()
        else:
            db.commit()

        print_summary(summary, dry_run)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Agrega datos demo premium a un tenant DressFlow sin borrar datos existentes.")
    parser.add_argument("--tenant-slug", default=DEFAULT_TENANT_SLUG, help="Slug del tenant demo. Default: demo")
    parser.add_argument("--dry-run", action="store_true", help="Simula la carga y hace rollback.")
    return parser.parse_args(argv)


if __name__ == "__main__":
    args = parse_args(sys.argv[1:])
    run(tenant_slug=args.tenant_slug, dry_run=args.dry_run)

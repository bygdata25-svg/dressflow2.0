# backend/scripts/seed_demo_data.py

from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.tenant import Tenant

from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.fabric import Fabric
from app.models.fabric_roll import FabricRoll
from app.models.dress import Dress
from app.models.accessory import Accessory
from app.models.trim import Trim
from app.models.production_order import ProductionOrder
from app.models.sale import Sale
from app.models.dress_sale import DressSale
from app.models.accessory_sale import AccessorySale
from app.models.loan import Loan


def run(tenant_slug: str):
    db: Session = SessionLocal()

    tenant = db.query(Tenant).filter(Tenant.slug == tenant_slug).first()
    if not tenant:
        raise Exception(f"Tenant no encontrado: {tenant_slug}")

    tid = tenant.id
    today = date.today()

    print(f"Creando demo para tenant: {tenant_slug}")

    customers = []
    customer_names = [
        ("María", "González"),
        ("Lucía", "Fernández"),
        ("Sofía", "Martínez"),
        ("Camila", "Rojas"),
        ("Valentina", "Suárez"),
        ("Julieta", "Pérez"),
        ("Martina", "Romero"),
        ("Ana", "Torres"),
        ("Carolina", "Méndez"),
        ("Victoria", "López"),
    ]

    for i, (first, last) in enumerate(customer_names, start=1):
        c = Customer(
            tenant_id=tid,
            code=f"CUS-{i:05d}",
            first_name=first,
            last_name=last,
            email=f"{first.lower()}.{last.lower()}@demo.com",
            phone=f"11-5555-{1000 + i}",
            tax_id=f"30{i:09d}",
            notes="Cliente demo",
        )
        db.add(c)
        customers.append(c)

    db.flush()

    suppliers = []
    supplier_data = [
        ("Textiles Premium SA", "FABRIC_SUPPLIER", "Argentina"),
        ("Sedalux Import", "FABRIC_SUPPLIER", "Italia"),
        ("Atelier Norte", "WORKSHOP", "Argentina"),
        ("Taller Costura Sur", "WORKSHOP", "Argentina"),
        ("Bordados Aurora", "BOTH", "Argentina"),
        ("Encajes París", "FABRIC_SUPPLIER", "Francia"),
        ("Sastrería Central", "WORKSHOP", "Argentina"),
        ("Avíos Dorados", "BOTH", "Brasil"),
        ("Textil Milano", "FABRIC_SUPPLIER", "Italia"),
        ("Taller Boutique", "WORKSHOP", "Argentina"),
    ]

    for i, (name, stype, origin) in enumerate(supplier_data, start=1):
        s = Supplier(
            tenant_id=tid,
            supplier_code=f"SUP-{i:05d}",
            name=name,
            supplier_type=stype,
            origin=origin,
            email=f"contacto{i}@proveedor-demo.com",
            phone=f"11-4444-{1000 + i}",
            notes="Proveedor demo",
            is_active=True,
        )
        db.add(s)
        suppliers.append(s)

    db.flush()

    fabrics = []
    fabric_data = [
        ("Crepe Seda", "Negro", "Crepe", "FBR-001"),
        ("Satén Italiano", "Marfil", "Satén", "FBR-002"),
        ("Tul Bordado", "Rosa viejo", "Tul", "FBR-003"),
        ("Organza Premium", "Blanco", "Organza", "FBR-004"),
        ("Mikado", "Off White", "Mikado", "FBR-005"),
        ("Encaje Chantilly", "Natural", "Encaje", "FBR-006"),
        ("Gasa Seda", "Azul noche", "Gasa", "FBR-007"),
        ("Jacquard Floral", "Dorado", "Jacquard", "FBR-008"),
        ("Raso Novia", "Perla", "Raso", "FBR-009"),
        ("Tafeta Couture", "Verde oliva", "Tafeta", "FBR-010"),
    ]

    fabric_suppliers = [s for s in suppliers if s.supplier_type in {"FABRIC_SUPPLIER", "BOTH"}]

    for i, (name, color, ftype, code) in enumerate(fabric_data):
        supplier = fabric_suppliers[i % len(fabric_suppliers)]

        f = Fabric(
            tenant_id=tid,
            code=code,
            name=name,
            fabric_type=ftype,
            color=color,
            supplier_id=supplier.id,
            supplier_color=color,
            supplier_reference=f"REF-{1000 + i}",
            composition="Poliéster / Seda / Blend",
            origin=supplier.origin,
            width_meters=Decimal("1.50"),
            weight_grams=Decimal("180.00"),
            default_location=f"Rack {i + 1}",
            has_scraps=i % 3 == 0,
            is_active=True,
            notes="Tela demo",
        )
        db.add(f)
        fabrics.append(f)

    db.flush()

    rolls = []

    for i, fabric in enumerate(fabrics, start=1):
        supplier = fabric_suppliers[(i - 1) % len(fabric_suppliers)]

        initial = Decimal(str(25 + i * 4))
        current = initial - Decimal(str(i % 4))

        r = FabricRoll(
            tenant_id=tid,
            fabric_id=fabric.id,
            supplier_id=supplier.id,
            roll_code=f"ROLL-{i:03d}",
            initial_length=initial,
            current_length=current,
            reserved_length=Decimal(str(i % 3)),
            unit="meters",
            status="AVAILABLE" if current > 5 else "DEPLETED",
            price_per_meter=Decimal(str(80 + i * 12)),
            purchase_date=today - timedelta(days=i * 7),
            location=f"Depósito A-{i}",
            currency="USD",
            is_scrap=False,
            is_active=True,
            notes="Rollo demo",
        )
        db.add(r)
        rolls.append(r)

    trims = []
    trim_data = [
        ("TRM-001", "Cierre Invisible", "Cierres"),
        ("TRM-002", "Botón Nácar", "Botones"),
        ("TRM-003", "Broche Corset", "Herrajes"),
        ("TRM-004", "Cinta Gross", "Cintas"),
        ("TRM-005", "Aplique Cristal", "Apliques"),
        ("TRM-006", "Ballena Corsetería", "Estructura"),
        ("TRM-007", "Elástico Premium", "Elásticos"),
        ("TRM-008", "Hebilla Dorada", "Herrajes"),
        ("TRM-009", "Perlas Bordado", "Bordado"),
        ("TRM-010", "Tanza Alta Costura", "Costura"),
    ]

    for i, (code, name, category) in enumerate(trim_data, start=1):
        supplier = suppliers[i % len(suppliers)]

        t = Trim(
            tenant_id=tid,
            code=code,
            name=name,
            category=category,
            unit="unit",
            current_stock=Decimal(str(100 - i * 6)),
            reserved_stock=Decimal(str(i)),
            min_stock=Decimal("20"),
            supplier_id=supplier.id,
            unit_cost=Decimal(str(1 + i * 0.75)),
            notes="Avío demo",
        )
        db.add(t)
        trims.append(t)

    accessories = []
    accessory_data = [
        ("ACC-001", "Cinturón Dorado", "Cinturones", "Dorado"),
        ("ACC-002", "Tocado Perlas", "Tocados", "Perla"),
        ("ACC-003", "Guantes Satinados", "Guantes", "Blanco"),
        ("ACC-004", "Capa Tul", "Capas", "Natural"),
        ("ACC-005", "Broche Vintage", "Broches", "Oro viejo"),
        ("ACC-006", "Velo Corto", "Velos", "Blanco"),
        ("ACC-007", "Aro Cristal", "Bijou", "Cristal"),
        ("ACC-008", "Faja Bordada", "Fajas", "Marfil"),
        ("ACC-009", "Bolso Ceremonia", "Bolsos", "Champagne"),
        ("ACC-010", "Peineta Flores", "Tocados", "Rosa"),
    ]

    for i, (code, name, category, color) in enumerate(accessory_data, start=1):
        a = Accessory(
            tenant_id=tid,
            code=code,
            name=name,
            category=category,
            color=color,
            unit_cost=Decimal(str(8000 + i * 1200)),
            sale_price=Decimal(str(18000 + i * 2500)),
            stock=12 - i if i < 10 else 2,
            min_stock=3,
            status="ACTIVE",
            notes="Accesorio demo",
        )
        db.add(a)
        accessories.append(a)

    dresses = []
    dress_data = [
        ("DRS-001", "Vestido Gala Negro", "M", "Negro", "AVAILABLE", "900", "180"),
        ("DRS-002", "Vestido Noche Rojo", "S", "Rojo", "AVAILABLE", "850", "170"),
        ("DRS-003", "Vestido Novia Perla", "M", "Perla", "LOANED", "1450", "260"),
        ("DRS-004", "Vestido Civil Seda", "S", "Marfil", "AVAILABLE", "760", "150"),
        ("DRS-005", "Vestido Cóctel Verde", "L", "Verde", "MAINTENANCE", "720", "140"),
        ("DRS-006", "Vestido Alta Costura", "M", "Dorado", "AVAILABLE", "1850", "340"),
        ("DRS-007", "Vestido Romantic Tul", "S", "Rosa", "AVAILABLE", "980", "190"),
        ("DRS-008", "Vestido Minimal Blanco", "M", "Blanco", "SOLD", "1100", "210"),
        ("DRS-009", "Vestido Sirena Azul", "L", "Azul", "AVAILABLE", "1250", "230"),
        ("DRS-010", "Vestido Atelier Rouge", "M", "Bordó", "AVAILABLE", "1320", "250"),
    ]

    for code, name, size, color, status, sale_price, rental_price in dress_data:
        d = Dress(
            tenant_id=tid,
            code=code,
            name=name,
            description="Vestido demo para presentación comercial",
            size=size,
            color=color,
            status=status,
            sale_price=Decimal(sale_price),
            rental_price=Decimal(rental_price),
        )
        db.add(d)
        dresses.append(d)

    db.flush()

    workshops = [s for s in suppliers if s.supplier_type in {"WORKSHOP", "BOTH"}]

    order_statuses = [
        "DRAFT",
        "APPROVED",
        "MATERIALS_RESERVED",
        "IN_PRODUCTION",
        "IN_PRODUCTION",
        "COMPLETED",
        "IN_PRODUCTION",
        "APPROVED",
        "IN_PRODUCTION",
        "CANCELLED",
    ]

    for i in range(10):
        dress = dresses[i]
        workshop = workshops[i % len(workshops)]

        op = ProductionOrder(
            tenant_id=tid,
            order_number=f"OP-{i + 1:05d}",
            workshop_supplier_id=workshop.id,
            target_dress_name=dress.name,
            target_dress_code=dress.code,
            target_size=dress.size,
            target_color=dress.color,
            planned_quantity=1 + (i % 3),
            produced_quantity=1 if order_statuses[i] == "COMPLETED" else 0,
            status=order_statuses[i],
            priority="URGENT" if i in {2, 6} else "HIGH" if i in {1, 4} else "NORMAL",
            due_date=today + timedelta(days=i - 4),
            started_at=datetime.utcnow() - timedelta(days=i + 1),
            labor_cost=Decimal(str(120 + i * 20)),
            additional_cost=Decimal(str(40 + i * 10)),
            estimated_total_cost=Decimal(str(300 + i * 55)),
            actual_total_cost=Decimal(str(280 + i * 60)),
            currency="USD",
            notes="Orden demo",
        )
        db.add(op)

    for i in range(10):
        customer = customers[i % len(customers)]
        dress = dresses[i % len(dresses)]
        sale_number = f"SAL-D-{i + 1:05d}"
        amount = Decimal(str(700 + i * 115))

        sale = Sale(
            tenant_id=tid,
            sale_number=sale_number,
            customer_id=customer.id,
            sale_date=datetime.utcnow() - timedelta(days=i * 2),
            currency="USD",
            status="COMPLETED",
            subtotal_amount=amount,
            discount_amount=Decimal("0.00"),
            total_amount=amount,
            notes="Venta demo de vestido",
        )
        db.add(sale)

        ds = DressSale(
            tenant_id=tid,
            dress_id=dress.id,
            customer_id=customer.id,
            sale_date=datetime.utcnow() - timedelta(days=i * 2),
            sale_price=amount,
            currency="USD",
            payment_method="EFECTIVO" if i % 2 == 0 else "TRANSFERENCIA",
            sale_number=sale_number,
            status="COMPLETED",
            notes="Venta demo vestido USD",
        )
        db.add(ds)

    for i in range(10):
        customer = customers[(i + 2) % len(customers)]
        accessory = accessories[i % len(accessories)]
        sale_number = f"SAL-A-{i + 1:05d}"
        quantity = 1 + (i % 2)
        unit_price = Decimal(str(18000 + i * 2500))
        total_price = unit_price * Decimal(quantity)

        sale = Sale(
            tenant_id=tid,
            sale_number=sale_number,
            customer_id=customer.id,
            sale_date=datetime.utcnow() - timedelta(days=i),
            currency="ARS",
            status="COMPLETED",
            subtotal_amount=total_price,
            discount_amount=Decimal("0.00"),
            total_amount=total_price,
            notes="Venta demo de accesorio",
        )
        db.add(sale)

        acc_sale = AccessorySale(
            tenant_id=tid,
            accessory_id=accessory.id,
            customer_id=customer.id,
            sale_date=datetime.utcnow() - timedelta(days=i),
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
            currency="ARS",
            payment_method="MERCADO_PAGO" if i % 2 == 0 else "TRANSFERENCIA",
            sale_number=sale_number,
            status="COMPLETED",
            notes="Venta demo accesorio ARS",
        )
        db.add(acc_sale)

    loan_statuses = [
        "ACTIVE",
        "ACTIVE",
        "LATE",
        "RETURNED",
        "ACTIVE",
        "LATE",
        "ACTIVE",
        "RETURNED",
        "ACTIVE",
        "LATE",
    ]

    for i in range(10):
        customer = customers[i % len(customers)]
        dress = dresses[i % len(dresses)]

        start = today - timedelta(days=10 + i)
        expected = today + timedelta(days=3 - i)

        loan = Loan(
            tenant_id=tid,
            dress_id=dress.id,
            customer_id=customer.id,
            start_date=start,
            expected_return_date=expected,
            actual_return_date=today - timedelta(days=1) if loan_statuses[i] == "RETURNED" else None,
            status=loan_statuses[i],
            loan_type="RENTAL" if i % 2 == 0 else "LOAN",
            amount=Decimal(str(120 + i * 25)),
            notes="Préstamo / alquiler demo",
        )
        db.add(loan)

    db.commit()
    db.close()

    print("DEMO LISTA: 10 registros por módulo principal.")


if __name__ == "__main__":
    import sys

    slug = sys.argv[1] if len(sys.argv) > 1 else "demo"
    run(slug)

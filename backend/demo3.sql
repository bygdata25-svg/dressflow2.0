-- ============================================================
-- DEMO PRO DressFlow v2
-- Tenant objetivo: slug = 'demo'
--
-- Este script es idempotente:
-- - Borra primero los datos DEMO relacionados.
-- - Vuelve a cargar el dataset completo.
-- - Carga sales + sale_items + sale_payments para impactar en dashboard financiero.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
    v_tenant_id uuid;

    v_customer_ids uuid[] := ARRAY[]::uuid[];
    v_supplier_ids uuid[] := ARRAY[]::uuid[];
    v_workshop_ids uuid[] := ARRAY[]::uuid[];
    v_fabric_ids uuid[] := ARRAY[]::uuid[];
    v_roll_ids uuid[] := ARRAY[]::uuid[];
    v_trim_ids uuid[] := ARRAY[]::uuid[];
    v_accessory_ids uuid[] := ARRAY[]::uuid[];
    v_dress_ids uuid[] := ARRAY[]::uuid[];

    v_id uuid;
    i int;
    v_amount numeric(12,2);
    v_qty int;
    v_unit_price numeric(12,2);
    v_sale_number text;
BEGIN
    SELECT id INTO v_tenant_id
    FROM tenants
    WHERE slug = 'demo'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No existe tenant activo con slug demo';
    END IF;

    -- ============================================================
    -- LIMPIEZA TOTAL DEMO
    -- Orden correcto para evitar problemas de foreign keys.
    -- ============================================================

    DELETE FROM sale_payments
    WHERE tenant_id = v_tenant_id
      AND sale_id IN (
        SELECT id FROM sales
        WHERE tenant_id = v_tenant_id
          AND sale_number LIKE 'DEMO-%'
      );

    DELETE FROM sale_items
    WHERE tenant_id = v_tenant_id
      AND sale_id IN (
        SELECT id FROM sales
        WHERE tenant_id = v_tenant_id
          AND sale_number LIKE 'DEMO-%'
      );

    DELETE FROM accessory_sales
    WHERE tenant_id = v_tenant_id
      AND sale_number LIKE 'DEMO-%';

    DELETE FROM dress_sales
    WHERE tenant_id = v_tenant_id
      AND sale_number LIKE 'DEMO-%';

    DELETE FROM sales
    WHERE tenant_id = v_tenant_id
      AND sale_number LIKE 'DEMO-%';

    DELETE FROM loans
    WHERE tenant_id = v_tenant_id
      AND notes ILIKE '%DEMO PRO%';

    DELETE FROM production_orders
    WHERE tenant_id = v_tenant_id
      AND order_number LIKE 'DEMO-OP-%';

    DELETE FROM accessories
    WHERE tenant_id = v_tenant_id
      AND code LIKE 'DEMO-ACC-%';

    DELETE FROM trims
    WHERE tenant_id = v_tenant_id
      AND code LIKE 'DEMO-TRM-%';

    DELETE FROM fabric_rolls
    WHERE tenant_id = v_tenant_id
      AND roll_code LIKE 'DEMO-ROLL-%';

    DELETE FROM fabrics
    WHERE tenant_id = v_tenant_id
      AND code LIKE 'DEMO-FBR-%';

    DELETE FROM dresses
    WHERE tenant_id = v_tenant_id
      AND code LIKE 'DEMO-DRS-%';

    DELETE FROM suppliers
    WHERE tenant_id = v_tenant_id
      AND supplier_code LIKE 'DEMO-SUP-%';

    DELETE FROM customers
    WHERE tenant_id = v_tenant_id
      AND code LIKE 'DEMO-CUS-%';

    -- ============================================================
    -- CLIENTES
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_customer_ids := array_append(v_customer_ids, v_id);

        INSERT INTO customers (
            id, tenant_id, code, first_name, last_name, email, phone, tax_id, notes, created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            'DEMO-CUS-' || lpad(i::text, 5, '0'),
            (ARRAY['María','Lucía','Sofía','Camila','Valentina','Julieta','Martina','Ana','Carolina','Victoria'])[i],
            (ARRAY['González','Fernández','Martínez','Rojas','Suárez','Pérez','Romero','Torres','Méndez','López'])[i],
            'cliente' || i || '@demo-dressflow.com',
            '11-5555-' || (1000 + i),
            '30' || lpad(i::text, 9, '0'),
            'Cliente DEMO PRO',
            now(),
            now()
        );
    END LOOP;

    -- ============================================================
    -- PROVEEDORES / TALLERES
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_supplier_ids := array_append(v_supplier_ids, v_id);

        INSERT INTO suppliers (
            id, tenant_id, supplier_code, name, supplier_type, origin, email, phone, notes, is_active, created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            'DEMO-SUP-' || lpad(i::text, 5, '0'),
            (ARRAY[
                'Textiles Premium SA',
                'Sedalux Import',
                'Atelier Norte',
                'Taller Costura Sur',
                'Bordados Aurora',
                'Encajes París',
                'Sastrería Central',
                'Avíos Dorados',
                'Textil Milano',
                'Taller Boutique'
            ])[i],
            (ARRAY[
                'FABRIC_SUPPLIER',
                'FABRIC_SUPPLIER',
                'WORKSHOP',
                'WORKSHOP',
                'BOTH',
                'FABRIC_SUPPLIER',
                'WORKSHOP',
                'BOTH',
                'FABRIC_SUPPLIER',
                'WORKSHOP'
            ])[i],
            (ARRAY[
                'Argentina',
                'Italia',
                'Argentina',
                'Argentina',
                'Argentina',
                'Francia',
                'Argentina',
                'Brasil',
                'Italia',
                'Argentina'
            ])[i],
            'proveedor' || i || '@demo-dressflow.com',
            '11-4444-' || (1000 + i),
            'Proveedor DEMO PRO',
            true,
            now(),
            now()
        );

        IF (ARRAY[
            'FABRIC_SUPPLIER',
            'FABRIC_SUPPLIER',
            'WORKSHOP',
            'WORKSHOP',
            'BOTH',
            'FABRIC_SUPPLIER',
            'WORKSHOP',
            'BOTH',
            'FABRIC_SUPPLIER',
            'WORKSHOP'
        ])[i] IN ('WORKSHOP', 'BOTH') THEN
            v_workshop_ids := array_append(v_workshop_ids, v_id);
        END IF;
    END LOOP;

    -- ============================================================
    -- TELAS
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_fabric_ids := array_append(v_fabric_ids, v_id);

        INSERT INTO fabrics (
            id, tenant_id, code, name, fabric_type, color, supplier_id,
            supplier_color, supplier_reference, composition, origin,
            width_meters, weight_grams, default_location, has_scraps,
            is_active, notes, created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            'DEMO-FBR-' || lpad(i::text, 3, '0'),
            (ARRAY[
                'Crepe Seda',
                'Satén Italiano',
                'Tul Bordado',
                'Organza Premium',
                'Mikado',
                'Encaje Chantilly',
                'Gasa Seda',
                'Jacquard Floral',
                'Raso Novia',
                'Tafeta Couture'
            ])[i],
            (ARRAY[
                'Crepe',
                'Satén',
                'Tul',
                'Organza',
                'Mikado',
                'Encaje',
                'Gasa',
                'Jacquard',
                'Raso',
                'Tafeta'
            ])[i],
            (ARRAY[
                'Negro',
                'Marfil',
                'Rosa viejo',
                'Blanco',
                'Off White',
                'Natural',
                'Azul noche',
                'Dorado',
                'Perla',
                'Verde oliva'
            ])[i],
            v_supplier_ids[((i - 1) % array_length(v_supplier_ids, 1)) + 1],
            (ARRAY[
                'Negro',
                'Marfil',
                'Rosa viejo',
                'Blanco',
                'Off White',
                'Natural',
                'Azul noche',
                'Dorado',
                'Perla',
                'Verde oliva'
            ])[i],
            'REF-DEMO-' || (1000 + i),
            'Blend premium para alta costura',
            'Importado',
            1.50,
            180,
            'Rack DEMO ' || i,
            i IN (3, 6, 9),
            true,
            'Tela DEMO PRO',
            now(),
            now()
        );
    END LOOP;

    -- ============================================================
    -- ROLLOS
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_roll_ids := array_append(v_roll_ids, v_id);

        INSERT INTO fabric_rolls (
            id, tenant_id, fabric_id, supplier_id, roll_code,
            initial_length, current_length, reserved_length,
            unit, status, price_per_meter, purchase_date,
            location, currency, is_scrap, is_active, notes,
            created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            v_fabric_ids[i],
            v_supplier_ids[((i - 1) % array_length(v_supplier_ids, 1)) + 1],
            'DEMO-ROLL-' || lpad(i::text, 3, '0'),
            25 + (i * 4),
            CASE
                WHEN i IN (2, 7) THEN 3
                ELSE 25 + (i * 4) - (i % 4)
            END,
            i % 3,
            'meters',
            CASE WHEN i IN (2, 7) THEN 'DEPLETED' ELSE 'AVAILABLE' END,
            80 + (i * 12),
            current_date - (i * 7),
            'Depósito A-' || i,
            'USD',
            false,
            true,
            'Rollo DEMO PRO',
            now(),
            now()
        );
    END LOOP;

    -- ============================================================
    -- AVÍOS / TRIMS
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_trim_ids := array_append(v_trim_ids, v_id);

        INSERT INTO trims (
            id, tenant_id, code, name, category, unit,
            current_stock, reserved_stock, min_stock,
            supplier_id, unit_cost, notes, created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            'DEMO-TRM-' || lpad(i::text, 3, '0'),
            (ARRAY[
                'Cierre Invisible',
                'Botón Nácar',
                'Broche Corset',
                'Cinta Gross',
                'Aplique Cristal',
                'Ballena Corsetería',
                'Elástico Premium',
                'Hebilla Dorada',
                'Perlas Bordado',
                'Tanza Alta Costura'
            ])[i],
            (ARRAY[
                'Cierres',
                'Botones',
                'Herrajes',
                'Cintas',
                'Apliques',
                'Estructura',
                'Elásticos',
                'Herrajes',
                'Bordado',
                'Costura'
            ])[i],
            'unit',
            CASE WHEN i IN (2, 5, 8) THEN 4 ELSE 100 - (i * 6) END,
            i,
            20,
            v_supplier_ids[((i - 1) % array_length(v_supplier_ids, 1)) + 1],
            1 + (i * 0.75),
            'Avío DEMO PRO',
            now(),
            now()
        );
    END LOOP;

    -- ============================================================
    -- ACCESORIOS
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_accessory_ids := array_append(v_accessory_ids, v_id);

        INSERT INTO accessories (
            id, tenant_id, code, name, category, color,
            unit_cost, sale_price, stock, min_stock,
            status, notes, created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            'DEMO-ACC-' || lpad(i::text, 3, '0'),
            (ARRAY[
                'Cinturón Dorado',
                'Tocado Perlas',
                'Guantes Satinados',
                'Capa Tul',
                'Broche Vintage',
                'Velo Corto',
                'Aro Cristal',
                'Faja Bordada',
                'Bolso Ceremonia',
                'Peineta Flores'
            ])[i],
            (ARRAY[
                'Cinturones',
                'Tocados',
                'Guantes',
                'Capas',
                'Broches',
                'Velos',
                'Bijou',
                'Fajas',
                'Bolsos',
                'Tocados'
            ])[i],
            (ARRAY[
                'Dorado',
                'Perla',
                'Blanco',
                'Natural',
                'Oro viejo',
                'Blanco',
                'Cristal',
                'Marfil',
                'Champagne',
                'Rosa'
            ])[i],
            8000 + (i * 1200),
            18000 + (i * 2500),
            CASE WHEN i IN (1, 4, 9) THEN 1 ELSE 12 - i END,
            3,
            'ACTIVE',
            'Accesorio DEMO PRO',
            now(),
            now()
        );
    END LOOP;

    -- ============================================================
    -- VESTIDOS
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_id := gen_random_uuid();
        v_dress_ids := array_append(v_dress_ids, v_id);

        INSERT INTO dresses (
            id, tenant_id, code, name, description, size, color,
            status, sale_price, rental_price, created_at, updated_at
        )
        VALUES (
            v_id,
            v_tenant_id,
            'DEMO-DRS-' || lpad(i::text, 3, '0'),
            (ARRAY[
                'Vestido Gala Negro',
                'Vestido Noche Rojo',
                'Vestido Novia Perla',
                'Vestido Civil Seda',
                'Vestido Cóctel Verde',
                'Vestido Alta Costura',
                'Vestido Romantic Tul',
                'Vestido Minimal Blanco',
                'Vestido Sirena Azul',
                'Vestido Atelier Rouge'
            ])[i],
            'Vestido DEMO PRO para presentación comercial',
            (ARRAY['M','S','M','S','L','M','S','M','L','M'])[i],
            (ARRAY[
                'Negro',
                'Rojo',
                'Perla',
                'Marfil',
                'Verde',
                'Dorado',
                'Rosa',
                'Blanco',
                'Azul',
                'Bordó'
            ])[i],
            (ARRAY[
                'AVAILABLE',
                'AVAILABLE',
                'LOANED',
                'AVAILABLE',
                'MAINTENANCE',
                'AVAILABLE',
                'AVAILABLE',
                'SOLD',
                'AVAILABLE',
                'AVAILABLE'
            ])[i],
            (ARRAY[900,850,1450,760,720,1850,980,1100,1250,1320])[i],
            (ARRAY[180,170,260,150,140,340,190,210,230,250])[i],
            now() - ((80 + i) || ' days')::interval,
            now() - ((70 + i) || ' days')::interval
        );
    END LOOP;

    -- ============================================================
    -- ÓRDENES DE PRODUCCIÓN
    -- Con atrasos, urgencias y sobrecostos para alimentar dashboard operativo.
    -- ============================================================

    FOR i IN 1..10 LOOP
        INSERT INTO production_orders (
            id, tenant_id, order_number, workshop_supplier_id,
            target_dress_name, target_dress_code, target_size, target_color,
            planned_quantity, produced_quantity, status, priority,
            due_date, started_at, labor_cost, additional_cost,
            estimated_total_cost, actual_total_cost, currency, notes,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            'DEMO-OP-' || lpad(i::text, 5, '0'),
            v_workshop_ids[((i - 1) % array_length(v_workshop_ids, 1)) + 1],
            (SELECT name FROM dresses WHERE id = v_dress_ids[i]),
            (SELECT code FROM dresses WHERE id = v_dress_ids[i]),
            (SELECT size FROM dresses WHERE id = v_dress_ids[i]),
            (SELECT color FROM dresses WHERE id = v_dress_ids[i]),
            1 + (i % 3),
            CASE WHEN i IN (6) THEN 1 ELSE 0 END,
            (ARRAY[
                'DRAFT',
                'APPROVED',
                'MATERIALS_RESERVED',
                'IN_PRODUCTION',
                'IN_PRODUCTION',
                'COMPLETED',
                'IN_PRODUCTION',
                'APPROVED',
                'IN_PRODUCTION',
                'CANCELLED'
            ])[i],
            CASE WHEN i IN (2, 6) THEN 'URGENT'
                 WHEN i IN (1, 4, 9) THEN 'HIGH'
                 ELSE 'NORMAL'
            END,
            current_date + (i - 6),
            now() - ((i + 1) || ' days')::interval,
            120 + (i * 20),
            40 + (i * 10),
            300 + (i * 55),
            CASE
                WHEN i IN (3, 4, 7) THEN (300 + (i * 55)) * 1.45
                ELSE 280 + (i * 60)
            END,
            'USD',
            'Orden DEMO PRO con datos para dashboard operativo',
            now() - ((12 + i) || ' days')::interval,
            CASE
                WHEN i IN (1, 2, 3, 4) THEN now() - ((10 + i) || ' days')::interval
                ELSE now() - (i || ' days')::interval
            END
        );
    END LOOP;

    -- ============================================================
    -- VENTAS DE VESTIDOS USD
    -- Carga:
    -- - sales
    -- - dress_sales
    -- - sale_items
    -- - sale_payments
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_sale_number := 'DEMO-SAL-D-' || lpad(i::text, 5, '0');
        v_amount := 700 + (i * 115);

        INSERT INTO sales (
            id, tenant_id, sale_number, customer_id,
            sale_date, currency, status,
            subtotal_amount, discount_amount, total_amount,
            notes, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_sale_number,
            v_customer_ids[((i - 1) % array_length(v_customer_ids, 1)) + 1],
            now() - ((i * 2) || ' days')::interval,
            'USD',
            'COMPLETED',
            v_amount,
            CASE WHEN i IN (4, 8) THEN 50 ELSE 0 END,
            CASE WHEN i IN (4, 8) THEN v_amount - 50 ELSE v_amount END,
            'Venta DEMO PRO vestido USD',
            now(),
            now()
        );

        INSERT INTO dress_sales (
            id, tenant_id, dress_id, customer_id,
            sale_date, sale_price, currency, payment_method,
            notes, status, sale_number, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_dress_ids[((i - 1) % array_length(v_dress_ids, 1)) + 1],
            v_customer_ids[((i - 1) % array_length(v_customer_ids, 1)) + 1],
            now() - ((i * 2) || ' days')::interval,
            CASE WHEN i IN (4, 8) THEN v_amount - 50 ELSE v_amount END,
            'USD',
            CASE WHEN i % 2 = 0 THEN 'EFECTIVO' ELSE 'TRANSFERENCIA' END,
            'Venta DEMO PRO vestido USD',
            'COMPLETED',
            v_sale_number,
            now(),
            now()
        );

        INSERT INTO sale_items (
            id, tenant_id, sale_id, item_type, dress_id, accessory_id,
            code_snapshot, description_snapshot,
            quantity, unit_price, currency, line_total,
            notes, created_at
        )
        SELECT
            gen_random_uuid(),
            v_tenant_id,
            s.id,
            'DRESS',
            v_dress_ids[((i - 1) % array_length(v_dress_ids, 1)) + 1],
            NULL,
            d.code,
            d.name,
            1,
            CASE WHEN i IN (4, 8) THEN v_amount - 50 ELSE v_amount END,
            'USD',
            CASE WHEN i IN (4, 8) THEN v_amount - 50 ELSE v_amount END,
            'Item DEMO PRO vestido USD',
            now()
        FROM sales s
        JOIN dresses d
          ON d.id = v_dress_ids[((i - 1) % array_length(v_dress_ids, 1)) + 1]
        WHERE s.tenant_id = v_tenant_id
          AND s.sale_number = v_sale_number;

        INSERT INTO sale_payments (
            id, tenant_id, sale_id, payment_method, amount, currency, created_at
        )
        SELECT
            gen_random_uuid(),
            v_tenant_id,
            s.id,
            CASE WHEN i % 2 = 0 THEN 'EFECTIVO' ELSE 'TRANSFERENCIA' END,
            CASE WHEN i IN (4, 8) THEN v_amount - 50 ELSE v_amount END,
            'USD',
            now()
        FROM sales s
        WHERE s.tenant_id = v_tenant_id
          AND s.sale_number = v_sale_number;
    END LOOP;

    -- ============================================================
    -- VENTAS DE ACCESORIOS ARS
    -- Carga:
    -- - sales
    -- - accessory_sales
    -- - sale_items
    -- - sale_payments
    -- ============================================================

    FOR i IN 1..10 LOOP
        v_sale_number := 'DEMO-SAL-A-' || lpad(i::text, 5, '0');
        v_qty := CASE WHEN i % 2 = 0 THEN 2 ELSE 1 END;
        v_unit_price := 18000 + (i * 2500);
        v_amount := v_unit_price * v_qty;

        INSERT INTO sales (
            id, tenant_id, sale_number, customer_id,
            sale_date, currency, status,
            subtotal_amount, discount_amount, total_amount,
            notes, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_sale_number,
            v_customer_ids[((i + 1) % array_length(v_customer_ids, 1)) + 1],
            now() - (i || ' days')::interval,
            'ARS',
            'COMPLETED',
            v_amount,
            CASE WHEN i IN (3, 9) THEN 2500 ELSE 0 END,
            CASE WHEN i IN (3, 9) THEN v_amount - 2500 ELSE v_amount END,
            'Venta DEMO PRO accesorio ARS',
            now(),
            now()
        );

        INSERT INTO accessory_sales (
            id, tenant_id, accessory_id, customer_id,
            sale_date, quantity, unit_price, total_price,
            currency, payment_method, notes, status,
            sale_number, created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_accessory_ids[((i - 1) % array_length(v_accessory_ids, 1)) + 1],
            v_customer_ids[((i + 1) % array_length(v_customer_ids, 1)) + 1],
            now() - (i || ' days')::interval,
            v_qty,
            v_unit_price,
            CASE WHEN i IN (3, 9) THEN v_amount - 2500 ELSE v_amount END,
            'ARS',
            CASE WHEN i % 2 = 0 THEN 'MERCADO_PAGO' ELSE 'TRANSFERENCIA' END,
            'Venta DEMO PRO accesorio ARS',
            'COMPLETED',
            v_sale_number,
            now(),
            now()
        );

        INSERT INTO sale_items (
            id, tenant_id, sale_id, item_type, dress_id, accessory_id,
            code_snapshot, description_snapshot,
            quantity, unit_price, currency, line_total,
            notes, created_at
        )
        SELECT
            gen_random_uuid(),
            v_tenant_id,
            s.id,
            'ACCESSORY',
            NULL,
            v_accessory_ids[((i - 1) % array_length(v_accessory_ids, 1)) + 1],
            a.code,
            a.name,
            v_qty,
            v_unit_price,
            'ARS',
            CASE WHEN i IN (3, 9) THEN v_amount - 5000 ELSE v_amount END,
            'Item DEMO PRO accesorio ARS',
            now()
        FROM sales s
        JOIN accessories a
          ON a.id = v_accessory_ids[((i - 1) % array_length(v_accessory_ids, 1)) + 1]
        WHERE s.tenant_id = v_tenant_id
          AND s.sale_number = v_sale_number;

        INSERT INTO sale_payments (
            id, tenant_id, sale_id, payment_method, amount, currency, created_at
        )
        SELECT
            gen_random_uuid(),
            v_tenant_id,
            s.id,
            CASE WHEN i % 2 = 0 THEN 'MERCADO_PAGO' ELSE 'TRANSFERENCIA' END,
            CASE WHEN i IN (3, 9) THEN v_amount - 2500 ELSE v_amount END,
            'ARS',
            now()
        FROM sales s
        WHERE s.tenant_id = v_tenant_id
          AND s.sale_number = v_sale_number;
    END LOOP;

    -- ============================================================
    -- VENTA MIXTA USD + ARS
    -- Para mostrar TOTAL MIXTO / multipago / multicurrency.
    -- ============================================================

    v_sale_number := 'DEMO-SAL-MIX-00001';

    INSERT INTO sales (
        id, tenant_id, sale_number, customer_id,
        sale_date, currency, status,
        subtotal_amount, discount_amount, total_amount,
        notes, created_at, updated_at
    )
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        v_sale_number,
        v_customer_ids[1],
        now() - interval '1 day',
        'MIXED',
        'COMPLETED',
        0,
        0,
        0,
        'Venta DEMO PRO mixta USD + ARS',
        now(),
        now()
    );

    INSERT INTO sale_items (
        id, tenant_id, sale_id, item_type, dress_id, accessory_id,
        code_snapshot, description_snapshot,
        quantity, unit_price, currency, line_total,
        notes, created_at
    )
    SELECT
        gen_random_uuid(),
        v_tenant_id,
        s.id,
        'DRESS',
        v_dress_ids[6],
        NULL,
        d.code,
        d.name,
        1,
        1850,
        'USD',
        1850,
        'Item DEMO PRO vestido USD',
        now()
    FROM sales s
    JOIN dresses d ON d.id = v_dress_ids[6]
    WHERE s.tenant_id = v_tenant_id
      AND s.sale_number = v_sale_number;INSERT INTO sale_items (
        id, tenant_id, sale_id, item_type, dress_id, accessory_id,
        code_snapshot, description_snapshot,
        quantity, unit_price, currency, line_total,
        notes, created_at
    )
    SELECT
        gen_random_uuid(),
        v_tenant_id,
        s.id,
        'ACCESSORY',
        NULL,
        v_accessory_ids[1],
        a.code,
        a.name,
        1,
        20500,
        'ARS',
        20500,
        'Item DEMO PRO accesorio ARS',
        now()
    FROM sales s
    JOIN accessories a ON a.id = v_accessory_ids[1]
    WHERE s.tenant_id = v_tenant_id
      AND s.sale_number = v_sale_number;INSERT INTO sale_payments (
        id, tenant_id, sale_id, payment_method, amount, currency, created_at
    )
    SELECT
        gen_random_uuid(),
        v_tenant_id,
        s.id,
        'EFECTIVO',
        1000,
        'USD',
        now(),
        now()
    FROM sales s
    WHERE s.tenant_id = v_tenant_id
      AND s.sale_number = v_sale_number;

    INSERT INTO sale_payments (
        id, tenant_id, sale_id, payment_method, amount, currency, created_at
    )
    SELECT
        gen_random_uuid(),
        v_tenant_id,
        s.id,
        'TRANSFERENCIA',
        350000,
        'ARS',
        now(),
        now()
    FROM sales s
    WHERE s.tenant_id = v_tenant_id
      AND s.sale_number = v_sale_number;

    -- ============================================================
    -- PRÉSTAMOS / ALQUILERES
    -- Con vencidos y próximos para alertas del dashboard.
    -- ============================================================

    FOR i IN 1..10 LOOP
        INSERT INTO loans (
            id, tenant_id, dress_id, customer_id,
            start_date, expected_return_date, actual_return_date,
            status, loan_type, amount, notes,
            created_at, updated_at
        )
        VALUES (
            gen_random_uuid(),
            v_tenant_id,
            v_dress_ids[((i - 1) % array_length(v_dress_ids, 1)) + 1],
            v_customer_ids[((i - 1) % array_length(v_customer_ids, 1)) + 1],
            current_date - (10 + i),
            current_date + (3 - i),
            CASE WHEN i IN (4, 8) THEN current_date - 1 ELSE NULL END,
            (ARRAY[
                'ACTIVE',
                'ACTIVE',
                'LATE',
                'RETURNED',
                'ACTIVE',
                'LATE',
                'ACTIVE',
                'RETURNED',
                'ACTIVE',
                'LATE'
            ])[i],
            CASE WHEN i % 2 = 0 THEN 'RENTAL' ELSE 'LOAN' END,
            120 + (i * 25),
            'Préstamo / alquiler DEMO PRO',
            now(),
            now()
        );
    END LOOP;

END $$;

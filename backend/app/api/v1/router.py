from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    dashboard,
    dresses,
    sales,
    tenants,
    customers,
    suppliers,
    fabrics,
    fabric_rolls,
    fabric_movements,
    production_orders,
    productions,
    trims,
    reports,
    superadmin_tenants,
    public_tenants,
    capsules,
    loans,
    users,
    fabric_import,
    accessories,
    accessory_movements, 
    accessory_sales,
    sales_unified,
    ui_config,
    my_ui_config,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(dresses.router)
api_router.include_router(sales.router)
api_router.include_router(tenants.router)
api_router.include_router(customers.router)
api_router.include_router(suppliers.router)
api_router.include_router(fabrics.router)
api_router.include_router(fabric_rolls.router)
api_router.include_router(fabric_movements.router)
api_router.include_router(productions.router)
api_router.include_router(production_orders.router)
api_router.include_router(trims.router)
api_router.include_router(reports.router)
api_router.include_router(superadmin_tenants.router)
api_router.include_router(public_tenants.router)
api_router.include_router(capsules.router)
api_router.include_router(loans.router)
api_router.include_router(users.router)
api_router.include_router(fabric_import.router)
api_router.include_router(accessories.router)
api_router.include_router(ui_config.router)
api_router.include_router(my_ui_config.router)
api_router.include_router(accessory_movements.router)
api_router.include_router(accessory_sales.router)
api_router.include_router(sales_unified.router)

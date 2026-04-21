from app.models.tenant import Tenant
from app.schemas.tenant import TenantBrandingRead


def build_tenant_branding(tenant: Tenant) -> TenantBrandingRead:
    return TenantBrandingRead(
        logo_url=tenant.branding_logo_url,
        primary_color=tenant.branding_primary_color,
        secondary_color=tenant.branding_secondary_color,
        accent_color=tenant.branding_accent_color,
        surface_color=tenant.branding_surface_color,
        sidebar_color=tenant.branding_sidebar_color,
    )

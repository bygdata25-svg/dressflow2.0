from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os
from fastapi.staticfiles import StaticFiles

from app.core.database import Base, engine
from app.api.v1.router import api_router
from app.core.config import settings
from app.services.storage_service import ensure_upload_dirs

app = FastAPI(title="DressFlow API")

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

os.makedirs("static/tenant_logos", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

ensure_upload_dirs()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}

from app.core.database import Base, engine

Base.metadata.create_all(bind=engine)

print("DB creada")

@app.get("/init-db")
def init_db():
    Base.metadata.create_all(bind=engine)
    return {"status": "ok"}

@app.get("/seed-admin")
def seed_admin():
    db: Session = SessionLocal()
    try:
        # 1. Crear tenant
        tenant = db.query(Tenant).filter(Tenant.slug == "demo").first()

        if not tenant:
            tenant = Tenant(
                name="DressFlow Demo",
                slug="demo",
                status="ACTIVE",
                currency="ARS",
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        # 2. Crear usuario
        user = db.query(User).filter(User.email == "admin@dressflow.ai").first()

        if not user:
            user = User(
                email="admin@dressflow.ai",
                password_hash=hash_password("Admin1234!"),
                first_name="Admin",
                last_name="User",
                is_active=True,
                is_superuser=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # 3. Vincular usuario con tenant
        membership = (
            db.query(UserTenant)
            .filter(
                UserTenant.user_id == user.id,
                UserTenant.tenant_id == tenant.id,
            )
            .first()
        )

        if not membership:
            membership = UserTenant(
                user_id=user.id,
                tenant_id=tenant.id,
                role="admin",
                is_default=True,
            )
            db.add(membership)
            db.commit()

        return {
            "status": "ok",
            "user": "admin@dressflow.ai",
            "password": "Admin1234!",
            "tenant": "demo",
        }

    finally:
        db.close()


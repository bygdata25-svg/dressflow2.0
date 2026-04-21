"""add impersonation audit table

Revision ID: add_impersonation_audit_table
Revises: 
Create Date: 2026-03-28 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "add_impersonation_audit_table"
down_revision = None  # reemplazalo por tu revision anterior real
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "impersonation_audit",
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_membership_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_membership_id"], ["user_tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_membership_id"], ["user_tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_tenant_id"], ["tenants.id"], ondelete="CASCADE"),
    )

    op.create_index(
        "ix_impersonation_audit_actor_user_id",
        "impersonation_audit",
        ["actor_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_impersonation_audit_target_user_id",
        "impersonation_audit",
        ["target_user_id"],
        unique=False,
    )
    op.create_index(
        "ix_impersonation_audit_target_tenant_id",
        "impersonation_audit",
        ["target_tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_impersonation_audit_is_active",
        "impersonation_audit",
        ["is_active"],
        unique=False,
    )
    op.create_index(
        "ix_impersonation_audit_started_at",
        "impersonation_audit",
        ["started_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_impersonation_audit_started_at", table_name="impersonation_audit")
    op.drop_index("ix_impersonation_audit_is_active", table_name="impersonation_audit")
    op.drop_index("ix_impersonation_audit_target_tenant_id", table_name="impersonation_audit")
    op.drop_index("ix_impersonation_audit_target_user_id", table_name="impersonation_audit")
    op.drop_index("ix_impersonation_audit_actor_user_id", table_name="impersonation_audit")
    op.drop_table("impersonation_audit")

"""Add supabase_id and is_pro to users; make google_id nullable

Revision ID: j1k2l3m4n5o6
Revises: i0j1k2l3m4n5
Create Date: 2026-04-27 00:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'j1k2l3m4n5o6'
down_revision: Union[str, None] = 'i0j1k2l3m4n5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make google_id nullable — Supabase-authed users won't have a Google ID
    op.alter_column('users', 'google_id', existing_type=sa.String(), nullable=True)

    # Add supabase_id: stores the Supabase auth.users UUID for Ocupa-authed users
    op.add_column('users', sa.Column('supabase_id', sa.String(), nullable=True))
    op.create_unique_constraint('uq_users_supabase_id', 'users', ['supabase_id'])
    op.create_index('ix_users_supabase_id', 'users', ['supabase_id'])

    # Add is_pro: synced from Supabase profiles.is_pro at login time
    op.add_column('users', sa.Column('is_pro', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    op.drop_column('users', 'is_pro')
    op.drop_index('ix_users_supabase_id', table_name='users')
    op.drop_constraint('uq_users_supabase_id', 'users', type_='unique')
    op.drop_column('users', 'supabase_id')
    op.alter_column('users', 'google_id', existing_type=sa.String(), nullable=False)

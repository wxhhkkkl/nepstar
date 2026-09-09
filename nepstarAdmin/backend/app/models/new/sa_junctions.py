"""Junction tables: sa_role_menu, sa_user_role, sa_user_org."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ...database import Base, NEPSTAR_SCHEMA


class SARoleMenu(Base):
    __tablename__ = "sa_role_menu"
    __table_args__ = (UniqueConstraint("role_id", "menu_id"), {"schema": NEPSTAR_SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    menu_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    actions: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class SAUserRole(Base):
    __tablename__ = "sa_user_role"
    __table_args__ = (UniqueConstraint("user_id", "role_id"), {"schema": NEPSTAR_SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    role_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class SARoleOrg(Base):
    __tablename__ = "sa_role_org"
    __table_args__ = (UniqueConstraint("role_id", "org_id"), {"schema": NEPSTAR_SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    org_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


class SAUserOrg(Base):
    __tablename__ = "sa_user_org"
    __table_args__ = (UniqueConstraint("user_id", "org_id"), {"schema": NEPSTAR_SCHEMA})

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    org_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

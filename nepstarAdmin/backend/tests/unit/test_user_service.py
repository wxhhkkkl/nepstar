"""Unit tests for user_service — TDD: Red → Green phase."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.new.sa_user import SAUser


def make_user(id=2, username="testuser", created_by=1):
    u = MagicMock(spec=SAUser)
    u.id = id
    u.username = username
    u.real_name = "Test User"
    u.password = "$2b$hashed"
    u.lang_pref = "zh-CN"
    u.must_change_pwd = 1
    u.login_fail_count = 0
    u.locked_until = None
    u.status = 1
    u.created_by = created_by
    u.created_at = None
    u.updated_at = None
    return u


def mock_result(scalar_one=None, scalar=None, scalars_all=None):
    """Build a mock SQLAlchemy Result with sync accessors."""
    r = MagicMock()
    r.scalar_one.return_value = scalar_one
    r.scalar.return_value = scalar
    r.scalars.return_value.all.return_value = scalars_all or []
    return r


@pytest.mark.asyncio
async def test_delete_user_success():
    """T007: delete_user() should cascade delete user, roles, and orgs."""
    db = AsyncMock()
    user = make_user(id=2, created_by=1)
    # First execute: get user → scalar_one
    # Second execute: count created_by → scalar = 0
    # Third execute: role links → scalars().all() = []
    # Fourth execute: org links → scalars().all() = []
    db.execute = AsyncMock(side_effect=[
        mock_result(scalar_one=user),
        mock_result(scalar=0),
        mock_result(scalars_all=[]),
        mock_result(scalars_all=[]),
    ])

    from app.services.user_service import delete_user
    await delete_user(db, user_id=2, current_user_id=1)

    assert db.delete.called
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_delete_user_self_deletion():
    """T008: delete_user() should reject self-deletion."""
    db = AsyncMock()

    from app.services.user_service import delete_user
    with pytest.raises(ValueError, match="Cannot delete yourself"):
        await delete_user(db, user_id=1, current_user_id=1)


@pytest.mark.asyncio
async def test_delete_user_created_by_guard():
    """T009: delete_user() should reject if user has created other users."""
    db = AsyncMock()
    user = make_user(id=1, created_by=0)
    db.execute = AsyncMock(side_effect=[
        mock_result(scalar_one=user),
        mock_result(scalar=2),  # 2 users created by this user
    ])

    from app.services.user_service import delete_user
    with pytest.raises(ValueError, match="Cannot delete user who has created other users"):
        await delete_user(db, user_id=1, current_user_id=3)


@pytest.mark.asyncio
async def test_update_user_with_password():
    """T010: update_user() should hash and set password when provided."""
    db = AsyncMock()
    user = make_user(id=2)
    db.execute = AsyncMock(return_value=mock_result(scalar_one=user))

    data = MagicMock()
    data.real_name = None
    data.password = "newpass123"
    data.status = None
    data.org_ids = None
    data.role_ids = None

    with patch("app.services.user_service.hash_password") as mock_hash:
        mock_hash.return_value = "$2b$hashed_new"
        from app.services.user_service import update_user
        await update_user(db, user_id=2, data=data)
        mock_hash.assert_called_once_with("newpass123")
        assert user.password == "$2b$hashed_new"

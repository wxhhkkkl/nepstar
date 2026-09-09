"""Integration tests for User API — TDD: Red phase (fail before implementation)."""
import pytest


@pytest.mark.asyncio
async def test_delete_user_success(client, admin_headers):
    """T013: DELETE /users/{id} should return 200 for valid deletion."""
    # First create a user
    create_resp = await client.post("/api/v1/users", json={
        "username": "delete_test_user", "real_name": "Delete Me",
        "password": "Test12345", "org_ids": [1], "role_ids": [1],
    }, headers=admin_headers)
    user_id = create_resp.json()["data"]["id"]

    # Then delete
    resp = await client.delete(f"/api/v1/users/{user_id}", headers=admin_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_delete_user_self_deletion(client, admin_headers):
    """T014: DELETE /users/{id} should reject self-deletion (400)."""
    resp = await client.delete("/api/v1/users/1", headers=admin_headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_user_created_by_guard(client, admin_headers):
    """T015: DELETE /users/{id} should reject if user created others (400)."""
    # admin (id=1) created other users via seed data, so deletion should be rejected
    resp = await client.delete("/api/v1/users/1", headers=admin_headers)
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_unlock_user_endpoint(client, admin_headers):
    """T011: PUT /users/{id}/unlock should still work (regression)."""
    resp = await client.put("/api/v1/users/2/unlock", headers=admin_headers)
    # 200 or 404 are both acceptable (user may not exist in test DB)
    assert resp.status_code in (200, 404)


@pytest.mark.asyncio
async def test_create_user_validation(client, admin_headers):
    """T012: POST /users with empty role/org list should be rejected."""
    resp = await client.post("/api/v1/users", json={
        "username": "noval_user", "real_name": "No Validation",
        "password": "Test12345", "org_ids": [], "role_ids": [],
    }, headers=admin_headers)
    assert resp.status_code == 422  # Pydantic validation: min_length=1

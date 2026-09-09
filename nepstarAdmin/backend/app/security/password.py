"""Password hashing and validation using bcrypt."""

import re

import bcrypt


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain-text password against its bcrypt hash."""
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def validate_password_complexity(password: str, min_length: int = 8) -> str | None:
    """Validate password meets complexity rules.
    Returns error message or None if valid.
    """
    if len(password) < min_length:
        return f"Password must be at least {min_length} characters"
    if not re.search(r"[a-zA-Z]", password):
        return "Password must contain at least one letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one digit"
    return None

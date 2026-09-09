"""Backend i18n message loader — zh-CN, en, es."""

MESSAGES = {
    "zh-CN": {
        "auth.invalid_credentials": "用户名或密码错误",
        "auth.account_locked": "账号已被锁定，请稍后再试",
        "auth.password_changed": "密码修改成功",
        "auth.weak_password": "密码需至少8位且包含字母和数字",
        "auth.must_change_pwd": "首次登录，请修改密码",
        "common.not_found": "资源不存在",
        "common.forbidden": "无权限访问",
        "common.conflict": "操作冲突",
        "common.validation_error": "请求参数无效",
        "user.exists": "用户名已存在",
        "role.has_users": "角色下有关联用户，无法删除",
        "org.has_children": "组织下有子组织或设备，无法删除",
        "device.not_found": "设备不存在",
    },
    "en": {
        "auth.invalid_credentials": "Invalid username or password",
        "auth.account_locked": "Account locked, please try again later",
        "auth.password_changed": "Password changed successfully",
        "auth.weak_password": "Password must be at least 8 characters with letters and numbers",
        "auth.must_change_pwd": "First login, please change your password",
        "common.not_found": "Resource not found",
        "common.forbidden": "Access denied",
        "common.conflict": "Operation conflict",
        "common.validation_error": "Invalid request parameters",
        "user.exists": "Username already exists",
        "role.has_users": "Role has associated users, cannot delete",
        "org.has_children": "Organization has children or devices, cannot delete",
        "device.not_found": "Device not found",
    },
    "es": {
        "auth.invalid_credentials": "Usuario o contraseña inválidos",
        "auth.account_locked": "Cuenta bloqueada, intente más tarde",
        "auth.password_changed": "Contraseña cambiada exitosamente",
        "auth.weak_password": "La contraseña debe tener al menos 8 caracteres con letras y números",
        "auth.must_change_pwd": "Primer inicio de sesión, cambie su contraseña",
        "common.not_found": "Recurso no encontrado",
        "common.forbidden": "Acceso denegado",
        "common.conflict": "Conflicto de operación",
        "common.validation_error": "Parámetros de solicitud inválidos",
        "user.exists": "El nombre de usuario ya existe",
        "role.has_users": "El rol tiene usuarios asociados, no se puede eliminar",
        "org.has_children": "La organización tiene dependencias, no se puede eliminar",
        "device.not_found": "Dispositivo no encontrado",
    },
}


def get_message(key: str, lang: str = "zh-CN") -> str:
    return MESSAGES.get(lang, MESSAGES["zh-CN"]).get(key, key)

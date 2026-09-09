"""PII (Personally Identifiable Information) masking utilities.

手机号和姓名脱敏处理：在API返回数据前对敏感字段进行掩码，
确保前端永远不会收到原始明文数据。
"""


def mask_phone(phone: str | None) -> str | None:
    """脱敏手机号：保留前3位和后4位，中间替换为****。

    Examples:
        mask_phone("13812345678") → "138****5678"
        mask_phone("1381234") → "1****"  (短号码保留首字符)
        mask_phone(None) → None
        mask_phone("") → ""
    """
    if not phone:
        return phone
    if len(phone) >= 7:
        return phone[:3] + "****" + phone[-4:]
    return phone[0] + "****"


def mask_name(name: str | None) -> str | None:
    """脱敏姓名：保留首字符，其余替换为*。

    Examples:
        mask_name("张三") → "张*"
        mask_name("Li Xiaoming") → "L*********"
        mask_name("A") → "A"
        mask_name(None) → None
        mask_name("") → ""
    """
    if not name:
        return name
    return name[0] + "*" * (len(name) - 1)

"""海王开放平台签名（MD5 大写 → SHA1 大写）。

规则来自《海王相关接口签名方案》：
1. 去除 sign、None、空字符串与字节类型参数；
2. 参数名按 ASCII 升序；
3. 拼接 ``a=v1&b=v2``，末尾追加 ``&secret=<secret>``；
4. 对整串做 MD5，取大写十六进制；
5. 对**大写 MD5 字符串**做 SHA1，取大写十六进制。
"""

import hashlib
import hmac
import time
from collections.abc import Mapping
from typing import Any


def _is_blank(value: Any) -> bool:
    return value is None or isinstance(value, bytes | bytearray | memoryview) or value == ""


def canonical_string(params: Mapping[str, Any]) -> str:
    """按文档规则拼接待签名字符串（不含 secret）。"""
    items = sorted(
        (str(key), str(value))
        for key, value in params.items()
        if key != "sign" and not _is_blank(value)
    )
    return "&".join(f"{key}={value}" for key, value in items)


def build_sign(params: Mapping[str, Any], secret: str) -> str:
    """生成大写 sign；签名基于参数原始值，不做 URL 编码。"""
    source = f"{canonical_string(params)}&secret={secret}"
    md5_upper = hashlib.md5(source.encode("utf-8")).hexdigest().upper()
    return hashlib.sha1(md5_upper.encode("utf-8")).hexdigest().upper()


def verify_sign(params: Mapping[str, Any], secret: str) -> bool:
    """恒定时间比较签名，避免时序侧信道。"""
    provided = str(params.get("sign", "")).upper()
    if not provided or not secret:
        return False
    return hmac.compare_digest(build_sign(params, secret), provided)


def timestamp_is_fresh(timestamp: Any, tolerance_seconds: int, now: int | None = None) -> bool:
    """校验 10 位秒级时间戳是否在允许误差内。"""
    try:
        value = int(timestamp)
    except (TypeError, ValueError):
        return False
    current = time.time() if now is None else now
    return abs(int(current) - value) <= tolerance_seconds

"""海王签名黄金用例与边界规则。"""

from app.utils.haixin_sign import build_sign, canonical_string, timestamp_is_fresh, verify_sign


def test_document_golden_case():
    params = {
        "appKey": "test",
        "phone": "13798261307",
        "timestamp": "1547795196",
        "type": "1",
        "version": "1.0",
    }
    assert canonical_string(params) == (
        "appKey=test&phone=13798261307&timestamp=1547795196&type=1&version=1.0"
    )
    assert build_sign(params, "test") == "5F366AE0295C45AE78B11FC022199FBB0E5D4239"


def test_empty_and_sign_params_are_excluded():
    params = {"appKey": "test", "memo": "", "skip": None, "sign": "ignored", "type": "1"}
    assert canonical_string(params) == "appKey=test&type=1"


def test_verify_sign_is_case_insensitive_on_provided_value():
    params = {"appKey": "test", "timestamp": "1547795196", "version": "1.0"}
    sign = build_sign(params, "test")
    assert verify_sign({**params, "sign": sign.lower()}, "test")
    assert verify_sign({**params, "sign": sign}, "test")
    assert not verify_sign({**params, "sign": "BAD"}, "test")
    assert not verify_sign({**params, "sign": sign}, "")


def test_timestamp_tolerance():
    now = 1_700_000_000
    assert timestamp_is_fresh(now - 600, 600, now=now)
    assert timestamp_is_fresh(now + 600, 600, now=now)
    assert not timestamp_is_fresh(now - 601, 600, now=now)
    assert not timestamp_is_fresh("not-a-number", 600, now=now)

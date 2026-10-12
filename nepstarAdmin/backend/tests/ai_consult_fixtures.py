"""合成 AI 咨询 fixtures；不建立数据库连接，也不执行网络请求。"""

from copy import deepcopy
from datetime import datetime

from app.security.ai_consult_access import build_guest_context


TEST_HMAC_KEY = "ai-consult-fixture-only-key-material-32-bytes"
TEST_NOW = datetime(2026, 10, 8, 12, 0, 0)

SYNTHETIC_REPORTS = {
    ("R1", 1001): {
        "report": {"report_code": "R1", "report_date": "2026-10-08", "total_score": 82},
        "systems": [{"system_code": "SYS_LUNG", "name": "肺功能", "score": 80}],
    },
    ("R2", 2002): {
        "report": {"report_code": "R2", "report_date": "2026-10-09", "total_score": 91},
        "systems": [{"system_code": "SYS_CARDIO", "name": "心血管", "score": 91}],
    },
}


class FakePublicReportSource:
    """只读合成报告源：仅暴露查询方法，返回副本并记录读取范围。"""

    def __init__(self, reports=None):
        self._reports = deepcopy(SYNTHETIC_REPORTS if reports is None else reports)
        self.reads = []

    async def load_home(self, report_code: str, customer_id: int):
        self.reads.append((report_code, customer_id))
        report = self._reports.get((report_code, customer_id))
        return deepcopy(report) if report is not None else None


class FakeDraftProvider:
    """不访问外部模型的确定性替身。"""

    provider_code = "fixture-provider"
    model_code = "fixture-model"
    available = True

    def __init__(self, result=None, error=None):
        self.result = result or {
            "summary": "可以结合本次报告指标理解。",
            "evidence_ids": ["ev1"],
            "follow_up_questions": [],
            "_usage": {"prompt_tokens": 10, "completion_tokens": 8},
        }
        self.error = error
        self.calls = []

    async def draft(self, *, question, evidence):
        self.calls.append((question, deepcopy(evidence)))
        if self.error is not None:
            raise self.error
        return deepcopy(self.result)


def make_guest_pair(report_code="R1", customer_id=1001):
    """Create two independent credentials bound to the same synthetic report."""
    return tuple(
        build_guest_context(
            report_code,
            customer_id,
            now=TEST_NOW,
            hmac_key=TEST_HMAC_KEY,
        )
        for _ in range(2)
    )

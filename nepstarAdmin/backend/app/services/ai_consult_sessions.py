"""匿名咨询欢迎数据：只转换已验证的报告聚合结果，不生成示例报告。"""

import math
from typing import Any


def _score(value: Any) -> int | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    if not math.isfinite(value) or value < 0 or value > 100 or int(value) != value:
        return None
    return int(value)


def build_welcome_context(home: dict[str, Any]) -> dict[str, Any]:
    """从现有报告首页数据挑选可核对字段；缺项不推断或填充假分数。"""
    report = home.get("report") or {}
    systems = home.get("systems") or []
    date = report.get("report_date")
    total = _score(report.get("total_score"))
    visible = [item for item in systems if isinstance(item, dict)]
    scored = [
        (str(item["name"]), _score(item.get("score")))
        for item in visible
        if item.get("name") and _score(item.get("score")) is not None
    ]
    scored.sort(key=lambda item: item[1])

    if total is None:
        summary = f"本次报告展示 {len(visible)} 个身体系统；总分未提供。"
    else:
        summary = f"本次报告总分 {total} 分，展示 {len(visible)} 个身体系统。"

    questions = [
        f"我的{name}活力值{score}分，应该如何理解？"
        for name, score in scored[:2]
    ]
    if total is not None:
        questions.append(f"本次报告总分{total}分，我应该优先关注什么？")
    else:
        questions.append("这份报告的总体结果应该如何理解？")
    for fallback in (
        "这份报告有哪些指标值得关注？",
        "本次报告与历史检测有可核对的变化吗？",
    ):
        if len(questions) >= 3:
            break
        questions.append(fallback)

    return {
        "report_date": date,
        "report_summary": summary,
        "suggested_questions": questions[:3],
    }

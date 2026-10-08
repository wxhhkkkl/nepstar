"""咨询模型的窄接口；生产模型未获批准前不进行外部调用。"""

from typing import Any, Protocol


class ProviderUnavailable(RuntimeError):
    """当前没有获准处理报告数据的模型服务。"""


class DraftProvider(Protocol):
    async def draft(self, *, question: str, evidence: dict[str, Any]) -> dict[str, Any]:
        """仅返回 {summary, evidence_ids}；不得自行读取报告或发送原始流。"""


class DisabledDraftProvider:
    async def draft(self, *, question: str, evidence: dict[str, Any]) -> dict[str, Any]:
        raise ProviderUnavailable("AI consult provider is disabled")


default_provider: DraftProvider = DisabledDraftProvider()

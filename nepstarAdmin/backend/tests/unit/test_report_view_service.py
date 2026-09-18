"""Unit tests for report_view_service — 首页组装、口径过滤、性别分支、派生与错误区分。

全部用固定 fixture 与 AsyncMock，不连真实数据源。
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.new.sa_indicator import SAIndicator
from app.services import report_source, report_view_service as svc


# --- fixtures ---


def ind(id_, code, name, target_id, sort_order, parent_id=None, **over):
    return SAIndicator(
        id=id_,
        parent_id=parent_id,
        ind_code=code,
        ind_name=name,
        sort_order=sort_order,
        status=1,
        target_id=target_id,
        **over,
    )


# 8 个 V2 系统中取 4 个做样本：心血管(一级) / 骨骼(一级) / 女性功能(二级) / 男性功能(二级)
INDICATORS = [
    ind(1, "SYS_CARDIO", "心血管", 3087, 1),
    ind(2, "SYS_CARDIO_LIPID", "血脂", 3088, 1, parent_id=1),
    ind(3, "SYS_CARDIO_VESSEL", "血管弹性", 3089, 2, parent_id=1),
    ind(4, "SYS_BONE", "骨骼", 3127, 2),
    ind(5, "SYS_BONE_OSTEO", "骨质疏松", 3130, 1, parent_id=4),
    # 性别两项：女性报告只有 3152 出现在文档里，男性那支被自然排除
    ind(6, "SYS_FEMALE", "女性功能", 3152, 3),
    ind(7, "SYS_FEMALE_PROGESTERONE", "黄体酮", 3154, 1, parent_id=6),
    ind(8, "SYS_MALE", "男性功能", 3144, 4),
    ind(9, "SYS_MALE_ED", "勃起功能", 3146, 1, parent_id=8),
]

WEIGHTS = {
    3087: {"name": "循环系统", "weight": 30},
    3088: {"name": "心血管", "weight": 100},
    3089: {"name": "血管弹性", "weight": 40},
    3127: {"name": "骨骼系统", "weight": 5},
    3130: {"name": "骨质疏松", "weight": 20},
    3152: {"name": "女性功能", "weight": 40},
    3154: {"name": "黄体酮", "weight": 30},
    3144: {"name": "男性功能", "weight": 30},
    3146: {"name": "勃起功能", "weight": 40},
}


def female_doc(report_code="R1"):
    """女性报告：只有 3152 支，没有 3144。"""
    return {
        "_id": report_code,
        "sex": 0,
        "uId": "u1",
        "ddsReportInfo": {
            "inspectAge": 57,
            "totalAge": 57.7,
            "totalScore": 82,
            "firstTarget": [
                {
                    "targetId": 3087,
                    "score": 91,
                    "secondTarget": [
                        {"targetId": 3088, "score": 90, "threeTarget": [{"targetId": 3089, "score": 94}]}
                    ],
                },
                {"targetId": 3127, "score": 94, "secondTarget": [{"targetId": 3130, "score": 48}]},
                {"targetId": 3108, "score": 80, "secondTarget": []},
                {
                    "targetId": 3143,
                    "score": 89,
                    "secondTarget": [{"targetId": 3152, "score": 85, "threeTarget": [{"targetId": 3154, "score": 83}]}],
                },
                # 未登记到后台的旧系统：不应出现
                {"targetId": 3163, "score": 90, "secondTarget": []},
                {"targetId": 3195, "score": 77, "secondTarget": []},
            ],
        },
        "spo2hReportInfo": {"heartRate": 64, "bloodoxygenRate": 97, "microcirculation": 86},
        "ecgReportInfo": {"heartRate": 64, "heartStatus": 1},
    }


META = {"status": 1, "report_date": "2026-08-03", "ranking": "22", "customer_id": 1001}


def make_db():
    res = MagicMock()
    res.scalars.return_value.all.return_value = INDICATORS
    db = AsyncMock()
    db.execute = AsyncMock(return_value=res)
    return db


def patch_sources(doc=None, meta=None, weights=None, trend=None):
    """把 report_source 的 IO 全打桩。"""
    return [
        patch.object(report_source, "fetch_report_document", AsyncMock(return_value=doc)),
        patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=meta)),
        patch.object(report_source, "fetch_indicator_meta", AsyncMock(return_value=weights or WEIGHTS)),
        patch.object(report_source, "fetch_recent_system_scores", AsyncMock(return_value=trend or [])),
    ]


_UNSET = object()


async def build(doc=_UNSET, meta=_UNSET, weights=None, trend=None):
    """构建首页数据。显式传 doc=None / meta=None 表示"数据源查不到"。"""
    db = make_db()
    ctxs = patch_sources(
        female_doc() if doc is _UNSET else doc,
        META if meta is _UNSET else meta,
        weights,
        trend,
    )
    for c in ctxs:
        c.start()
    try:
        return await svc.build_home(db, "R1", 1001)
    finally:
        for c in ctxs:
            c.stop()


# --- 系统组装 ---


class TestSystemAssembly:
    @pytest.mark.asyncio
    async def test_returns_only_registered_systems(self):
        """未登记到后台的旧系统（营养状态/有害物质）不出现（FR-027）。"""
        payload = await build()
        codes = [s["system_code"] for s in payload["systems"]]
        assert codes == ["SYS_CARDIO", "SYS_BONE", "SYS_FEMALE"]

    @pytest.mark.asyncio
    async def test_gender_branch_excludes_other_sex(self):
        """女性报告的文档里没有男性那支，系统被自然排除，不做性别推断（FR-012）。"""
        payload = await build()
        assert "SYS_MALE" not in [s["system_code"] for s in payload["systems"]]

    @pytest.mark.asyncio
    async def test_seven_systems_for_each_report(self):
        """8 个定义系统中性别二选一 → 每份报告恒 7 个（SC-019）。"""
        all_indicators = INDICATORS + [
            ind(20, "SYS_LUNG", "肺功能", 3108, 5),
            ind(21, "SYS_DIGEST", "消化系统", 3095, 6),
            ind(22, "SYS_IMMUNE", "免疫力", 3135, 7),
            ind(23, "SYS_ENDOCRINE", "内分泌", 3115, 8),
        ]
        doc = female_doc()
        doc["ddsReportInfo"]["firstTarget"] += [
            {"targetId": 3108, "score": 80, "secondTarget": []},
            {"targetId": 3095, "score": 75, "secondTarget": []},
            {"targetId": 3135, "score": 88, "secondTarget": []},
            {"targetId": 3115, "score": 90, "secondTarget": []},
        ]
        res = MagicMock()
        res.scalars.return_value.all.return_value = all_indicators
        db = AsyncMock()
        db.execute = AsyncMock(return_value=res)
        ctxs = patch_sources(doc, META)
        for c in ctxs:
            c.start()
        try:
            payload = await svc.build_home(db, "R1", 1001)
        finally:
            for c in ctxs:
                c.stop()
        assert len(payload["systems"]) == 7

    @pytest.mark.asyncio
    async def test_system_score_comes_from_document_level(self):
        """心血管取一级 3087=91；女性功能取二级 3152=85（FR-044）。"""
        payload = await build()
        by_code = {s["system_code"]: s for s in payload["systems"]}
        assert by_code["SYS_CARDIO"]["score"] == 91
        assert by_code["SYS_FEMALE"]["score"] == 85

    @pytest.mark.asyncio
    async def test_indicators_carry_weight_from_old_dictionary(self):
        """权重取自旧库字典（FR-037），不是后台维护的。"""
        payload = await build()
        cardio = next(s for s in payload["systems"] if s["system_code"] == "SYS_CARDIO")
        assert [i["weight"] for i in cardio["indicators"]] == [100, 40]

    @pytest.mark.asyncio
    async def test_visualization_categories_and_series_align(self):
        """类别与序列一一对应（FR-022）。"""
        payload = await build()
        cardio = next(s for s in payload["systems"] if s["system_code"] == "SYS_CARDIO")
        viz = cardio["visualization"]
        assert viz["categories"] == ["血脂", "血管弹性"]
        assert viz["series"] == [90, 94]

    @pytest.mark.asyncio
    async def test_sorted_by_backend_sort_order(self):
        payload = await build()
        assert [s["sort_order"] for s in payload["systems"]] == [1, 2, 3]


class TestReportSummary:
    @pytest.mark.asyncio
    async def test_warning_threshold_comes_from_config(self):
        payload = await build()
        assert payload["report"]["warning_threshold"] == 70
        assert payload["report"]["total_score"] == 82

    @pytest.mark.asyncio
    async def test_life_expectancy_is_derived(self):
        """86.8 − (57.7 − 57) = 86.1（FR-045）。"""
        payload = await build()
        assert payload["report"]["healthy_life_expectancy"] == 86.1

    @pytest.mark.asyncio
    async def test_life_expectancy_none_when_ages_missing(self):
        doc = female_doc()
        doc["ddsReportInfo"].pop("inspectAge")
        doc["ddsReportInfo"].pop("totalAge")
        payload = await build(doc=doc)
        assert payload["report"]["healthy_life_expectancy"] is None


class TestTrend:
    @pytest.mark.asyncio
    async def test_only_cardiac_gets_trend(self):
        """仅心血管返回趋势，其余为空（FR-034）。"""
        payload = await build(trend=[80, 82, 84, 86, 88, 91])
        by_code = {s["system_code"]: s for s in payload["systems"]}
        assert by_code["SYS_CARDIO"]["trend"]["series"] == [80, 82, 84, 86, 88, 91]
        assert by_code["SYS_BONE"]["trend"]["series"] == []

    @pytest.mark.asyncio
    async def test_trend_queried_once_with_current_report_excluded(self):
        trend_mock = AsyncMock(return_value=[])
        db = make_db()
        ctxs = [
            patch.object(report_source, "fetch_report_document", AsyncMock(return_value=female_doc())),
            patch.object(report_source, "fetch_report_meta", AsyncMock(return_value=META)),
            patch.object(report_source, "fetch_indicator_meta", AsyncMock(return_value=WEIGHTS)),
            patch.object(report_source, "fetch_recent_system_scores", trend_mock),
        ]
        for c in ctxs:
            c.start()
        try:
            await svc.build_home(db, "R1", 1001)
        finally:
            for c in ctxs:
                c.stop()
        assert trend_mock.await_count == 1  # 只查一次，不是每个系统都查
        assert trend_mock.await_args.args[1] == 1001  # customer_id
        assert trend_mock.await_args.args[2] == 3087  # 心血管
        assert trend_mock.await_args.kwargs["exclude_report_code"] == "R1"


class TestRegistrationAndLogging:
    @pytest.mark.asyncio
    async def test_logs_unmatched_target_ids(self):
        """文档里存在但未登记的 targetId 要记录，供排查（FR-028、FR-039）。"""
        with patch.object(svc, "log_report_request") as log:
            await build()
        missing = log.call_args.kwargs["missing_target_ids"]
        assert 3163 in missing and 3195 in missing

    @pytest.mark.asyncio
    async def test_logs_ok_outcome(self):
        with patch.object(svc, "log_report_request") as log:
            await build()
        assert log.call_args.kwargs["outcome"] == "ok"
        assert log.call_args.kwargs["report_code"] == "R1"


class TestErrorDistinction:
    """四种失败情形内部可区分（FR-019）。"""

    @pytest.mark.asyncio
    async def test_missing_document(self):
        with pytest.raises(svc.ReportNotFoundError) as e:
            await build(doc=None)
        assert e.value.reason == "not_found"

    @pytest.mark.asyncio
    async def test_customer_mismatch_is_recorded_as_access_denied(self):
        with pytest.raises(svc.ReportNotFoundError) as e:
            await build(meta={**META, "customer_id": 999999})
        assert e.value.reason == "access_denied"

    @pytest.mark.asyncio
    async def test_not_ready(self):
        with pytest.raises(svc.ReportNotReadyError):
            await build(meta={**META, "status": 0})

    @pytest.mark.asyncio
    async def test_source_failure_propagates(self):
        with patch.object(
            report_source,
            "fetch_report_document",
            AsyncMock(side_effect=report_source.ReportSourceUnavailableError("boom")),
        ):
            db = make_db()
            with pytest.raises(report_source.ReportSourceUnavailableError):
                await svc.build_home(db, "R1", 1001)

    @pytest.mark.asyncio
    async def test_not_found_and_access_denied_share_public_key(self):
        keys = set()
        for kwargs in ({"doc": None}, {"meta": {**META, "customer_id": 999999}}):
            with pytest.raises(svc.ReportNotFoundError) as e:
                await build(**kwargs)
            keys.add((e.value.key, e.value.code))
        assert keys == {("report.not_found", 404)}


# --- US2：系统详情 ---

DETAIL_INDICATORS = INDICATORS + [
    ind(30, "SYS_LUNG", "肺功能", 3108, 5),
    ind(31, "SYS_LUNG_VC", "肺活量 VC", 3111, 1, parent_id=30),
]

DETAIL_WEIGHTS = {
    **WEIGHTS,
    3108: {"name": "呼吸系统", "weight": 15},
    3111: {"name": "肺活量 VC", "weight": 25},
}


def make_detail_db():
    res = MagicMock()
    res.scalars.return_value.all.return_value = DETAIL_INDICATORS
    db = AsyncMock()
    db.execute = AsyncMock(return_value=res)
    return db


async def build_detail(system_code, doc=None, meta=None):
    db = make_detail_db()
    ctxs = patch_sources(
        doc if doc is not None else female_doc(), meta or META, DETAIL_WEIGHTS
    )
    for c in ctxs:
        c.start()
    try:
        return await svc.build_system_detail(db, "R1", system_code, 1001)
    finally:
        for c in ctxs:
            c.stop()


class TestSystemDetail:
    @pytest.mark.asyncio
    async def test_returns_indicators_with_weight(self):
        payload = await build_detail("SYS_BONE")
        system = payload["system"]
        assert system["system_code"] == "SYS_BONE"
        assert system["indicators"] == [
            {
                "indicator_code": "SYS_BONE_OSTEO",
                "name": "骨质疏松",
                "score": 48,
                "weight": 20,
                "description": None,
            }
        ]

    @pytest.mark.asyncio
    async def test_matches_home_for_the_same_system(self):
        """首页与详情的同一系统必须完全一致（FR-011、SC-002）。"""
        home = await build()
        detail = await build_detail("SYS_CARDIO")
        from_home = next(s for s in home["systems"] if s["system_code"] == "SYS_CARDIO")
        for field in ("score", "status_text", "summary", "visualization", "trend", "indicators"):
            assert detail["system"][field] == from_home[field]

    @pytest.mark.asyncio
    async def test_direct_measurements_are_attached_to_cardiac(self):
        """微循环/心率/心电图挂到心血管，不参与加权（FR-009）。"""
        system = (await build_detail("SYS_CARDIO"))["system"]
        got = [(m["name"], m["value"], m["unit"]) for m in system["direct_measurements"]]
        assert got == [("微循环", "86", None), ("心率", "64", "bpm"), ("心电图", "正常", None)]

    @pytest.mark.asyncio
    async def test_direct_measurements_are_attached_to_lung(self):
        system = (await build_detail("SYS_LUNG"))["system"]
        got = [(m["name"], m["value"], m["unit"]) for m in system["direct_measurements"]]
        assert got == [("血氧饱和度", "97", "%")]

    @pytest.mark.asyncio
    async def test_abnormal_ecg_status_is_reported_as_abnormal(self):
        doc = female_doc()
        doc["ecgReportInfo"]["heartStatus"] = 8
        system = (await build_detail("SYS_CARDIO", doc=doc))["system"]
        ecg = next(m for m in system["direct_measurements"] if m["name"] == "心电图")
        assert ecg["value"] == "异常"

    @pytest.mark.asyncio
    async def test_systems_without_direct_values_return_empty(self):
        system = (await build_detail("SYS_BONE"))["system"]
        assert system["direct_measurements"] == []

    @pytest.mark.asyncio
    async def test_missing_direct_block_does_not_break(self):
        doc = female_doc()
        doc.pop("spo2hReportInfo")
        doc.pop("ecgReportInfo")
        system = (await build_detail("SYS_CARDIO", doc=doc))["system"]
        assert system["direct_measurements"] == []

    @pytest.mark.asyncio
    async def test_unknown_system_raises_system_not_found(self):
        """不得回退到第一个系统（FR-007）。"""
        with pytest.raises(svc.ReportSystemNotFoundError):
            await build_detail("SYS_NOPE")

    @pytest.mark.asyncio
    async def test_registered_but_absent_system_raises_system_not_found(self):
        """已登记但该报告没有这一支（如性别不符）也按系统不存在处理。"""
        with pytest.raises(svc.ReportSystemNotFoundError):
            await build_detail("SYS_MALE")

    @pytest.mark.asyncio
    async def test_interpretation_and_actions_come_from_indicator_copy(self):
        """文案来自指标管理维护的字段（FR-010、FR-041）。"""
        system = (await build_detail("SYS_BONE"))["system"]
        assert system["interpretation"] is None
        assert system["actions"] == []


# --- US3：推荐方案与商品 ---

# indicator_id(=sa_indicator.id) -> 命中的方案
PLANS = {
    5: [  # 骨骼的"骨质疏松"(target 3130)
        {
            "plan_id": 2,
            "plan_name": "骨质疏松钙流失健康管理方案",
            "description": "提供钙营养与维生素 D 的连续管理参考。",
            # 注：tags / actionLabel / actionHint 在 sa_plan 里没有对应列，
            # 当前没有来源，组装时按空处理。
            "products": [
                {
                    "product_id": 2,
                    "name": "钙流失健康管理礼盒",
                    "image_url": "https://cdn/钙流失.png",
                    "image_alt": "钙流失健康管理礼盒",
                }
            ],
        }
    ],
}


async def build_with_plans(plans=None, **kwargs):
    db = make_db()
    ctxs = patch_sources(female_doc(), META, DETAIL_WEIGHTS)
    for c in ctxs:
        c.start()
    try:
        with patch.object(
            report_source, "fetch_plans_for_indicators", AsyncMock(return_value=plans or {})
        ):
            return await svc.build_home(db, "R1", 1001)
    finally:
        for c in ctxs:
            c.stop()


class TestRecommendations:
    @pytest.mark.asyncio
    async def test_attaches_recommendation_to_matching_system(self):
        payload = await build_with_plans(PLANS)
        bone = next(s for s in payload["systems"] if s["system_code"] == "SYS_BONE")
        rec = bone["recommendation"]
        assert rec["plan_id"] == 2
        assert rec["title"] == "骨质疏松钙流失健康管理方案"  # 取方案名（无独立的展示标题字段）
        assert rec["issue"] == "骨质疏松 · 活力值 48"
        # 这三个字段源数据里没有对应列，按空返回
        assert rec["tags"] == []
        assert rec["action_label"] is None and rec["action_hint"] is None
        assert rec["trigger_indicator_code"] == "SYS_BONE_OSTEO"
        assert rec["products"][0]["name"] == "钙流失健康管理礼盒"

    @pytest.mark.asyncio
    async def test_systems_without_a_plan_have_no_recommendation(self):
        payload = await build_with_plans(PLANS)
        cardio = next(s for s in payload["systems"] if s["system_code"] == "SYS_CARDIO")
        assert cardio["recommendation"] is None

    @pytest.mark.asyncio
    async def test_no_plans_at_all_leaves_every_system_empty(self):
        payload = await build_with_plans({})
        assert all(s["recommendation"] is None for s in payload["systems"])

    @pytest.mark.asyncio
    async def test_recommendation_issue_names_the_triggering_indicator(self):
        payload = await build_with_plans(PLANS)
        bone = next(s for s in payload["systems"] if s["system_code"] == "SYS_BONE")
        trigger = bone["recommendation"]["trigger_indicator_code"]
        # 触发指标必须出现在该系统的指标列表里（FR-015）
        assert trigger in [i["indicator_code"] for i in bone["indicators"]]

    @pytest.mark.asyncio
    async def test_systems_with_recommendations_render_first(self):
        """低分且命中推荐方案的系统优先（FR-014）。骨骼 sort_order=2，应排到最前。"""
        payload = await build_with_plans(PLANS)
        assert [s["system_code"] for s in payload["systems"]][0] == "SYS_BONE"


class TestEntryConfig:
    """入口配置与功能开关取自后台固定值，前端不内置（FR-020、US5）。"""

    @pytest.mark.asyncio
    async def test_values_come_from_settings(self):
        from app.config import settings

        payload = await build()
        assert payload["ai_consult"]["enabled"] is settings.REPORT_AI_CONSULT_ENABLED
        assert payload["ai_consult"]["title"] == settings.REPORT_AI_CONSULT_TITLE
        assert payload["ai_consult"]["entry_type"] == settings.REPORT_AI_CONSULT_ENTRY_TYPE
        assert payload["ai_consult"]["entry_url"] == settings.REPORT_AI_CONSULT_ENTRY_URL
        assert payload["features"]["save_report_enabled"] is settings.REPORT_SAVE_ENABLED

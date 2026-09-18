"""Unit tests for report_source — 报告文档读取、字典读取与错误归并。

全部用固定 fixture，不连真实 MongoDB 或 MySQL。
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from pymongo.errors import ServerSelectionTimeoutError

from app.services import report_source as rs

# --- fixtures：形状取自真实报告文档（见 data-model.md §2） ---

def make_doc(**over):
    doc = {
        "_id": "KH503LS0005865V220721182530852",
        "sex": 0,
        "uId": "11922495",
        "robotSn": "KH503LS0005865V",
        "reportDate": "20220721182722",
        "userInfo": {"userId": "11922495", "age": 54, "height": 160, "weight": 55},
        "ddsReportInfo": {
            "inspectAge": 57,
            "totalScore": 82,
            "totalScored": 85.1,
            "totalAge": 57.7,
            "firstTarget": [
                {
                    "targetId": 3087,
                    "score": 91,
                    "inspectAge": 54,
                    "secondTarget": [
                        {
                            "targetId": 3088,
                            "score": 90,
                            "threeTarget": [
                                {"targetId": 3089, "score": 94, "lastScore": 94, "abLevel": 1}
                            ],
                        }
                    ],
                },
                {"targetId": 3115, "score": 90, "secondTarget": []},  # 二级为空
            ],
            "fastScore": [91, 90],
        },
        "spo2hReportInfo": {"heartRate": 64, "bloodoxygenRate": 97, "microcirculation": 86},
        "ecgReportInfo": {"heartRate": 64, "heartStatus": 1},
    }
    doc.update(over)
    return doc


class TestWalkTargets:
    """三层遍历。"""

    def test_walks_all_three_levels(self):
        nodes = rs.walk_targets(make_doc()["ddsReportInfo"]["firstTarget"])
        got = {(n["target_id"], n["level"], n["score"]) for n in nodes}
        assert (3087, 1, 91) in got
        assert (3088, 2, 90) in got
        assert (3089, 3, 94) in got
        assert (3115, 1, 90) in got

    def test_tolerates_missing_nested_keys(self):
        """缺 secondTarget / threeTarget 不得抛错（文档结构会漂移）。"""
        nodes = rs.walk_targets([{"targetId": 1, "score": 10}])  # 无 secondTarget
        assert [n["target_id"] for n in nodes] == [1]
        nodes = rs.walk_targets([{"targetId": 1, "secondTarget": [{"targetId": 2}]}])
        assert [n["target_id"] for n in nodes] == [1, 2]

    def test_skips_entries_without_target_id(self):
        nodes = rs.walk_targets([{"score": 10}, {"targetId": 5, "score": 1}])
        assert [n["target_id"] for n in nodes] == [5]


class TestParseSummary:
    """报告摘要字段来源（FR-046）。"""

    def test_uses_inspect_age_not_profile_age(self):
        """实际年龄取受检年龄；文档里 userInfo.age=54、dds.inspectAge=57。"""
        s = rs.parse_summary(make_doc(), {"ranking": "22"})
        assert s["actual_age"] == 57
        assert s["biological_age"] == 57.7

    def test_ranking_is_cast_to_int(self):
        """旧库排名字段是字符串，对外必须转成整数。"""
        s = rs.parse_summary(make_doc(), {"ranking": "22"})
        assert s["peer_percent"] == 22

    def test_ranking_invalid_or_missing_is_none(self):
        assert rs.parse_summary(make_doc(), {"ranking": None})["peer_percent"] is None
        assert rs.parse_summary(make_doc(), {"ranking": ""})["peer_percent"] is None
        assert rs.parse_summary(make_doc(), {})["peer_percent"] is None

    def test_gender_from_sex(self):
        assert rs.parse_summary(make_doc(sex=0), {})["gender"] == "female"
        assert rs.parse_summary(make_doc(sex=1), {})["gender"] == "male"

    def test_tolerates_missing_dds_block(self):
        """完全没有明细时不得抛错，按可得数据降级。"""
        doc = make_doc()
        doc.pop("ddsReportInfo")
        s = rs.parse_summary(doc, {})
        assert s["total_score"] is None
        assert s["actual_age"] is None


class TestIsReady:
    """就绪判定：看主记录状态与报告生成时间，不看明细是否存在（FR-019）。"""

    def test_ready_when_status_ok_and_report_date_present(self):
        assert rs.is_ready({"status": 1, "report_date": "2026-08-03"}) is True

    def test_not_ready_when_status_invalid(self):
        assert rs.is_ready({"status": 0, "report_date": "2026-08-03"}) is False

    def test_not_ready_when_report_date_missing(self):
        assert rs.is_ready({"status": 1, "report_date": None}) is False

    def test_not_ready_when_meta_missing(self):
        assert rs.is_ready(None) is False


class TestErrorMapping:
    """数据源故障必须归并成可识别的异常，供上层转成 report.unavailable（FR-038）。"""

    @pytest.mark.asyncio
    async def test_mongo_timeout_becomes_source_unavailable(self):
        coll = MagicMock()
        coll.find_one = AsyncMock(side_effect=ServerSelectionTimeoutError("boom"))
        with pytest.raises(rs.ReportSourceUnavailableError):
            await rs.fetch_report_document("R1", collection=coll)

    @pytest.mark.asyncio
    async def test_mongo_returns_none_for_missing_report(self):
        coll = MagicMock()
        coll.find_one = AsyncMock(return_value=None)
        assert await rs.fetch_report_document("NOPE", collection=coll) is None

    @pytest.mark.asyncio
    async def test_mongo_not_configured_becomes_source_unavailable(self, monkeypatch):
        def _raise():
            raise rs.mongo.MongoNotConfiguredError("MONGODB_URL 未配置")

        monkeypatch.setattr(rs.mongo, "get_report_collection", _raise)
        with pytest.raises(rs.ReportSourceUnavailableError):
            await rs.fetch_report_document("R1")


class TestRecentSystemScores:
    """趋势序列：先按客户从旧库取报告编号，再按 _id 回查文档（FR-034~036）。

    报告集合有 84 万文档且没有 uId 索引，直接按 uId 查会全表扫描（实测超时），
    所以这里走的是 customer_id 索引 + _id 主键索引。
    """

    @staticmethod
    def _db(codes):
        rows = [(c,) for c in codes]
        res = MagicMock()
        res.all.return_value = rows
        db = AsyncMock()
        db.execute = AsyncMock(return_value=res)
        return db

    @staticmethod
    def _coll(docs):
        cursor = MagicMock()
        cursor.to_list = AsyncMock(return_value=docs)
        coll = MagicMock()
        coll.find.return_value = cursor
        return coll, cursor

    @staticmethod
    def _doc(report_code, score):
        return {
            "_id": report_code,
            "ddsReportInfo": {"firstTarget": [{"targetId": 3087, "score": score}]},
        }

    @pytest.mark.asyncio
    async def test_returns_scores_ascending_by_time(self):
        db = self._db(["C", "B", "A"])  # 旧库按时间倒序给出
        coll, _ = self._coll([self._doc("A", 82), self._doc("B", 85), self._doc("C", 88)])
        got = await rs.fetch_recent_system_scores(db, 1001, 3087, collection=coll)
        assert got == [82, 85, 88]

    @pytest.mark.asyncio
    async def test_excludes_current_report(self):
        db = self._db(["NOW", "B"])
        coll, _ = self._coll([self._doc("NOW", 99), self._doc("B", 85)])
        got = await rs.fetch_recent_system_scores(
            db, 1001, 3087, exclude_report_code="NOW", collection=coll
        )
        assert got == [85]

    @pytest.mark.asyncio
    async def test_looks_up_documents_by_id_not_by_uid(self):
        """必须按 _id 查——按 uId 查会全表扫描（该列没有索引）。"""
        db = self._db(["A", "B"])
        coll, _ = self._coll([])
        await rs.fetch_recent_system_scores(db, 1001, 3087, collection=coll)
        assert coll.find.call_args[0][0] == {"_id": {"$in": ["A", "B"]}}

    @pytest.mark.asyncio
    async def test_skips_rows_without_that_system(self):
        """某次没有该系统得分时跳过，不补零、不缩短到固定长度。"""
        db = self._db(["C", "B", "A"])
        coll, _ = self._coll(
            [self._doc("C", 88), {"_id": "B", "ddsReportInfo": {"firstTarget": []}}, self._doc("A", 82)]
        )
        got = await rs.fetch_recent_system_scores(db, 1001, 3087, collection=coll)
        assert got == [82, 88]

    @pytest.mark.asyncio
    async def test_caps_at_six_and_asks_for_six(self):
        db = self._db([f"R{i}" for i in range(6)])
        coll, _ = self._coll([self._doc(f"R{i}", 80 + i) for i in range(6)])
        got = await rs.fetch_recent_system_scores(db, 1001, 3087, collection=coll)
        assert len(got) == 6
        # SQL 里的 LIMIT 参数
        assert db.execute.await_args.args[1]["n"] == 6

    @pytest.mark.asyncio
    async def test_empty_history_returns_empty_without_querying_mongo(self):
        db = self._db([])
        coll, _ = self._coll([])
        assert await rs.fetch_recent_system_scores(db, 1001, 3087, collection=coll) == []
        coll.find.assert_not_called()

    @pytest.mark.asyncio
    async def test_mongo_failure_becomes_source_unavailable(self):
        db = self._db(["A"])
        coll = MagicMock()
        coll.find.side_effect = ServerSelectionTimeoutError("boom")
        with pytest.raises(rs.ReportSourceUnavailableError):
            await rs.fetch_recent_system_scores(db, 1001, 3087, collection=coll)

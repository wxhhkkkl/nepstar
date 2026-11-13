"""推送记录菜单幂等登记与顶层兜底。"""

from types import SimpleNamespace

from app.services.report_push_menu import seed_report_push_menu


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeSession:
    def __init__(self, values):
        self.values = iter(values)
        self.added = []
        self.commits = 0

    async def execute(self, statement):
        return FakeResult(next(self.values))

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1


async def test_creates_sibling_of_report_menu():
    report_menu = SimpleNamespace(parent_id=7, sort_order=3)
    db = FakeSession([None, report_menu])
    await seed_report_push_menu(db)
    assert len(db.added) == 1
    menu = db.added[0]
    assert menu.route_path == "/report/push-records"
    assert menu.parent_id == 7
    assert menu.sort_order == 4
    assert db.commits == 1


async def test_creates_top_level_when_report_menu_missing():
    db = FakeSession([None, None])
    await seed_report_push_menu(db)
    menu = db.added[0]
    assert menu.parent_id is None
    assert menu.sort_order == 0


async def test_idempotent_when_menu_exists():
    db = FakeSession([SimpleNamespace(id=99)])
    await seed_report_push_menu(db)
    assert db.added == []
    assert db.commits == 0

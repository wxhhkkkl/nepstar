#!/usr/bin/env python3
"""初始化 nepstar 库：执行 sql/schema-sa.sql + sql/seed-sa.sql。

用法（在 nepstarAdmin/backend 目录下）:
    python sql/init_nepstar_db.py

- 读取 .env 中的 NEPSTAR_DATABASE_URL（本脚本不含任何凭据）。
- 幂等：schema 用 CREATE TABLE IF NOT EXISTS；种子数据仅在
  sa_user/sa_menu 均为空时写入，重复运行安全。
"""

import os
import re
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BACKEND_DIR)


def load_env(path=".env"):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def parse(url):
    m = re.match(r"mysql\+aiomysql://([^:]+):([^@]+)@([^:/]+):(\d+)/(\w+)", url)
    if not m:
        raise SystemExit(f"Cannot parse NEPSTAR_DATABASE_URL: {url!r}")
    user, pw, host, port, db = m.groups()
    return dict(user=user, password=pw, host=host, port=int(port), db=db)


def split_statements(sql):
    """按 ';' 切分 SQL，忽略 -- 注释行与空行。"""
    stmts, buf = [], []
    for line in sql.splitlines():
        stripped = line.strip()
        if stripped.startswith("--") or not stripped:
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmts.append("\n".join(buf))
            buf = []
    if buf:
        stmts.append("\n".join(buf))
    return [s for s in stmts if s.strip()]


def main():
    url = load_env().get("NEPSTAR_DATABASE_URL", "")
    if not url:
        raise SystemExit("NEPSTAR_DATABASE_URL not set in .env")
    cfg = parse(url)
    print(f"Target: {cfg['host']}:{cfg['port']}  db={cfg['db']}  user={cfg['user']}")

    import pymysql
    conn = pymysql.connect(
        host=cfg["host"], port=cfg["port"], user=cfg["user"],
        password=cfg["password"], database=cfg["db"], charset="utf8mb4",
        autocommit=True, connect_timeout=15,
    )

    with conn.cursor() as cur:
        cur.execute("SHOW TABLES")
        before = {r[0] for r in cur.fetchall()}
        print(f"Tables before: {sorted(before) if before else 'NONE'}")

        # 1. schema
        schema_sql = open(os.path.join("sql", "schema-sa.sql"), encoding="utf-8").read()
        for stmt in split_statements(schema_sql):
            cur.execute(stmt)
        cur.execute("SHOW TABLES")
        after = {r[0] for r in cur.fetchall()}
        print(f"Schema applied. Created: {sorted(after - before)}")
        print(f"Tables now: {sorted(after)}")

        # 2. seed (guarded)
        seed_sql = open(os.path.join("sql", "seed-sa.sql"), encoding="utf-8").read()
        cur.execute("SELECT COUNT(*) FROM sa_user")
        n_users = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM sa_menu")
        n_menus = cur.fetchone()[0]
        print(f"Seed state: sa_user={n_users}, sa_menu={n_menus}")
        if n_users == 0 and n_menus == 0:
            for stmt in split_statements(seed_sql):
                cur.execute(stmt)
            cur.execute("SELECT COUNT(*) FROM sa_user")
            print(f"Seed applied. sa_user rows = {cur.fetchone()[0]}")
        else:
            print("Seed SKIPPED (sa_user/sa_menu already populated)")

    conn.close()
    print("DONE")


if __name__ == "__main__":
    main()

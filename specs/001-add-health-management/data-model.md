# Data Model — Health Management Module

All tables live in schema `nepstar` (ORM `__table_args__ = {"schema": NEPSTAR_SCHEMA}`), prefixed `sa_`, MySQL 5.6+ compatible, InnoDB utf8mb4, `BIGINT` autoincrement PK, no FK constraints (integrity enforced in service layer). DDL is added to `sql/schema-sa.sql` (doc/bootstrap) and to a new alembic migration (`003_add_health_module`) applied to the live DB.

## Entity relationships

```text
sa_indicator  (self-ref tree, exactly 2 levels)
  id
  parent_id ──┐ NULL => level-1 (category); non-NULL => level-2 (item) under that L1
              └── SAIndicator.parent_id (idx_parent); NO 3rd level allowed (service enforces)

sa_product 1─n sa_product_image   (cover = image with min sort_order; also denormalized on product.cover_url)
sa_plan    n─n sa_product         via sa_plan_product  (ordered; uk_plan_product)
sa_plan    n─n sa_indicator       via sa_plan_indicator (strict: exactly the ticked nodes; uk_plan_indicator)
```

Reference semantics: junctions store **references, not copies** (spec "引用而非拷贝") — editing an indicator/product name updates what plans display. Associations are written delete-then-insert on plan create/update (mirrors `role_service.update_role`).

## Table definitions

### sa_indicator — 指标（一级/二级）

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AI PK | |
| parent_id | BIGINT NULL | NULL=一级; 非NULL=二级(指向一级). Index `idx_parent`. Depth enforced ≤2 by service. |
| ind_code | VARCHAR(50) NOT NULL | 指标编码; **globally unique across both levels** (unique key `uk_ind_code`). |
| ind_name | VARCHAR(100) NOT NULL | 指标名称 (single-language Chinese, v1). |
| description | VARCHAR(500) NULL | 说明. |
| sort_order | INT NOT NULL DEFAULT 0 | sibling ordering. |
| status | TINYINT NOT NULL DEFAULT 1 | 1=启用 0=停用. |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME NULL | |

Service rules (spec FR-101…FR-106):
- create/update accept `parent_id: None` (L1) or an **existing level-1 id** (L2). Reject a parent that is itself a level-2 (no 3rd level) and reject a missing/nonexistent parent.
- `ind_code` required; DB unique + service pre-check → duplicate raises business error `indicator.code_exists` (→ 400/409).
- delete guards: reject L1 with children (`indicator.has_children`); reject any node referenced by `sa_plan_indicator` (`indicator.in_use`).
- tree/list order: L1 by `sort_order`, then `id`; L2 grouped by `parent_id`, ordered by `sort_order`, then `id`.

### sa_product — 商品

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AI PK | |
| product_name | VARCHAR(100) NOT NULL | 商品名称. |
| description | VARCHAR(500) NULL | 文字说明 (short). |
| detail_html | LONGTEXT NULL | 图文详情 HTML (wangEditor output). |
| cover_url | VARCHAR(500) NULL | 封面图 URL (denormalized = first image by sort_order), for list thumbnails. |
| status | TINYINT NOT NULL DEFAULT 1 | 1=启用 0=停用. |
| sort_order | INT NOT NULL DEFAULT 0 | |
| created_at / updated_at | DATETIME | |

Service rules (spec FR-201…FR-206):
- create requires ≥1 image; cover = lowest-`sort_order` image; set `cover_url` accordingly.
- rich text stored verbatim (HTML); length bounded to LONGTEXT.
- update replaces the image set via delete-then-insert on `sa_product_image` (flush before insert), recomputing `cover_url`.
- delete guard: reject when referenced by `sa_plan_product` (`product.in_use`).
- image upload constraints enforced at endpoint + OSS: only image MIME (`image/*`), per-file max size and per-product count (configured constants; default 10MB / 9 images + 1 cover → 10 total, tunable — spec edge cases).
- list search: `product_name`/`description` contains keyword; page/page_size paginated.

### sa_product_image — 商品图片

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AI PK | |
| product_id | BIGINT NOT NULL | → sa_product.id. Index `idx_product`. |
| image_url | VARCHAR(500) NOT NULL | OSS public URL. |
| sort_order | INT NOT NULL DEFAULT 0 | 0-based; image[0] = cover. |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

### sa_plan — 健康方案

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AI PK | |
| plan_name | VARCHAR(100) NOT NULL | 方案名称. |
| description | VARCHAR(500) NULL | 描述/目标. |
| status | TINYINT NOT NULL DEFAULT 1 | 1=启用 0=停用 (不影响已保存关联). |
| sort_order | INT NOT NULL DEFAULT 0 | |
| created_at / updated_at | DATETIME | |

Service rules (spec FR-301…FR-306):
- update replaces associations delete-then-insert (flush then insert to avoid duplicate-key, per `role_service.update_role`).
- status toggling is independent of association content.
- delete allowed with confirm; service deletes `sa_plan_product` + `sa_plan_indicator` rows for the plan first, then the plan row.

### sa_plan_product — 方案×商品 (junction)

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AI PK | |
| plan_id | BIGINT NOT NULL | → sa_plan.id |
| product_id | BIGINT NOT NULL | → sa_product.id |
| sort_order | INT NOT NULL DEFAULT 0 | display order of products within the plan (spec FR-302). |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

Unique: `uk_plan_product (plan_id, product_id)` — dedups FR-304.

### sa_plan_indicator — 方案×指标 (junction)

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AI PK | |
| plan_id | BIGINT NOT NULL | → sa_plan.id |
| indicator_id | BIGINT NOT NULL | → sa_indicator.id (may be a level-1 or level-2 node; granularity derived from `indicator.parent_id` NULL-ness). |
| created_at | DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP | |

Unique: `uk_plan_indicator (plan_id, indicator_id)` — strict-precise, dedup (FR-303/FR-304). Picking an L1 never auto-adds its children because only the ticked node id is stored.

## System tables touched (menu / role)

### sa_menu — 4 new rows (idempotent seed `seed_health_menus`)

| id | parent_id | name_zh | name_en | name_es | icon | route_path | sort_order |
|---|---|---|---|---|---|---|---|
| (next after existing seed ids, e.g. 10) | NULL | 健康管理 | Health Management | Gestión de Salud | `first-aid-kit`/`health` | /health | (after System, e.g. 10) |
| 11 | 10 | 指标管理 | Indicator Management | Gestión de Indicadores | `list`/`trend-charts` | /health/indicators | 1 |
| 12 | 10 | 商品管理 | Product Management | Gestión de Productos | `goods`/`shopping` | /health/products | 2 |
| 13 | 10 | 方案管理 | Plan Management | Gestión de Planes | `document`/`files` | /health/plans | 3 |

Seeding: `health_seed.seed_health_menus(db)` (INSERT…SELECT WHERE NOT EXISTS by `route_path`), invoked in `main.py` startup **before** `seed_admin_role`, which re-grants all current menus to `admin` on every startup. No change to `sa_role_menu` seed needed for admin; non-admin roles are granted via existing RBAC flows. Icon/name strings finalized in implementation (icon must be a known Element Plus icon name or empty).

## Validation & uniqueness summary (source: spec FR)

| Rule | Spec | Enforced by |
|---|---|---|
| ind_code required + globally unique (L1/L2) | FR-103 | DB `uk_ind_code` + service pre-check |
| L1 may contain many L2; no 3rd level | FR-102/edge | service |
| L1 with children undeletable | FR-106 | service |
| Node referenced by a plan undeletable | FR-106 | service (`sa_plan_indicator`) |
| Product referenced by a plan undeletable | FR-206 | service (`sa_plan_product`) |
| Product needs ≥1 image; cover = first | FR-204/SC-003 | service + endpoint |
| Plan association granularity strict (L1 ≠ its L2s) | FR-303 | storage model (node ids only) + ui picker |
| No duplicate plan-product / plan-indicator | FR-304 | `uk_plan_product`, `uk_plan_indicator` |
| Plan status independent of associations | FR-306 | service (junction untouched on status toggle) |
| Single-language (Chinese) content v1 | FR-003 | data + schema (no lang columns) |

## State transitions

- indicator/product/plan: `status` flips 1↔0 freely. Stopping an item does not remove its plan references; plan detail marks referenced-but-stopped items as 已停用 (spec Edge Cases).
- deletion is guarded (see rules) and permanent after guard passes; plan deletion cascades own junctions only.
- concurrency: last-write-wins on entity updates; unique keys surface duplicate races as errors.

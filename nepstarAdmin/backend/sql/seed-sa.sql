USE `nepstar`;

-- Seed data for Smart Admin
-- Super admin account: admin / Admin@123 (bcrypt hash)

INSERT INTO sa_user (username, password, real_name, lang_pref, must_change_pwd, login_fail_count, status, created_by, created_at)
VALUES ('admin', '$2b$12$krmJCU720G9CU8YDyVB83OC8HXm04F4PJVBSecIaf8gkHASFwZaJK', 'Super Admin', 'zh-CN', 1, 0, 1, 0, NOW());

-- Default menus
INSERT INTO sa_menu (id, parent_id, name_zh, name_en, name_es, icon, route_path, sort_order, status, created_at) VALUES
(1, NULL, '数据看板', 'Dashboard', 'Panel', 'dashboard', '/dashboard', 1, 1, NOW()),
(2, NULL, '设备管理', 'Device Management', 'Gestión de Dispositivos', 'monitor', '/device', 2, 1, NOW()),
(3, 2, '设备列表', 'Device List', 'Lista de Dispositivos', 'list', '/device/list', 1, 1, NOW()),
(4, NULL, '数据管理', 'Data Management', 'Gestión de Datos', 'document', '/report', 3, 1, NOW()),
(5, 4, '检测报告', 'Inspection Reports', 'Informes de Inspección', 'report', '/report/list', 1, 1, NOW()),
(11, 4, '客户管理', 'Customer Management', 'Gestión de Clientes', 'user', '/customer/list', 2, 1, NOW()),
(6, NULL, '系统管理', 'System Management', 'Administración del Sistema', 'setting', '/system', 9, 1, NOW()),
(7, 6, '用户管理', 'User Management', 'Gestión de Usuarios', 'user', '/system/users', 1, 1, NOW()),
(8, 6, '角色管理', 'Role Management', 'Gestión de Roles', 'role', '/system/roles', 2, 1, NOW()),
(9, 6, '菜单管理', 'Menu Management', 'Gestión de Menús', 'menu', '/system/menus', 3, 1, NOW()),
(10, 6, '组织管理', 'Organization Management', 'Gestión de Organizaciones', 'organization', '/system/organizations', 4, 1, NOW());

-- 健康管理模块菜单（顶级 + 三个子页；按 /health 幂等防重）
INSERT INTO sa_menu (id, parent_id, name_zh, name_en, name_es, icon, route_path, sort_order, status, created_at)
SELECT t.id, t.parent_id, t.name_zh, t.name_en, t.name_es, t.icon, t.route_path, t.sort_order, 1, NOW()
FROM (
    SELECT 12 AS id, NULL AS parent_id, '健康管理' AS name_zh, 'Health Management' AS name_en, 'Gestión de Salud' AS name_es, 'data-analysis' AS icon, '/health' AS route_path, 5 AS sort_order
    UNION ALL SELECT 13, 12, '指标管理', 'Indicator Management', 'Gestión de Indicadores', 'list', '/health/indicators', 1
    UNION ALL SELECT 14, 12, '商品管理', 'Product Management', 'Gestión de Productos', 'goods', '/health/products', 2
    UNION ALL SELECT 15, 12, '方案管理', 'Plan Management', 'Gestión de Planes', 'document', '/health/plans', 3
) t
WHERE NOT EXISTS (SELECT 1 FROM sa_menu WHERE route_path = '/health');

-- Default admin role (idempotent) — data_scope=all for full org access
INSERT INTO sa_role (role_name, role_code, data_scope, status, created_at)
SELECT 'SystemAdmin', 'admin', 'all', 1, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_role WHERE role_code = 'admin');

-- Grant all menu permissions to admin role
INSERT INTO sa_role_menu (role_id, menu_id, actions)
SELECT r.id, m.id, 'view,add,edit,delete,export,import'
FROM sa_role r
CROSS JOIN sa_menu m
WHERE r.role_code = 'admin'
  AND NOT EXISTS (SELECT 1 FROM sa_role_menu rm WHERE rm.role_id = r.id AND rm.menu_id = m.id);

-- Grant all organizations to admin role
INSERT INTO sa_role_org (role_id, org_id)
SELECT r.id, o.id
FROM sa_role r
CROSS JOIN sa_organization o
WHERE r.role_code = 'admin'
  AND NOT EXISTS (SELECT 1 FROM sa_role_org ro WHERE ro.role_id = r.id AND ro.org_id = o.id);

-- Assign admin user to admin role
INSERT INTO sa_user_role (user_id, role_id)
SELECT u.id, r.id
FROM sa_user u
CROSS JOIN sa_role r
WHERE u.username = 'admin' AND r.role_code = 'admin'
  AND NOT EXISTS (SELECT 1 FROM sa_user_role ur WHERE ur.user_id = u.id AND ur.role_id = r.id);

-- Default root organization (idempotent)
INSERT INTO sa_organization (org_name, org_code, parent_id, sort_order, created_at)
SELECT 'NEPSTAR', 'NEPSTAR', NULL, 0, NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM sa_organization WHERE org_code = 'NEPSTAR');

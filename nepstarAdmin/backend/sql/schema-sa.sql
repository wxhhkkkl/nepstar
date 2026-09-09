-- =============================================
-- Smart Admin 新表创建脚本 (sa_* 前缀)
-- 数据库: platform (MySQL 5.6+)
-- =============================================

-- 1. 系统用户表
CREATE TABLE IF NOT EXISTS sa_user (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE COMMENT '登录账号',
    password        VARCHAR(255) NOT NULL COMMENT 'BCrypt加密密码',
    real_name       VARCHAR(50)  NOT NULL COMMENT '姓名',
    lang_pref       VARCHAR(10)  DEFAULT 'zh-CN' COMMENT '偏好语言 zh-CN/en/es',
    must_change_pwd TINYINT      DEFAULT 1 COMMENT '首次登录是否强制改密',
    login_fail_count INT         DEFAULT 0 COMMENT '连续登录失败次数',
    locked_until    DATETIME     NULL COMMENT '锁定截止时间',
    status          TINYINT      DEFAULT 1 COMMENT '1=启用,0=禁用',
    created_by      BIGINT       NOT NULL DEFAULT 0 COMMENT '创建人ID',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户';

-- 2. 角色表
CREATE TABLE IF NOT EXISTS sa_role (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_name   VARCHAR(50) NOT NULL COMMENT '角色名称',
    role_code   VARCHAR(50) NOT NULL UNIQUE COMMENT '角色编码',
    data_scope  VARCHAR(20) DEFAULT 'self' COMMENT '数据权限范围: all=全部组织/self=本组织/self_and_children=本组织及下级',
    status      TINYINT     DEFAULT 1 COMMENT '1=启用,0=禁用',
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色';

-- 3. 菜单表 (三语名称)
CREATE TABLE IF NOT EXISTS sa_menu (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id   BIGINT       NULL COMMENT '父菜单ID',
    name_zh     VARCHAR(50)  NOT NULL COMMENT '中文名称',
    name_en     VARCHAR(50)  NOT NULL COMMENT '英文名称',
    name_es     VARCHAR(50)  NOT NULL COMMENT '西语名称',
    icon        VARCHAR(50)  NULL COMMENT '图标',
    route_path  VARCHAR(200) NULL COMMENT '前端路由',
    sort_order  INT          DEFAULT 0 COMMENT '排序',
    status      TINYINT      DEFAULT 1 COMMENT '1=启用,0=禁用',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NULL,
    INDEX idx_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统菜单(三语)';

-- 4. 角色-菜单权限关联表
CREATE TABLE IF NOT EXISTS sa_role_menu (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id     BIGINT       NOT NULL COMMENT '角色ID',
    menu_id     BIGINT       NOT NULL COMMENT '菜单ID',
    actions     VARCHAR(100) NOT NULL COMMENT '操作权限: view,add,edit,delete,export,import',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_menu (role_id, menu_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单权限';

-- 4b. 角色-组织数据权限关联表
CREATE TABLE IF NOT EXISTS sa_role_org (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id     BIGINT   NOT NULL COMMENT '角色ID',
    org_id      BIGINT   NOT NULL COMMENT '组织ID',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_role_org (role_id, org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色组织数据权限';

-- 5. 用户-角色关联表
CREATE TABLE IF NOT EXISTS sa_user_role (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT    NOT NULL COMMENT '用户ID',
    role_id     BIGINT    NOT NULL COMMENT '角色ID',
    created_at  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_role (user_id, role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联';

-- 6. 组织架构表
CREATE TABLE IF NOT EXISTS sa_organization (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    org_name    VARCHAR(100) NOT NULL COMMENT '组织名称',
    org_code    VARCHAR(50)  NOT NULL UNIQUE COMMENT '组织编码',
    parent_id   BIGINT       NULL COMMENT '上级组织ID',
    sort_order  INT          DEFAULT 0 COMMENT '排序',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组织架构';

-- 7. 用户-组织关联表
CREATE TABLE IF NOT EXISTS sa_user_org (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT   NOT NULL COMMENT '用户ID',
    org_id      BIGINT   NOT NULL COMMENT '组织ID',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_org (user_id, org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户组织关联';

-- 8. 设备配置表（报告语言等）
CREATE TABLE IF NOT EXISTS sa_device_config (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id       VARCHAR(50) NOT NULL UNIQUE COMMENT '设备ID (ne.ne_id)',
    report_language VARCHAR(10) DEFAULT 'zh-CN' COMMENT '报告语言: zh-CN/en/es',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备配置';

-- 9. 设备-组织关联表（人工维护）
CREATE TABLE IF NOT EXISTS sa_device_org (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id   VARCHAR(50) NOT NULL COMMENT '设备ID (ne.ne_id)',
    org_id      BIGINT NOT NULL COMMENT '组织ID (sa_organization.id)',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NULL,
    UNIQUE KEY uk_device_org (device_id, org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备-组织关联';

-- 10. 设备归属变更日志表
CREATE TABLE IF NOT EXISTS sa_device_change_log (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id   VARCHAR(50)  NOT NULL COMMENT '设备ID (ne.ne_id)',
    from_org    VARCHAR(100) NULL COMMENT '原组织',
    to_org      VARCHAR(100) NOT NULL COMMENT '新组织',
    changed_by  BIGINT       NOT NULL COMMENT '操作人',
    changed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备组织变更日志';

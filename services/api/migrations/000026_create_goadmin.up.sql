BEGIN;

CREATE TABLE goadmin_menu (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER NOT NULL DEFAULT 0,
    type INTEGER DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    title VARCHAR(50) NOT NULL,
    header VARCHAR(100),
    plugin_name VARCHAR(100) NOT NULL DEFAULT '',
    icon VARCHAR(50) NOT NULL,
    uri TEXT NOT NULL,
    uuid VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_operation_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip VARCHAR(45) NOT NULL,
    input TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    http_method VARCHAR(255),
    http_path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_site (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    type INTEGER DEFAULT 0,
    description VARCHAR(3000),
    state INTEGER DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    slug VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_session (
    id SERIAL PRIMARY KEY,
    sid VARCHAR(50) NOT NULL,
    "values" VARCHAR(3000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    avatar VARCHAR(255),
    remember_token VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_role_menu (
    role_id INTEGER NOT NULL,
    menu_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_role_users (
    role_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE goadmin_user_permissions (
    user_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO goadmin_menu (id, parent_id, type, "order", title, icon, uri) VALUES
    (1, 0, 1, 2, 'Admin', 'fa-tasks', ''),
    (2, 1, 1, 2, 'Users', 'fa-users', '/info/manager'),
    (3, 1, 1, 3, 'Roles', 'fa-user', '/info/roles'),
    (4, 1, 1, 4, 'Permission', 'fa-ban', '/info/permission'),
    (5, 1, 1, 5, 'Menu', 'fa-bars', '/menu'),
    (6, 1, 1, 6, 'Operation log', 'fa-history', '/info/op'),
    (7, 0, 1, 1, 'Dashboard', 'fa-bar-chart', '/');

INSERT INTO goadmin_permissions (id, name, slug, http_method, http_path) VALUES
    (1, 'All permission', '*', '', '*'),
    (2, 'Dashboard', 'dashboard', 'GET,PUT,POST,DELETE', '/');

INSERT INTO goadmin_roles (id, name, slug) VALUES
    (1, 'Administrator', 'administrator'),
    (2, 'Operator', 'operator');

INSERT INTO goadmin_role_menu (role_id, menu_id)
SELECT 1, id FROM goadmin_menu;

INSERT INTO goadmin_role_menu (role_id, menu_id) VALUES (2, 7);
INSERT INTO goadmin_role_permissions (role_id, permission_id) VALUES (1, 1), (1, 2), (2, 2);

SELECT setval(pg_get_serial_sequence('goadmin_menu', 'id'), 7, TRUE);
SELECT setval(pg_get_serial_sequence('goadmin_permissions', 'id'), 2, TRUE);
SELECT setval(pg_get_serial_sequence('goadmin_roles', 'id'), 2, TRUE);

COMMIT;

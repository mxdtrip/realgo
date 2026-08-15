BEGIN;

WITH application_menu AS (
    INSERT INTO goadmin_menu (parent_id, type, "order", title, icon, uri, uuid, plugin_name)
    VALUES (0, 1, 8, 'Application', 'fa-database', '', 'realgo-application', '')
    RETURNING id
)
INSERT INTO goadmin_menu (parent_id, type, "order", title, icon, uri, uuid, plugin_name)
SELECT id, 1, 1, 'Users', 'fa-users', '/info/users', 'realgo-users', ''
FROM application_menu;

INSERT INTO goadmin_role_menu (role_id, menu_id)
SELECT 1, id
FROM goadmin_menu
WHERE uuid IN ('realgo-application', 'realgo-users');

COMMIT;

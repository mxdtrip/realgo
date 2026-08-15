BEGIN;

INSERT INTO goadmin_menu (parent_id, type, "order", title, icon, uri, uuid, plugin_name)
SELECT id, 1, 2, 'Problems', 'fa-code', '/info/problems', 'realgo-problems', ''
FROM goadmin_menu
WHERE uuid = 'realgo-application';

INSERT INTO goadmin_role_menu (role_id, menu_id)
SELECT 1, id
FROM goadmin_menu
WHERE uuid = 'realgo-problems';

COMMIT;

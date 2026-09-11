BEGIN;

INSERT INTO goadmin_menu (parent_id, type, "order", title, icon, uri, uuid, plugin_name)
SELECT id, 1, 3, 'Problem reports', 'fa-bug', '/info/problem_reports', 'realgo-problem-reports', ''
FROM goadmin_menu
WHERE uuid = 'realgo-application'
  AND NOT EXISTS (
      SELECT 1 FROM goadmin_menu WHERE uuid = 'realgo-problem-reports'
  );

INSERT INTO goadmin_role_menu (role_id, menu_id)
SELECT 1, id
FROM goadmin_menu
WHERE uuid = 'realgo-problem-reports'
  AND NOT EXISTS (
      SELECT 1
      FROM goadmin_role_menu
      WHERE role_id = 1
        AND menu_id = goadmin_menu.id
  );

COMMIT;

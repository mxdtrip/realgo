BEGIN;

UPDATE goadmin_menu
SET parent_id = (SELECT id FROM goadmin_menu WHERE uuid = 'realgo-application')
WHERE uuid IN ('realgo-users', 'realgo-problems');

DELETE FROM goadmin_role_menu
WHERE menu_id IN (
    SELECT id FROM goadmin_menu
    WHERE uuid LIKE 'realgo-%'
      AND uuid NOT IN ('realgo-application', 'realgo-users', 'realgo-problems')
);

DELETE FROM goadmin_menu
WHERE uuid LIKE 'realgo-%'
  AND uuid NOT IN ('realgo-application', 'realgo-users', 'realgo-problems');

COMMIT;

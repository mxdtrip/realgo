BEGIN;

DELETE FROM goadmin_role_menu
WHERE menu_id IN (
    SELECT id FROM goadmin_menu
    WHERE uuid = 'realgo-problems'
);

DELETE FROM goadmin_menu
WHERE uuid = 'realgo-problems';

COMMIT;

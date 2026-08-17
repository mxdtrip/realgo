BEGIN;

DROP INDEX IF EXISTS goadmin_role_menu_role_id_menu_id_unique;
DROP INDEX IF EXISTS goadmin_menu_uuid_unique;

COMMIT;

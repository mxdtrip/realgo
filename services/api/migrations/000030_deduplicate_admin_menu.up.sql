BEGIN;

WITH menu_map AS (
    SELECT id, MIN(id) OVER (PARTITION BY uuid) AS keeper_id
    FROM goadmin_menu
    WHERE uuid IS NOT NULL
)
INSERT INTO goadmin_role_menu (role_id, menu_id)
SELECT DISTINCT role_menu.role_id, menu_map.keeper_id
FROM goadmin_role_menu AS role_menu
JOIN menu_map ON menu_map.id = role_menu.menu_id
WHERE menu_map.id <> menu_map.keeper_id
  AND NOT EXISTS (
      SELECT 1
      FROM goadmin_role_menu AS existing
      WHERE existing.role_id = role_menu.role_id
        AND existing.menu_id = menu_map.keeper_id
  );

WITH duplicate_menu AS (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY uuid ORDER BY id) AS position
        FROM goadmin_menu
        WHERE uuid IS NOT NULL
    ) AS ranked
    WHERE position > 1
)
DELETE FROM goadmin_role_menu
WHERE menu_id IN (SELECT id FROM duplicate_menu);

WITH duplicate_menu AS (
    SELECT id
    FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY uuid ORDER BY id) AS position
        FROM goadmin_menu
        WHERE uuid IS NOT NULL
    ) AS ranked
    WHERE position > 1
)
DELETE FROM goadmin_menu
WHERE id IN (SELECT id FROM duplicate_menu);

DELETE FROM goadmin_role_menu AS duplicate
USING goadmin_role_menu AS keeper
WHERE duplicate.role_id = keeper.role_id
  AND duplicate.menu_id = keeper.menu_id
  AND duplicate.ctid > keeper.ctid;

CREATE UNIQUE INDEX goadmin_menu_uuid_unique
    ON goadmin_menu (uuid)
    WHERE uuid IS NOT NULL;

CREATE UNIQUE INDEX goadmin_role_menu_role_id_menu_id_unique
    ON goadmin_role_menu (role_id, menu_id);

COMMIT;

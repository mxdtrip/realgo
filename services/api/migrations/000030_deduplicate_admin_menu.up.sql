BEGIN;

-- Compatibility migration for staging databases that already contain the
-- admin menu migrations. The landing branch does not mount the admin UI, but
-- keeping the schema history complete lets migrate validate a restored
-- staging snapshot without attempting to roll it back.
WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY parent_id, title, uri, COALESCE(uuid, '')
               ORDER BY id
           ) AS rn
    FROM goadmin_menu
)
DELETE FROM goadmin_role_menu
WHERE menu_id IN (SELECT id FROM duplicates WHERE rn > 1);

WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY parent_id, title, uri, COALESCE(uuid, '')
               ORDER BY id
           ) AS rn
    FROM goadmin_menu
)
DELETE FROM goadmin_menu
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

COMMIT;

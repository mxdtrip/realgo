BEGIN;

DELETE FROM user_roadmap_configs WHERE NOT is_active;

DROP INDEX user_roadmap_configs_one_active_idx;
DROP INDEX user_roadmap_plan_items_week_idx;

ALTER TABLE user_roadmap_plan_items
    DROP CONSTRAINT user_roadmap_plan_items_config_fkey,
    DROP CONSTRAINT user_roadmap_plan_items_pkey,
    DROP CONSTRAINT user_roadmap_plan_items_user_id_plan_key_position_key;

ALTER TABLE user_roadmap_configs DROP CONSTRAINT user_roadmap_configs_pkey;
ALTER TABLE user_roadmap_configs ADD PRIMARY KEY (user_id);

ALTER TABLE user_roadmap_plan_items
    ADD CONSTRAINT user_roadmap_plan_items_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES user_roadmap_configs(user_id) ON DELETE CASCADE,
    ADD PRIMARY KEY (user_id, subpattern_id),
    ADD UNIQUE (user_id, position),
    DROP COLUMN plan_key;

CREATE INDEX user_roadmap_plan_items_week_idx
    ON user_roadmap_plan_items (user_id, week_index, position);

ALTER TABLE user_roadmap_configs
    DROP COLUMN plan_key,
    DROP COLUMN company_name,
    DROP COLUMN interview_date,
    DROP COLUMN is_active;

COMMIT;

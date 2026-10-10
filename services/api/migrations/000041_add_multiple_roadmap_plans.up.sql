BEGIN;

ALTER TABLE user_roadmap_configs
    ADD COLUMN plan_key TEXT,
    ADD COLUMN company_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN interview_date TIMESTAMPTZ,
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE user_roadmap_configs config
SET plan_key = COALESCE(NULLIF(config.company_code, ''), 'core'),
    company_name = COALESCE(users.target_company, ''),
    interview_date = users.interview_date
FROM users
WHERE users.id = config.user_id;

ALTER TABLE user_roadmap_configs
    ALTER COLUMN plan_key SET NOT NULL;

ALTER TABLE user_roadmap_plan_items ADD COLUMN plan_key TEXT;

UPDATE user_roadmap_plan_items item
SET plan_key = config.plan_key
FROM user_roadmap_configs config
WHERE config.user_id = item.user_id;

ALTER TABLE user_roadmap_plan_items
    ALTER COLUMN plan_key SET NOT NULL,
    DROP CONSTRAINT user_roadmap_plan_items_user_id_fkey,
    DROP CONSTRAINT user_roadmap_plan_items_pkey,
    DROP CONSTRAINT user_roadmap_plan_items_user_id_position_key;

ALTER TABLE user_roadmap_configs DROP CONSTRAINT user_roadmap_configs_pkey;
ALTER TABLE user_roadmap_configs
    ADD PRIMARY KEY (user_id, plan_key);

CREATE UNIQUE INDEX user_roadmap_configs_one_active_idx
    ON user_roadmap_configs (user_id)
    WHERE is_active;

ALTER TABLE user_roadmap_plan_items
    ADD CONSTRAINT user_roadmap_plan_items_config_fkey
        FOREIGN KEY (user_id, plan_key)
        REFERENCES user_roadmap_configs(user_id, plan_key)
        ON DELETE CASCADE,
    ADD PRIMARY KEY (user_id, plan_key, subpattern_id),
    ADD UNIQUE (user_id, plan_key, position);

DROP INDEX user_roadmap_plan_items_week_idx;
CREATE INDEX user_roadmap_plan_items_week_idx
    ON user_roadmap_plan_items (user_id, plan_key, week_index, position);

COMMIT;

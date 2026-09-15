BEGIN;

CREATE TABLE user_roadmap_task_access_overrides (
    user_id BIGINT NOT NULL,
    plan_key TEXT NOT NULL,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE RESTRICT,
    replacement_problem_id BIGINT REFERENCES problems(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('skipped', 'replaced')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, plan_key, problem_id),
    CONSTRAINT user_roadmap_task_access_overrides_plan_fkey
        FOREIGN KEY (user_id, plan_key)
        REFERENCES user_roadmap_configs(user_id, plan_key)
        ON DELETE CASCADE,
    CONSTRAINT user_roadmap_task_access_overrides_state_check CHECK (
        (status = 'skipped' AND replacement_problem_id IS NULL)
        OR (status = 'replaced' AND replacement_problem_id IS NOT NULL)
    )
);

CREATE INDEX user_roadmap_task_access_overrides_replacement_idx
    ON user_roadmap_task_access_overrides (user_id, plan_key, replacement_problem_id)
    WHERE replacement_problem_id IS NOT NULL;

COMMIT;

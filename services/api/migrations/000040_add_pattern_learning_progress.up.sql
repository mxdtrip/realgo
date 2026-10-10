BEGIN;

CREATE TABLE user_pattern_learning_progress (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subpattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    theory_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, subpattern_id)
);

COMMENT ON TABLE user_pattern_learning_progress IS
    'Durable first-pass learning progress for subpatterns; spaced repetitions remain in review_schedules.';

COMMIT;

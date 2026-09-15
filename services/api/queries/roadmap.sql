-- name: GetRoadmapUserTarget :one
SELECT target_company, interview_date, target_topics
FROM users
WHERE id = $1;

-- name: ListUserRoadmapItems :many
SELECT
    ri.position,
    pt.code AS pattern_code,
    pt.name AS pattern_name,
    p.id AS problem_id,
    p.external_id,
    p.external_slug,
    p.title,
    p.url,
    p.difficulty,
    COALESCE(upp.status, 'not_started')::text AS status,
    upp.rating,
    upp.confidence
FROM roadmap_items ri
JOIN patterns pt ON pt.id = ri.pattern_id
JOIN problems p ON p.id = ri.problem_id
LEFT JOIN user_problem_progress upp
    ON upp.problem_id = p.id AND upp.user_id = $2
WHERE ri.roadmap_code = $1
ORDER BY ri.position ASC;

-- name: ClearRoadmapTarget :exec
UPDATE users
SET target_company = NULL, interview_date = NULL, target_topics = '{}', updated_at = NOW()
WHERE id = $1;

-- name: GetUserRoadmapConfig :one
SELECT user_id, company_code, priority_mode, horizon_weeks, weekly_capacity,
       algorithm_version, source, generated_at
FROM user_roadmap_configs
WHERE user_id = $1;

-- name: ListUserRoadmapPlanItems :many
SELECT p.code, p.name, p.position AS taxonomy_position,
       i.week_index, i.position, i.selected
FROM user_roadmap_plan_items i
JOIN patterns p ON p.id = i.subpattern_id
WHERE i.user_id = $1
ORDER BY i.position;

-- name: UpsertUserRoadmapConfig :exec
INSERT INTO user_roadmap_configs (
    user_id, company_code, priority_mode, horizon_weeks, weekly_capacity,
    algorithm_version, source, generated_at, updated_at
) VALUES (
    sqlc.arg(user_id), sqlc.narg(company_code), sqlc.arg(priority_mode),
    sqlc.arg(horizon_weeks), sqlc.arg(weekly_capacity),
    sqlc.arg(algorithm_version), sqlc.arg(source), NOW(), NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
    company_code = EXCLUDED.company_code,
    priority_mode = EXCLUDED.priority_mode,
    horizon_weeks = EXCLUDED.horizon_weeks,
    weekly_capacity = EXCLUDED.weekly_capacity,
    algorithm_version = EXCLUDED.algorithm_version,
    source = EXCLUDED.source,
    generated_at = CASE
        WHEN sqlc.arg(preserve_progress)::boolean THEN user_roadmap_configs.generated_at
        ELSE NOW()
    END,
    updated_at = NOW();

-- Stable, deliberately small task set for every subpattern included in a
-- personal plan. The rank does not depend on user progress, so solving a task
-- never replaces it with another one and turns the plan into an endless list.
-- name: ListRoadmapPlanProblems :many
WITH ranked AS (
    SELECT
        sp.code AS subpattern_code,
        pr.id,
        pr.title,
        pr.url,
        COALESCE(pr.difficulty, '')::text AS difficulty,
        COALESCE(ps.tier, '')::text AS tier,
        COALESCE(upp.status, 'not_started')::text AS status,
        ROW_NUMBER() OVER (
            PARTITION BY sp.code
            ORDER BY
                CASE ps.tier
                    WHEN 'foundational' THEN 0
                    WHEN 'core' THEN 1
                    WHEN 'advanced' THEN 2
                    ELSE 3
                END,
                CASE LOWER(COALESCE(pr.difficulty, ''))
                    WHEN 'easy' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'hard' THEN 2
                    ELSE 3
                END,
                COALESCE(cp.evidence_count, 0) DESC,
                ps.position NULLS LAST,
                pr.id
        ) AS task_rank
    FROM patterns sp
    JOIN problem_subpatterns ps ON ps.subpattern_id = sp.id
    JOIN problems pr ON pr.id = ps.problem_id
    LEFT JOIN user_problem_progress upp
        ON upp.problem_id = pr.id AND upp.user_id = sqlc.arg(user_id)::bigint
    LEFT JOIN companies co ON co.code = NULLIF(sqlc.arg(company_code)::text, '')
    LEFT JOIN company_problems cp
        ON cp.problem_id = pr.id AND cp.company_id = co.id
    WHERE sp.code = ANY(sqlc.arg(subpattern_codes)::text[])
      AND (sqlc.arg(company_code)::text = '' OR cp.problem_id IS NOT NULL)
)
SELECT subpattern_code, id, title, url, difficulty, tier, status
FROM ranked
WHERE task_rank <= 3
ORDER BY subpattern_code, task_rank;

-- name: ListRoadmapPlanCardProgress :many
SELECT
    sp.code AS subpattern_code,
    COUNT(c.id)::integer AS total_cards,
    COUNT(c.id) FILTER (WHERE rs.last_rating IS NOT NULL)::integer AS reviewed_cards,
    COUNT(c.id) FILTER (WHERE rs.next_review_at <= NOW())::integer AS due_cards
FROM patterns sp
LEFT JOIN cards c
    ON c.pattern_id = sp.id
   AND (c.user_id IS NULL OR c.user_id = sqlc.arg(user_id)::bigint)
LEFT JOIN review_schedules rs
    ON rs.card_id = c.id AND rs.user_id = sqlc.arg(user_id)::bigint
WHERE sp.code = ANY(sqlc.arg(subpattern_codes)::text[])
GROUP BY sp.code
ORDER BY sp.code;

-- name: DeleteUserRoadmapPlanItems :exec
DELETE FROM user_roadmap_plan_items WHERE user_id = $1;

-- name: InsertUserRoadmapPlanItem :exec
INSERT INTO user_roadmap_plan_items (
    user_id, subpattern_id, week_index, position, selected
)
SELECT sqlc.arg(user_id), p.id, sqlc.arg(week_index), sqlc.arg(position), sqlc.arg(selected)
FROM patterns p
WHERE p.code = sqlc.arg(subpattern_code) AND p.kind = 'subpattern';

-- name: DeleteUserRoadmapConfig :exec
DELETE FROM user_roadmap_configs WHERE user_id = $1;

-- name: SetRoadmapTarget :exec
UPDATE users
SET target_company = NULLIF(sqlc.arg(target_company)::text, ''),
    interview_date = sqlc.narg(interview_date)::timestamptz,
    target_topics = sqlc.arg(target_topics)::text[],
    updated_at = NOW()
WHERE id = sqlc.arg(user_id);

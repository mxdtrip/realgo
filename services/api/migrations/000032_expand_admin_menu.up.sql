BEGIN;

WITH groups(uuid, title, icon, "order") AS (
    VALUES
        ('realgo-catalog', 'Catalog', 'fa-database', 1),
        ('realgo-atlas', 'Pattern Atlas', 'fa-sitemap', 2),
        ('realgo-learning', 'Learning', 'fa-graduation-cap', 3),
        ('realgo-activity', 'User Activity', 'fa-users', 4),
        ('realgo-operations', 'Operations', 'fa-cogs', 5)
), application AS (
    SELECT id FROM goadmin_menu WHERE uuid = 'realgo-application'
)
INSERT INTO goadmin_menu (parent_id, type, "order", title, icon, uri, uuid, plugin_name)
SELECT application.id, 1, groups."order", groups.title, groups.icon, '', groups.uuid, ''
FROM groups CROSS JOIN application
ON CONFLICT (uuid) WHERE uuid IS NOT NULL DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    "order" = EXCLUDED."order",
    title = EXCLUDED.title,
    icon = EXCLUDED.icon,
    uri = EXCLUDED.uri;

WITH entries(parent_uuid, uuid, title, icon, uri, "order") AS (
    VALUES
        ('realgo-catalog', 'realgo-platforms', 'Platforms', 'fa-globe', '/info/platforms', 1),
        ('realgo-catalog', 'realgo-problems', 'Problems', 'fa-code', '/info/problems', 2),
        ('realgo-catalog', 'realgo-cards', 'Cards', 'fa-clone', '/info/cards', 3),

        ('realgo-atlas', 'realgo-taxonomy-versions', 'Taxonomy versions', 'fa-code-fork', '/info/taxonomy_versions', 1),
        ('realgo-atlas', 'realgo-patterns', 'Patterns', 'fa-sitemap', '/info/patterns', 2),
        ('realgo-atlas', 'realgo-pattern-learning-materials', 'Learning materials', 'fa-book', '/info/pattern_learning_materials', 3),
        ('realgo-atlas', 'realgo-companies', 'Companies', 'fa-building', '/info/companies', 4),
        ('realgo-atlas', 'realgo-pattern-family-subpatterns', 'Family links', 'fa-link', '/info/pattern_family_subpatterns', 5),
        ('realgo-atlas', 'realgo-subpattern-prerequisites', 'Prerequisites', 'fa-link', '/info/subpattern_prerequisites', 6),
        ('realgo-atlas', 'realgo-problem-subpatterns', 'Problem patterns', 'fa-link', '/info/problem_subpatterns', 7),
        ('realgo-atlas', 'realgo-subpattern-companies', 'Company relevance', 'fa-link', '/info/subpattern_companies', 8),
        ('realgo-atlas', 'realgo-company-problems', 'Company problems', 'fa-link', '/info/company_problems', 9),

        ('realgo-learning', 'realgo-roadmap-items', 'Roadmap items', 'fa-road', '/info/roadmap_items', 1),
        ('realgo-learning', 'realgo-quiz-questions', 'Quiz questions', 'fa-question-circle', '/info/quiz_questions', 2),

        ('realgo-activity', 'realgo-users', 'Users', 'fa-users', '/info/users', 1),
        ('realgo-activity', 'realgo-user-problem-progress', 'Problem progress', 'fa-tasks', '/info/user_problem_progress', 2),
        ('realgo-activity', 'realgo-review-schedules', 'Review schedules', 'fa-calendar', '/info/review_schedules', 3),
        ('realgo-activity', 'realgo-review-attempts', 'Review attempts', 'fa-history', '/info/review_attempts', 4),
        ('realgo-activity', 'realgo-quiz-answers', 'Quiz answers', 'fa-check-square-o', '/info/quiz_answers', 5),
        ('realgo-activity', 'realgo-user-practice-patterns', 'Practice patterns', 'fa-list', '/info/user_practice_patterns', 6),
        ('realgo-activity', 'realgo-user-roadmap-configs', 'Roadmap configs', 'fa-sliders', '/info/user_roadmap_configs', 7),
        ('realgo-activity', 'realgo-user-roadmap-plan-items', 'Roadmap plans', 'fa-list-ol', '/info/user_roadmap_plan_items', 8),

        ('realgo-operations', 'realgo-extension-events', 'Extension events', 'fa-plug', '/info/extension_events', 1),
        ('realgo-operations', 'realgo-ai-request-logs', 'AI requests', 'fa-magic', '/info/ai_request_logs', 2),
        ('realgo-operations', 'realgo-problem-reports', 'Problem reports', 'fa-bug', '/info/problem_reports', 3)
)
INSERT INTO goadmin_menu (parent_id, type, "order", title, icon, uri, uuid, plugin_name)
SELECT parent.id, 1, entries."order", entries.title, entries.icon, entries.uri, entries.uuid, ''
FROM entries
JOIN goadmin_menu parent ON parent.uuid = entries.parent_uuid
ON CONFLICT (uuid) WHERE uuid IS NOT NULL DO UPDATE SET
    parent_id = EXCLUDED.parent_id,
    "order" = EXCLUDED."order",
    title = EXCLUDED.title,
    icon = EXCLUDED.icon,
    uri = EXCLUDED.uri;

INSERT INTO goadmin_role_menu (role_id, menu_id)
SELECT 1, id
FROM goadmin_menu
WHERE uuid LIKE 'realgo-%'
ON CONFLICT (role_id, menu_id) DO NOTHING;

COMMIT;

BEGIN;

ALTER TABLE problems DROP CONSTRAINT problems_platform_id_fkey;
ALTER TABLE problems ADD CONSTRAINT problems_platform_id_fkey
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE;

ALTER TABLE patterns DROP CONSTRAINT patterns_parent_id_fkey;
ALTER TABLE patterns ADD CONSTRAINT patterns_parent_id_fkey
    FOREIGN KEY (parent_id) REFERENCES patterns(id) ON DELETE SET NULL;
ALTER TABLE patterns DROP CONSTRAINT patterns_taxonomy_version_fkey;
ALTER TABLE patterns ADD CONSTRAINT patterns_taxonomy_version_fkey
    FOREIGN KEY (taxonomy_version) REFERENCES taxonomy_versions(code) ON DELETE SET NULL;

ALTER TABLE cards DROP CONSTRAINT cards_problem_id_fkey;
ALTER TABLE cards ADD CONSTRAINT cards_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;
ALTER TABLE cards DROP CONSTRAINT cards_pattern_id_fkey;
ALTER TABLE cards ADD CONSTRAINT cards_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE roadmap_items DROP CONSTRAINT roadmap_items_problem_id_fkey;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;
ALTER TABLE roadmap_items DROP CONSTRAINT roadmap_items_pattern_id_fkey;
ALTER TABLE roadmap_items ADD CONSTRAINT roadmap_items_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE user_problem_progress DROP CONSTRAINT user_problem_progress_problem_id_fkey;
ALTER TABLE user_problem_progress ADD CONSTRAINT user_problem_progress_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;

ALTER TABLE review_schedules DROP CONSTRAINT review_schedules_problem_id_fkey;
ALTER TABLE review_schedules ADD CONSTRAINT review_schedules_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;
ALTER TABLE review_schedules DROP CONSTRAINT review_schedules_pattern_id_fkey;
ALTER TABLE review_schedules ADD CONSTRAINT review_schedules_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE review_attempts DROP CONSTRAINT review_attempts_problem_id_fkey;
ALTER TABLE review_attempts ADD CONSTRAINT review_attempts_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;
ALTER TABLE review_attempts DROP CONSTRAINT review_attempts_pattern_id_fkey;
ALTER TABLE review_attempts ADD CONSTRAINT review_attempts_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE quiz_questions DROP CONSTRAINT quiz_questions_problem_id_fkey;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;
ALTER TABLE quiz_questions DROP CONSTRAINT quiz_questions_pattern_id_fkey;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;
ALTER TABLE quiz_answers DROP CONSTRAINT quiz_answers_question_id_fkey;
ALTER TABLE quiz_answers ADD CONSTRAINT quiz_answers_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE;

ALTER TABLE pattern_family_subpatterns DROP CONSTRAINT pattern_family_subpatterns_family_id_fkey;
ALTER TABLE pattern_family_subpatterns ADD CONSTRAINT pattern_family_subpatterns_family_id_fkey
    FOREIGN KEY (family_id) REFERENCES patterns(id) ON DELETE CASCADE;
ALTER TABLE pattern_family_subpatterns DROP CONSTRAINT pattern_family_subpatterns_subpattern_id_fkey;
ALTER TABLE pattern_family_subpatterns ADD CONSTRAINT pattern_family_subpatterns_subpattern_id_fkey
    FOREIGN KEY (subpattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE subpattern_prerequisites DROP CONSTRAINT subpattern_prerequisites_subpattern_id_fkey;
ALTER TABLE subpattern_prerequisites ADD CONSTRAINT subpattern_prerequisites_subpattern_id_fkey
    FOREIGN KEY (subpattern_id) REFERENCES patterns(id) ON DELETE CASCADE;
ALTER TABLE subpattern_prerequisites DROP CONSTRAINT subpattern_prerequisites_tool_id_fkey;
ALTER TABLE subpattern_prerequisites ADD CONSTRAINT subpattern_prerequisites_tool_id_fkey
    FOREIGN KEY (tool_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE pattern_learning_materials DROP CONSTRAINT pattern_learning_materials_pattern_id_fkey;
ALTER TABLE pattern_learning_materials ADD CONSTRAINT pattern_learning_materials_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE problem_subpatterns DROP CONSTRAINT problem_subpatterns_problem_id_fkey;
ALTER TABLE problem_subpatterns ADD CONSTRAINT problem_subpatterns_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;
ALTER TABLE problem_subpatterns DROP CONSTRAINT problem_subpatterns_subpattern_id_fkey;
ALTER TABLE problem_subpatterns ADD CONSTRAINT problem_subpatterns_subpattern_id_fkey
    FOREIGN KEY (subpattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE subpattern_companies DROP CONSTRAINT subpattern_companies_subpattern_id_fkey;
ALTER TABLE subpattern_companies ADD CONSTRAINT subpattern_companies_subpattern_id_fkey
    FOREIGN KEY (subpattern_id) REFERENCES patterns(id) ON DELETE CASCADE;
ALTER TABLE subpattern_companies DROP CONSTRAINT subpattern_companies_company_id_fkey;
ALTER TABLE subpattern_companies ADD CONSTRAINT subpattern_companies_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE company_problems DROP CONSTRAINT company_problems_company_id_fkey;
ALTER TABLE company_problems ADD CONSTRAINT company_problems_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE company_problems DROP CONSTRAINT company_problems_problem_id_fkey;
ALTER TABLE company_problems ADD CONSTRAINT company_problems_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE;

ALTER TABLE user_practice_patterns DROP CONSTRAINT user_practice_patterns_pattern_id_fkey;
ALTER TABLE user_practice_patterns ADD CONSTRAINT user_practice_patterns_pattern_id_fkey
    FOREIGN KEY (pattern_id) REFERENCES patterns(id) ON DELETE CASCADE;

ALTER TABLE ai_request_logs DROP CONSTRAINT ai_request_logs_problem_id_fkey;
ALTER TABLE ai_request_logs ADD CONSTRAINT ai_request_logs_problem_id_fkey
    FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE SET NULL;

ALTER TABLE pattern_family_subpatterns DROP COLUMN admin_id;
ALTER TABLE subpattern_prerequisites DROP COLUMN admin_id;
ALTER TABLE problem_subpatterns DROP COLUMN admin_id;
ALTER TABLE subpattern_companies DROP COLUMN admin_id;
ALTER TABLE company_problems DROP COLUMN admin_id;
ALTER TABLE roadmap_items DROP COLUMN admin_id;

COMMIT;

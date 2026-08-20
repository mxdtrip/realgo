package admin

import "github.com/GoAdminGroup/go-admin/plugins/admin/modules/table"

// Generators contains application tables exposed in GoAdmin.
var Generators = table.GeneratorList{
	"ai_request_logs":            AIRequestLogs,
	"cards":                      Cards,
	"companies":                  Companies,
	"company_problems":           CompanyProblems,
	"extension_events":           ExtensionEvents,
	"pattern_family_subpatterns": PatternFamilySubpatterns,
	"pattern_learning_materials": PatternLearningMaterials,
	"patterns":                   Patterns,
	"platforms":                  Platforms,
	"problem_reports":            ProblemReports,
	"problem_subpatterns":        ProblemSubpatterns,
	"problems":                   Problems,
	"quiz_answers":               QuizAnswers,
	"quiz_questions":             QuizQuestions,
	"review_attempts":            ReviewAttempts,
	"review_schedules":           ReviewSchedules,
	"roadmap_items":              RoadmapItems,
	"subpattern_companies":       SubpatternCompanies,
	"subpattern_prerequisites":   SubpatternPrerequisites,
	"taxonomy_versions":          TaxonomyVersions,
	"user_practice_patterns":     UserPracticePatterns,
	"user_problem_progress":      UserProblemProgress,
	"user_roadmap_configs":       UserRoadmapConfigs,
	"user_roadmap_plan_items":    UserRoadmapPlanItems,
	"users":                      Users,
}

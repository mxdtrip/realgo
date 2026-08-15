package patterns

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mxdtrip/realgo/services/api/internal/config"
	"github.com/mxdtrip/realgo/services/api/internal/storage/postgres"
	"github.com/mxdtrip/realgo/services/api/internal/storage/redis"
	"github.com/mxdtrip/realgo/services/api/internal/testutil"
)

const (
	benchmarkCompanyCode = "atlas-bench-company-001"
	benchmarkCacheKey    = "benchmark:atlas:company:001:user:active"
	parallelClients      = 12
)

type benchmarkFixture struct {
	newUserID    int64
	activeUserID int64
	nodeCode     string
}

type benchmarkLoad func(context.Context) ([]byte, error)

// Run with: go test ./internal/patterns -run '^$' -bench '^BenchmarkAtlasScale$' -benchmem -benchtime=1s -count=3 -timeout=20m
// Add ATLAS_BENCH_EXPLAIN=1 and -v to print plans for the five catalog-scale queries.
func BenchmarkAtlasScale(b *testing.B) {
	if testing.Short() {
		b.Skip("atlas scale benchmark requires Docker")
	}

	ctx := context.Background()
	h, err := testutil.Start(ctx)
	if err != nil {
		b.Skipf("start Postgres and Redis: %v", err)
	}
	defer h.Stop()

	started := time.Now()
	fixture, err := seedAtlasBenchmark(ctx, h.Pool)
	if err != nil {
		b.Fatal(err)
	}
	b.Logf("seeded 45k problems, 90k problem links, 550 companies, 660k company links and 1m attempts in %s", time.Since(started).Round(time.Millisecond))

	dbCfg := h.DatabaseConfig()
	pg, err := postgres.New(ctx, &dbCfg)
	if err != nil {
		b.Fatal(err)
	}
	defer pg.Close()

	redisCfg := h.RedisConfig()
	cache, err := redis.New(ctx, &redisCfg)
	if err != nil {
		b.Fatal(err)
	}
	defer func() { _ = cache.Close() }()

	repo := NewRepository(pg.Pool)
	baseNew := func(ctx context.Context) ([]byte, error) {
		value, err := repo.GetAtlas(ctx, fixture.newUserID, "")
		return marshalBenchmarkResponse(value, err)
	}
	baseActive := func(ctx context.Context) ([]byte, error) {
		value, err := repo.GetAtlas(ctx, fixture.activeUserID, "")
		return marshalBenchmarkResponse(value, err)
	}
	companyActive := func(ctx context.Context) ([]byte, error) {
		value, err := repo.GetAtlas(ctx, fixture.activeUserID, benchmarkCompanyCode)
		return marshalBenchmarkResponse(value, err)
	}
	companies := func(ctx context.Context) ([]byte, error) {
		value, err := repo.ListCompanies(ctx)
		return marshalBenchmarkResponse(value, err)
	}
	nodeActive := func(ctx context.Context) ([]byte, error) {
		value, err := repo.GetAtlasNode(ctx, fixture.activeUserID, fixture.nodeCode, "")
		return marshalBenchmarkResponse(value, err)
	}
	page50 := func(ctx context.Context) ([]byte, error) {
		return loadCompanyPage(ctx, pg.Pool, fixture.activeUserID, benchmarkCompanyCode)
	}

	cachedCompany, err := companyActive(ctx)
	if err != nil {
		b.Fatal(err)
	}
	if err := cache.Save(ctx, benchmarkCacheKey, cachedCompany, time.Minute); err != nil {
		b.Fatal(err)
	}
	cachedRoundTrip, err := cache.Get(ctx, benchmarkCacheKey)
	if err != nil {
		b.Fatal(err)
	}
	if !bytes.Equal(cachedRoundTrip, cachedCompany) {
		b.Fatal("Redis changed the cached Atlas response")
	}
	cacheHit := func(ctx context.Context) ([]byte, error) {
		return cache.Get(ctx, benchmarkCacheKey)
	}
	cacheMissFill := func(ctx context.Context) ([]byte, error) {
		body, err := companyActive(ctx)
		if err != nil {
			return nil, err
		}
		return body, cache.Save(ctx, benchmarkCacheKey, body, time.Minute)
	}

	if os.Getenv("ATLAS_BENCH_EXPLAIN") == "1" {
		explainAtlasQueries(b, ctx, dbCfg, fixture)
	}

	benchmarkSerial(b, "Postgres/Atlas/NewUser", baseNew)
	benchmarkSerial(b, "Postgres/Atlas/ActiveUser", baseActive)
	benchmarkSerial(b, "Postgres/CompanyAtlas/ActiveUser", companyActive)
	benchmarkSerial(b, "Postgres/Companies", companies)
	benchmarkSerial(b, "Postgres/NodeDetail/ActiveUser", nodeActive)
	benchmarkSerial(b, "Postgres/CompanyPage50/ActiveUser", page50)
	benchmarkSerial(b, "Redis/CompanyAtlas/Hit", cacheHit)
	benchmarkSerial(b, "Redis/CompanyAtlas/MissFill", cacheMissFill)
	benchmarkParallel(b, "Parallel12/Postgres/CompanyAtlas", companyActive)
	benchmarkParallel(b, "Parallel12/Redis/CompanyAtlasHit", cacheHit)
}

func benchmarkSerial(b *testing.B, name string, load benchmarkLoad) {
	b.Run(name, func(b *testing.B) {
		sample, err := load(context.Background())
		if err != nil {
			b.Fatal(err)
		}
		b.ReportAllocs()
		b.ResetTimer()
		for b.Loop() {
			body, err := load(context.Background())
			if err != nil {
				b.Fatal(err)
			}
			runtime.KeepAlive(body)
		}
		b.ReportMetric(float64(len(sample)), "response_B")
	})
}

func benchmarkParallel(b *testing.B, name string, load benchmarkLoad) {
	b.Run(name, func(b *testing.B) {
		sample, err := load(context.Background())
		if err != nil {
			b.Fatal(err)
		}
		b.ReportAllocs()

		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		start := make(chan struct{})
		var next atomic.Int64
		var firstErr error
		var once sync.Once
		var wg sync.WaitGroup
		wg.Add(parallelClients)
		for range parallelClients {
			go func() {
				defer wg.Done()
				<-start
				for {
					if next.Add(1) > int64(b.N) {
						return
					}
					body, err := load(ctx)
					if err != nil {
						once.Do(func() {
							firstErr = err
							cancel()
						})
						return
					}
					runtime.KeepAlive(body)
				}
			}()
		}

		b.ResetTimer()
		close(start)
		wg.Wait()
		b.StopTimer()
		b.ReportMetric(float64(len(sample)), "response_B")
		if firstErr != nil {
			b.Fatal(firstErr)
		}
	})
}

func marshalBenchmarkResponse(value any, err error) ([]byte, error) {
	if err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		Data any `json:"data"`
	}{Data: value})
}

type benchmarkPageProblem struct {
	SubpatternCode string `json:"subpattern_code"`
	SubpatternName string `json:"subpattern_name"`
	Tier           string `json:"tier"`
	ID             int64  `json:"id"`
	Title          string `json:"title"`
	URL            string `json:"url"`
	Difficulty     string `json:"difficulty"`
	EvidenceCount  int    `json:"evidence_count"`
	LastSeenAt     string `json:"last_seen_at,omitempty"`
	SourceType     string `json:"source_type"`
	Status         string `json:"status"`
	NextReviewAt   string `json:"next_review_at,omitempty"`
}

func loadCompanyPage(ctx context.Context, pool *pgxpool.Pool, userID int64, companyCode string) ([]byte, error) {
	rows, err := pool.Query(ctx, `
		SELECT
			p.code,
			p.name,
			COALESCE(ps.tier, '')::text,
			pr.id,
			pr.title,
			pr.url,
			COALESCE(pr.difficulty, '')::text,
			cp.evidence_count,
			COALESCE(cp.last_seen_at::text, ''),
			cp.source_type,
			COALESCE(upp.status, 'not_started')::text,
			COALESCE(rs.next_review_at::text, '')
		FROM company_problems cp
		JOIN companies co ON co.id = cp.company_id
		JOIN problems pr ON pr.id = cp.problem_id
		JOIN problem_subpatterns ps ON ps.problem_id = pr.id
		JOIN patterns p ON p.id = ps.subpattern_id
		LEFT JOIN user_problem_progress upp
			ON upp.problem_id = pr.id AND upp.user_id = $1
		LEFT JOIN review_schedules rs
			ON rs.problem_id = pr.id AND rs.user_id = $1
		WHERE co.code = $2
		ORDER BY p.code, ps.tier, pr.title
		LIMIT 50`,
		userID, companyCode,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]benchmarkPageProblem, 0, 50)
	for rows.Next() {
		var item benchmarkPageProblem
		if err := rows.Scan(
			&item.SubpatternCode,
			&item.SubpatternName,
			&item.Tier,
			&item.ID,
			&item.Title,
			&item.URL,
			&item.Difficulty,
			&item.EvidenceCount,
			&item.LastSeenAt,
			&item.SourceType,
			&item.Status,
			&item.NextReviewAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return marshalBenchmarkResponse(items, nil)
}

func seedAtlasBenchmark(ctx context.Context, pool *pgxpool.Pool) (benchmarkFixture, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return benchmarkFixture{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, statement := range atlasSeedStatements {
		if _, err := tx.Exec(ctx, statement); err != nil {
			return benchmarkFixture{}, fmt.Errorf("seed atlas benchmark: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return benchmarkFixture{}, err
	}

	if _, err := pool.Exec(ctx, `
		ANALYZE problems, problem_subpatterns, companies, company_problems,
			subpattern_companies, users, user_problem_progress, review_schedules,
			review_attempts, cards`); err != nil {
		return benchmarkFixture{}, err
	}

	var fixture benchmarkFixture
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT id FROM users WHERE email = 'atlas-bench-new@example.test'),
			(SELECT id FROM users WHERE email = 'atlas-bench-active@example.test'),
			(
				SELECT p.code
				FROM patterns p
				JOIN problem_subpatterns ps ON ps.subpattern_id = p.id
				WHERE p.kind = 'subpattern'
				GROUP BY p.id, p.code
				ORDER BY COUNT(*) DESC, p.code
				LIMIT 1
			)`).Scan(&fixture.newUserID, &fixture.activeUserID, &fixture.nodeCode); err != nil {
		return benchmarkFixture{}, err
	}

	var problems, problemLinks, companies, companyLinks, attempts, progress, schedules, cards int
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM problems WHERE external_slug LIKE 'atlas-bench-%'),
			(SELECT COUNT(*) FROM problem_subpatterns),
			(SELECT COUNT(*) FROM companies WHERE code LIKE 'atlas-bench-%'),
			(SELECT COUNT(*) FROM company_problems),
			(SELECT COUNT(*) FROM review_attempts),
			(SELECT COUNT(*) FROM user_problem_progress),
			(SELECT COUNT(*) FROM review_schedules),
			(SELECT COUNT(*) FROM cards WHERE source LIKE 'atlas-bench-%')`,
	).Scan(&problems, &problemLinks, &companies, &companyLinks, &attempts, &progress, &schedules, &cards); err != nil {
		return benchmarkFixture{}, err
	}
	got := []int{problems, problemLinks, companies, companyLinks, attempts, progress, schedules, cards}
	want := []int{45_000, 90_000, 550, 660_000, 1_000_000, 10_000, 10_000, 10_000}
	for i := range want {
		if got[i] != want[i] {
			return benchmarkFixture{}, fmt.Errorf("seed atlas benchmark: count[%d] = %d, want %d", i, got[i], want[i])
		}
	}
	return fixture, nil
}

var atlasSeedStatements = []string{
	`
		INSERT INTO users (email, password_hash, onboarding_completed_at)
		VALUES
			('atlas-bench-new@example.test', 'benchmark', NOW()),
			('atlas-bench-active@example.test', 'benchmark', NOW());

		INSERT INTO users (email, password_hash, onboarding_completed_at)
		SELECT 'atlas-bench-user-' || g || '@example.test', 'benchmark', NOW()
		FROM generate_series(3, 100) AS g`,
	`
		WITH platform_ids AS (
			SELECT array_agg(id ORDER BY id) AS ids FROM platforms
		)
		INSERT INTO problems (
			platform_id, external_slug, title, url, difficulty, source_type
		)
		SELECT
			ids[((g - 1) % array_length(ids, 1)) + 1],
			'atlas-bench-' || g,
			'Atlas benchmark problem ' || g,
			'https://example.test/problems/' || g,
			(ARRAY['easy', 'medium', 'hard'])[((g - 1) % 3) + 1],
			'dataset'
		FROM generate_series(1, 45000) AS g
		CROSS JOIN platform_ids`,
	`
		WITH benchmark_problems AS (
			SELECT id, row_number() OVER (ORDER BY id) AS n
			FROM problems
			WHERE external_slug LIKE 'atlas-bench-%'
		),
		subpatterns AS (
			SELECT array_agg(id ORDER BY id) AS ids
			FROM patterns
			WHERE kind = 'subpattern' AND taxonomy_version = 'realgo-v2'
		)
		INSERT INTO problem_subpatterns (problem_id, subpattern_id, tier, position)
		SELECT
			bp.id,
			sp.ids[((bp.n - 1 + link.link_index * 17) % array_length(sp.ids, 1)) + 1],
			(ARRAY['foundational', 'core', 'advanced'])[((bp.n - 1) % 3) + 1],
			link.link_index + 1
		FROM benchmark_problems bp
		CROSS JOIN subpatterns sp
		CROSS JOIN generate_series(0, 1) AS link(link_index)`,
	`
		INSERT INTO companies (code, name)
		SELECT
			'atlas-bench-company-' || lpad(g::text, 3, '0'),
			'Atlas benchmark company ' || g
		FROM generate_series(1, 550) AS g`,
	`
		WITH benchmark_companies AS (
			SELECT id, row_number() OVER (ORDER BY id) AS n
			FROM companies
			WHERE code LIKE 'atlas-bench-%'
		),
		benchmark_problems AS (
			SELECT array_agg(id ORDER BY id) AS ids
			FROM problems
			WHERE external_slug LIKE 'atlas-bench-%'
		)
		INSERT INTO company_problems (
			company_id, problem_id, evidence_count, last_seen_at, source_type
		)
		SELECT
			bc.id,
			bp.ids[(((bc.n - 1) * 1200 + link.link_index) % array_length(bp.ids, 1)) + 1],
			(link.link_index % 20) + 1,
			CURRENT_DATE - (link.link_index % 365),
			'dataset'
		FROM benchmark_companies bc
		CROSS JOIN benchmark_problems bp
		CROSS JOIN generate_series(0, 1199) AS link(link_index)`,
	`
		INSERT INTO subpattern_companies (
			subpattern_id, company_id, relevance, confidence,
			evidence_count, last_seen_at, source_type
		)
		SELECT
			ps.subpattern_id,
			cp.company_id,
			CASE
				WHEN SUM(cp.evidence_count) >= 150 THEN 'high'
				WHEN SUM(cp.evidence_count) >= 75 THEN 'medium'
				ELSE 'low'
			END,
			'high',
			SUM(cp.evidence_count)::integer,
			MAX(cp.last_seen_at),
			'dataset'
		FROM company_problems cp
		JOIN problem_subpatterns ps ON ps.problem_id = cp.problem_id
		GROUP BY ps.subpattern_id, cp.company_id`,
	`
		WITH active_user AS (
			SELECT id FROM users WHERE email = 'atlas-bench-active@example.test'
		),
		benchmark_problems AS (
			SELECT id, row_number() OVER (ORDER BY id) AS n
			FROM problems
			WHERE external_slug LIKE 'atlas-bench-%'
			ORDER BY id
			LIMIT 10000
		)
		INSERT INTO user_problem_progress (
			user_id, problem_id, status, rating, first_seen_at, solved_at
		)
		SELECT
			u.id,
			p.id,
			CASE WHEN p.n % 5 = 0 THEN 'in_progress' ELSE 'solved' END,
			(ARRAY['hard', 'normal', 'easy'])[((p.n - 1) % 3) + 1],
			NOW() - INTERVAL '30 days',
			CASE WHEN p.n % 5 = 0 THEN NULL ELSE NOW() - INTERVAL '1 day' END
		FROM active_user u
		CROSS JOIN benchmark_problems p`,
	`
		WITH active_user AS (
			SELECT id FROM users WHERE email = 'atlas-bench-active@example.test'
		),
		benchmark_problems AS (
			SELECT id, row_number() OVER (ORDER BY id) AS n
			FROM problems
			WHERE external_slug LIKE 'atlas-bench-%'
			ORDER BY id
			LIMIT 10000
		)
		INSERT INTO review_schedules (
			user_id, problem_id, next_review_at, interval_days, ease,
			stability, difficulty, review_count, last_rating, algorithm
		)
		SELECT
			u.id,
			p.id,
			NOW() + ((p.n % 7) - 3) * INTERVAL '1 day',
			7,
			2.5,
			5,
			5,
			3,
			'normal',
			'fsrs'
		FROM active_user u
		CROSS JOIN benchmark_problems p`,
	`
		WITH benchmark_users AS (
			SELECT array_agg(id ORDER BY id) AS ids
			FROM users
			WHERE email LIKE 'atlas-bench-%'
			  AND email <> 'atlas-bench-new@example.test'
		),
		benchmark_problems AS (
			SELECT array_agg(id ORDER BY id) AS ids
			FROM problems
			WHERE external_slug LIKE 'atlas-bench-%'
		)
		INSERT INTO review_attempts (
			user_id, problem_id, rating, review_type, duration_sec, was_correct
		)
		SELECT
			u.ids[((g - 1) % array_length(u.ids, 1)) + 1],
			p.ids[((g * 17 - 1) % array_length(p.ids, 1)) + 1],
			(ARRAY['hard', 'normal', 'easy'])[((g - 1) % 3) + 1],
			'problem',
			(g % 300) + 1,
			g % 4 <> 0
		FROM generate_series(1, 1000000) AS g
		CROSS JOIN benchmark_users u
		CROSS JOIN benchmark_problems p`,
	`
		WITH subpatterns AS (
			SELECT array_agg(id ORDER BY id) AS ids
			FROM patterns
			WHERE kind = 'subpattern' AND taxonomy_version = 'realgo-v2'
		)
		INSERT INTO cards (
			pattern_id, type, question, answer, source, created_by_ai
		)
		SELECT
			sp.ids[((g - 1) % array_length(sp.ids, 1)) + 1],
			'recognition',
			'Atlas benchmark question ' || g,
			'Atlas benchmark answer ' || g,
			'atlas-bench-card-' || g,
			FALSE
		FROM generate_series(1, 10000) AS g
		CROSS JOIN subpatterns sp`,
}

type capturedQuery struct {
	name string
	sql  string
	args []any
}

type queryCapture struct {
	mu      sync.Mutex
	enabled bool
	queries []capturedQuery
}

func (c *queryCapture) TraceQueryStart(ctx context.Context, _ *pgx.Conn, data pgx.TraceQueryStartData) context.Context {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.enabled {
		c.queries = append(c.queries, capturedQuery{
			name: queryName(data.SQL),
			sql:  data.SQL,
			args: append([]any(nil), data.Args...),
		})
	}
	return ctx
}

func (*queryCapture) TraceQueryEnd(context.Context, *pgx.Conn, pgx.TraceQueryEndData) {}

func queryName(sql string) string {
	fields := strings.Fields(strings.SplitN(strings.TrimSpace(sql), "\n", 2)[0])
	if len(fields) >= 3 && fields[0] == "--" && fields[1] == "name:" {
		return fields[2]
	}
	return "unnamed"
}

func explainAtlasQueries(b *testing.B, ctx context.Context, cfg config.Database, fixture benchmarkFixture) {
	b.Helper()
	capture := &queryCapture{enabled: true}
	poolCfg, err := pgxpool.ParseConfig(cfg.ConnString())
	if err != nil {
		b.Fatal(err)
	}
	poolCfg.ConnConfig.Tracer = capture
	poolCfg.MaxConns = 1
	poolCfg.MinConns = 0
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		b.Fatal(err)
	}
	defer pool.Close()

	repo := NewRepository(pool)
	if _, err := repo.GetAtlas(ctx, fixture.activeUserID, benchmarkCompanyCode); err != nil {
		b.Fatal(err)
	}
	if _, err := repo.GetAtlasNode(ctx, fixture.activeUserID, fixture.nodeCode, ""); err != nil {
		b.Fatal(err)
	}

	capture.mu.Lock()
	capture.enabled = false
	queries := append([]capturedQuery(nil), capture.queries...)
	capture.mu.Unlock()

	targets := map[string]bool{
		"ListUserSubpatternProblemStats": true,
		"ListSubpatternDifficultyCounts": true,
		"ListUserSubpatternAttemptStats": true,
		"ListCompanyRelevantProblems":    true,
		"ListSubpatternCompanyProblems":  true,
	}
	seen := map[string]bool{}
	for _, query := range queries {
		if !targets[query.name] || seen[query.name] {
			continue
		}
		seen[query.name] = true
		rows, err := pool.Query(ctx, "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) "+query.sql, query.args...)
		if err != nil {
			b.Fatalf("explain %s: %v", query.name, err)
		}
		var plan []string
		for rows.Next() {
			var line string
			if err := rows.Scan(&line); err != nil {
				rows.Close()
				b.Fatalf("scan explain %s: %v", query.name, err)
			}
			plan = append(plan, line)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			b.Fatalf("read explain %s: %v", query.name, err)
		}
		rows.Close()
		b.Logf("EXPLAIN %s\n%s", query.name, strings.Join(plan, "\n"))
	}
}

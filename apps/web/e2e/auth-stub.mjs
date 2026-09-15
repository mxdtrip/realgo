// Zero-dependency stand-in for the Go auth API, used only by the Playwright
// e2e suite (apps/web/e2e). It is booted by playwright.config.mjs and torn down
// with the test run — it is never deployed and never long-lived.
//
// Behaviour is deterministic by TOKEN PREFIX, so one instance drives every
// scenario without a restart. /users/me keys off the access bearer; /auth/refresh
// keys off the refresh_token in the body — independently, so a test can mix them:
//
//   LIVE.*  -> 200  healthy session
//   DEAD.*  -> 401  revoked/expired  (client must clear tokens)
//   FLAKY.* -> 500  transient outage (client must KEEP tokens)

import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT ?? 8080);
const PREFIX = "/api/v1";

const USER = {
  id: 1,
  email: "e2e@realgo.dev",
  timezone: "UTC",
  plan: "free",
  interview_date: null,
  created_at: "2026-01-01T00:00:00Z",
  onboarding_completed: true,
  profile: {
    prep_goal: null,
    grade: null,
    target_company: null,
    target_position: null,
    platform: null,
    target_topics: [],
  },
  notification_settings: {
    review_reminder: true,
    streak_reminder: false,
    weekly_digest: false,
    email_enabled: false,
  },
};

const tokens = (kind) => ({
  // JWT-shaped enough for the web client's cross-tab subject comparison.
  access_token: `${kind}.eyJzdWIiOiIxIn0.signature`,
  refresh_token: `${kind}.refresh`,
  token_type: "Bearer",
  expires_in: 900,
});

function kindOf(token) {
  if (!token) return "NONE";
  if (token.startsWith("LIVE")) return "LIVE";
  if (token.startsWith("DEAD")) return "DEAD";
  if (token.startsWith("FLAKY")) return "FLAKY";
  return "UNKNOWN";
}

function send(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "X-Request-Id": `stub-request-${Date.now()}`,
  });
  res.end(JSON.stringify(obj));
}
const ok = (res, data) => send(res, 200, { data });
const fail = (res, status, code, message) => send(res, status, { error: { code, message } });

function parseMultipartReport(raw, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) return {};
  for (const part of raw.split(`--${boundary}`)) {
    if (!part.includes('name="report"')) continue;
    const [, payload = ""] = part.split("\r\n\r\n");
    return JSON.parse(payload.replace(/\r\n--$/, "").trim());
  }
  return {};
}

// Small deterministic Realgo Taxonomy slice for the /patterns e2e specs.
const stubStats = (over = {}) => ({
  problem_count: 0,
  solved_count: 0,
  in_progress_count: 0,
  due_count: 0,
  card_count: 0,
  attempt_count: 0,
  hard_count: 0,
  ...over,
});

const stubMastery = (status, percent, practice = percent, retention = 100) => ({
  status,
  percent,
  components: { practice, retention },
});

const ATLAS_COMPANIES = [
  { code: "cmp_stub", name: "Stub Corp", subpattern_count: 2, demo_only: true, last_seen_at: "2026-05-01" },
];

const STUB_RELEVANCE = {
  binary_search_on_answer: {
    relevance: "high",
    confidence: "medium",
    evidence_count: 7,
    last_seen_at: "2026-05-01",
    source_type: "demo",
  },
  lower_upper_bound: {
    relevance: "medium",
    confidence: "low",
    evidence_count: 2,
    last_seen_at: "2026-02-01",
    source_type: "demo",
  },
};

// ---- Review hub fixtures (/reviews, /problems, /cards deck) --------------
// dueAt/nextReviewAt lean on "now" so the UI renders the deterministic
// "today / due now" branches regardless of when the suite runs.
const NOW_ISO = new Date().toISOString();
const PAST_ISO = new Date(Date.now() - 3 * 3600_000).toISOString();
const OVERDUE_ISO = new Date(Date.now() - 3 * 86_400_000).toISOString();
const FUTURE_ISO = new Date(Date.now() + 26 * 3600_000).toISOString();

const REVIEW_QUEUE = [
  {
    id: 501,
    entityType: "problem",
    entityId: 41,
    title: "Stub Problem: Koko Eating Bananas",
    meta: "Binary Search · medium",
    typeLabel: "problem review",
    dueAt: NOW_ISO,
    status: "due",
    lastRating: "hard",
    attempts: 3,
    entityUrl: "https://example.test/koko",
    patternCode: "binary_search_on_answer",
  },
  {
    id: 502,
    entityType: "card",
    entityId: 9101,
    title: "Stub card: which approach fits a sorted array?",
    meta: "Two Pointers · pattern_recognition",
    typeLabel: "card review",
    dueAt: NOW_ISO,
    status: "due",
    lastRating: null,
    attempts: 0,
    entityUrl: "",
    patternCode: "two_pointers",
  },
  {
    id: 503,
    entityType: "pattern",
    entityId: 7,
    title: "Sliding Window",
    meta: "Pattern · weak confidence",
    typeLabel: "pattern review",
    dueAt: NOW_ISO,
    status: "due",
    lastRating: "normal",
    attempts: 2,
    entityUrl: "",
    patternCode: "sliding_window",
  },
];

const PROBLEMS = [
  {
    id: 41,
    externalId: "koko-eating-bananas",
    title: "Stub Problem: Koko Eating Bananas",
    url: "https://example.test/koko",
    platform: "leetcode",
    difficulty: "medium",
    pattern: { id: "binary_search_on_answer", name: "Binary Search on Answer" },
    status: "reviewing",
    nextReviewAt: PAST_ISO,
    lastRating: "hard",
    solvedAt: PAST_ISO,
    hintsUsed: 2,
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: PAST_ISO,
  },
  {
    id: 42,
    externalId: "two-sum-stub",
    title: "Stub Problem: Two Sum",
    url: "https://example.test/two-sum",
    platform: "neetcode",
    difficulty: "easy",
    pattern: null,
    status: "mastered",
    nextReviewAt: FUTURE_ISO,
    lastRating: "easy",
    solvedAt: "2026-06-20T10:00:00Z",
    hintsUsed: 0,
    createdAt: "2026-05-20T10:00:00Z",
    updatedAt: "2026-06-20T10:00:00Z",
  },
];

// Practice set: statuses derive from the atlas mastery fixtures above
// (unstable 41% -> "в работе", mastered 92% -> "освоен", not_started -> "добавлен").
let PRACTICE = [
  { code: "binary_search_on_answer", name: "Binary Search on Answer", addedAt: "2026-07-01T10:00:00Z" },
  { code: "lower_upper_bound", name: "Lower / Upper Bound", addedAt: "2026-07-02T10:00:00Z" },
  { code: "fixed_size_window", name: "Fixed-Size Window", addedAt: "2026-07-03T10:00:00Z" },
];

const DECK_CARDS = [
  {
    id: 9101,
    type: "pattern_recognition",
    source: { entityType: "pattern", entityId: 11, label: "Two Pointers" },
    front: "STUB DECK: which approach fits a sorted array?",
    back: "STUB DECK BACK: two pointers moving inward.",
    status: "due",
    nextReviewAt: PAST_ISO,
    lastRating: "normal",
    createdAt: "2026-06-01T10:00:00Z",
  },
  {
    id: 9102,
    type: "edge_case",
    source: { entityType: "pattern", entityId: 12, label: "Sliding Window" },
    front: "STUB DECK: what breaks on an empty input?",
    back: "STUB DECK BACK: guard the zero-length slice first.",
    status: "mastered",
    nextReviewAt: FUTURE_ISO,
    lastRating: "easy",
    createdAt: "2026-06-02T10:00:00Z",
  },
];

// Deterministic card review session for the /cards/session e2e specs.
const CARD_SESSION = {
  sessionId: "sess_stub",
  scope: "due",
  estimatedMinutes: 3,
  cards: [
    {
      id: 9101,
      type: "pattern_recognition",
      sourceLabel: "Stub Problem · Two Pointers",
      front: "STUB FRONT: which approach fits a sorted array?",
      back: "STUB BACK: two pointers moving inward.",
      createdByAi: true,
      reviewState: { attempts: 0, lastRating: null, nextReviewAt: null },
    },
    {
      id: 9102,
      type: "edge_case",
      sourceLabel: "Stub Problem · Edge Cases",
      front: "STUB FRONT: what breaks on an empty input?",
      back: "STUB BACK: guard the zero-length slice first.",
      createdByAi: false,
      reviewState: { attempts: 1, lastRating: "normal", nextReviewAt: "2026-07-01T00:00:00Z" },
    },
  ],
};

const DUE_CARDS_SUMMARY = {
  totalDue: 0,
  estimatedMinutes: 0,
  byType: [],
};

function atlasPayload(withCompany) {
  const subpatterns = [
    {
      code: "binary_search_on_answer",
      name: "Binary Search on Answer",
      position: 1,
      family_codes: ["binary_search"],
      tool_codes: ["tool_arrays"],
      stats: stubStats({
        problem_count: 12,
        solved_count: 3,
        due_count: 1,
        difficulty_counts: { easy: 3, medium: 6, hard: 3 },
      }),
      mastery: stubMastery("unstable", 41),
    },
    {
      code: "lower_upper_bound",
      name: "Lower / Upper Bound",
      position: 2,
      family_codes: ["binary_search"],
      tool_codes: ["tool_arrays"],
      stats: stubStats({ problem_count: 4, solved_count: 4, difficulty_counts: { easy: 2, medium: 2 } }),
      mastery: stubMastery("mastered", 92),
    },
    {
      code: "fixed_size_window",
      name: "Fixed-Size Window",
      position: 3,
      family_codes: ["sliding_window"],
      tool_codes: ["tool_arrays"],
      stats: stubStats(),
      mastery: stubMastery("not_started", 0),
    },
  ];
  if (withCompany) {
    for (const sub of subpatterns) {
      if (STUB_RELEVANCE[sub.code]) sub.relevance = STUB_RELEVANCE[sub.code];
    }
  }
  return {
    taxonomy_version: "realgo-v2",
    tools: [
      { code: "tool_arrays", name: "Arrays", position: 1, subpattern_codes: ["binary_search_on_answer", "lower_upper_bound", "fixed_size_window"] },
      { code: "tool_hash_map", name: "Hash Map", position: 2, subpattern_codes: [] },
    ],
    families: [
      {
        code: "binary_search",
        name: "Binary Search",
        description: "",
        position: 1,
        subpattern_codes: ["binary_search_on_answer", "lower_upper_bound"],
      },
      {
        code: "sliding_window",
        name: "Sliding Window",
        description: "",
        position: 2,
        subpattern_codes: ["fixed_size_window"],
      },
    ],
    subpatterns,
    company: withCompany
      ? {
          code: "cmp_stub",
          name: "Stub Corp",
          demo_only: true,
          coverage: {
            relevant_subpatterns: 2,
            strong: 1,
            unstable: 1,
            weak: 0,
            not_started: 0,
            top_gaps: [
              { code: "binary_search_on_answer", name: "Binary Search on Answer", relevance: "high", mastery_percent: 41 },
            ],
          },
        }
      : undefined,
  };
}

const ATLAS_NODES = {
  binary_search: {
    code: "binary_search",
    name: "Binary Search",
    kind: "family",
    description: "Family node stub — only used to trigger the /patterns redirect (#166).",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    subpatterns: [
      { code: "binary_search_on_answer", name: "Binary Search on Answer" },
      { code: "lower_upper_bound", name: "Lower / Upper Bound" },
    ],
    cards: [],
    practice: [],
    company_practice: [],
    relevant_companies: [],
  },
  binary_search_on_answer: {
    code: "binary_search_on_answer",
    name: "Binary Search on Answer",
    kind: "subpattern",
    description: "",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    families: [{ code: "binary_search", name: "Binary Search" }],
    tools: [{ code: "tool_arrays", name: "Arrays" }],
    material: {
      what_it_is: "Стаб: поиск по пространству ответов.",
      mental_model: "Стаб: монотонный предикат.",
      recognition_cues: ["Минимальная скорость, чтобы успеть"],
      anti_cues: ["Предикат не монотонен"],
      core_invariant: "Граница всегда в [lo, hi].",
      canonical_skeleton: "while lo < hi: ...",
      common_mistakes: ["hi = mid - 1 при поиске минимума"],
      dont_confuse_with: [{ title: "Exact Binary Search", note: "ищет элемент, а не границу" }],
    },
    stats: stubStats({
      problem_count: 12,
      solved_count: 3,
      due_count: 1,
      difficulty_counts: { easy: 2, medium: 7, hard: 3 },
    }),
    mastery: stubMastery("unstable", 41),
    cards: [],
    practice: [
      { id: 1, title: "Koko Eating Bananas", url: "https://example.test/koko", difficulty: "medium", tier: "core", status: "solved" },
      { id: 2, title: "Split Array Largest Sum", url: "https://example.test/split", difficulty: "hard", tier: "advanced", status: "not_started" },
    ],
    company_practice: [
      {
        company: { code: "cmp_stub", name: "Stub Corp" },
        problems: [
          { id: 1, title: "Koko Eating Bananas", url: "https://example.test/koko", difficulty: "medium", status: "solved", evidence_count: 4, last_seen_at: "2026-05-01", source_type: "demo" },
        ],
      },
    ],
    relevant_companies: [
      { code: "cmp_stub", name: "Stub Corp", relevance: "high", confidence: "medium", evidence_count: 7, last_seen_at: "2026-05-01", source_type: "demo" },
    ],
  },
  fixed_size_window: {
    code: "fixed_size_window",
    name: "Fixed-Size Window",
    kind: "subpattern",
    description: "",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    families: [{ code: "sliding_window", name: "Sliding Window" }],
    tools: [{ code: "tool_arrays", name: "Arrays" }],
    stats: stubStats(),
    mastery: stubMastery("not_started", 0),
    cards: [],
    practice: [],
    company_practice: [],
    relevant_companies: [],
  },
  two_pointers: {
    code: "two_pointers",
    name: "Two Pointers",
    kind: "subpattern",
    description: "Два указателя сужают область поиска без вложенного перебора.",
    taxonomy_version: "realgo-v2",
    techniques: [],
    recognition_symptoms: [],
    checklist: [],
    example_problems: [],
    families: [{ code: "arrays_hashing", name: "Arrays & Hashing" }],
    tools: [{ code: "tool_arrays", name: "Arrays" }],
    material: {
      what_it_is: "Стаб: два указателя движутся по общей структуре данных.",
      mental_model: "Стаб: после каждого шага пространство поиска уменьшается.",
      recognition_cues: ["Отсортированный массив", "Поиск пары"],
      anti_cues: ["Нужны все комбинации"],
      core_invariant: "Ответ остаётся между левым и правым указателями.",
      canonical_skeleton: "while left < right: ...",
      mini_example: "Сумма меньше цели — сдвигаем левый указатель.",
      common_mistakes: ["Не обновить указатель на равных значениях"],
      dont_confuse_with: [],
    },
    stats: stubStats({ problem_count: 8, solved_count: 1 }),
    mastery: stubMastery("learning", 40),
    cards: [],
    practice: [],
    company_practice: [],
    relevant_companies: [],
  },
};

// ---- Dashboard / roadmap / extension fixtures -----------------------------
const dayKey = (agoDays) => {
  const d = new Date();
  d.setDate(d.getDate() - agoDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DASHBOARD = {
  nextAction: {
    type: "problem_review",
    title: "2 повторения на сегодня",
    description: "Binary Search · medium",
    href: "/queue",
    dueAt: NOW_ISO,
  },
  stats: [
    { key: "today_queue", label: "today queue", value: 2, displayValue: "2", hint: "1 задач, 1 карточек, 0 паттернов", tone: "accent" },
    { key: "solved_total", label: "solved", value: 12, displayValue: "12", hint: "решено задач всего", tone: "default" },
    { key: "streak", label: "streak", value: 4, displayValue: "4", hint: "дней подряд активности", tone: "accent" },
    { key: "readiness", label: "readiness", value: 61, displayValue: "61%", hint: "оценка готовности", tone: "warning" },
    { key: "roadmap_progress", label: "roadmap progress", value: 67, displayValue: "67%", hint: "план подготовки · Google", tone: "accent", href: "/roadmap" },
  ],
  reviewPreview: [
    {
      id: "501",
      type: "problem_review",
      title: "Stub Problem: Koko Eating Bananas",
      meta: "Binary Search · medium",
      dueAt: OVERDUE_ISO,
      lastRating: "hard",
    },
  ],
  weakPatterns: [
    { id: "pat_binary_search", name: "Binary Search", confidence: 40, signal: "3 hard из 4 повторений" },
  ],
  activity: {
    days: [
      { date: dayKey(3), count: 2 },
      { date: dayKey(1), count: 5 },
      { date: dayKey(0), count: 3 },
    ],
    activeDays: 3,
    totalReviews: 10,
  },
};

const ROADMAP = {
  planKey: "cmp_google",
  overallProgress: 67,
  target: { company: { code: "cmp_google", name: "Google" }, interviewDate: "2026-09-01", topics: ["arrays_hashing", "two_pointers"] },
  priorityMode: "balanced",
  availableModes: ["balanced", "easy_first", "company_frequency", "knowledge_gaps"],
  algorithmVersion: 1,
  source: "company",
  horizonWeeks: 2,
  weeklyCapacity: 3,
  selectedCount: 3,
  reserveCount: 1,
  configured: true,
  generatedAt: NOW_ISO,
  nextAction: {
    stage: "theory",
    title: "Изучить Two Pointers",
    description: "Two Pointers · этап 1 из 3 · теория",
    href: "/patterns/two_pointers?from=roadmap",
    patternCode: "two_pointers",
    weekId: "week_02",
  },
  weeks: [
    {
      id: "week_01",
      label: "week 01",
      title: "Arrays & Hashing",
      progress: 100,
      focus: "solve pattern problems and reviews",
      status: "done",
      topics: ["arrays_hashing"],
      items: [{
        code: "arrays_hashing",
        name: "Arrays & Hashing",
        relevantProblemCount: 12,
        difficultyCounts: { easy: 4, medium: 8 },
        masteryPercent: 100,
        planProgress: 100,
        stage: "complete",
        theory: { completed: true, completedAt: PAST_ISO },
        tasks: [
          { id: 701, title: "Two Sum", url: "https://leetcode.com/problems/two-sum/", difficulty: "easy", tier: "foundational", status: "solved", lastRating: "easy", nextReviewAt: FUTURE_ISO, reviewCount: 1 },
        ],
        cardProgress: { total: 3, reviewed: 3, due: 0, reinforcement: 0, nextReviewAt: FUTURE_ISO },
        reinforcement: { count: 0, due: 0, nextReviewAt: FUTURE_ISO },
      }],
    },
    {
      id: "week_02",
      label: "week 02",
      title: "Two Pointers",
      progress: 33,
      focus: "solve pattern problems and reviews",
      status: "active",
      topics: ["two_pointers", "fixed_size_window"],
      items: [
        {
          code: "two_pointers",
          name: "Two Pointers",
          relevantProblemCount: 8,
          difficultyCounts: { easy: 2, medium: 6 },
          masteryPercent: 40,
          planProgress: 33,
          stage: "theory",
          theory: { completed: false },
          tasks: [
            { id: 702, title: "Valid Palindrome", url: "https://leetcode.com/problems/valid-palindrome/", difficulty: "easy", tier: "foundational", status: "solved", reviewCount: 0 },
            { id: 703, title: "Two Sum II", url: "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/", difficulty: "medium", tier: "core", status: "not_started", reviewCount: 0 },
          ],
          cardProgress: { total: 3, reviewed: 1, due: 0, reinforcement: 1, nextReviewAt: FUTURE_ISO },
          reinforcement: { count: 1, due: 0, nextReviewAt: FUTURE_ISO },
        },
        {
          code: "fixed_size_window",
          name: "Fixed-Size Window",
          relevantProblemCount: 5,
          difficultyCounts: { easy: 1, medium: 4 },
          masteryPercent: 0,
          planProgress: 0,
          stage: "theory",
          theory: { completed: false },
          tasks: [
            { id: 704, title: "Maximum Average Subarray I", url: "https://leetcode.com/problems/maximum-average-subarray-i/", difficulty: "easy", tier: "foundational", status: "not_started", reviewCount: 0 },
          ],
          cardProgress: { total: 3, reviewed: 0, due: 0, reinforcement: 0 },
          reinforcement: { count: 0, due: 0 },
        },
      ],
    },
  ],
  patterns: [],
};

let roadmapTheoryCompleted = false;
let activeRoadmapPlan = "cmp_google";
const roadmapTaskAttempts = new Map();
const roadmapTaskAccess = new Map();

const COMPANY_CATALOG = [
  { id: "cmp_google", name: "Google", source: "manual" },
  { id: "cmp_meta", name: "Meta", source: "manual" },
  { id: "cmp_yandex", name: "Yandex", source: "manual" },
  { id: "cmp_microsoft", name: "Microsoft", source: "manual" },
];

function roadmapPayload() {
  const payload = structuredClone(ROADMAP);
  if (activeRoadmapPlan === "cmp_meta") {
    payload.planKey = "cmp_meta";
    payload.target.company = { code: "cmp_meta", name: "Meta" };
  }
  for (const week of payload.weeks) {
    for (const item of week.items) {
      for (const task of item.tasks) {
        const access = roadmapTaskAccess.get(task.id);
        if (access?.action === "skip") {
          task.status = "unavailable";
          task.accessStatus = "unavailable";
          continue;
        }
        if (access?.action === "replace") {
          task.originalId = task.id;
          task.id = access.replacementProblemId;
          task.title = "3Sum";
          task.url = "https://leetcode.com/problems/3sum/";
          task.accessStatus = "replaced";
        }
        const outcome = roadmapTaskAttempts.get(task.id);
        if (!outcome) continue;
        task.status = outcome === "not_solved" ? "in_progress" : "reviewing";
        if (outcome !== "not_solved") {
          task.lastRating = outcome;
          task.reviewCount += 1;
          task.nextReviewAt = FUTURE_ISO;
        }
      }
    }
  }
  if (!roadmapTheoryCompleted) return payload;
  const item = payload.weeks[1].items[0];
  item.theory = { completed: true, completedAt: new Date().toISOString() };
  item.stage = "tasks";
  item.planProgress = 50;
  payload.weeks[1].progress = 50;
  payload.overallProgress = 75;
  payload.nextAction = {
    stage: "tasks",
    title: "Two Sum II",
    description: "Two Pointers · этап 2 из 3 · задача",
    href: "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/",
    patternCode: "two_pointers",
    weekId: "week_02",
  };
  if (roadmapTaskAttempts.has(703) && roadmapTaskAttempts.get(703) !== "not_solved") {
    item.stage = "cards";
    item.planProgress = 67;
    payload.nextAction = {
      stage: "cards",
      title: "Вопросы по Two Pointers",
      description: "Two Pointers · этап 3 из 3 · карточки",
      href: "/patterns/two_pointers/session",
      patternCode: "two_pointers",
      weekId: "week_02",
    };
  }
  return payload;
}

const EXTENSION_STATUS = {
  connected: true,
  platforms: [{ source: "leetcode", status: "connected", lastSyncAt: PAST_ISO }],
  recentEvents: [
    {
      id: "evt-1",
      source: "leetcode",
      event: "problem_solved",
      title: "Stub Problem: Koko Eating Bananas",
      occurredAt: NOW_ISO,
    },
    {
      id: "evt-2",
      source: "leetcode",
      event: "problem_viewed",
      title: "Two Sum",
      occurredAt: PAST_ISO,
    },
  ],
};

const server = createServer((req, res) => {
  // The web app hits this cross-origin (page :3000 -> api :8080) with a JSON
  // content-type, so the browser sends a preflight. No credentials are used
  // (Bearer header, not cookies), so a wildcard origin is safe and simplest.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");

  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (path === "/healthz") {
    ok(res, { status: "ok" });
    return;
  }

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body = {};
    try {
      const contentType = req.headers["content-type"] ?? "";
      body = raw && contentType.includes("multipart/form-data")
        ? parseMultipartReport(raw, contentType)
        : raw
          ? JSON.parse(raw)
          : {};
    } catch {
      /* leave body empty */
    }

    if (req.method === "POST" && (path === `${PREFIX}/auth/login` || path === `${PREFIX}/auth/register`)) {
      return ok(res, { user: USER, tokens: tokens("LIVE") });
    }

    if (req.method === "GET" && path === `${PREFIX}/users/me`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const kind = kindOf(bearer);
      if (kind === "LIVE") return ok(res, { user: USER });
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      return fail(res, 401, "unauthorized", "stub: session invalid");
    }

    if (req.method === "PATCH" && path === `${PREFIX}/me/profile`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, {
        user: {
          ...USER,
          interview_date: Object.hasOwn(body, "interview_date")
            ? body.interview_date
            : USER.interview_date,
          profile: { ...USER.profile, ...body },
        },
      });
    }

    if (req.method === "PATCH" && path === `${PREFIX}/me/notification-settings`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, {
        user: {
          ...USER,
          notification_settings: { ...USER.notification_settings, ...body },
        },
      });
    }

    if (req.method === "POST" && path === `${PREFIX}/auth/refresh`) {
      const kind = kindOf(body.refresh_token);
      if (kind === "LIVE") return ok(res, { tokens: tokens("LIVE") });
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      return fail(res, 401, "invalid_refresh", "stub: refresh rejected");
    }

    if (req.method === "POST" && path === `${PREFIX}/auth/logout`) {
      return ok(res, { status: "ok" });
    }

    if (req.method === "POST" && path === `${PREFIX}/me/problem-reports`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if ((req.headers["content-type"] ?? "").includes("multipart/form-data") && !raw.includes('name="attachment"; filename=')) {
        return fail(res, 400, "validation_error", "stub: missing attachment");
      }
      if (body.schemaVersion !== 2 || typeof body.description !== "string") {
        return fail(res, 400, "validation_error", "stub: invalid report");
      }
      if (body.description === "Не загружается сессия повторения") {
        return fail(res, 503, "unavailable", "stub: report storage unavailable");
      }
      return send(res, 201, {
        data: {
          reportId: "12b3b7f9-7b92-4ea6-b745-7ae9c0199a92",
          fingerprint: "a".repeat(64),
          receivedAt: "2026-08-14T00:00:00Z",
        },
      });
    }

    // ---- Dashboard / roadmap / extension fixtures ----------------------
    if (req.method === "GET" && path === `${PREFIX}/me/dashboard`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, DASHBOARD);
    }

    if (req.method === "GET" && path === `${PREFIX}/me/roadmap`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, roadmapPayload());
    }

    if (req.method === "GET" && path === `${PREFIX}/me/roadmaps`) {
      return ok(res, [
        { planKey: "cmp_google", company: { code: "cmp_google", name: "Google" }, interviewDate: "2026-09-01", priorityMode: "balanced", active: activeRoadmapPlan === "cmp_google" },
        { planKey: "cmp_meta", company: { code: "cmp_meta", name: "Meta" }, interviewDate: "2026-09-01", priorityMode: "balanced", active: activeRoadmapPlan === "cmp_meta" },
      ]);
    }

    const activateMatch = path.match(/^\/api\/v1\/me\/roadmaps\/([^/]+)\/activate$/);
    if (req.method === "PUT" && activateMatch) {
      activeRoadmapPlan = decodeURIComponent(activateMatch[1]);
      return ok(res, roadmapPayload());
    }

    if (req.method === "POST" && path === `${PREFIX}/me/roadmap/preview`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, { ...roadmapPayload(), priorityMode: body.priorityMode ?? "balanced", configured: false });
    }

    if (req.method === "PUT" && path === `${PREFIX}/me/roadmap`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      activeRoadmapPlan = body.companyCode || `custom:${String(body.companyName || "core").toLowerCase()}`;
      const payload = roadmapPayload();
      return ok(res, {
        ...payload,
        planKey: activeRoadmapPlan,
        target: {
          ...payload.target,
          company: body.companyName ? { code: body.companyCode || null, name: body.companyName } : null,
        },
        priorityMode: body.priorityMode ?? "balanced",
        configured: true,
      });
    }

    if (req.method === "GET" && path === `${PREFIX}/companies`) {
      return ok(res, COMPANY_CATALOG);
    }

    if (req.method === "GET" && path === `${PREFIX}/companies/search`) {
      const query = new URL(req.url, `http://127.0.0.1:${PORT}`).searchParams.get("query")?.toLowerCase() ?? "";
      return ok(res, COMPANY_CATALOG.filter((company) => company.name.toLowerCase().includes(query)));
    }

    if (req.method === "PUT" && path === `${PREFIX}/me/roadmap/patterns/two_pointers/theory`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      roadmapTheoryCompleted = true;
      return ok(res, { code: "two_pointers", completedAt: new Date().toISOString() });
    }

    const roadmapTaskAccessMatch = path.match(/^\/api\/v1\/me\/roadmap\/tasks\/(\d+)\/access$/);
    if (req.method === "POST" && roadmapTaskAccessMatch) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      const problemId = Number(roadmapTaskAccessMatch[1]);
      if (body.action !== "replace" && body.action !== "skip") {
        return fail(res, 400, "validation_error", "stub: invalid action");
      }
      const replacementProblemId = body.action === "replace" ? 1703 : undefined;
      roadmapTaskAccess.set(problemId, { action: body.action, replacementProblemId });
      return ok(res, { action: body.action, originalProblemId: problemId, replacementProblemId });
    }

    const roadmapAttemptMatch = path.match(/^\/api\/v1\/me\/reviews\/problems\/(\d+)\/attempt$/);
    if (req.method === "POST" && roadmapAttemptMatch) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      const problemId = Number(roadmapAttemptMatch[1]);
      roadmapTaskAttempts.set(problemId, body.outcome);
      return ok(res, {
        problemId,
        outcome: body.outcome,
        status: body.outcome === "not_solved" ? "in_progress" : "reviewing",
      });
    }

    if (req.method === "DELETE" && path === `${PREFIX}/me/roadmap`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && path === `${PREFIX}/me/extension/status`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, EXTENSION_STATUS);
    }

    // ---- Review hub fixtures (/reviews, /problems, /cards deck) --------
    if (req.method === "GET" && path === `${PREFIX}/me/reviews/queue`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return send(res, 200, { data: REVIEW_QUEUE, meta: { nextCursor: null } });
    }

    if (req.method === "POST" && /^\/api\/v1\/me\/reviews\/\d+\/rate$/.test(path)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if (!["hard", "normal", "easy"].includes(body.rating)) {
        return fail(res, 400, "validation_error", "stub: bad rating");
      }
      const reviewId = Number(path.split("/").at(-2));
      return ok(res, {
        reviewId,
        rating: body.rating,
        nextReviewAt: FUTURE_ISO,
        status: "completed",
      });
    }

    if (req.method === "GET" && path === `${PREFIX}/me/problems`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return send(res, 200, { data: PROBLEMS, meta: { nextCursor: null } });
    }

    if (req.method === "GET" && path === `${PREFIX}/me/cards`) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return send(res, 200, { data: DECK_CARDS, meta: { nextCursor: null } });
    }

    // ---- Practice set fixtures (/problems, /cards launcher) ------------
    if (path === `${PREFIX}/me/practice` && req.method === "GET") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, { subpatterns: PRACTICE });
    }

    if (path === `${PREFIX}/me/practice/subpatterns` && req.method === "POST") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if (!body.code) return fail(res, 400, "validation_error", "stub: code required");
      if (!PRACTICE.some((item) => item.code === body.code)) {
        PRACTICE.push({ code: body.code, name: body.code, addedAt: new Date().toISOString() });
      }
      return ok(res, { code: body.code, active: true });
    }

    if (req.method === "DELETE" && path.startsWith(`${PREFIX}/me/practice/subpatterns/`)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      const code = decodeURIComponent(path.split("/").at(-1));
      PRACTICE = PRACTICE.filter((item) => item.code !== code);
      res.writeHead(204);
      res.end();
      return;
    }

    // ---- Card session fixtures (e2e for /cards/session) ----------------
    if (path === `${PREFIX}/me/cards/due-summary` && req.method === "GET") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, DUE_CARDS_SUMMARY);
    }

    if (path === `${PREFIX}/me/cards/session` && req.method === "GET") {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const kind = kindOf(bearer);
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      if (kind !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      return ok(res, CARD_SESSION);
    }

    if (req.method === "POST" && /^\/api\/v1\/me\/cards\/\d+\/rate$/.test(path)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      if (kindOf(bearer) !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");
      if (body.sessionId !== CARD_SESSION.sessionId) {
        return fail(res, 400, "validation_error", "stub: unknown sessionId");
      }
      if (!["hard", "normal", "easy"].includes(body.rating)) {
        return fail(res, 400, "validation_error", "stub: bad rating");
      }
      const cardId = Number(path.split("/").at(-2));
      return ok(res, {
        cardId,
        rating: body.rating,
        nextReviewAt: "2026-07-12T00:00:00Z",
        repeatInCurrentSession: body.rating === "hard",
        sessionProgress: { reviewed: 1, total: CARD_SESSION.cards.length, remaining: 1 },
      });
    }

    // ---- Pattern Atlas fixtures (e2e for /patterns) --------------------
    if (req.method === "GET" && path.startsWith(`${PREFIX}/me/patterns/atlas`)) {
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
      const kind = kindOf(bearer);
      if (kind === "FLAKY") return fail(res, 500, "server_error", "stub transient failure");
      if (kind !== "LIVE") return fail(res, 401, "unauthorized", "stub: session invalid");

      if (path === `${PREFIX}/me/patterns/atlas/companies`) {
        return ok(res, { companies: ATLAS_COMPANIES });
      }
      if (path === `${PREFIX}/me/patterns/atlas`) {
        const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
        const company = url.searchParams.get("company");
        if (company && company !== "cmp_stub") {
          return fail(res, 404, "not_found", "stub: unknown company");
        }
        return ok(res, atlasPayload(Boolean(company)));
      }
      const code = path.slice(`${PREFIX}/me/patterns/atlas/`.length);
      const node = ATLAS_NODES[code];
      if (!node) return fail(res, 404, "not_found", "stub: unknown atlas node");
      return ok(res, node);
    }

    return fail(res, 404, "not_found", `stub: no route ${req.method} ${path}`);
  });
});

// No host arg: bind to the unspecified address (dual-stack) so both
// 127.0.0.1 and ::1/localhost reach the stub, regardless of how the client
// resolves "localhost".
server.listen(PORT, () => {
  console.log(`[auth-stub] listening on :${PORT}`);
});

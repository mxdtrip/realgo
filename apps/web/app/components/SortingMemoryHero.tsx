"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../_api/AuthProvider";
import { ApiError } from "../_api/types";
import { ReportProblemLauncher, openReportProblemDialog } from "../(cabinet)/ReportProblemDialog";
import { getDictionary, keepShortWords } from "../_content/i18n";
import { AccountUserMenu } from "./AccountUserMenu";

const WORD = "realgo";
const LETTER_COUNT = WORD.length;

// Measure each glyph so its real advance plus one shared gap controls the row.
// The fallback matches the monospace logo stack and is replaced after the font
// finishes loading.
const FALLBACK_WORD_GLYPH_RATIO = 0.62;
let wordGlyphRatios: number[] | null = null;

function measureWordGlyphRatios(): number[] | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("span");
  probe.className = "word-letter";
  probe.style.position = "fixed";
  probe.style.left = "-10000px";
  probe.style.top = "-10000px";
  probe.style.display = "inline-block";
  probe.style.width = "auto";
  probe.style.height = "auto";
  probe.style.fontSize = "1000px";
  probe.style.lineHeight = "1";
  probe.style.transform = "none";
  probe.style.filter = "none";
  probe.style.textShadow = "none";
  probe.style.visibility = "hidden";

  document.body.appendChild(probe);
  const ratios = [...WORD].map((letter) => {
    probe.textContent = letter;
    return probe.getBoundingClientRect().width / 1000;
  });
  probe.remove();
  return ratios.every((ratio) => Number.isFinite(ratio) && ratio > 0) ? ratios : null;
}
// Keep the intro demonstrative without leaving the hero in an apparently empty
// state for several seconds on a fresh load.
const GATHER_MS = 600;
const COMPARE_MS = 55;
const SWAP_MS = 260;
const SWAP_PAUSE_MS = 25;
const DEFAULT_CODE = `def sort(a):
    for i in range(len(a)):
        for j in range(0, len(a) - i - 1):
            if compare(j, j + 1) > 0:
                swap(j, j + 1)`;

type Pose = {
  key: number;
  x: number;
  y: number;
  rotate: number;
  visible: boolean;
};

type MotionMode = "idle" | "gathering" | "swapping";

type SortStep = {
  type: "compare" | "swap";
  a: number;
  b: number;
};

type SortRecording = {
  result: number[];
  steps: SortStep[];
};

type SceneSize = {
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function interactiveWordFontSize(width: number) {
  if (width <= 640) return clamp(width * 0.135, 48, 56);
  if (width <= 920) return clamp(width * 0.09, 56, 74);
  if (width >= 1600) return 88;
  return clamp(width * 0.068, 74, 92);
}

function wordRowLeft(size: SceneSize, total: number) {
  if (size.width <= 920) return (size.width - total) / 2;
  if (size.width >= 1600) {
    const contentWidth = Math.min(1784, size.width - 220);
    return (size.width - contentWidth) / 2;
  }
  if (size.width >= 1200) {
    const contentWidth = Math.min(1248, size.width - 192);
    return (size.width - contentWidth) / 2;
  }
  const contentWidth = Math.min(1120, size.width - 64);
  return (size.width - contentWidth) / 2;
}

function wordRowTop(size: SceneSize) {
  if (size.width <= 640) return 90;
  if (size.width <= 920) return 104;
  if (size.width >= 1600) return 164;
  return clamp(size.height * 0.185, 132, 150);
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function shuffle(order: number[]) {
  const next = [...order];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  if (next.every((item, index) => item === index)) {
    [next[0], next[1]] = [next[1], next[0]];
  }

  return next;
}

function geometry(size: SceneSize) {
  // The interactive word is the hero wordmark itself. Its layout is calculated
  // directly in viewport coordinates so CSS transforms cannot produce a second,
  // differently-sized logo elsewhere in the scene.
  const font = Math.round(interactiveWordFontSize(size.width));
  const gap = Math.round(clamp(size.width * 0.003, 2, 5));
  const ratios = wordGlyphRatios ?? Array.from({ length: LETTER_COUNT }, () => FALLBACK_WORD_GLYPH_RATIO);
  const widths = ratios.map((ratio) => ratio * font);
  const total = widths.reduce((sum, w) => sum + w, 0) + (LETTER_COUNT - 1) * gap;

  return {
    font,
    gap,
    widths,
    total,
    startX: wordRowLeft(size, total),
    y: wordRowTop(size),
  };
}

function rowPoses(size: SceneSize, order: number[]) {
  const g = geometry(size);
  let x = g.startX;

  // Advance by each glyph's measured width plus one shared gap, so the
  // proportional landing font keeps a consistent visual rhythm.
  return order.map((key) => {
    const pose = { key, x, y: g.y, rotate: 0, visible: true };
    x += g.widths[key] + g.gap;
    return pose;
  });
}

// Scatter the letters onto random points of an invisible oval centred on the
// gathered word itself. The word moved into the left copy column, so using the
// viewport centre here made the letters fly too far into the visual and bunch
// up near the top-right tags. A tighter orbit keeps the interaction attached to
// the word while still giving each letter a distinct path.
const CHAOS_JITTER = 28;

function chaosPoses(size: SceneSize, order: number[]) {
  const g = geometry(size);
  const isPhone = size.width <= 640;
  const centerX = g.startX + g.total / 2;
  const centerY = g.y + g.font * 0.54;
  const radiusX = size.width * (isPhone ? 0.22 : 0.29);
  const radiusY = size.height * (isPhone ? 0.15 : 0.21);
  const edgeInset = isPhone ? 40 : 12;

  return order.map((key, index) => {
    const angle = Math.random() * Math.PI * 2;
    const ex = radiusX * Math.cos(angle);
    const ey = radiusY * Math.sin(angle);
    const radius = Math.hypot(ex, ey) || 1;
    const jitter = (Math.random() * 2 - 1) * (isPhone ? 18 : CHAOS_JITTER);
    const px = centerX + ex + (ex / radius) * jitter;
    const py = centerY + ey + (ey / radius) * jitter;
    const width = g.widths[key];

    return {
      key,
      x: clamp(px - width / 2, edgeInset, size.width - width - edgeInset),
      y: clamp(py - g.font * 0.54, edgeInset, size.height - g.font * 1.08 - edgeInset),
      rotate: -16 + Math.random() * 32 + index * 0.2,
      visible: true,
    };
  });
}

const SORT_WORKER_TIMEOUT_MS = 800;

const SORT_WORKER_SOURCE = `
self.onmessage = (event) => {
  const { code, order } = event.data;
  const arr = [...order];
  const steps = [];
  const maxOps = 600;

  const assertIndex = (value) => {
    if (!Number.isInteger(value) || value < 0 || value >= arr.length) {
      throw new Error("invalid index");
    }
  };

  const compare = (a, b) => {
    assertIndex(a);
    assertIndex(b);
    steps.push({ type: "compare", a, b });
    if (steps.length > maxOps) throw new Error("too many operations");
    return Math.sign(arr[a] - arr[b]);
  };

  const swap = (a, b) => {
    assertIndex(a);
    assertIndex(b);
    steps.push({ type: "swap", a, b });
    if (steps.length > maxOps) throw new Error("too many operations");
    [arr[a], arr[b]] = [arr[b], arr[a]];
  };

  // The visible editor uses a small, deliberately constrained Python dialect.
  // Translating only the constructs needed by the educational bubble-sort
  // example keeps execution in the same isolated worker without pretending
  // that arbitrary Python can run in a browser with no Python runtime.
  const pythonToJavaScript = (source) => {
    const output = [];
    const blocks = [];
    const normalizeExpression = (expression) => expression
      .replace(/\\blen\\(([^()]*)\\)/g, "$1.length")
      .replace(/\\band\\b/g, "&&")
      .replace(/\\bor\\b/g, "||")
      .replace(/\\bnot\\b/g, "!");
    const closeBlocks = (indent) => {
      while (blocks.length && indent < blocks[blocks.length - 1]) {
        output.push("}");
        blocks.pop();
      }
    };

    source.split("\\n").forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const indent = (line.match(/^\\s*/) || [""])[0].length;
      closeBlocks(indent);

      const definition = trimmed.match(/^def\\s+(sort|bubble_sort)\\s*\\(\\s*a\\s*\\)\\s*:\\s*$/);
      if (definition) {
        output.push("function " + (definition[1] === "bubble_sort" ? "bubbleSort" : "sort") + "(a) {");
        blocks.push(indent);
        return;
      }

      const loop = trimmed.match(/^for\\s+([A-Za-z_]\\w*)\\s+in\\s+range\\((.*)\\)\\s*:\\s*$/);
      if (loop) {
        const rangeArguments = loop[2].split(",").map((part) => normalizeExpression(part.trim()));
        if (rangeArguments.length === 1) {
          output.push("for (let " + loop[1] + " = 0; " + loop[1] + " < " + rangeArguments[0] + "; " + loop[1] + " += 1) {");
        } else if (rangeArguments.length === 2) {
          output.push("for (let " + loop[1] + " = " + rangeArguments[0] + "; " + loop[1] + " < " + rangeArguments[1] + "; " + loop[1] + " += 1) {");
        } else {
          throw new Error("unsupported range");
        }
        blocks.push(indent);
        return;
      }

      const condition = trimmed.match(/^if\\s+(.+)\\s*:\\s*$/);
      if (condition) {
        output.push("if (" + normalizeExpression(condition[1]) + ") {");
        blocks.push(indent);
        return;
      }

      if (trimmed === "else:") {
        output.push("} else {");
        return;
      }

      if (/^(compare|swap)\\s*\\(/.test(trimmed)) {
        output.push(trimmed + ";");
        return;
      }

      if (/^return\\s+/.test(trimmed)) {
        output.push(trimmed + ";");
        return;
      }

      throw new Error("unsupported Python syntax");
    });

    while (blocks.length) {
      output.push("}");
      blocks.pop();
    }
    return output.join("\\n");
  };

  try {
    const executableCode = /\\bdef\\s+/.test(code) ? pythonToJavaScript(code) : code;
    const factory = new Function(
      "compare",
      "swap",
      '"use strict";\\n' +
        'const window = undefined; const document = undefined; const localStorage = undefined; const sessionStorage = undefined; const fetch = undefined; const importScripts = undefined;\\n' +
        executableCode +
        '\\nreturn typeof bubbleSort === "function" ? bubbleSort : typeof sort === "function" ? sort : null;'
    );
    const sort = factory(compare, swap);
    if (typeof sort !== "function") throw new Error("missing sort function");
    sort(arr);
    self.postMessage({ result: arr, steps });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
`;

function recordSort(code: string, order: number[]): Promise<SortRecording> {
  if (typeof Worker === "undefined" || typeof Blob === "undefined") {
    return Promise.reject(new Error("worker unavailable"));
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([SORT_WORKER_SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      URL.revokeObjectURL(url);
    };
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("sort timed out"));
    }, SORT_WORKER_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<SortRecording | { error: string }>) => {
      cleanup();
      if ("error" in event.data) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(event.data);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("sort worker failed"));
    };
    worker.postMessage({ code, order });
  });
}

export function SortingMemoryHero() {
  const dictionary = getDictionary();
  const copy = dictionary.marketing.hero;
  const router = useRouter();
  const auth = useAuth();
  const sceneRef = useRef<HTMLElement | null>(null);
  const runIdRef = useRef(0);
  const [size, setSize] = useState<SceneSize>({ width: 1200, height: 760 });
  const [code, setCode] = useState(DEFAULT_CODE);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  // Keep the auth popup mounted through its exit animation: `authOpen` is the
  // intent, `authRender` keeps the layer in the DOM until the close animation ends.
  const [authRender, setAuthRender] = useState(false);
  const authPanelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (authOpen) setAuthRender(true);
  }, [authOpen]);

  // Same convention as the cabinet's .shell-dialog modals (see
  // PatternAtlasClient's company picker): move focus into the dialog on
  // open instead of leaving it on the trigger, and close on Escape. Without
  // this, Tab from the trigger walked straight into the hero page behind
  // the overlay (e.g. the code editor textarea) instead of the form.
  // Depends on `authRender`, not just `authOpen`: the panel only actually
  // mounts (and the ref attaches) once the effect above flips authRender to
  // true on the render *after* authOpen does — focusing on authOpen alone
  // would run while authPanelRef.current is still null.
  useEffect(() => {
    if (!authOpen || !authRender) return;
    authPanelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAuthOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [authOpen, authRender]);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);
  // Deterministic first-frame values are intentional. The old empty array
  // meant that no letters existed in the server HTML until ResizeObserver ran;
  // a slow hydration or a dev-server hiccup therefore produced a blank hero.
  // We replace this row with the measured/scattered scene on the first client
  // measurement below.
  const initialOrder = [0, 1, 2, 3, 4, 5];
  const [order, setOrder] = useState(initialOrder);
  const [poses, setPoses] = useState<Pose[]>(() => rowPoses({ width: 1200, height: 760 }, initialOrder));
  const [activeKeys, setActiveKeys] = useState<number[]>([]);
  const [activeLines, setActiveLines] = useState<number[]>([]);
  const [isSorting, setIsSorting] = useState(false);
  const [motionMode, setMotionMode] = useState<MotionMode>("idle");
  // Whether the letters are currently scattered; a click on empty space toggles
  // between scattering and gathering. Starts scattered to match the intro.
  const [scattered, setScattered] = useState(true);
  // Bumped once the real font metrics are measured, to re-lay-out the word.
  const [metricsVersion, setMetricsVersion] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  // Letters are only placed once we know the real scene size, so on first load
  // they appear already scattered at the edges instead of flying out from the
  // default-size centre on screen.
  const [measured, setMeasured] = useState(false);
  const initialPlacementRef = useRef(false);
  // Set when the editor code fails to compile, to show a notice to the user.
  const [codeError, setCodeError] = useState(false);
  const codeLinesRef = useRef<HTMLPreElement | null>(null);

  // Intro: letters start scattered, then auto-gather after a short beat.
  const introRef = useRef(true);
  const introTimerRef = useRef<number | null>(null);
  const sortRef = useRef<() => void>(() => {});

  // Respect prefers-reduced-motion: when active, skip the scatter/sort
  // animation and place letters directly in a gathered row.
  const prefersReducedMotionRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mq.matches;
    const onChange = () => {
      prefersReducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // metricsVersion is a dependency so the layout recomputes when glyph widths
  // are refined from the loaded font, even though geometry reads them globally.
  const g = useMemo(() => geometry(size), [size, metricsVersion]);

  const setChaos = useCallback(() => {
    if (isSorting) return;
    const next = prefersReducedMotionRef.current ? order : shuffle(order);
    runIdRef.current += 1;
    setOrder(next);
    setActiveKeys([]);
    setActiveLines([]);
    setMotionMode("gathering");
    setPoses(prefersReducedMotionRef.current ? rowPoses(size, next) : chaosPoses(size, next));
    setScattered(true);
  }, [isSorting, order, size]);

  const sort = useCallback(async () => {
    if (isSorting) return;

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setIsSorting(true);

    let recording: SortRecording;

    try {
      recording = await recordSort(code, order);
    } catch (error) {
      console.error(error);
      setCodeError(true);
      setIsSorting(false);
      return;
    }
    setCodeError(false);

    // Under prefers-reduced-motion, skip the step-by-step animation and place
    // the sorted word in a gathered row directly.
    if (prefersReducedMotionRef.current) {
      setPoses(rowPoses(size, recording.result));
      setOrder(recording.result);
      setIsSorting(false);
      setMotionMode("idle");
      setScattered(false);
      setActiveKeys([]);
      setActiveLines([]);
      return;
    }

    // Which source line each kind of step maps to, so we can light it up while
    // the step plays. Found by keyword, so it survives the user editing the code.
    const codeLines = code.split("\n");
    const lineWith = (needle: string) => codeLines.findIndex((line) => line.includes(needle));
    const compareLine = lineWith("compare(");
    const swapLine = lineWith("swap(");

    let slotOrder = [...order];
    setMotionMode("gathering");
    setActiveLines([]);
    setPoses(rowPoses(size, slotOrder));

    await sleep(GATHER_MS);
    if (runIdRef.current !== runId) return;
    setMotionMode("swapping");

    for (const step of recording.steps) {
      if (runIdRef.current !== runId) return;

      const keyA = slotOrder[step.a];
      const keyB = slotOrder[step.b];
      setActiveKeys([keyA, keyB]);
      const stepLine = step.type === "compare" ? compareLine : swapLine;
      setActiveLines(stepLine >= 0 ? [stepLine] : []);

      if (step.type === "compare") {
        await sleep(COMPARE_MS);
        setActiveKeys([]);
        continue;
      }

      const currentRow = rowPoses(size, slotOrder);
      const poseA = currentRow.find((pose) => pose.key === keyA);
      const poseB = currentRow.find((pose) => pose.key === keyB);

      if (poseA && poseB) {
        const nextSlotOrder = [...slotOrder];
        [nextSlotOrder[step.a], nextSlotOrder[step.b]] = [nextSlotOrder[step.b], nextSlotOrder[step.a]];
        const targetRow = rowPoses(size, nextSlotOrder);

        setPoses((current) =>
          current.map((pose) => {
            const target = targetRow.find((rowPose) => rowPose.key === pose.key);
            if (pose.key === keyA && target) return target;
            if (pose.key === keyB && target) return target;
            return pose;
          }),
        );

        await sleep(SWAP_MS);
        slotOrder = nextSlotOrder;
        await sleep(SWAP_PAUSE_MS);
      }

      setActiveKeys([]);
    }

    if (runIdRef.current !== runId) return;

    setActiveKeys([]);
    setActiveLines([]);
    setOrder(recording.result);
    setIsSorting(false);
    setMotionMode("idle");
    setScattered(false);
  }, [code, isSorting, order, size]);

  useEffect(() => {
    sortRef.current = () => {
      void sort();
    };
  }, [sort]);

  const cancelIntro = useCallback(() => {
    introRef.current = false;
    if (introTimerRef.current !== null) {
      window.clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
  }, []);

  // A click on empty space toggles the scene: scatter the letters, then gather
  // (and sort) them on the next click. Clicks on real controls are ignored.
  const handleSceneClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (isSorting) return;
      if (
        (event.target as HTMLElement).closest(
          "a, button, input, textarea, .code-editor, .site-strip, .auth-layer",
        )
      ) {
        return;
      }
      cancelIntro();
      if (scattered) {
        void sort();
      } else {
        setChaos();
      }
    },
    [cancelIntro, isSorting, scattered, setChaos, sort],
  );

  const handleAuthSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (authPending) return;
      setAuthPending(true);
      setAuthError("");
      try {
        if (authMode === "signup") {
          const authUser = await auth.register(authEmail.trim(), authPassword);
          router.push(authUser.onboarding_completed ? "/dashboard" : "/onboarding/profile");
        } else {
          const authUser = await auth.login(authEmail.trim(), authPassword);
          router.push(authUser.onboarding_completed ? "/dashboard" : "/onboarding/profile");
        }
        // Keep the button disabled while the redirect happens; the component
        // unmounts on navigation, so there's no need to reset pending here.
      } catch (e) {
        setAuthError(e instanceof ApiError ? e.message : copy.auth.error);
        setAuthPending(false);
      }
    },
    [auth, authEmail, authMode, authPassword, authPending, copy.auth.error, router],
  );

  useEffect(() => {
    const element = sceneRef.current;
    if (!element) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
      setMeasured(true);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // The letters are already present in the server-rendered row. Once the
    // actual scene size is known, move them to the intended intro state and
    // randomise the order on the client (never during SSR, which would make
    // hydration nondeterministic).
    if (!measured || initialPlacementRef.current || isSorting) return;
    initialPlacementRef.current = true;
    const next = prefersReducedMotionRef.current ? order : shuffle(order);
    setOrder(next);
    setPoses(
      prefersReducedMotionRef.current ? rowPoses(size, next) : chaosPoses(size, next),
    );
    setScattered(!prefersReducedMotionRef.current);
    setSceneReady(true);
  }, [measured, isSorting, order, size]);

  useEffect(() => {
    // Re-scatter onto the oval for the new viewport while the word is apart;
    // the gathered word is recentred by the effect below.
    if (poses.length === 0) return;
    if (isSorting) {
      // Resize during a sort: the running sort closure captured the pre-resize
      // size, so its rowPoses() calls produce stale coordinates. Cancel the
      // stale run and re-snapshot to the new viewport. The word is always in a
      // gathered row during a sort, never scattered.
      runIdRef.current += 1;
      setIsSorting(false);
      setMotionMode("idle");
      setActiveKeys([]);
      setActiveLines([]);
      setPoses(rowPoses(size, order));
      return;
    }
    if (!introRef.current && !scattered) return;
    setPoses(prefersReducedMotionRef.current ? rowPoses(size, order) : chaosPoses(size, order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // Measure every glyph once the font is loaded, then bump the version so the
  // gathered word re-lays out with consistent proportional-font spacing.
  useEffect(() => {
    const apply = () => {
      const ratios = measureWordGlyphRatios();
      if (ratios) {
        wordGlyphRatios = ratios;
        setMetricsVersion((value) => value + 1);
      }
    };
    apply();
    if (document.fonts?.ready) {
      void document.fonts.ready.then(apply);
    }
  }, []);

  useEffect(() => {
    // Keep the gathered word centred for the current viewport and metrics. Also
    // re-runs when sorting ends, fixing a left shift when the word was first
    // placed before the real (wider) viewport size had been measured.
    if (isSorting || poses.length === 0 || introRef.current || scattered) return;
    setPoses(rowPoses(size, order));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricsVersion, isSorting, size.width, size.height]);

  // Intro auto-gather: as soon as the REAL scene size is measured, gather the
  // scattered word immediately (no hold). Gating on `measured` is essential —
  // firing before the ResizeObserver reports the size lays the letters out with
  // the default 1200×760 centre, which sits up-left of the true centre, so the
  // word would scatter/gather off to the corner (notably on soft navigation
  // back to "/" via the brand link, where the component remounts size-less).
  //
  // Double rAF, not setTimeout(0): we must let the scattered chaos poses PAINT
  // for one frame before starting the gather, otherwise the transform
  // transition has no wide "from" position and the letters just appear in a
  // tight shuffled row instead of flying in from the edges.
  useEffect(() => {
    if (!measured || !introRef.current) return;
    // Under reduced motion the word is already placed in a gathered row by the
    // initial placement effect — skip the auto-sort entirely.
    if (prefersReducedMotionRef.current) {
      introRef.current = false;
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        introRef.current = false;
        sortRef.current();
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [measured]);

  const heroTitle = keepShortWords(copy.title);
  const heroTitleAccent = keepShortWords(copy.titleAccent);
  const heroTitleAccentStart = heroTitle.indexOf(heroTitleAccent);

  return (
    <main
      className="minimal-scene"
      data-scene-ready={sceneReady ? "true" : "false"}
      data-code-language="python"
      data-sort-state={codeError ? "error" : isSorting ? "sorting" : scattered ? "scattered" : "sorted"}
      ref={sceneRef}
      onClick={handleSceneClick}
    >
      <header className="site-strip">
        <a className="site-brand" href="/" aria-label={copy.homeAria}>
          {dictionary.common.brand}
        </a>
        <nav className="site-nav" aria-label={copy.navAria}>
          {copy.nav.map((item) => (
            <a href={`#${item.href}`} key={item.href}>
              {keepShortWords(item.label)}
            </a>
          ))}
        </nav>
        <div className={auth.status === "authenticated" && auth.user ? "site-auth site-auth--authenticated" : "site-auth"}>
          {auth.status === "authenticated" && auth.user ? (
            <>
              <AccountUserMenu
                className="site-user-panel"
                copy={dictionary.cabinet.layout.account}
                onReport={openReportProblemDialog}
              />
              <a className="site-auth__dashboard" href="/dashboard">
                {keepShortWords(copy.auth.dashboard)}
              </a>
              <ReportProblemLauncher copy={dictionary.cabinet.shell.report} showTrigger={false} />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthOpen(true);
                }}
              >
                {keepShortWords(copy.auth.login)}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setAuthOpen(true);
                }}
              >
                {keepShortWords(copy.auth.signup)}
              </button>
            </>
          )}
        </div>
      </header>

      <section className="hero-reference-layout" aria-labelledby="landing-hero-title">
        <div className="hero-reference-copy">
          <h1 className="hero-title" id="landing-hero-title">
            {heroTitleAccentStart >= 0 ? (
              <>
                {heroTitle.slice(0, heroTitleAccentStart)}
                <span className="hero-title__accent">{heroTitleAccent}</span>
                {heroTitle.slice(heroTitleAccentStart + heroTitleAccent.length)}
              </>
            ) : heroTitle}
          </h1>
          <p className="hero-reference-lead">{keepShortWords(copy.lead)}</p>
          <div className="hero-action-row">
            <div className="hero-cta">
              <a href="/register?intent=hero">{keepShortWords(copy.cta)}</a>
            </div>
            <div className="hero-platform-note" aria-label="4 поддерживаемые платформы">
              <div className="hero-platform-dots" aria-hidden="true">
                <span>LC</span>
                <span>HR</span>
                <span>CF</span>
              </div>
              <p>
                <strong>4 платформы</strong>
                <span>единый прогресс</span>
              </p>
            </div>
          </div>
        </div>

        <div className="hero-visual-aura" aria-hidden="true" />
        <div className="hero-visual-tags" aria-hidden="true">
          <span className="hero-visual-tag hero-visual-tag--algorithms">
            <svg viewBox="0 0 20 20"><path d="M7 4 3 10l4 6M14 4l4 6-4 6M12.5 2.5 9 17.5" /></svg>
            Алгоритмы
          </span>
          <span className="hero-visual-tag hero-visual-tag--patterns">
            <svg viewBox="0 0 20 20"><path d="M7 3v3H4v4h3v3h4v-3h3V6h-3V3H7Zm4 10v4H7v-4M14 8h3v4h-3" /></svg>
            Паттерны
          </span>
          <span className="hero-visual-tag hero-visual-tag--reviews">
            <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" /></svg>
            Повторение
          </span>
          <span className="hero-visual-tag hero-visual-tag--result">
            <svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><circle cx="10" cy="10" r="3.5" /><path d="m10 10 6-6M13 4h3v3" /></svg>
            Результат
          </span>
        </div>
      </section>

      <div
        className={codeError ? "code-editor has-error" : "code-editor"}
        data-language="python"
      >
        <span className="code-editor__language" aria-hidden="true">python</span>
        <pre className="code-lines" aria-hidden="true" ref={codeLinesRef}>
          {code.split("\n").map((line, index) => (
            <span
              className={activeLines.includes(index) ? "code-line active" : "code-line"}
              key={index}
            >
              {line.length > 0 ? line : " "}
            </span>
          ))}
        </pre>
        <textarea
          aria-label={copy.sortingCodeAria}
          className="code-sheet"
          spellCheck={false}
          wrap="off"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (codeError) setCodeError(false);
          }}
          onScroll={(event) => {
            // Keep the highlight layer aligned with the textarea when it scrolls.
            const lines = codeLinesRef.current;
            if (lines) {
              lines.scrollTop = event.currentTarget.scrollTop;
              lines.scrollLeft = event.currentTarget.scrollLeft;
            }
          }}
        />
        {codeError ? (
          <p className="code-error" role="alert">
            {keepShortWords(copy.codeError)}
          </p>
        ) : null}
      </div>

      <div className="word-stage" aria-label={copy.wordAria}>
        {/* Render in a FIXED key order (0..5), never in `order`/array sequence.
            Visual position is driven entirely by `transform`, so keeping the DOM
            order stable stops React from reordering nodes when `order` shuffles.
            A moved node loses its transition "before" snapshot and snaps to the
            target instantly — that was the intermittent teleport. */}
        {[...poses]
          .sort((a, b) => a.key - b.key)
          .map((pose) => {
          // The further a letter sits from the scene centre, the more it blurs
          // and fades — so scattered letters dissolve and sharpen as they gather.
          const width = g.widths[pose.key];
          const dx = pose.x + width / 2 - (g.startX + g.total / 2);
          const dy = pose.y + g.font * 0.54 - (g.y + g.font * 0.54);
          // Vertical offset counts double, so letters drifting up/down fade and
          // blur twice as hard as those spreading sideways.
          const distance = Math.hypot(dx, dy * 2);
          const t = clamp((distance - size.width * 0.22) / (size.width * 0.32), 0, 1);
          const blur = t * 13;
          const fade = 1 - t * 0.96;

          return (
            <span
              className={[
                "word-letter",
                activeKeys.includes(pose.key) ? "active" : "",
              ]
                .concat(`motion-${motionMode}`)
                .filter(Boolean)
                .join(" ")}
              key={pose.key}
              style={{
                fontSize: g.font,
                height: g.font * 1.08,
                opacity: pose.visible ? fade : 0,
                filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
                transform: `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotate}deg)`,
                width,
              }}
            >
              {WORD[pose.key]}
            </span>
          );
        })}
      </div>

      {authRender ? (
        <div
          className={`auth-layer ${authOpen ? "is-open" : "is-closing"}`}
          role="presentation"
          onMouseDown={() => setAuthOpen(false)}
          onAnimationEnd={(event) => {
            if (event.animationName === "auth-layer-out") setAuthRender(false);
          }}
        >
          <section
            aria-label={authMode === "login" ? copy.auth.loginAria : copy.auth.signupAria}
            className="auth-panel"
            role="dialog"
            aria-modal="true"
            ref={authPanelRef}
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                {copy.auth.login}
              </button>
              <button
                className={authMode === "signup" ? "active" : ""}
                type="button"
                onClick={() => {
                  setAuthMode("signup");
                  setAuthError("");
                }}
              >
                {copy.auth.signup}
              </button>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              <label>
                {copy.auth.email}
                <input
                  autoComplete="email"
                  placeholder={copy.auth.emailPlaceholder}
                  type="email"
                  required
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  disabled={authPending}
                />
              </label>
              <label>
                {copy.auth.password}
                <input
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  placeholder={copy.auth.passwordPlaceholder}
                  type="password"
                  required
                  minLength={8}
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  disabled={authPending}
                />
              </label>

              {authError ? (
                <p className="auth-form__error" role="alert">
                  {authError}
                </p>
              ) : null}

              <button type="submit" disabled={authPending}>
                {authPending
                  ? copy.auth.pending
                  : authMode === "login"
                    ? copy.auth.continue
                    : copy.auth.createAccount}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}

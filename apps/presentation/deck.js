(() => {
  const stage = document.getElementById("stage");
  const slides = Array.from(document.querySelectorAll(".slide:not([data-pitch-hidden])"))
    .sort((firstSlide, secondSlide) => Number(firstSlide.dataset.order) - Number(secondSlide.dataset.order));
  // Keep immutable logical modes because the first slot becomes the shared
  // physical host and its dataset is updated as the story advances.
  const logicalProductModes = slides.map((slide) => (
    slide.querySelector(".macbook-3d-slot")?.dataset.macbookMode || ""
  ));
  const extensionIntroSlideIndex = logicalProductModes.indexOf("extension-intro");
  const extensionPromptSlideIndex = logicalProductModes.indexOf("extension");
  const productSlideIndices = new Set(slides
    .map((slide, slideIndex) => slide.querySelector(".macbook-3d-slot") ? slideIndex : -1)
    .filter((slideIndex) => slideIndex >= 0));
  const sharedProductSlideIndex = Math.min(...productSlideIndices);
  const visualSlideIndex = (logicalIndex) => (
    productSlideIndices.has(logicalIndex) ? sharedProductSlideIndex : logicalIndex
  );
  const visualSlideAt = (logicalIndex) => slides[visualSlideIndex(logicalIndex)];
  const progressBar = document.querySelector("#progress i");
  const slideCounter = document.getElementById("slideCounter");
  const dots = document.getElementById("dots");
  const timer = document.getElementById("timer");
  const help = document.getElementById("help");
  const priceBackdrop = document.getElementById("priceBackdrop");
  const priceCounter = document.getElementById("priceCounter");
  const priceCounterValue = document.getElementById("priceCounterValue");
  const blackout = document.getElementById("blackout");
  const planetWipe = document.getElementById("planetWipe");
  const planetWipeBody = document.getElementById("planetWipeBody");
  const marketCounter = document.getElementById("marketCounter");
  const marketCounterRow = document.getElementById("marketCounterRow");
  const marketCounterMain = document.getElementById("marketCounterMain");
  const marketCounterDecimal = document.getElementById("marketCounterDecimal");
  const marketCounterPercent = document.getElementById("marketCounterPercent");
  const coverTransition = document.getElementById("coverTransition");
  const coverTransitionVideo = document.getElementById("coverTransitionVideo");
  const coverTransitionForeground = document.getElementById("coverTransitionForeground");
  const coverTransitionWhite = document.getElementById("coverTransitionWhite");
  const roadmapList = document.querySelector(".roadmap-list");
  const roadmapItems = roadmapList ? Array.from(roadmapList.children) : [];
  const roadmapSlide = roadmapList?.closest(".slide") || null;
  const roadmapBuilderSlide = document.querySelector(".slide-roadmap-builder");
  if (roadmapBuilderSlide) roadmapBuilderSlide.dataset.roadmapStage = "0";
  const teamSlide = document.querySelector(".slide-team");
  const teamHandles = Array.from(document.querySelectorAll("[data-team-index]"));
  const teamOrbits = Array.from(document.querySelectorAll(".team-orbit"));
  const teamPlanets = Array.from(document.querySelectorAll(".team-planet"));
  const memberRole = document.getElementById("memberRole");
  const memberNumber = document.getElementById("memberNumber");
  const memberName = document.getElementById("memberName");
  const memberDuty = document.getElementById("memberDuty");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const teamMembers = [
    {
      name: "Mxdtrip",
      duty: "Координация, продукт, AI-интеграция, браузерное расширение и deploy.",
    },
    {
      name: "MixKage",
      duty: "Frontend: интерфейсы кабинета, onboarding и клиентские продуктовые сценарии.",
    },
    {
      name: "MikebangSfilya",
      duty: "Backend и DevOps: API, инфраструктура, надёжность и идемпотентность операций.",
    },
    {
      name: "bryack",
      duty: "Автор идеи, backend и серверная логика продукта.",
    },
    {
      name: "pagister",
      duty: "QA: пользовательские сценарии, интеграционные проверки и валидация релизов.",
    },
    {
      name: "P1xart",
      duty: "Миграции, контракты данных и согласованность состояния между слоями продукта.",
    },
  ];
  const preparationFieldLabels = [
    "Blind 75", "NeetCode", "Top Interview 150", "Cracking the Coding Interview",
    "System Design", "Dynamic Programming", "Binary Search", "Two Pointers",
    "Sliding Window", "Graphs", "Trees", "Heaps", "Backtracking", "Greedy",
    "Recursion", "Intervals", "Linked Lists", "Stacks", "Queues", "Hash Maps",
    "SQL", "Concurrency", "OOP", "Behavioral", "Mock Session", "Cheat Sheet",
    "Discord", "Reddit", "Medium", "Подкасты", "Ментор", "Bootcamp",
    "Daily Challenge", "Contest", "Company Tags", "Premium Lists", "Flashcards",
    "Notion", "Obsidian", "Google Docs", "Excel", "PDF-гайды", "Статьи",
    "Вебинары", "Интенсив", "Спринт", "Трекер", "Календарь", "Повторение",
  ];

  function buildPreparationFields() {
    document.querySelectorAll(".journey-materials").forEach((container) => {
      while (container.children.length < 100) {
        const index = container.children.length;
        const field = document.createElement("span");
        field.className = "is-chaos-field";
        field.textContent = preparationFieldLabels[(index - 18) % preparationFieldLabels.length];
        container.appendChild(field);
      }

      Array.from(container.children).forEach((field, index) => {
        if (index < 18) return;
        const horizontal = 2 + ((index * 37 + Math.floor(index / 7) * 11) % 94);
        const vertical = 2 + ((index * 53 + Math.floor(index / 5) * 17) % 91);
        field.style.left = `${horizontal}%`;
        field.style.top = `${vertical}%`;
        field.style.setProperty("--field-delay", `${(0.95 + ((index * 7) % 58) * 0.055).toFixed(3)}s`);
        field.style.setProperty("--field-reveal-delay", `${(1.85 + ((index * 7) % 58) * 0.025).toFixed(3)}s`);
      });

      container.dataset.fieldCount = String(container.children.length);
    });
  }

  // The journey scene is taller than its original SVG viewBox. Hard-coded
  // coordinates therefore placed the connectors below the optical center of
  // the cards. Build every visible path from the real element bounds instead:
  // the direct line meets both cards at mid-height, while the ReAlgo route
  // enters each selected node through its left edge and exits through its right.
  function layoutJourneyPaths() {
    document.querySelectorAll(".slide-journey .journey-stage").forEach((journeyStage) => {
      const svg = journeyStage.querySelector(".journey-lines");
      const direct = svg?.querySelector(".journey-direct");
      const candidate = journeyStage.querySelector(".journey-candidate svg");
      const vacancy = journeyStage.querySelector(".journey-vacancy svg");
      if (!svg || !direct || !candidate || !vacancy) return;

      const stageRect = journeyStage.getBoundingClientRect();
      if (!stageRect.width || !stageRect.height) return;
      svg.setAttribute("viewBox", `0 0 ${stageRect.width} ${stageRect.height}`);
      svg.setAttribute("preserveAspectRatio", "none");

      const pointFor = (element, edge) => {
        const rect = element.getBoundingClientRect();
        const x = edge === "left" ? rect.left : edge === "right" ? rect.right : rect.left + rect.width / 2;
        return {
          x: x - stageRect.left,
          y: rect.top + rect.height / 2 - stageRect.top,
        };
      };

      const connector = (from, to) => {
        const bend = Math.max(28, Math.abs(to.x - from.x) * 0.38);
        return `C ${(from.x + bend).toFixed(2)} ${from.y.toFixed(2)}, ${(to.x - bend).toFixed(2)} ${to.y.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
      };

      const candidateEdge = pointFor(candidate, "right");
      const vacancyEdge = pointFor(vacancy, "left");
      direct.setAttribute("d", `M ${candidateEdge.x.toFixed(2)} ${candidateEdge.y.toFixed(2)} ${connector(candidateEdge, vacancyEdge)}`);

      if (!journeyStage.closest(".journey-route")) return;
      const routeGroup = svg.querySelector(".journey-route-segments");
      const routeMask = svg.querySelector("#journeyRouteUncover");
      const maskBase = svg.querySelector(".journey-route-mask-base");
      const maskCover = svg.querySelector(".journey-route-mask-cover");
      const maskFeather = svg.querySelector(".journey-route-mask-feather");
      const maskBody = svg.querySelector(".journey-route-mask-body");
      const maskGradient = svg.querySelector("#journeyRouteMaskFeather");
      const routeNodes = Array.from(journeyStage.querySelectorAll(".journey-materials .is-route"));
      if (!routeGroup || !routeMask || !maskBase || !maskCover || !maskFeather || !maskBody || !maskGradient || !routeNodes.length) return;

      // Build the five visual connectors with clean gaps around labels, but
      // reveal the complete group through one rectangular cover mask. The mask
      // moves as one surface; individual paths never own animation timelines.
      const segmentPaths = [];
      let current = candidateEdge;
      routeNodes.forEach((node) => {
        const rawLeft = pointFor(node, "left");
        const rawRight = pointFor(node, "right");
        const nodeLeft = { x: rawLeft.x - 18, y: rawLeft.y };
        const nodeRight = { x: rawRight.x + 18, y: rawRight.y };
        segmentPaths.push(`M ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${connector(current, nodeLeft)}`);
        current = nodeRight;
        node.dataset.routeRevealX = ((rawLeft.x + rawRight.x) / 2).toFixed(2);
      });
      segmentPaths.push(`M ${current.x.toFixed(2)} ${current.y.toFixed(2)} ${connector(current, vacancyEdge)}`);

      while (routeGroup.children.length < segmentPaths.length) {
        const segment = document.createElementNS("http://www.w3.org/2000/svg", "path");
        segment.classList.add("journey-route-segment");
        routeGroup.appendChild(segment);
      }
      while (routeGroup.children.length > segmentPaths.length) routeGroup.lastElementChild.remove();

      Array.from(routeGroup.children).forEach((segment, index) => {
        segment.setAttribute("d", segmentPaths[index]);
      });

      const featherWidth = 92;
      const maskStart = candidateEdge.x;
      const maskEnd = vacancyEdge.x + 4;
      const maskTravel = maskEnd - maskStart + featherWidth;
      routeMask.setAttribute("x", "0");
      routeMask.setAttribute("y", "0");
      routeMask.setAttribute("width", stageRect.width.toFixed(2));
      routeMask.setAttribute("height", stageRect.height.toFixed(2));
      maskBase.setAttribute("x", "0");
      maskBase.setAttribute("y", "0");
      maskBase.setAttribute("width", stageRect.width.toFixed(2));
      maskBase.setAttribute("height", stageRect.height.toFixed(2));
      maskFeather.setAttribute("x", (maskStart - featherWidth).toFixed(2));
      maskFeather.setAttribute("y", "0");
      maskFeather.setAttribute("width", String(featherWidth));
      maskFeather.setAttribute("height", stageRect.height.toFixed(2));
      maskBody.setAttribute("x", maskStart.toFixed(2));
      maskBody.setAttribute("y", "0");
      maskBody.setAttribute("width", Math.max(1, maskEnd - maskStart).toFixed(2));
      maskBody.setAttribute("height", stageRect.height.toFixed(2));
      maskGradient.setAttribute("x1", (maskStart - featherWidth).toFixed(2));
      maskGradient.setAttribute("x2", maskStart.toFixed(2));
      maskGradient.setAttribute("y1", "0");
      maskGradient.setAttribute("y2", "0");
      maskCover.dataset.routeStart = maskStart.toFixed(2);
      maskCover.dataset.routeTravel = maskTravel.toFixed(2);

      const routeSlide = journeyStage.closest(".journey-route");
      if (routeSlide?.classList.contains("is-route-complete")) {
        maskCover.style.transform = "translateX(100%)";
      }
    });
  }

  function stopJourneyRouteAnimation() {
    journeyRouteRun += 1;
    journeyRouteAnimations.forEach((animation) => animation.cancel());
    journeyRouteAnimations = [];
    if (journeyRouteMaskFrame !== null) window.cancelAnimationFrame(journeyRouteMaskFrame);
    journeyRouteMaskFrame = null;

    document.querySelectorAll(".journey-route").forEach((slide) => {
      slide.classList.add("is-route-resetting");
      slide.classList.remove("is-route-complete");
      const maskCover = slide.querySelector(".journey-route-mask-cover");
      if (maskCover) maskCover.style.transform = "translateX(0%)";
      slide.querySelectorAll(".journey-materials .is-route").forEach((node) => {
        node.classList.remove("is-route-active");
      });
      // Flush the reset while transitions are disabled. A replay therefore
      // starts from a genuinely clean frame instead of fading backwards from
      // the previous completed state.
      void slide.offsetWidth;
      slide.classList.remove("is-route-resetting");
    });
  }

  function startJourneyRouteAnimation(slide) {
    stopJourneyRouteAnimation();
    if (!slide?.classList.contains("journey-route")) return;

    const maskCover = slide.querySelector(".journey-route-mask-cover");
    const routeNodes = Array.from(slide.querySelectorAll(".journey-materials .is-route"));
    if (!maskCover || !routeNodes.length) return;
    const run = journeyRouteRun;

    const finishImmediately = () => {
      if (run !== journeyRouteRun || !slide.classList.contains("is-active")) return;
      journeyRouteAnimations.forEach((animation) => animation.cancel());
      journeyRouteAnimations = [];
      if (journeyRouteMaskFrame !== null) window.cancelAnimationFrame(journeyRouteMaskFrame);
      journeyRouteMaskFrame = null;
      maskCover.style.transform = "translateX(100%)";
      slide.classList.add("is-route-complete");
      routeNodes.forEach((node) => node.classList.add("is-route-active"));
    };
    if (reduceMotion || typeof Element.prototype.animate !== "function") {
      finishImmediately();
      return;
    }

    const transitionHold = document.documentElement.classList.contains("is-slide-transitioning")
      ? JOURNEY_ROUTE_TRANSITION_HOLD
      : 0;
    maskCover.style.transform = "translateX(0%)";
    const animation = maskCover.animate(
      [
        { transform: "translateX(0%)" },
        { transform: "translateX(100%)" },
      ],
      {
        duration: JOURNEY_ROUTE_DURATION,
        delay: transitionHold + JOURNEY_ROUTE_DELAY,
        easing: "cubic-bezier(0.37, 0, 0.63, 1)",
        fill: "both",
      },
    );
    journeyRouteAnimations = [animation];

    const routeStart = Number.parseFloat(maskCover.dataset.routeStart || "0");
    const routeTravel = Math.max(1, Number.parseFloat(maskCover.dataset.routeTravel || "1"));
    const syncNodesToMask = () => {
      if (run !== journeyRouteRun || !slide.classList.contains("is-active")) return;
      const progress = animation.effect?.getComputedTiming().progress ?? 0;
      const revealEdge = routeStart + routeTravel * progress;
      routeNodes.forEach((node) => {
        const revealX = Number.parseFloat(node.dataset.routeRevealX || "0");
        node.classList.toggle("is-route-active", revealEdge >= revealX);
      });
      if (animation.playState !== "finished") {
        journeyRouteMaskFrame = window.requestAnimationFrame(syncNodesToMask);
      }
    };
    journeyRouteMaskFrame = window.requestAnimationFrame(syncNodesToMask);

    animation.finished.then(finishImmediately).catch(() => {});
  }

  function buildTaxonomyGraphFields() {
    document.querySelectorAll("[data-taxonomy-nodes]").forEach((container) => {
      const nodeCount = Number.parseInt(container.dataset.taxonomyNodes || "0", 10);
      if (!Number.isFinite(nodeCount) || nodeCount <= 0) return;
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < nodeCount; index += 1) {
        const node = document.createElement("i");
        node.style.setProperty("--node-index", String(index));
        fragment.appendChild(node);
      }
      container.replaceChildren(fragment);
    });
  }

  function buildTaxonomyConnections() {
    const flow = document.querySelector(".taxonomy-flow");
    if (!flow) return;
    const svg = flow.querySelector(".taxonomy-links");
    const platformLinks = svg?.querySelector(".taxonomy-links-platforms");
    const patternLinks = svg?.querySelector(".taxonomy-links-patterns");
    if (!svg || !platformLinks || !patternLinks) return;

    const flowRect = flow.getBoundingClientRect();
    if (!flowRect.width || !flowRect.height) return;
    svg.setAttribute("viewBox", `0 0 ${flowRect.width} ${flowRect.height}`);

    const pointFor = (element, edge = "center") => {
      const rect = element.getBoundingClientRect();
      const x = edge === "right" ? rect.right : edge === "left" ? rect.left : rect.left + rect.width / 2;
      return { x: x - flowRect.left, y: rect.top + rect.height / 2 - flowRect.top };
    };

    const appendConnection = (group, from, to, index) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const bend = Math.max(34, (to.x - from.x) * 0.42);
      path.setAttribute("d", `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} C ${(from.x + bend).toFixed(1)} ${from.y.toFixed(1)}, ${(to.x - bend).toFixed(1)} ${to.y.toFixed(1)}, ${to.x.toFixed(1)} ${to.y.toFixed(1)}`);
      path.setAttribute("stroke", group === platformLinks ? "url(#taxonomyInputFlow)" : "url(#taxonomyMainFlow)");
      path.style.setProperty("--edge-index", String(index));
      group.appendChild(path);
    };

    platformLinks.replaceChildren();
    patternLinks.replaceChildren();
    const platforms = Array.from(flow.querySelectorAll(".taxonomy-platforms article"));
    const patterns = Array.from(flow.querySelectorAll('[data-taxonomy-nodes="22"] i'));
    const subpatterns = Array.from(flow.querySelectorAll('[data-taxonomy-nodes="111"] i'));

    let platformEdgeIndex = 0;
    platforms.forEach((platform) => {
      patterns.forEach((pattern) => {
        appendConnection(platformLinks, pointFor(platform, "right"), pointFor(pattern), platformEdgeIndex);
        platformEdgeIndex += 1;
      });
    });
    subpatterns.forEach((subpattern, index) => {
      const patternIndex = Math.min(patterns.length - 1, Math.floor(index * patterns.length / subpatterns.length));
      appendConnection(patternLinks, pointFor(patterns[patternIndex]), pointFor(subpattern), index);
    });
  }
  const magicMovePairs = [
    [
      [".centered h1", ".giant-number", "morph-primary"],
      [".centered .kicker", ".stat-keynote .kicker", "morph-kicker"],
      [".subhead", ".stat-keynote h2", "morph-secondary"],
    ],
    [
      [".giant-number", ".giant-number", "morph-market-number"],
      [".stat-keynote .kicker", ".stat-keynote .kicker", "morph-market-kicker"],
      [".stat-copy h2", ".stat-copy h2", "morph-market-title"],
      [".stat-copy p", ".stat-copy p", "morph-market-detail"],
      [".source-line", ".source-line", "morph-market-source"],
    ],
    [
      [".giant-number", ".giant-number", "morph-market-number"],
      [".stat-keynote .kicker", ".stat-keynote .kicker", "morph-market-kicker"],
      [".stat-copy h2", ".stat-copy h2", "morph-market-title"],
      [".stat-copy p", ".stat-copy p", "morph-market-detail"],
      [".source-line", ".source-line", "morph-market-source"],
    ],
    [
      [".giant-number", ".journey-materials span:first-child", "morph-primary"],
    ],
    [
      [".journey-candidate", ".journey-candidate", "morph-card-a"],
      [".journey-vacancy", ".journey-vacancy", "morph-card-b"],
    ],
    [
      [".journey-candidate", ".journey-candidate", "morph-card-a"],
      [".journey-vacancy", ".journey-vacancy", "morph-card-b"],
      [".journey-materials", ".journey-materials", "morph-surface"],
    ],
    [], // Journey route → product demo
    [
      [".macbook-3d-slot", ".macbook-3d-slot", "morph-surface"],
    ],
    [
      [".macbook-3d-slot", ".macbook-3d-slot", "morph-surface"],
    ],
    [
      [".macbook-3d-slot", ".macbook-3d-slot", "morph-surface"],
    ],
    [], // Rating → roadmap: cross-fade
    [], // Roadmap → cards: blackout
    [], // Cards → taxonomy
    [], // Taxonomy → team
    [], // Team → Free: planet transition
    [], // Free → Pro: price transition
    [
      [".price-keynote h2", ".closing-keynote h2", "morph-primary"],
    ],
  ];

  let currentSlide = getInitialSlide();
  let timerStartedAt = Date.now();
  let touchStartX = null;
  let activeTeamMember = 0;
  let teamRotationTimer = null;
  let teamSwitchTimer = null;
  let activeRoadmapItem = 0;
  let roadmapTimer = null;
  let roadmapStartTimer = null;
  let roadmapBuilderStage = 0;
  const ROADMAP_BUILDER_STAGES = 5;
  const ROADMAP_STEP = 2200;
  const JOURNEY_ROUTE_DELAY = 180;
  const JOURNEY_ROUTE_DURATION = 5400;
  const JOURNEY_ROUTE_TRANSITION_HOLD = 1240;
  let journeyRouteAnimations = [];
  let journeyRouteMaskFrame = null;
  let journeyRouteRun = 0;
  let teamOrbitFrame = null;
  let teamOrbitElapsed = 0;
  let teamOrbitStartedAt = 0;
  let activeViewTransition = null;
  let activeMagicMoveElements = [];
  let viewTransitionSequence = 0;
  let marketTransitionRunning = false;
  let planetTransitionRunning = false;
  let priceTransitionRunning = false;
  let productCopyTransitionRunning = false;
  let coverVideoTransitionRunning = false;
  let coverTransitionFrame = null;
  let coverTransitionObjects = [];
  const COVER_WHITE_FADE_DURATION = 0.4;
  const COVER_ARRIVAL_FADE_DURATION = 1360;
  let blackoutTransitionRunning = false;
  const BLACKOUT_DURATION = 1250;
  let crossFadeTransitionRunning = false;
  const CROSS_FADE_DURATION = 780;
  const PRICE_TRANSITION_DURATION = 1400;
  let planetFrame = null;
  const PLANET_FLIGHT_DURATION = 1500;
  // Диаметр сферы относительно высоты кадра. Должен быть > 1, иначе диск
  // перестанет перекрывать шов между слайдами по всей высоте.
  const PLANET_DIAMETER_RATIO = 1.35;
  let marketCounterFrame = null;
  let countUpFrame = null;
  let countUpTimer = null;
  let taxonomyCountFrame = null;
  let taxonomyCountTimer = null;
  let taxonomySettleTimer = null;
  // Пауза после окончания перехода между слайдами, перед стартом счёта.
  const COUNT_UP_DELAY = 500;
  const counterMetrics = { slot: 0.62, decimal: 0.72, percent: 0.92 };
  const countUpTargets = Array.from(document.querySelectorAll("[data-count-to]"));

  function getInitialSlide() {
    const hashSlide = Number.parseInt(window.location.hash.replace("#", ""), 10);
    if (Number.isInteger(hashSlide) && hashSlide >= 1 && hashSlide <= slides.length) {
      return hashSlide - 1;
    }
    return 0;
  }

  function formatSlideNumber(value) {
    return String(value).padStart(2, "0");
  }

  function resizeStage() {
    const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty("--stage-scale", scale.toFixed(4));
  }

  function buildDots() {
    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.dataset.slide = String(index);
      dot.setAttribute("aria-label", `Перейти к слайду ${index + 1}`);
      dot.addEventListener("click", () => showSlide(index));
      dots.appendChild(dot);
    });
  }

  function updateDots() {
    Array.from(dots.children).forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentSlide);
      dot.setAttribute("aria-current", index === currentSlide ? "true" : "false");
    });
  }

  function restartMemberProgress() {
    memberRole.classList.remove("is-running");
    void memberRole.offsetWidth;
    memberRole.classList.add("is-running");
  }

  function activateTeamMember(index, options = {}) {
    const nextMember = ((index % teamMembers.length) + teamMembers.length) % teamMembers.length;
    const delay = options.immediate || reduceMotion ? 0 : 180;
    window.clearTimeout(teamSwitchTimer);
    memberRole.classList.add("is-switching");

    teamSwitchTimer = window.setTimeout(() => {
      activeTeamMember = nextMember;
      const member = teamMembers[activeTeamMember];
      memberNumber.textContent = formatSlideNumber(activeTeamMember + 1);
      memberName.textContent = member.name;
      memberDuty.textContent = member.duty;

      teamHandles.forEach((element) => {
        const isActive = Number(element.dataset.teamIndex) === activeTeamMember;
        element.classList.toggle("is-active", isActive);
        if (element.matches("button")) {
          element.setAttribute("aria-pressed", isActive ? "true" : "false");
        }
      });

      memberRole.classList.remove("is-switching");
      restartMemberProgress();
    }, delay);
  }

  function restartTeamRotation() {
    window.clearInterval(teamRotationTimer);
    teamRotationTimer = window.setInterval(() => {
      activateTeamMember(activeTeamMember + 1);
    }, 5000);
  }

  function positionTeamPlanets(elapsedMilliseconds) {
    const tilt = -6 * (Math.PI / 180);
    const tiltCosine = Math.cos(tilt);
    const tiltSine = Math.sin(tilt);

    teamPlanets.forEach((planet) => {
      const orbit = teamOrbits[Number(planet.dataset.orbitIndex)];
      if (!orbit) return;
      const duration = Number(planet.dataset.duration) || 24;
      const phase = Number(planet.dataset.phase) || 0;
      const angle = phase + (elapsedMilliseconds / 1000 / duration) * Math.PI * 2;
      const ellipseX = Math.cos(angle) * orbit.offsetWidth * 0.5;
      const ellipseY = Math.sin(angle) * orbit.offsetHeight * 0.5;
      const orbitX = ellipseX * tiltCosine - ellipseY * tiltSine;
      const orbitY = ellipseX * tiltSine + ellipseY * tiltCosine;
      const depth = (Math.sin(angle) + 1) * 0.5;

      planet.style.setProperty("--orbit-x", `${orbitX.toFixed(2)}px`);
      planet.style.setProperty("--orbit-y", `${orbitY.toFixed(2)}px`);
      planet.style.setProperty("--planet-depth-scale", (0.84 + depth * 0.22).toFixed(3));
      planet.style.setProperty("--planet-depth-opacity", (0.56 + depth * 0.44).toFixed(3));
      planet.style.zIndex = depth > 0.52 ? "12" : "6";
    });
  }

  function animateTeamOrbits(now) {
    positionTeamPlanets(teamOrbitElapsed + now - teamOrbitStartedAt);
    teamOrbitFrame = window.requestAnimationFrame(animateTeamOrbits);
  }

  function startTeamOrbitMotion() {
    if (reduceMotion) {
      positionTeamPlanets(teamOrbitElapsed);
      return;
    }
    if (teamOrbitFrame !== null) return;
    teamOrbitStartedAt = performance.now();
    teamOrbitFrame = window.requestAnimationFrame(animateTeamOrbits);
  }

  function stopTeamOrbitMotion() {
    if (teamOrbitFrame === null) return;
    teamOrbitElapsed += performance.now() - teamOrbitStartedAt;
    window.cancelAnimationFrame(teamOrbitFrame);
    teamOrbitFrame = null;
  }

  function startTeamRotation() {
    startTeamOrbitMotion();
    activateTeamMember(activeTeamMember, { immediate: true });
    restartTeamRotation();
  }

  function stopTeamRotation() {
    stopTeamOrbitMotion();
    window.clearInterval(teamRotationTimer);
    window.clearTimeout(teamSwitchTimer);
    memberRole.classList.remove("is-running", "is-switching");
  }

  function highlightRoadmapItem(index) {
    const total = roadmapItems.length;
    activeRoadmapItem = ((index % total) + total) % total;
    roadmapItems.forEach((item, itemIndex) => {
      item.classList.toggle("is-active", itemIndex === activeRoadmapItem);
    });
  }

  function stopRoadmapCycle() {
    window.clearInterval(roadmapTimer);
    window.clearTimeout(roadmapStartTimer);
    roadmapTimer = null;
    roadmapStartTimer = null;
    activeRoadmapItem = 0;
    roadmapItems.forEach((item) => item.classList.remove("is-active"));
  }

  function startRoadmapCycle() {
    stopRoadmapCycle();
    if (!roadmapItems.length || reduceMotion) return;

    const begin = () => {
      highlightRoadmapItem(0);
      roadmapTimer = window.setInterval(() => {
        highlightRoadmapItem(activeRoadmapItem + 1);
      }, ROADMAP_STEP);
    };

    // Как и со счётчиками: пока идёт view transition, на экране снимок,
    // и подсветка под ним не видна. Ждём конца перехода, потом небольшая пауза.
    const schedule = () => {
      if (slides[currentSlide] !== roadmapSlide) return;
      roadmapStartTimer = window.setTimeout(begin, 320);
    };

    const transition = activeViewTransition;
    if (transition?.finished) {
      transition.finished.catch(() => {}).finally(schedule);
      return;
    }
    schedule();
  }

  function clearMagicMoveElements() {
    activeMagicMoveElements.forEach((element) => {
      element.style.removeProperty("view-transition-name");
    });
    activeMagicMoveElements = [];
  }

  function prepareMagicMove(previousIndex, nextIndex) {
    clearMagicMoveElements();
    if (Math.abs(nextIndex - previousIndex) !== 1) return [];

    const pairIndex = Math.min(previousIndex, nextIndex);
    const pairDefinitions = magicMovePairs[pairIndex] || [];
    const movingForward = nextIndex > previousIndex;
    const previousSlide = slides[previousIndex];
    const nextSlide = slides[nextIndex];

    return pairDefinitions.flatMap(([lowerSelector, upperSelector, name]) => {
      const previousSelector = movingForward ? lowerSelector : upperSelector;
      const nextSelector = movingForward ? upperSelector : lowerSelector;
      const previousElement = previousSlide.querySelector(previousSelector);
      const nextElement = nextSlide.querySelector(nextSelector);
      if (!previousElement || !nextElement) return [];

      previousElement.style.viewTransitionName = name;
      activeMagicMoveElements.push(previousElement, nextElement);
      return [{ previousElement, nextElement, name }];
    });
  }

  function setMarketNumberDirection(previousIndex, nextIndex) {
    const previousNumber = slides[previousIndex]?.querySelector(".giant-number[data-value]");
    const nextNumber = slides[nextIndex]?.querySelector(".giant-number[data-value]");
    const previousValue = Number.parseFloat(previousNumber?.dataset.value);
    const nextValue = Number.parseFloat(nextNumber?.dataset.value);

    if (!Number.isFinite(previousValue) || !Number.isFinite(nextValue)) {
      delete document.documentElement.dataset.marketNumberDirection;
      return;
    }

    document.documentElement.dataset.marketNumberDirection = nextValue >= previousValue ? "up" : "down";
  }

  function readMarketMetric(slide) {
    const element = slide?.querySelector(".giant-number[data-value]");
    if (!element) return null;
    const value = Number.parseFloat(element.dataset.value);
    if (!Number.isFinite(value)) return null;
    return {
      value,
      decimals: Number.parseInt(element.dataset.decimals || "0", 10),
      percent: element.dataset.percent === "true",
    };
  }

  function isMarketMetricTransition(previousIndex, nextIndex) {
    return Math.abs(nextIndex - previousIndex) === 1
      && Boolean(readMarketMetric(slides[previousIndex]))
      && Boolean(readMarketMetric(slides[nextIndex]));
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  // Ширина слота цифры и ширины «,X» / «%» измеряются по реальному шрифту:
  // хардкод em-значений давал рассинхрон и горизонтальный сдвиг.
  function measureDigitSlotEm(referenceElement) {
    const styles = window.getComputedStyle(referenceElement);
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;top:-9999px;left:-9999px;visibility:hidden;white-space:pre;letter-spacing:normal;font-size:1000px;";
    probe.style.fontFamily = styles.fontFamily;
    probe.style.fontWeight = styles.fontWeight;
    probe.style.fontStyle = styles.fontStyle;
    probe.style.fontVariantNumeric = styles.fontVariantNumeric;
    probe.style.fontFeatureSettings = styles.fontFeatureSettings;
    document.body.appendChild(probe);

    let widest = 0;
    for (const digit of "0123456789") {
      probe.textContent = digit;
      widest = Math.max(widest, probe.getBoundingClientRect().width);
    }
    probe.remove();
    return widest > 0 ? widest / 1000 : 0.62;
  }

  function getStageScale() {
    const raw = Number.parseFloat(window.getComputedStyle(stage).getPropertyValue("--stage-scale"));
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }

  // Меряем субпиксельно (getBoundingClientRect, а не offsetWidth): целочисленное
  // округление ширины давало ошибку, которая каждый кадр падала на разные пиксели.
  function measureOptionalWidthEm(element, fontSizePx, fallback) {
    const inlineWidth = element.style.width;
    const inlineOpacity = element.style.opacity;
    const inlineTransform = element.style.transform;
    const inlineFilter = element.style.filter;
    element.style.width = "auto";
    element.style.transform = "none";
    element.style.filter = "none";
    element.style.opacity = "0";
    const measured = element.getBoundingClientRect().width / (getStageScale() * fontSizePx);
    element.style.width = inlineWidth;
    element.style.opacity = inlineOpacity;
    element.style.transform = inlineTransform;
    element.style.filter = inlineFilter;
    return measured > 0 ? measured : fallback;
  }

  function calibrateCounterMetrics() {
    const slotEm = measureDigitSlotEm(marketCounter);
    counterMetrics.slot = slotEm;
    document.documentElement.style.setProperty("--digit-slot", `${slotEm.toFixed(4)}em`);

    const fontSizePx = Number.parseFloat(window.getComputedStyle(marketCounter).fontSize) || 310;
    renderDigits(marketCounterMain, "0");
    renderDigits(marketCounterDecimal, ",0");
    // «%» тоже через слоты — иначе у счётчика и статичного числа разный бокс-модель.
    renderDigits(marketCounterPercent, "%");
    marketCounterDecimal.style.width = "";
    marketCounterPercent.style.width = "";
    counterMetrics.decimal = measureOptionalWidthEm(marketCounterDecimal, fontSizePx, 0.72);
    counterMetrics.percent = measureOptionalWidthEm(marketCounterPercent, fontSizePx, 0.92);
    // Ширина фиксируется один раз: во время анимации layout не меняется вообще.
    marketCounterDecimal.style.width = `${counterMetrics.decimal.toFixed(4)}em`;
    marketCounterPercent.style.width = `${counterMetrics.percent.toFixed(4)}em`;
  }

  function applyStaticNumberGradient(element) {
    const elementRect = element.getBoundingClientRect();
    const scale = getStageScale();
    const gradientWidth = elementRect.width / scale;
    if (gradientWidth <= 0) return;

    Array.from(element.children).forEach((cell) => {
      const cellRect = cell.getBoundingClientRect();
      const gradientOffset = (cellRect.left - elementRect.left) / scale;
      cell.style.setProperty("--static-gradient-width", `${gradientWidth.toFixed(3)}px`);
      cell.style.setProperty("--static-gradient-position", `${(-gradientOffset).toFixed(3)}px`);
    });
    element.classList.add("is-slotted");
  }

  // Статичные числа на слайдах используют ту же разметку слотов,
  // чтобы при передаче анимации счётчику не было скачка.
  function applyDigitSlotsToStaticNumbers() {
    document.querySelectorAll(".giant-number[data-value], .slide .price-value").forEach((element) => {
      const source = element.dataset.display || element.textContent.trim();
      element.dataset.display = source;
      renderDigits(element, source);
      if (element.classList.contains("giant-number")) applyStaticNumberGradient(element);
    });
  }

  function easeInOutCubic(value) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - ((-2 * value + 2) ** 3) / 2;
  }

  function easeOutCubic(value) {
    return 1 - (1 - value) ** 3;
  }

  // Резервируем ширину под итоговое число разрядов: пока счёт идёт от 1,
  // левый край и подпись справа стоят на месте.
  function reserveCountUpWidth(element) {
    const digits = String(element.dataset.countTo || "").length || 1;
    const tracking = Math.abs(Number.parseFloat(
      window.getComputedStyle(element).getPropertyValue("--num-tracking"),
    )) || 0.075;
    element.style.minWidth = `${(digits * (counterMetrics.slot - tracking)).toFixed(4)}em`;
  }

  function runCountUp(slide) {
    window.cancelAnimationFrame(countUpFrame);
    window.clearTimeout(countUpTimer);
    countUpFrame = null;
    countUpTimer = null;

    const targets = countUpTargets.filter((element) => slide.contains(element));
    if (!targets.length) return;

    // Сразу ставим «1»: пока идёт переход, число просто стоит на старте,
    // а сам счёт целиком попадает в поле зрения.
    targets.forEach((element) => {
      reserveCountUpWidth(element);
      renderDigits(element, reduceMotion ? String(element.dataset.countTo) : "1");
    });
    if (reduceMotion) return;

    // Пауза отсчитывается от КОНЦА перехода между слайдами, а не от commitSlide.
    // Пока идёт view transition, на экране снимок, а не живой элемент, — счёт
    // под ним просто не виден. Переходы разной длины (860мс root, 1240мс
    // morph-surface на слайде Pattern Atlas), поэтому фиксированный таймер
    // где-то съедал бы начало анимации.
    const startCounting = () => {
      if (slides[currentSlide] !== slide) return;
      countUpTimer = window.setTimeout(() => startCountUpFrames(targets), COUNT_UP_DELAY);
    };

    const transition = activeViewTransition;
    if (transition?.finished) {
      transition.finished.catch(() => {}).finally(startCounting);
      return;
    }
    startCounting();
  }

  function runTaxonomyCountUp(slide) {
    window.cancelAnimationFrame(taxonomyCountFrame);
    window.clearTimeout(taxonomyCountTimer);
    window.clearTimeout(taxonomySettleTimer);
    taxonomyCountFrame = null;
    taxonomyCountTimer = null;
    taxonomySettleTimer = null;
    document.querySelectorAll(".slide-taxonomy-graph.is-settled").forEach((element) => {
      element.classList.remove("is-settled");
    });

    const targets = Array.from(slide.querySelectorAll("[data-taxonomy-count]"));
    if (!targets.length) return;

    const formatValue = (value) => Math.round(value).toLocaleString("ru-RU").replace(/\u00a0/g, " ");
    targets.forEach((element) => {
      const target = Number.parseInt(element.dataset.taxonomyCount || "0", 10);
      element.textContent = reduceMotion ? formatValue(target) : "0";
    });
    const isTaxonomy = slide.classList.contains("slide-taxonomy-graph");

    if (reduceMotion) {
      if (isTaxonomy) slide.classList.add("is-settled");
      return;
    }

    if (isTaxonomy) {
      // is-settled глушит анимации и выставляет конечные состояния, поэтому
      // должен сработать позже последнего такта (узлы подпаттернов, ~7090мс).
      taxonomySettleTimer = window.setTimeout(() => {
        if (slides[currentSlide] === slide) slide.classList.add("is-settled");
      }, 7400);
    }

    const begin = () => {
      if (slides[currentSlide] !== slide) return;
      const startedAt = performance.now();
      const frame = (now) => {
        const progress = clamp01((now - startedAt) / 680);
        const easedProgress = easeOutCubic(progress);
        targets.forEach((element) => {
          const target = Number.parseInt(element.dataset.taxonomyCount || "0", 10);
          element.textContent = formatValue(target * easedProgress);
        });
        if (progress < 1) {
          taxonomyCountFrame = window.requestAnimationFrame(frame);
          return;
        }
        taxonomyCountFrame = null;
      };
      taxonomyCountFrame = window.requestAnimationFrame(frame);
    };

    const startDelay = Number.parseInt(slide.dataset.countDelay || "820", 10);

    // Слайды, которые въезжают через morph-surface, ждут конца перехода:
    // пока на экране снимок, а не живой элемент, счёт под ним не виден.
    const transition = activeViewTransition;
    if (slide.hasAttribute("data-count-after-transition") && transition?.finished) {
      transition.finished.catch(() => {}).finally(() => {
        if (slides[currentSlide] !== slide) return;
        taxonomyCountTimer = window.setTimeout(begin, startDelay);
      });
      return;
    }

    taxonomyCountTimer = window.setTimeout(begin, startDelay);
  }

  function startCountUpFrames(targets) {
    const startedAt = performance.now();
    const frame = (now) => {
      const progress = clamp01((now - startedAt) / 1150);
      const easedProgress = easeOutCubic(progress);

      targets.forEach((element) => {
        const target = Number.parseInt(element.dataset.countTo, 10);
        if (!Number.isFinite(target)) return;
        renderDigits(element, String(Math.round(1 + (target - 1) * easedProgress)));
      });

      if (progress < 1) {
        countUpFrame = window.requestAnimationFrame(frame);
        return;
      }
      countUpFrame = null;
    };
    countUpFrame = window.requestAnimationFrame(frame);
  }

  function optionalPresence(fromVisible, toVisible, progress, timing) {
    if (fromVisible === toVisible) return fromVisible ? 1 : 0;
    const localProgress = clamp01((progress - timing.start) / (timing.end - timing.start));
    const easedProgress = easeInOutCubic(localProgress);
    return toVisible ? easedProgress : 1 - easedProgress;
  }

  // Ширина не трогается: часть «схлопывается» сдвигом по X, а не reflow-ом.
  function styleOptionalCounterPart(element, presence, shiftEm) {
    element.style.opacity = presence.toFixed(3);
    element.style.filter = presence >= 1 ? "none" : `blur(${((1 - presence) * 5).toFixed(2)}px)`;
    element.style.transform = `translate(${shiftEm.toFixed(4)}em, ${((1 - presence) * 0.11).toFixed(3)}em)`;
  }

  // Цифры рендерятся в слоты фиксированной ширины: ширина строки не зависит
  // от того, какие именно цифры показаны, поэтому счётчик не дёргается по горизонтали.
  function renderDigits(container, text) {
    // Исходная разметка — текстовый узел («10,3», «%»). Его нужно удалить,
    // иначе спаны-слоты добавятся рядом и значение отрисуется дважды.
    Array.from(container.childNodes).forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) node.remove();
    });

    if (container.dataset.digits === text) return;
    container.dataset.digits = text;

    const characters = Array.from(text);
    while (container.childElementCount > characters.length) {
      container.lastElementChild.remove();
    }
    while (container.childElementCount < characters.length) {
      container.appendChild(document.createElement("span"));
    }

    characters.forEach((character, index) => {
      const cell = container.children[index];
      const isDigit = character >= "0" && character <= "9";
      cell.className = isDigit ? "num-slot" : "num-char";
      if (cell.textContent !== character) cell.textContent = character;
    });
  }

  function renderMarketCounter(value, decimalPresence, percentPresence) {
    // Единая основа округления: целая часть не «перепрыгивает» в момент,
    // когда десятичная часть скрывается.
    const tenths = Math.round(value * 10);
    renderDigits(marketCounterMain, String(Math.trunc(tenths / 10)));
    renderDigits(marketCounterDecimal, `,${Math.abs(tenths % 10)}`);

    // Один непрерывный градиент распределяется по всем видимым частям числа.
    // Фон задаётся каждой части отдельно, но с общей шириной и собственным
    // смещением: так Chrome не отрывает маску от цифр во время transform-анимации.
    const fontSizePx = Number.parseFloat(window.getComputedStyle(marketCounter).fontSize) || 310;
    const mainWidth = marketCounterMain.getBoundingClientRect().width / (getStageScale() * fontSizePx);
    const decimalWidth = decimalPresence > 0 ? counterMetrics.decimal : 0;
    const percentWidth = percentPresence > 0 ? counterMetrics.percent : 0;
    const gradientWidth = Math.max(mainWidth + decimalWidth + percentWidth, mainWidth);
    const gradientParts = [
      [marketCounterMain, 0],
      [marketCounterDecimal, mainWidth],
      [marketCounterPercent, mainWidth + decimalWidth],
    ];
    gradientParts.forEach(([element, offset]) => {
      element.style.setProperty("--market-gradient-width", `${gradientWidth.toFixed(4)}em`);
      element.style.setProperty("--market-gradient-offset", `${offset.toFixed(4)}em`);
    });

    // Скрытые части не удаляются из потока, а «съезжают»:
    // «%» подтягивается влево на схлопнувшуюся десятичную часть,
    // а вся строка компенсируется на половину освободившейся ширины,
    // чтобы число осталось оптически по центру. Один плавный transform
    // вместо двух встречных анимаций ширины — горизонтальных рывков нет.
    const decimalCollapse = (1 - decimalPresence) * counterMetrics.decimal;
    const percentCollapse = (1 - percentPresence) * counterMetrics.percent;
    styleOptionalCounterPart(marketCounterDecimal, decimalPresence, 0);
    styleOptionalCounterPart(marketCounterPercent, percentPresence, -decimalCollapse);
    marketCounterRow.style.transform = `translateX(${((decimalCollapse + percentCollapse) / 2).toFixed(4)}em)`;
  }

  function animateMarketCounter(fromMetric, toMetric, duration) {
    window.cancelAnimationFrame(marketCounterFrame);
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const frame = (now) => {
        const progress = clamp01((now - startedAt) / duration);
        const easedProgress = easeInOutCubic(progress);
        const value = fromMetric.value + (toMetric.value - fromMetric.value) * easedProgress;
        const decimalPresence = optionalPresence(
          fromMetric.decimals > 0,
          toMetric.decimals > 0,
          progress,
          { start: 0.58, end: 0.94 },
        );
        const percentPresence = optionalPresence(
          fromMetric.percent,
          toMetric.percent,
          progress,
          { start: 0.54, end: 0.9 },
        );
        renderMarketCounter(value, decimalPresence, percentPresence);

        if (progress < 1) {
          marketCounterFrame = window.requestAnimationFrame(frame);
          return;
        }
        marketCounterFrame = null;
        resolve();
      };
      marketCounterFrame = window.requestAnimationFrame(frame);
    });
  }

  function animateMarketCopy(previousSlide, nextSlide, increasing) {
    const selectors = [
      ".stat-keynote .kicker",
      ".stat-copy h2",
      ".stat-copy p",
      ".source-line",
    ];
    const previousElements = selectors.map((selector) => previousSlide.querySelector(selector));
    const nextElements = selectors.map((selector) => nextSlide.querySelector(selector));
    const oldOffset = increasing ? -14 : 14;
    const newOffset = -oldOffset;
    const animations = [];

    previousElements.forEach((element, index) => {
      if (!element) return;
      animations.push(element.animate([
        { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
        { opacity: 0, transform: `translateY(${oldOffset}px)`, filter: "blur(3px)" },
      ], {
        duration: 520,
        delay: index * 35,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "both",
      }));
    });

    nextElements.forEach((element, index) => {
      if (!element) return;
      animations.push(element.animate([
        { opacity: 0, transform: `translateY(${newOffset}px)`, filter: "blur(3px)" },
        { opacity: 1, transform: "translateY(0)", filter: "blur(0)" },
      ], {
        duration: 680,
        delay: 310 + index * 70,
        easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        fill: "both",
      }));
    });

    return animations;
  }

  // Метка ставится на слайд, ПОСЛЕ которого нужно затухание.
  function isCrossFadeTransition(previousIndex, nextIndex) {
    if (Math.abs(nextIndex - previousIndex) !== 1) return false;
    const lower = Math.min(previousIndex, nextIndex);
    return Boolean(slides[lower]?.hasAttribute("data-fade-next"));
  }

  function isCoverVideoTransition(previousIndex, nextIndex) {
    return previousIndex === 0 && nextIndex === 1;
  }

  function prepareCoverTransitionForeground() {
    if (!coverTransitionForeground) return;
    coverTransitionForeground.replaceChildren();
    coverTransitionObjects = [];

    const deckChrome = document.querySelector(".deck-chrome");
    const sources = [
      { source: slides[0]?.querySelector(".centered"), depth: 0.96, name: "hero" },
      { source: slides[0]?.querySelector(".awards"), depth: 0.78, name: "awards" },
      {
        source: deckChrome,
        depth: 0.86,
        name: "brand",
        prepare(clone) {
          clone.querySelector(".deck-meta")?.remove();
        },
      },
      {
        source: deckChrome,
        depth: 1.18,
        name: "meta",
        prepare(clone) {
          clone.querySelector(".brand")?.remove();
          clone.style.justifyContent = "flex-end";
        },
      },
    ].filter(({ source }) => Boolean(source));

    sources.forEach(({ source, depth, name, prepare }) => {
      const clone = source.cloneNode(true);
      prepare?.(clone);
      [clone, ...clone.querySelectorAll("[id]")].forEach((element) => element.removeAttribute("id"));
      clone.querySelectorAll("a, button").forEach((element) => element.setAttribute("tabindex", "-1"));
      const object = document.createElement("div");
      object.className = `cover-transition-object cover-transition-object--${name}`;
      object.dataset.depth = String(depth);
      object.appendChild(clone);
      coverTransitionForeground.appendChild(object);
      coverTransitionObjects.push({ element: object, depth });
    });
    if (coverTransitionWhite) coverTransitionWhite.style.opacity = "0";
  }

  function coverReferenceScaleAtTime(currentTime) {
    const time = Math.max(0, currentTime);
    // Least-squares fit по SIFT-трекингу 205 опорных точек Blender-рендера.
    // Ошибка масштаба на надёжном интервале 0–1.125 с: около 0.0032x.
    return Math.exp(-0.0496956 * time + 1.08506902 * time * time - 0.18118389 * time * time * time);
  }

  function coverCameraPoseAtTime(currentTime) {
    const time = Math.max(0, currentTime);
    const trackedTime = Math.min(time, 1.125);
    const trackedTime2 = trackedTime * trackedTime;
    const trackedTime3 = trackedTime2 * trackedTime;

    // Точка пролёта и roll восстановлены из накопленных межкадровых affine
    // transforms, затем переведены из 2560×1440 в координаты сцены 1920×1080.
    let focusX = 1830 + 141.99439214 * trackedTime - 582.82697947 * trackedTime2 + 257.1590266 * trackedTime3;
    let focusY = 465 + 29.27110665 * trackedTime - 1.00879765 * trackedTime2 - 7.0578793 * trackedTime3;
    let roll = -0.28344155 * trackedTime + 7.49935484 * trackedTime2 - 1.42773199 * trackedTime3;

    // После 1.125 с объект занимает почти весь кадр и feature tracking теряет
    // устойчивость. Продолжаем позу по касательной последнего надёжного кадра;
    // масштаб всё ещё задаётся непрерывной fit-кривой выше.
    if (time > 1.125) {
      const tail = time - 1.125;
      focusX -= 193 * tail;
      focusY += 0.2 * tail;
      roll += 11.17 * tail;
    }

    const referenceScale = coverReferenceScaleAtTime(time);
    return {
      focusX,
      focusY,
      roll,
      travel: 1 - 1 / referenceScale,
    };
  }

  function renderCoverObjectInCamera(object, pose) {
    const remainingDepth = object.depth - pose.travel;
    if (remainingDepth <= 0.035) {
      object.element.style.visibility = "hidden";
      return;
    }

    object.element.style.visibility = "visible";
    const projectedScale = object.depth / remainingDepth;
    const perspective = 1450;
    const translateZ = perspective * (1 - 1 / projectedScale);
    object.element.style.transform = [
      `translate3d(${pose.focusX.toFixed(3)}px, ${pose.focusY.toFixed(3)}px, 0)`,
      `rotateZ(${pose.roll.toFixed(4)}deg)`,
      `perspective(${perspective}px)`,
      `translateZ(${translateZ.toFixed(3)}px)`,
      `translate3d(${-pose.focusX.toFixed(3)}px, ${-pose.focusY.toFixed(3)}px, 0)`,
    ].join(" ");
  }

  function startCoverForegroundCamera() {
    window.cancelAnimationFrame(coverTransitionFrame);

    const render = () => {
      if (!coverVideoTransitionRunning || !coverTransitionForeground || !coverTransitionVideo) return;
      const pose = coverCameraPoseAtTime(coverTransitionVideo.currentTime);
      coverTransitionObjects.forEach((object) => renderCoverObjectInCamera(object, pose));
      if (coverTransitionWhite) {
        const duration = Number.isFinite(coverTransitionVideo.duration) ? coverTransitionVideo.duration : 2;
        const fadeStart = Math.max(0, duration - COVER_WHITE_FADE_DURATION);
        const whiteOpacity = clamp01((coverTransitionVideo.currentTime - fadeStart) / COVER_WHITE_FADE_DURATION);
        coverTransitionWhite.style.opacity = whiteOpacity.toFixed(4);
      }
      coverTransitionFrame = window.requestAnimationFrame(render);
    };

    coverTransitionFrame = window.requestAnimationFrame(render);
  }

  function waitForVideoEvent(video, eventName, timeoutMs) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeout);
        video.removeEventListener(eventName, handleSuccess);
        video.removeEventListener("error", handleError);
      };
      const handleSuccess = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(video.error || new Error("Не удалось воспроизвести видео перехода"));
      };
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Истекло время ожидания видео перехода"));
      }, timeoutMs);

      video.addEventListener(eventName, handleSuccess, { once: true });
      video.addEventListener("error", handleError, { once: true });
    });
  }

  function prepareCoverArrival(slide) {
    const slideElements = Array.from(slide?.children || [])
      .filter((element) => !element.classList.contains("speaker-notes"));
    const chromeElements = [
      document.querySelector(".deck-chrome"),
      document.querySelector(".deck-controls"),
      document.querySelector(".slide-dots"),
    ].filter(Boolean);
    const elements = [...slideElements, ...chromeElements];
    elements.forEach((element) => {
      element.style.opacity = "0";
    });
    return elements;
  }

  async function runCoverArrivalFade(elements) {
    if (typeof Element.prototype.animate !== "function") {
      elements.forEach((element) => element.style.removeProperty("opacity"));
      return;
    }

    const animations = elements.map((element) => element.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: COVER_ARRIVAL_FADE_DURATION,
        easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        fill: "both",
      },
    ));

    await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    animations.forEach((animation) => animation.cancel());
    elements.forEach((element) => element.style.removeProperty("opacity"));
  }

  async function runCoverVideoTransition(nextIndex, previousIndex, options) {
    if (coverVideoTransitionRunning) return;
    if (!coverTransition || !coverTransitionVideo) {
      commitSlide(nextIndex, previousIndex, options);
      return;
    }

    coverVideoTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();
    coverTransitionVideo.pause();
    coverTransitionVideo.currentTime = 0;
    prepareCoverTransitionForeground();

    let committed = false;
    try {
      if (coverTransitionVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        coverTransitionVideo.load();
        await waitForVideoEvent(coverTransitionVideo, "loadeddata", 3000);
      }
      coverTransition.classList.add("is-running");
      await coverTransitionVideo.play();
      startCoverForegroundCamera();
      await waitForVideoEvent(coverTransitionVideo, "ended", 6000);
      if (coverTransitionWhite) coverTransitionWhite.style.opacity = "1";
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      const arrivalElements = prepareCoverArrival(slides[nextIndex]);
      commitSlide(nextIndex, previousIndex, options);
      committed = true;
      coverTransition.classList.remove("is-running");
      await runCoverArrivalFade(arrivalElements);
    } catch (error) {
      console.warn("Video transition skipped:", error);
    } finally {
      if (!committed) commitSlide(nextIndex, previousIndex, options);
      window.cancelAnimationFrame(coverTransitionFrame);
      coverTransitionFrame = null;
      coverTransitionVideo.pause();
      coverTransition.classList.remove("is-running");
      coverTransitionForeground?.replaceChildren();
      coverTransitionObjects = [];
      if (coverTransitionWhite) coverTransitionWhite.style.opacity = "0";
      coverVideoTransitionRunning = false;
    }
  }

  // Простое затухание без magic move: новый слайд проявляется поверх
  // старого. Оба тёмные и непрозрачные, поэтому перекрытие читается как
  // перетекание без растягивания снимков между разногабаритными сценами.
  async function runCrossFadeTransition(nextIndex, previousIndex, options) {
    if (crossFadeTransitionRunning) return;
    const nextSlideElement = slides[nextIndex];
    if (!nextSlideElement || typeof Element.prototype.animate !== "function") {
      commitSlide(nextIndex, previousIndex, options);
      return;
    }

    crossFadeTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();
    nextSlideElement.classList.add("is-fade-next");

    const fade = nextSlideElement.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: CROSS_FADE_DURATION, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "both" },
    );

    try {
      await fade.finished.catch(() => {});
      commitSlide(nextIndex, previousIndex, options);
    } finally {
      fade.cancel();
      nextSlideElement.classList.remove("is-fade-next");
      crossFadeTransitionRunning = false;
    }
  }

  // Метка ставится на слайд, ПОСЛЕ которого нужен провал в чёрный,
  // поэтому переход работает одинаково в обе стороны.
  function isBlackoutTransition(previousIndex, nextIndex) {
    if (Math.abs(nextIndex - previousIndex) !== 1) return false;
    const lower = Math.min(previousIndex, nextIndex);
    return Boolean(slides[lower]?.hasAttribute("data-blackout-next"));
  }

  async function runBlackoutTransition(nextIndex, previousIndex, options) {
    if (blackoutTransitionRunning) return;
    blackoutTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();

    blackout.style.opacity = "0";
    blackout.classList.add("is-running");

    let committed = false;
    try {
      await animateProgress(BLACKOUT_DURATION, (progress) => {
        // 0–38%: гаснем, 38–52%: держим полностью чёрный кадр, 52–100%: проявляемся.
        let opacity;
        if (progress < 0.38) {
          opacity = easeInOutCubic(progress / 0.38);
        } else if (progress < 0.52) {
          opacity = 1;
        } else {
          opacity = 1 - easeInOutCubic((progress - 0.52) / 0.48);
        }
        blackout.style.opacity = opacity.toFixed(3);

        // Слайд подменяем в середине чёрной паузы — самой подмены не видно.
        if (!committed && progress >= 0.45) {
          committed = true;
          commitSlide(nextIndex, previousIndex, options);
        }
      });
    } finally {
      if (!committed) commitSlide(nextIndex, previousIndex, options);
      window.cancelAnimationFrame(planetFrame);
      planetFrame = null;
      blackout.classList.remove("is-running");
      blackout.style.opacity = "0";
      blackoutTransitionRunning = false;
    }
  }

  function isProductCopyTransition(previousIndex, nextIndex) {
    return Math.abs(nextIndex - previousIndex) === 1
      && Boolean(slides[previousIndex]?.querySelector(".macbook-3d-slot"))
      && Boolean(slides[nextIndex]?.querySelector(".macbook-3d-slot"));
  }

  function isExtensionRevealTransition(previousIndex, nextIndex) {
    if (Math.abs(nextIndex - previousIndex) !== 1) return false;
    const previousMode = logicalProductModes[previousIndex];
    const nextMode = logicalProductModes[nextIndex];
    return (previousMode === "extension-intro" && nextMode === "extension")
      || (previousMode === "extension" && nextMode === "extension-intro");
  }

  function runExtensionRevealTransition(nextIndex, previousIndex, options) {
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();
    commitSlide(nextIndex, previousIndex, options);
  }

  function isJourneyRouteTransition(previousIndex, nextIndex) {
    if (Math.abs(nextIndex - previousIndex) !== 1) return false;
    const previousSlide = slides[previousIndex];
    const nextSlide = slides[nextIndex];
    return Boolean(
      (previousSlide?.classList.contains("journey-reveal") && nextSlide?.classList.contains("journey-route"))
      || (previousSlide?.classList.contains("journey-route") && nextSlide?.classList.contains("journey-reveal"))
    );
  }

  // Переход между слайдами с MacBook идёт БЕЗ view transition.
  // View transition подменяет страницу статичными снимками, а 3D-сцена в это
  // время живёт: движение камеры длится 3800мс. Снимок замораживал ракурс на
  // время перехода, а в конце управление возвращалось живому канвасу, который
  // уже уехал на треть пути, — отсюда второй «скачок» всей сцены.
  // Здесь канвас не прерывается ни на кадр: он физически один и переезжает
  // в новый слот сразу, а подписи старого слайда доигрывают затухание поверх.
  async function runProductCopyTransition(nextIndex, previousIndex, options) {
    if (productCopyTransitionRunning) return;
    const previousSlide = visualSlideAt(previousIndex);
    const nextSlide = visualSlideAt(nextIndex);
    if (!previousSlide || !nextSlide || typeof Element.prototype.animate !== "function") {
      commitSlide(nextIndex, previousIndex, options);
      return;
    }

    productCopyTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();

    // Every logical MacBook beat is rendered by one persistent visual slide.
    // Fade only the changing headline around the logical mode switch; the
    // shade, WebGL canvas, CSS3D renderer and React card stay alive throughout.
    if (previousSlide === nextSlide) {
      const previousMode = logicalProductModes[previousIndex];
      const nextMode = logicalProductModes[nextIndex];
      const previousCopy = previousSlide.querySelector(`[data-product-copy~="${previousMode}"]`);
      const nextCopy = nextSlide.querySelector(`[data-product-copy~="${nextMode}"]`);
      const animations = [];

      try {
        if (previousCopy && previousCopy !== nextCopy) {
          const copyOut = previousCopy.animate(
            [{ opacity: 1, transform: "translate3d(0, 0, 0)" }, { opacity: 0, transform: "translate3d(-14px, 0, 0)" }],
            { duration: 220, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "both" },
          );
          animations.push(copyOut);
          await copyOut.finished.catch(() => {});
        }

        commitSlide(nextIndex, previousIndex, options);

        if (nextCopy && previousCopy !== nextCopy) {
          const copyIn = nextCopy.animate(
            [{ opacity: 0, transform: "translate3d(18px, 0, 0)" }, { opacity: 1, transform: "translate3d(0, 0, 0)" }],
            { duration: 440, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
          );
          animations.push(copyIn);
          await copyIn.finished.catch(() => {});
        }
      } finally {
        animations.forEach((animation) => animation.cancel());
        productCopyTransitionRunning = false;
      }
      return;
    }

    previousSlide.classList.add("is-copy-fading");
    commitSlide(nextIndex, previousIndex, options);

    const selectors = [".product-overlay", ".platforms", ".product-demo-rail", ".model-credit"];
    const animations = [];

    selectors.forEach((selector) => {
      const element = previousSlide.querySelector(selector);
      if (!element) return;
      animations.push(element.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 420,
        easing: "cubic-bezier(0.65, 0, 0.35, 1)",
        fill: "both",
      }));
    });

    selectors.forEach((selector, index) => {
      const element = nextSlide.querySelector(selector);
      if (!element) return;
      animations.push(element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 520,
        delay: 300 + index * 45,
        easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
        fill: "both",
      }));
    });

    try {
      await Promise.all(animations.map((animation) => animation.finished.catch(() => {})));
    } finally {
      animations.forEach((animation) => animation.cancel());
      previousSlide.classList.remove("is-copy-fading");
      productCopyTransitionRunning = false;
    }
  }

  function readPrice(slide) {
    const element = slide?.querySelector(".price[data-price]");
    if (!element) return null;
    const value = Number.parseInt(element.dataset.price, 10);
    return Number.isFinite(value) ? value : null;
  }

  function isPriceTransition(previousIndex, nextIndex) {
    return Math.abs(nextIndex - previousIndex) === 1
      && readPrice(slides[previousIndex]) !== null
      && readPrice(slides[nextIndex]) !== null;
  }

  // Якорь — левый верхний угол блока цифр, а НЕ центр связки «цифры + валюта».
  // При центрировании смена разряда (0 → 699 проходит 9 → 10 и 99 → 100)
  // разом расширяет бокс на слот, и всё содержимое рывком съезжает влево на
  // пол-слота. С привязкой по левому краю число растёт вправо, как в одометре,
  // а «руб.» едет за ним. Раньше якорем была валюта — она стояла перед числом;
  // теперь она справа, и держать надо именно левый край цифр.
  function priceAnchor(root) {
    const value = root?.querySelector(".price-value");
    if (!value) return null;

    const rect = value.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const scale = getStageScale();
    return {
      x: (rect.left - stageRect.left) / scale,
      y: (rect.top - stageRect.top) / scale,
    };
  }

  async function runPriceTransition(nextIndex, previousIndex, options) {
    if (priceTransitionRunning) return;
    const previousSlide = slides[previousIndex];
    const nextSlide = slides[nextIndex];
    const fromValue = readPrice(previousSlide);
    const toValue = readPrice(nextSlide);
    const fromAnchor = priceAnchor(previousSlide);
    const toAnchor = priceAnchor(nextSlide);

    if (fromValue === null || toValue === null || !fromAnchor || !toAnchor
      || typeof Element.prototype.animate !== "function") {
      commitSlide(nextIndex, previousIndex, options);
      return;
    }

    priceTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();

    // Цвета читаем до того, как слайды станут прозрачными.
    const fromBackground = window.getComputedStyle(previousSlide).backgroundColor;
    const toBackground = window.getComputedStyle(nextSlide).backgroundColor;
    const fromColor = window.getComputedStyle(previousSlide.querySelector(".price")).color;
    const toColor = window.getComputedStyle(nextSlide.querySelector(".price")).color;

    priceBackdrop.style.backgroundColor = fromBackground;
    priceBackdrop.classList.add("is-running");
    stage.classList.add("is-price-counting");
    nextSlide.classList.add("is-price-next");
    renderDigits(priceCounterValue, String(fromValue));

    // Собственный якорь счётчика меряем при нулевом сдвиге и дальше двигаем
    // его дельтами. Разметка у счётчика и у живой цены одна и та же, поэтому
    // совмещение «$» совмещает и цифры — на обоих концах перехода стык точный.
    priceCounter.style.transform = "translate(0px, 0px)";
    const selfAnchor = priceAnchor(priceCounter);
    const fromShift = {
      x: fromAnchor.x - selfAnchor.x,
      y: fromAnchor.y - selfAnchor.y,
    };
    const toShift = {
      x: toAnchor.x - selfAnchor.x,
      y: toAnchor.y - selfAnchor.y,
    };
    priceCounter.style.transform = `translate(${fromShift.x.toFixed(2)}px, ${fromShift.y.toFixed(2)}px)`;
    priceCounter.classList.add("is-visible");

    const easing = "cubic-bezier(0.65, 0, 0.35, 1)";
    const animations = [
      priceBackdrop.animate(
        [{ backgroundColor: fromBackground }, { backgroundColor: toBackground }],
        { duration: PRICE_TRANSITION_DURATION, easing, fill: "both" },
      ),
      previousSlide.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: PRICE_TRANSITION_DURATION * 0.5, easing, fill: "both" },
      ),
      nextSlide.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        {
          duration: PRICE_TRANSITION_DURATION * 0.62,
          delay: PRICE_TRANSITION_DURATION * 0.38,
          easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
          fill: "both",
        },
      ),
      priceCounter.animate([
        {
          transform: `translate(${fromShift.x.toFixed(2)}px, ${fromShift.y.toFixed(2)}px)`,
          color: fromColor,
        },
        {
          transform: `translate(${toShift.x.toFixed(2)}px, ${toShift.y.toFixed(2)}px)`,
          color: toColor,
        },
      ], { duration: PRICE_TRANSITION_DURATION, easing, fill: "both" }),
    ];

    try {
      await animateProgress(PRICE_TRANSITION_DURATION, (progress) => {
        const eased = easeInOutCubic(progress);
        renderDigits(priceCounterValue, String(Math.round(fromValue + (toValue - fromValue) * eased)));
      });
      commitSlide(nextIndex, previousIndex, options);
    } finally {
      animations.forEach((animation) => animation.cancel());
      priceCounter.classList.remove("is-visible");
      nextSlide.classList.remove("is-price-next");
      stage.classList.remove("is-price-counting");
      priceBackdrop.classList.remove("is-running");
      priceTransitionRunning = false;
    }
  }

  function isPlanetTransition(previousIndex, nextIndex) {
    return nextIndex === previousIndex + 1
      && Boolean(slides[previousIndex]?.hasAttribute("data-planet-exit"));
  }

  function animateProgress(duration, onFrame) {
    return new Promise((resolve) => {
      const startedAt = performance.now();
      const step = (now) => {
        const progress = clamp01((now - startedAt) / duration);
        onFrame(progress);
        if (progress < 1) {
          planetFrame = window.requestAnimationFrame(step);
          return;
        }
        planetFrame = null;
        resolve();
      };
      planetFrame = window.requestAnimationFrame(step);
    });
  }

  // Сфера выезжает из-за правого края и проходит через весь кадр влево,
  // открывая за собой следующий слайд.
  //
  // Шов между слайдами — вертикальная линия ровно по центру сферы. Он всегда
  // спрятан под диском: в своей центральной колонке диск имеет полную высоту
  // (диаметр 1.35 высоты кадра), то есть перекрывает шов с запасом сверху и
  // снизу. Позиция сферы и позиция шва считаются в одном кадре из одного
  // значения прогресса — рассинхрона между ними быть не может.
  async function runPlanetTransition(nextIndex, previousIndex, options) {
    if (planetTransitionRunning) return;
    const nextSlideElement = slides[nextIndex];
    if (!nextSlideElement) {
      commitSlide(nextIndex, previousIndex, options);
      return;
    }

    planetTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();

    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const diameter = stageHeight * PLANET_DIAMETER_RATIO;
    const radius = diameter / 2;
    const fromX = stageWidth + radius;
    const toX = -radius;

    planetWipeBody.style.width = `${diameter}px`;
    planetWipeBody.style.height = `${diameter}px`;
    planetWipeBody.style.left = "0px";
    planetWipeBody.style.top = `${stageHeight / 2}px`;

    const render = (progress) => {
      // Скорость намеренно постоянная. С ease-in-out пик скорости приходится
      // на середину пути — то есть ровно на проход по кадру, и вытирание
      // проскакивает. Рывка на старте не видно: сфера стартует за краем.
      const centerX = fromX + (toX - fromX) * progress;
      const seam = Math.max(0, Math.min(stageWidth, centerX));
      planetWipeBody.style.transform = `translate(-50%, -50%) translateX(${centerX.toFixed(2)}px)`;
      nextSlideElement.style.clipPath = `inset(0 0 0 ${seam.toFixed(2)}px)`;
    };

    render(0);
    nextSlideElement.classList.add("is-planet-next");
    planetWipe.classList.add("is-running");

    // Солнечная система уходит вместе с приходом сферы. Иначе слева от неё
    // до самого конца прохода остаётся видно ядро с логотипом ReAlgo и
    // планеты команды — в кадре оказывается два разных шара сразу.
    // К 480мс сфера уже перевалила за середину кадра, так что система
    // успевает исчезнуть до того, как проход дойдёт до её места.
    const solar = slides[previousIndex]?.querySelector(".solar");
    const solarFade = solar?.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 480, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "both" },
    );

    try {
      await animateProgress(PLANET_FLIGHT_DURATION, render);
      commitSlide(nextIndex, previousIndex, options);
    } finally {
      window.cancelAnimationFrame(planetFrame);
      planetFrame = null;
      solarFade?.cancel();
      nextSlideElement.classList.remove("is-planet-next");
      nextSlideElement.style.removeProperty("clip-path");
      planetWipe.classList.remove("is-running");
      planetTransitionRunning = false;
    }
  }

  async function runMarketMetricTransition(nextIndex, previousIndex, options) {
    if (marketTransitionRunning) return;
    const previousSlide = slides[previousIndex];
    const nextSlide = slides[nextIndex];
    const fromMetric = readMarketMetric(previousSlide);
    const toMetric = readMarketMetric(nextSlide);
    if (!fromMetric || !toMetric || typeof Element.prototype.animate !== "function") {
      commitSlide(nextIndex, previousIndex, options);
      return;
    }

    marketTransitionRunning = true;
    activeViewTransition?.skipTransition();
    clearMagicMoveElements();
    const increasing = toMetric.value >= fromMetric.value;
    const copyAnimations = animateMarketCopy(previousSlide, nextSlide, increasing);
    nextSlide.classList.add("is-market-next");
    stage.classList.add("is-market-counting");
    marketCounter.classList.add("is-visible");
    renderMarketCounter(fromMetric.value, fromMetric.decimals > 0 ? 1 : 0, fromMetric.percent ? 1 : 0);

    try {
      await Promise.all([
        animateMarketCounter(fromMetric, toMetric, 1280),
        ...copyAnimations.map((animation) => animation.finished.catch(() => {})),
      ]);
      commitSlide(nextIndex, previousIndex, options);
    } finally {
      copyAnimations.forEach((animation) => animation.cancel());
      nextSlide.classList.remove("is-market-next");
      stage.classList.remove("is-market-counting");
      marketCounter.classList.remove("is-visible");
      marketTransitionRunning = false;
    }
  }

  function commitSlide(nextSlide, previousSlide, options = {}) {
    currentSlide = nextSlide;
    const logicalSlideElement = slides[currentSlide];
    const currentSlideElement = visualSlideAt(currentSlide);
    const previousSlideElement = visualSlideAt(previousSlide);
    const logicalProductMode = logicalProductModes[currentSlide];
    stage.dataset.theme = logicalSlideElement.dataset.theme || "dark";
    stage.dataset.extensionStep = currentSlide === extensionPromptSlideIndex
      ? "prompt"
      : currentSlide === extensionIntroSlideIndex ? "intro" : "";
    if (logicalProductMode) stage.dataset.productMode = logicalProductMode;
    else delete stage.dataset.productMode;

    const persistentProductSlot = currentSlideElement.querySelector(".macbook-3d-slot");
    const logicalProductSlot = logicalSlideElement.querySelector(".macbook-3d-slot");
    if (persistentProductSlot && logicalProductMode) {
      persistentProductSlot.dataset.macbookMode = logicalProductMode;
      if (logicalProductSlot?.getAttribute("aria-label")) {
        persistentProductSlot.setAttribute("aria-label", logicalProductSlot.getAttribute("aria-label"));
      }
    }

    slides.forEach((slide, slideIndex) => {
      const isVisualSlide = slide === currentSlideElement;
      slide.classList.toggle("is-active", isVisualSlide);
      slide.classList.toggle("is-before", !isVisualSlide && slideIndex < currentSlide);
      slide.classList.toggle("is-after", !isVisualSlide && slideIndex > currentSlide);
      slide.setAttribute("aria-hidden", isVisualSlide ? "false" : "true");
    });

    if (currentSlideElement === roadmapBuilderSlide && previousSlideElement !== roadmapBuilderSlide) {
      roadmapBuilderStage = nextSlide < previousSlide ? ROADMAP_BUILDER_STAGES : 0;
      roadmapBuilderSlide.dataset.roadmapStage = String(roadmapBuilderStage);
    } else if (currentSlideElement !== roadmapBuilderSlide && roadmapBuilderSlide) {
      roadmapBuilderStage = 0;
      roadmapBuilderSlide.dataset.roadmapStage = "0";
    }

    currentSlideElement.querySelectorAll("[data-product-note]").forEach((note) => {
      note.hidden = note.dataset.productNote !== logicalProductMode;
    });

    if (currentSlideElement.classList.contains("journey-route")) {
      startJourneyRouteAnimation(currentSlideElement);
    } else {
      stopJourneyRouteAnimation();
    }

    window.dispatchEvent(new CustomEvent("realgo:slidechange", {
      detail: { index: currentSlide, slide: currentSlideElement, logicalSlide: logicalSlideElement },
    }));

    runCountUp(currentSlideElement);
    runTaxonomyCountUp(currentSlideElement);

    if (previousSlideElement === teamSlide && currentSlideElement !== teamSlide) {
      stopTeamRotation();
    }
    if (currentSlideElement === teamSlide && previousSlideElement !== teamSlide) {
      startTeamRotation();
    }

    if (roadmapSlide) {
      if (currentSlideElement === roadmapSlide) startRoadmapCycle();
      else stopRoadmapCycle();
    }

    const progress = (currentSlide + 1) / slides.length;
    progressBar.style.transform = `scaleX(${progress})`;
    slideCounter.textContent = `${formatSlideNumber(currentSlide + 1)} / ${formatSlideNumber(slides.length)}`;
    updateDots();

    if (!options.skipHash) {
      window.history.replaceState(null, "", `#${currentSlide + 1}`);
    }
  }

  function showSlide(index, options = {}) {
    if ((activeViewTransition || coverVideoTransitionRunning) && !options.instant) return;

    const nextSlide = Math.max(0, Math.min(index, slides.length - 1));
    const previousSlide = currentSlide;

    const canPlayCoverTransition = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isCoverVideoTransition(previousSlide, nextSlide);

    if (canPlayCoverTransition) {
      runCoverVideoTransition(nextSlide, previousSlide, options);
      return;
    }

    // Slides 6 and 7 share identical geometry. Switch the static scene
    // directly so the single moving SVG cover mask is the only transition
    // surface; a View Transition snapshot would hide or retime that wipe.
    if (nextSlide !== previousSlide
      && !options.instant
      && isJourneyRouteTransition(previousSlide, nextSlide)) {
      activeViewTransition?.skipTransition();
      clearMagicMoveElements();
      commitSlide(nextSlide, previousSlide, options);
      return;
    }

    // Явная метка перехода имеет приоритет над остальными сценариями.
    const canBlackout = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isBlackoutTransition(previousSlide, nextSlide);

    if (canBlackout) {
      runBlackoutTransition(nextSlide, previousSlide, options);
      return;
    }

    const canCrossFade = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isCrossFadeTransition(previousSlide, nextSlide);

    if (canCrossFade) {
      runCrossFadeTransition(nextSlide, previousSlide, options);
      return;
    }

    const canFlyPlanet = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isPlanetTransition(previousSlide, nextSlide);

    if (canFlyPlanet) {
      runPlanetTransition(nextSlide, previousSlide, options);
      return;
    }

    const canCountPrice = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isPriceTransition(previousSlide, nextSlide);

    if (canCountPrice) {
      runPriceTransition(nextSlide, previousSlide, options);
      return;
    }

    // Slides 8 → 9 retain identical shade and copy. A copy cross-fade would
    // briefly expose two gradients and drive the headline near zero opacity.
    // Swap the slide root in one paint and leave motion exclusively to the
    // persistent extension card mounted by product-ui-source.tsx.
    const canRevealExtension = nextSlide !== previousSlide
      && !options.instant
      && isExtensionRevealTransition(previousSlide, nextSlide);

    if (canRevealExtension) {
      runExtensionRevealTransition(nextSlide, previousSlide, options);
      return;
    }

    const canFadeProductCopy = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isProductCopyTransition(previousSlide, nextSlide);

    if (canFadeProductCopy) {
      runProductCopyTransition(nextSlide, previousSlide, options);
      return;
    }

    const canAnimateMarketMetric = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && isMarketMetricTransition(previousSlide, nextSlide);

    if (canAnimateMarketMetric) {
      runMarketMetricTransition(nextSlide, previousSlide, options);
      return;
    }

    const canAnimate = nextSlide !== previousSlide
      && !reduceMotion
      && !options.instant
      && typeof document.startViewTransition === "function";

    if (!canAnimate) {
      delete document.documentElement.dataset.marketNumberDirection;
      commitSlide(nextSlide, previousSlide, options);
      return;
    }

    const transitionSequence = ++viewTransitionSequence;
    activeViewTransition?.skipTransition();
    const movePairs = prepareMagicMove(previousSlide, nextSlide);
    setMarketNumberDirection(previousSlide, nextSlide);
    document.documentElement.dataset.slideDirection = nextSlide > previousSlide ? "forward" : "backward";
    document.documentElement.classList.add("is-slide-transitioning");

    try {
      activeViewTransition = document.startViewTransition(() => {
        movePairs.forEach(({ previousElement, nextElement, name }) => {
          previousElement.style.removeProperty("view-transition-name");
          nextElement.style.viewTransitionName = name;
        });
        commitSlide(nextSlide, previousSlide, options);
      });

      activeViewTransition.finished
        .catch(() => {})
        .finally(() => {
          if (transitionSequence !== viewTransitionSequence) return;
          clearMagicMoveElements();
          document.documentElement.classList.remove("is-slide-transitioning");
          delete document.documentElement.dataset.slideDirection;
          delete document.documentElement.dataset.marketNumberDirection;
          activeViewTransition = null;
        });
    } catch (error) {
      clearMagicMoveElements();
      document.documentElement.classList.remove("is-slide-transitioning");
      delete document.documentElement.dataset.slideDirection;
      delete document.documentElement.dataset.marketNumberDirection;
      activeViewTransition = null;
      commitSlide(nextSlide, previousSlide, options);
    }
  }

  function nextSlide() {
    if (visualSlideAt(currentSlide) === roadmapBuilderSlide && roadmapBuilderStage < ROADMAP_BUILDER_STAGES) {
      roadmapBuilderStage += 1;
      roadmapBuilderSlide.dataset.roadmapStage = String(roadmapBuilderStage);
      return;
    }
    showSlide(currentSlide + 1);
  }

  function previousSlide() {
    if (visualSlideAt(currentSlide) === roadmapBuilderSlide && roadmapBuilderStage > 0) {
      roadmapBuilderStage -= 1;
      roadmapBuilderSlide.dataset.roadmapStage = String(roadmapBuilderStage);
      return;
    }
    showSlide(currentSlide - 1);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function toggleNotes() {
    stage.classList.toggle("notes-visible");
  }

  function toggleHelp(force) {
    const shouldShow = typeof force === "boolean" ? force : !help.classList.contains("is-visible");
    help.classList.toggle("is-visible", shouldShow);
    help.setAttribute("aria-hidden", shouldShow ? "false" : "true");
  }

  function updateTimer() {
    const elapsed = Math.max(0, Date.now() - timerStartedAt);
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function isInteractiveTarget(target) {
    return target instanceof Element && Boolean(target.closest("a, button, video"));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "?") {
      event.preventDefault();
      toggleHelp();
      return;
    }

    if (event.key === "Escape" && help.classList.contains("is-visible")) {
      toggleHelp(false);
      return;
    }

    if (["ArrowRight", "ArrowDown", "PageDown"].includes(event.key)) {
      event.preventDefault();
      nextSlide();
      return;
    }

    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) {
      event.preventDefault();
      previousSlide();
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      showSlide(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      showSlide(slides.length - 1);
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      nextSlide();
      return;
    }

    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      toggleNotes();
      return;
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFullscreen();
      return;
    }

    if (event.key.toLowerCase() === "r") {
      timerStartedAt = Date.now();
      updateTimer();
    }
  });

  document.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      const action = actionTarget.dataset.action;
      if (action === "next") nextSlide();
      if (action === "prev") previousSlide();
      return;
    }

    if (!isInteractiveTarget(event.target) && event.detail === 2) {
      toggleFullscreen();
    }
  });

  stage.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });

  stage.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const distance = touchEndX - touchStartX;
    touchStartX = null;
    if (Math.abs(distance) < 60) return;
    if (distance < 0) nextSlide();
    if (distance > 0) previousSlide();
  }, { passive: true });

  teamHandles.forEach((button) => {
    button.addEventListener("click", () => {
      activateTeamMember(Number(button.dataset.teamIndex));
      restartTeamRotation();
    });
  });

  window.addEventListener("resize", () => {
    resizeStage();
    requestAnimationFrame(layoutJourneyPaths);
    requestAnimationFrame(buildTaxonomyConnections);
  });
  window.addEventListener("hashchange", () => {
    const hashSlide = getInitialSlide();
    if (hashSlide !== currentSlide) showSlide(hashSlide, { skipHash: true });
  });

  buildPreparationFields();
  layoutJourneyPaths();
  buildTaxonomyGraphFields();
  buildDots();
  calibrateCounterMetrics();
  applyDigitSlotsToStaticNumbers();
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      calibrateCounterMetrics();
      applyDigitSlotsToStaticNumbers();
      // Слот мог измениться после подмены фолбэка на Manrope — пересчитываем резерв.
      countUpTargets.forEach((element) => {
        if (element.style.minWidth) reserveCountUpWidth(element);
      });
      requestAnimationFrame(layoutJourneyPaths);
      requestAnimationFrame(buildTaxonomyConnections);
    });
  }
  resizeStage();
  requestAnimationFrame(layoutJourneyPaths);
  requestAnimationFrame(buildTaxonomyConnections);
  showSlide(currentSlide, { skipHash: true });
  if (slides[currentSlide] === teamSlide) {
    startTeamRotation();
  }
  updateTimer();
  window.setInterval(updateTimer, 1000);
})();

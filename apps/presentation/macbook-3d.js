import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CSS3DObject, CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";

const MODEL_URL = "assets/models/macbook-pro-m3-16.glb";
const SCREEN_MATERIAL = "sfCQkHOWyrsLmor";
const KEYBOARD_ENGRAVING_MATERIAL = "sIfSZcqgDlKMJPf";
const SCREEN_WIDTH = 1600;
const SCREEN_HEIGHT = 1000;
// Cancel the 9.5-10.5% rightward lift and leave the settled window slightly
// inside the display bezel. The factor is multiplied by lift progress, so the
// original resting position remains unchanged.
const EXTENSION_SETTLED_SHIFT_LEFT = 0.115;
const CAMERA_MOVE_MS = 3800;
const FIRST_SHOT_HOLD_MS = 1800;
const stage = document.getElementById("stage");
const slots = Array.from(document.querySelectorAll(".macbook-3d-slot"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (stage && slots.length) {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.54;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = "macbook-3d-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.className = "macbook-css3d-renderer";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
  camera.position.set(0, 0.08, 5.2);
  camera.lookAt(0, 0, 0);

  const modelPivot = new THREE.Group();
  scene.add(modelPivot);

  const shotPoses = {
    wide: {
      camera: new THREE.Vector3(0.42, 0.16, 6.8),
      lookAt: new THREE.Vector3(0.3, 0.03, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 26,
      arc: 1,
      position: new THREE.Vector3(0.58, -0.24, 0),
      rotation: new THREE.Vector3(-0.045, -0.035, 0),
    },
    extension: {
      camera: new THREE.Vector3(0.68, 0.2, 4.5),
      lookAt: new THREE.Vector3(0.55, 0.11, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 26,
      arc: 1,
      position: new THREE.Vector3(0.64, -0.15, 0.02),
      rotation: new THREE.Vector3(-0.058, -0.06, 0),
    },
    extensionIntro: {
      camera: new THREE.Vector3(0.68, 0.2, 4.5),
      lookAt: new THREE.Vector3(0.55, 0.11, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 26,
      arc: 1,
      position: new THREE.Vector3(0.64, -0.15, 0.02),
      rotation: new THREE.Vector3(-0.058, -0.06, 0),
    },
    agent: {
      camera: new THREE.Vector3(0.98, 0.24, 3.92),
      lookAt: new THREE.Vector3(0.73, 0.14, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 25,
      arc: -1,
      position: new THREE.Vector3(0.82, -0.12, 0.04),
      rotation: new THREE.Vector3(-0.052, 0.028, 0),
    },
    agentScreen: {
      camera: new THREE.Vector3(0, 0.2, 4.2),
      lookAt: new THREE.Vector3(0, 0.1, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 24.5,
      arc: -1,
      position: new THREE.Vector3(0.66, -0.13, 0.02),
      rotation: new THREE.Vector3(-0.045, 0, 0),
    },
    stages: {
      camera: new THREE.Vector3(1.04, 0.24, 3.35),
      lookAt: new THREE.Vector3(0.8, 0.14, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 24,
      arc: 1,
      position: new THREE.Vector3(0.78, -0.1, 0.05),
      rotation: new THREE.Vector3(-0.045, 0.055, -0.002),
    },
    rating: {
      camera: new THREE.Vector3(1.08, 0.2, 3.05),
      lookAt: new THREE.Vector3(0.82, 0.1, 0),
      up: new THREE.Vector3(0, 1, 0),
      fov: 23.5,
      arc: -1,
      position: new THREE.Vector3(0.72, -0.08, 0.04),
      rotation: new THREE.Vector3(-0.035, -0.015, 0.004),
    },
  };

  function clonePose(pose) {
    return {
      camera: pose.camera.clone(),
      lookAt: pose.lookAt.clone(),
      up: pose.up.clone(),
      fov: pose.fov,
      arc: pose.arc,
      position: pose.position.clone(),
      rotation: pose.rotation.clone(),
    };
  }

  const currentPose = clonePose(shotPoses.wide);
  let shotFrom = clonePose(shotPoses.wide);
  let shotTo = clonePose(shotPoses.extension);
  const shotControlA = new THREE.Vector3();
  const shotControlB = new THREE.Vector3();
  let shotStartedAt = performance.now();

  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = environmentGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.16;
  environmentGenerator.dispose();

  const lightTarget = new THREE.Object3D();
  lightTarget.position.set(0, -0.18, 0);
  scene.add(lightTarget);

  const keyLight = new THREE.SpotLight(0xe9f1ff, 0, 14, Math.PI * 0.16, 0.46, 1.15);
  keyLight.position.set(-3.6, 4.6, 5.2);
  keyLight.target = lightTarget;
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 14;
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);

  const edgeLight = new THREE.SpotLight(0x64adff, 0, 13, Math.PI * 0.18, 0.56, 1.25);
  edgeLight.position.set(4.8, 2.5, 3.2);
  edgeLight.target = lightTarget;
  scene.add(edgeLight);

  const fillLight = new THREE.PointLight(0x8fa8c9, 0, 9, 1.6);
  fillLight.position.set(1.4, 0.5, 3.8);
  scene.add(fillLight);

  const topLight = new THREE.SpotLight(0xffffff, 0, 10, Math.PI * 0.26, 0.72, 1.4);
  topLight.position.set(0.4, 5.5, 0.5);
  topLight.target = lightTarget;
  scene.add(topLight);

  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = SCREEN_WIDTH;
  screenCanvas.height = SCREEN_HEIGHT;
  const screenOutputContext = screenCanvas.getContext("2d");
  const screenArtwork = document.createElement("canvas");
  screenArtwork.width = SCREEN_WIDTH;
  screenArtwork.height = SCREEN_HEIGHT;
  const screenContext = screenArtwork.getContext("2d");
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.flipY = false;
  screenTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  let model = null;
  let activeSlot = null;
  let activeMode = "extension";
  let sceneActive = false;
  let screenStoryStartedAt = performance.now();
  let agentTypingStartsAfter = Number.POSITIVE_INFINITY;
  let agentTypingAnnounced = false;
  let lastScreenStoryKey = "";
  let contactShadow = null;
  let contactBaseY = 0;
  let revealStartedAt = performance.now();
  let screenPlaneWidth = 0;
  let screenPlaneHeight = 0;
  let screenCenter = null;
  let screenNormal = null;
  let screenUp = null;
  let screenRight = null;
  let productUiObject = null;
  let productScreenShadow = null;
  let trackedPanel = null;
  let trackedPanelWidth = 400;
  let trackedPanelHeight = 372;
  const planeCenter = new THREE.Vector3();
  const screenBasisMatrix = new THREE.Matrix4();
  const panelResizeObserver = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      if (!entry || entry.target !== trackedPanel) return;
      const borderSize = Array.isArray(entry.borderBoxSize)
        ? entry.borderBoxSize[0]
        : entry.borderBoxSize;
      trackedPanelWidth = borderSize?.inlineSize || entry.contentRect.width || trackedPanelWidth;
      trackedPanelHeight = borderSize?.blockSize || entry.contentRect.height || trackedPanelHeight;
    });

  function roundedRect(context, x, y, width, height, radius) {
    const corner = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + corner, y);
    context.arcTo(x + width, y, x + width, y + height, corner);
    context.arcTo(x + width, y + height, x, y + height, corner);
    context.arcTo(x, y + height, x, y, corner);
    context.arcTo(x, y, x + width, y, corner);
    context.closePath();
  }

  function fillRoundedRect(context, x, y, width, height, radius, color) {
    roundedRect(context, x, y, width, height, radius);
    context.fillStyle = color;
    context.fill();
  }

  function drawText(context, text, x, y, size, color, weight = 500, family = "Inter") {
    context.fillStyle = color;
    context.font = `${weight} ${size}px ${family}, sans-serif`;
    context.fillText(text, x, y);
  }

  function drawExtensionScreen(mode = activeMode, elapsed = 0) {
    const context = screenContext;
    context.fillStyle = "#0f1115";
    context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    context.fillStyle = "#17191e";
    context.fillRect(0, 0, SCREEN_WIDTH, 72);
    context.fillStyle = "#292d34";
    context.fillRect(0, 71, SCREEN_WIDTH, 2);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((color, index) => {
      context.beginPath();
      context.arc(34 + index * 28, 36, 8, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    });
    fillRoundedRect(context, 382, 17, 834, 39, 10, "#0d0f13");
    drawText(context, "leetcode.com/problems/longest-substring-without-repeating-characters", 446, 43, 14, "#7d8590", 500, "JetBrains Mono");

    context.fillStyle = "#111318";
    context.fillRect(0, 73, 640, 927);
    context.fillStyle = "#0d0f13";
    context.fillRect(642, 73, 958, 927);
    context.fillStyle = "#292d34";
    context.fillRect(640, 73, 2, 927);
    drawText(context, "Description     Editorial     Solutions", 34, 118, 16, "#8b929d", 500);
    drawText(context, "3. Longest Substring Without", 42, 190, 29, "#f0f3f6", 650);
    drawText(context, "Repeating Characters", 42, 230, 29, "#f0f3f6", 650);
    fillRoundedRect(context, 42, 258, 104, 34, 8, "rgba(255, 161, 22, 0.13)");
    drawText(context, "Medium", 61, 281, 14, "#ffa116", 650, "JetBrains Mono");
    drawText(context, "Given a string s, find the length of the", 42, 350, 17, "#b4bbc5", 500);
    drawText(context, "longest substring without repeating characters.", 42, 384, 17, "#b4bbc5", 500);
    drawText(context, "Example 1", 42, 458, 20, "#f0f3f6", 650);
    fillRoundedRect(context, 42, 482, 554, 176, 12, "#1a1d23");
    drawText(context, 'Input:  s = "abcabcbb"', 68, 530, 16, "#c9d1d9", 500, "JetBrains Mono");
    drawText(context, "Output: 3", 68, 571, 16, "#c9d1d9", 500, "JetBrains Mono");
    drawText(context, 'The answer is "abc".', 68, 612, 16, "#8b929d", 500, "JetBrains Mono");

    drawText(context, "C++", 675, 119, 15, "#d7dce2", 600, "JetBrains Mono");
    context.fillStyle = "#292d34";
    context.fillRect(642, 139, 958, 2);

    const agentTypingElapsed = mode === "agent" ? elapsed - agentTypingStartsAfter : 0;
    const isSolved = mode === "rating" || (mode === "agent" && agentTypingElapsed >= 4100);
    const typingProgress = mode === "rating"
      ? 1
      : mode === "agent"
        ? THREE.MathUtils.clamp(agentTypingElapsed / 3600, 0, 1)
        : 0;
    const fixedCode = [
      ["class Solution {", "#ff7b72", 710],
      ["public:", "#ff7b72", 742],
      ["int lengthOfLongestSubstring(string s) {", "#c9d1d9", 742],
    ];
    fixedCode.forEach(([line, color, x], index) => drawText(context, line, x, 202 + index * 42, 18, color, 500, "JetBrains Mono"));

    const solutionBody = [
      ["unordered_map<char, int> last;", "#c9d1d9", 782],
      ["int left = 0, answer = 0;", "#79c0ff", 782],
      ["for (int right = 0; right < s.size(); right++) {", "#c9d1d9", 782],
      ["if (last.count(s[right]))", "#c9d1d9", 822],
      ["left = max(left, last[s[right]] + 1);", "#79c0ff", 862],
      ["last[s[right]] = right;", "#c9d1d9", 822],
      ["answer = max(answer, right - left + 1);", "#c9d1d9", 822],
      ["}", "#c9d1d9", 782],
      ["return answer;", "#ff7b72", 782],
    ];
    const totalCharacters = solutionBody.reduce((sum, [line]) => sum + line.length, 0);
    let visibleCharacters = Math.floor(totalCharacters * typingProgress);
    let cursor = null;
    solutionBody.forEach(([line, color, x], index) => {
      const visibleLine = line.slice(0, Math.max(0, visibleCharacters));
      if (visibleLine) drawText(context, visibleLine, x, 328 + index * 42, 18, color, 500, "JetBrains Mono");
      if (visibleCharacters >= 0 && visibleCharacters < line.length && cursor === null) {
        cursor = { x: x + context.measureText(visibleLine).width + 3, y: 308 + index * 42 };
      }
      visibleCharacters -= line.length;
    });

    if (typingProgress === 0) {
      drawText(context, "// Write your solution here", 782, 342, 18, "#59616c", 500, "JetBrains Mono");
      cursor = { x: 782, y: 360 };
    }
    drawText(context, "}", 742, 748, 18, "#c9d1d9", 500, "JetBrains Mono");
    drawText(context, "};", 710, 790, 18, "#c9d1d9", 500, "JetBrains Mono");
    if (!isSolved && cursor && Math.floor(elapsed / 420) % 2 === 0) {
      context.fillStyle = "#58a6ff";
      context.fillRect(cursor.x, cursor.y, 2, 23);
    }

    if (isSolved) {
      fillRoundedRect(context, 690, 835, 850, 92, 13, "#0f1c14");
      context.strokeStyle = "#1f7139";
      context.lineWidth = 2;
      roundedRect(context, 690, 835, 850, 92, 13);
      context.stroke();
      drawText(context, "✓  ACCEPTED", 722, 891, 23, "#3fb950", 700, "JetBrains Mono");
      drawText(context, "Runtime 3 ms", 1260, 890, 16, "#7d8590", 500, "JetBrains Mono");
    } else {
      fillRoundedRect(context, 690, 835, 850, 92, 13, "#11151b");
      context.strokeStyle = "#292f38";
      context.lineWidth = 2;
      roundedRect(context, 690, 835, 850, 92, 13);
      context.stroke();
      drawText(context, typingProgress > 0 ? "Editing solution…" : "Testcase", 722, 891, 16, "#7d8590", 500, "JetBrains Mono");
      fillRoundedRect(context, 1285, 855, 104, 48, 9, "#262b33");
      drawText(context, "Run", 1318, 886, 15, "#d7dce2", 650, "JetBrains Mono");
      fillRoundedRect(context, 1403, 855, 113, 48, 9, "#1f6f3d");
      drawText(context, "Submit", 1421, 886, 15, "#effff4", 650, "JetBrains Mono");
    }
  }

  function commitScreenTexture() {
    screenOutputContext.setTransform(1, 0, 0, 1, 0, 0);
    screenOutputContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    screenOutputContext.translate(0, SCREEN_HEIGHT);
    screenOutputContext.scale(1, -1);
    screenOutputContext.drawImage(screenArtwork, 0, 0);
    screenOutputContext.setTransform(1, 0, 0, 1, 0, 0);
    // Physical-display texture: mostly invisible in wide shots, but individual
    // RGB columns and the row grid emerge naturally during the camera dolly.
    screenOutputContext.save();
    screenOutputContext.globalAlpha = 0.012;
    for (let x = 0; x < SCREEN_WIDTH; x += 6) {
      screenOutputContext.fillStyle = "#ff3158";
      screenOutputContext.fillRect(x, 0, 1, SCREEN_HEIGHT);
      screenOutputContext.fillStyle = "#42ff8a";
      screenOutputContext.fillRect(x + 1, 0, 1, SCREEN_HEIGHT);
      screenOutputContext.fillStyle = "#3a7cff";
      screenOutputContext.fillRect(x + 2, 0, 1, SCREEN_HEIGHT);
    }
    screenOutputContext.globalAlpha = 0.025;
    screenOutputContext.fillStyle = "#000";
    for (let y = 0; y < SCREEN_HEIGHT; y += 4) screenOutputContext.fillRect(0, y, SCREEN_WIDTH, 1);
    screenOutputContext.restore();
    screenTexture.needsUpdate = true;
  }

  function drawScreen(mode, restartVideo = false) {
    activeMode = Object.hasOwn(shotPoses, mode) ? mode : "extension";
    screenStoryStartedAt = performance.now();
    agentTypingStartsAfter = Number.POSITIVE_INFINITY;
    agentTypingAnnounced = false;
    lastScreenStoryKey = "";
    drawExtensionScreen(activeMode, 0);
    commitScreenTexture();
  }

  function updateScreenStory(now) {
    const elapsed = Math.max(0, now - screenStoryStartedAt);
    const progress = activeMode === "agent"
      ? THREE.MathUtils.clamp((elapsed - agentTypingStartsAfter) / 3600, 0, 1)
      : activeMode === "rating" ? 1 : 0;
    const solved = activeMode === "rating" || (activeMode === "agent" && elapsed - agentTypingStartsAfter >= 4100);
    if (activeMode === "agent" && progress > 0 && !agentTypingAnnounced) {
      agentTypingAnnounced = true;
      window.dispatchEvent(new CustomEvent("realgo:codetypingstart"));
    }
    const storyKey = `${activeMode}:${Math.floor(progress * 260)}:${solved}:${Math.floor(elapsed / 420) % 2}`;
    if (storyKey === lastScreenStoryKey) return;
    lastScreenStoryKey = storyKey;
    drawExtensionScreen(activeMode, elapsed);
    commitScreenTexture();
  }

  function resizeRenderer() {
    if (!activeSlot) return;
    const width = Math.max(1, activeSlot.clientWidth);
    const height = Math.max(1, activeSlot.clientHeight);
    renderer.setSize(width, height, false);
    cssRenderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function copyPose(target, source) {
    target.camera.copy(source.camera);
    target.lookAt.copy(source.lookAt);
    target.up.copy(source.up);
    target.fov = source.fov;
    target.arc = source.arc;
    target.position.copy(source.position);
    target.rotation.copy(source.rotation);
  }

  function cubicBezierVector(target, start, controlA, controlB, end, progress) {
    const inverse = 1 - progress;
    target.copy(start).multiplyScalar(inverse * inverse * inverse)
      .addScaledVector(controlA, 3 * inverse * inverse * progress)
      .addScaledVector(controlB, 3 * inverse * progress * progress)
      .addScaledVector(end, progress * progress * progress);
  }

  function startCameraMove(mode, enterFromWide = false, immediate = false) {
    if (enterFromWide) copyPose(currentPose, shotPoses.wide);
    copyPose(shotFrom, currentPose);
    copyPose(shotTo, shotPoses[mode] || shotPoses.extension);
    const travel = shotTo.camera.clone().sub(shotFrom.camera);
    const travelDistance = travel.length();
    // Adjacent close-up modes intentionally share one optical pose. Do not
    // build a decorative Bezier arc for a zero-distance move: its synthetic
    // lift/side controls make the supposedly fixed top edge drift by pixels.
    if (travelDistance < 0.0001) {
      copyPose(currentPose, shotTo);
      copyPose(shotFrom, shotTo);
      shotControlA.copy(shotTo.camera);
      shotControlB.copy(shotTo.camera);
      shotStartedAt = performance.now() - CAMERA_MOVE_MS;
      return;
    }
    const averageUp = shotFrom.up.clone().add(shotTo.up).normalize();
    const side = travel.clone().cross(averageUp);
    if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
    side.normalize().multiplyScalar((shotTo.arc || 1) * Math.min(0.18, 0.06 + travelDistance * 0.055));
    const lift = averageUp.multiplyScalar(Math.min(0.16, 0.07 + travelDistance * 0.035));
    shotControlA.copy(shotFrom.camera).addScaledVector(travel, 0.3).add(lift).add(side);
    shotControlB.copy(shotFrom.camera).addScaledVector(travel, 0.72).add(lift).add(side);
    shotStartedAt = performance.now() + (enterFromWide && mode === "extension" ? FIRST_SHOT_HOLD_MS : 0);
    if (immediate || reduceMotion) copyPose(currentPose, shotTo);
  }

  function updateCameraMove(now) {
    const progress = reduceMotion
      ? 1
      : THREE.MathUtils.clamp((now - shotStartedAt) / CAMERA_MOVE_MS, 0, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    cubicBezierVector(currentPose.camera, shotFrom.camera, shotControlA, shotControlB, shotTo.camera, eased);
    currentPose.lookAt.lerpVectors(shotFrom.lookAt, shotTo.lookAt, eased);
    currentPose.up.lerpVectors(shotFrom.up, shotTo.up, eased).normalize();
    currentPose.fov = THREE.MathUtils.lerp(shotFrom.fov, shotTo.fov, eased);
    currentPose.position.lerpVectors(shotFrom.position, shotTo.position, eased);
    currentPose.rotation.lerpVectors(shotFrom.rotation, shotTo.rotation, eased);

    // Close product shots must be optically locked. Even a tiny idle drift is
    // magnified by the projected DOM plane and reads as camera shake.
    const idle = reduceMotion || sceneActive ? 0 : Math.sin(now * 0.00048) * 0.006;
    camera.position.copy(currentPose.camera);
    camera.up.copy(currentPose.up);
    camera.fov = currentPose.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(currentPose.lookAt);
    modelPivot.position.copy(currentPose.position);
    modelPivot.position.y += idle;
    modelPivot.rotation.set(
      currentPose.rotation.x,
      currentPose.rotation.y + idle * 0.45,
      currentPose.rotation.z
    );
    if (contactShadow) {
      contactShadow.position.set(
        currentPose.position.x,
        contactBaseY + currentPose.position.y + 0.006,
        0.24 + currentPose.position.z
      );
    }
  }

  function trackPanelMetrics(ui) {
    if (trackedPanel === ui) return;
    panelResizeObserver?.disconnect();
    trackedPanel = ui;
    // Read layout once when React mounts a new production component. The
    // animation loop thereafter uses cached metrics supplied by ResizeObserver,
    // so projecting the plane never forces synchronous layout on every frame.
    trackedPanelWidth = ui.offsetWidth || 400;
    trackedPanelHeight = ui.offsetHeight || (activeMode === "agent" || activeMode === "stages" ? 520 : 372);
    panelResizeObserver?.observe(ui, { box: "border-box" });
  }

  function detachProductObject() {
    if (productUiObject) {
      productUiObject.removeFromParent();
      productUiObject = null;
    }
    if (productScreenShadow) {
      productScreenShadow.visible = false;
      productScreenShadow.material.opacity = 0;
    }
    panelResizeObserver?.disconnect();
    trackedPanel = null;
  }

  function ensureProductScreenShadow() {
    if (productScreenShadow) return productScreenShadow;
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const context = shadowCanvas.getContext("2d");
    context.shadowColor = "rgba(0, 0, 0, 0.96)";
    context.shadowBlur = 24;
    context.fillStyle = "rgba(0, 0, 0, 0.72)";
    roundedRect(context, 24, 24, 208, 208, 20);
    context.fill();
    const texture = new THREE.CanvasTexture(shadowCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    productScreenShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    productScreenShadow.name = "ReAlgo extension screen shadow";
    screenBasisMatrix.makeBasis(screenRight, screenUp, screenNormal);
    productScreenShadow.quaternion.setFromRotationMatrix(screenBasisMatrix);
    productScreenShadow.renderOrder = 12;
    productScreenShadow.visible = false;
    modelPivot.add(productScreenShadow);
    return productScreenShadow;
  }

  function ensureProductObject() {
    if (!activeSlot || !screenCenter || !screenRight || !screenUp || !screenNormal) return null;
    const slide = activeSlot.closest(".slide.is-active");
    const card = slide?.querySelector(".product-ui-card");
    const ui = card?.querySelector(".realgo-popup, .realgo-assistant");
    if (!card || !ui) {
      detachProductObject();
      return null;
    }
    if (productUiObject?.element === card) {
      trackPanelMetrics(ui);
      return productUiObject;
    }

    detachProductObject();
    card.classList.remove("is-plane-tracked");
    card.classList.add("is-css3d-object");
    card.style.removeProperty("transform");
    productUiObject = new CSS3DObject(card);
    productUiObject.name = "ReAlgo extension interface";
    screenBasisMatrix.makeBasis(screenRight, screenUp, screenNormal);
    productUiObject.quaternion.setFromRotationMatrix(screenBasisMatrix);
    modelPivot.add(productUiObject);
    trackPanelMetrics(ui);
    return productUiObject;
  }

  function updateProductObject() {
    if (!activeSlot || !screenCenter || !screenRight || !screenUp || !screenNormal || !screenPlaneWidth || !screenPlaneHeight) return;
    const object = ensureProductObject();
    if (!object) return;
    const panelWidth = trackedPanelWidth;
    // During agent -> rating React has already mounted the new, shorter UI,
    // while the outer card is still interpolating from its previous height.
    // Following the inner ResizeObserver made the CSS3D plane snap to the new
    // geometry before the visible card finished resizing. For that brief
    // interval read the animated outer height, keeping the top edge locked and
    // letting only the bottom edge travel smoothly.
    const panelHeight = object.element.classList.contains("is-height-transitioning")
      ? object.element.offsetHeight || trackedPanelHeight
      : trackedPanelHeight;
    const tallPanel = panelHeight > 450;
    const storyPanel = activeMode === "extension" || activeMode === "agent" || activeMode === "rating";
    const widthFraction = storyPanel ? 0.28 : tallPanel ? 0.27 : 0.35;
    const worldWidth = screenPlaneWidth * widthFraction;
    const worldHeight = worldWidth * panelHeight / panelWidth;
    const margin = screenPlaneWidth * 0.025;
    const panelInsetX = storyPanel ? 0.095 : 0.105;
    // Product windows stay attached to one fixed screen-relative point across
    // slides 8–11. Only their contents change; there is no depth or lateral
    // lift away from the physical display.
    const screenOffsetX = screenPlaneWidth * 0.025;
    const screenOffsetY = screenPlaneHeight * 0.02;
    const centerX = screenPlaneWidth * 0.5 - margin - worldWidth * 0.5
      + screenOffsetX
      + screenPlaneWidth * panelInsetX
      - screenPlaneWidth * EXTENSION_SETTLED_SHIFT_LEFT;
    const storyTopY = -screenPlaneHeight * 0.195 + worldWidth * (520 / 400) * 0.5;
    const settledCenterY = storyPanel ? storyTopY - worldHeight * 0.5 : -screenPlaneHeight * 0.065;
    const centerY = settledCenterY - screenOffsetY;
    planeCenter.copy(screenCenter)
      .addScaledVector(screenRight, centerX)
      .addScaledVector(screenUp, centerY)
      .addScaledVector(screenNormal, screenPlaneWidth * 0.0012);
    object.position.copy(planeCenter);
    // CSS3DObject uses one uniform world-units-per-CSS-pixel scale. The DOM
    // panel therefore keeps its native aspect ratio; camera perspective is
    // supplied by the same Three.js camera that renders the MacBook.
    object.scale.setScalar(worldWidth / panelWidth);

    // A screen-attached window does not cast a detached projected shadow.
    const screenShadow = ensureProductScreenShadow();
    screenShadow.material.opacity = 0;
    screenShadow.visible = false;
  }

  function renderNow() {
    if (!model || !activeSlot) return;
    resizeRenderer();
    const now = performance.now();
    updateCameraMove(now);
    updateScreenStory(now);
    modelPivot.updateMatrixWorld(true);
    updateProductObject();
    renderer.render(scene, camera);
    cssRenderer.render(scene, camera);
  }

  function mountSlot(slot) {
    if (!slot) return;
    const isVisible = Boolean(slot.closest(".slide.is-active"));
    const enterFromWide = isVisible && !sceneActive;
    sceneActive = isVisible;
    if (activeSlot !== slot) {
      // Slides 10–12 share one live extension card. Preserve its CSS3DObject
      // while the WebGL/CSS renderers move to the next slot; recreating it
      // caused a one-frame disappearance followed by the lift animation.
      const continuesProductSequence = Boolean(
        productUiObject && slot.closest(".slide")?.classList.contains("slide-macbook")
      );
      if (!continuesProductSequence) detachProductObject();
      activeSlot?.classList.remove("is-ready");
      activeSlot = slot;
      activeSlot.appendChild(renderer.domElement);
    }
    const slide = activeSlot.closest(".slide");
    if (slide && cssRenderer.domElement.parentElement !== slide) slide.appendChild(cssRenderer.domElement);
    // Разгорание света — эффект ВХОДА в блок с MacBook, а не смены слайда
    // внутри него. Раньше строка стояла безусловно: на каждом переходе
    // 10 → 11 → 12 → 13 все четыре источника гасли в ноль и заново
    // разгорались 1650мс, из-за чего сцена вспыхивала повторно.
    if (enterFromWide) revealStartedAt = performance.now();
    const requestedMode = activeSlot.dataset.macbookMode;
    drawScreen(requestedMode, true);
    const cameraMode = requestedMode === "extension-intro" ? "extensionIntro" : activeMode;
    startCameraMove(cameraMode, enterFromWide, !isVisible);
    if (model) {
      activeSlot.classList.add("is-ready");
      renderNow();
    }
  }

  function syncActiveSlot() {
    const nextSlot = document.querySelector(".slide.is-active .macbook-3d-slot");
    if (nextSlot) {
      mountSlot(nextSlot);
      return;
    }
    detachProductObject();
    cssRenderer.domElement.remove();
    sceneActive = false;
  }

  window.addEventListener("realgo:slidechange", syncActiveSlot);
  window.addEventListener("realgo:hintready", () => {
    if (activeMode !== "agent") return;
    agentTypingStartsAfter = Math.max(0, performance.now() - screenStoryStartedAt) + 2000;
    agentTypingAnnounced = false;
    lastScreenStoryKey = "";
  });
  window.addEventListener("realgo:codetypingstart", () => {
    if (activeMode !== "agent") return;
    startCameraMove("agentScreen");
  });
  window.addEventListener("resize", resizeRenderer);

  Promise.all([
    new GLTFLoader().loadAsync(MODEL_URL),
    document.fonts?.ready || Promise.resolve(),
  ]).then(([gltf]) => {
    model = gltf.scene;
    let screenMesh = null;
    let keyboardEngraving = null;
    const adjustedMaterials = new Set();

    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some((material) => material?.name === SCREEN_MATERIAL)) screenMesh = object;
      if (materials.some((material) => material?.name === KEYBOARD_ENGRAVING_MATERIAL)) {
        keyboardEngraving = object;
      }
      materials.forEach((material) => {
        if (
          !material
          || material.name === SCREEN_MATERIAL
          || material.name === KEYBOARD_ENGRAVING_MATERIAL
          || adjustedMaterials.has(material)
        ) return;
        adjustedMaterials.add(material);
        if ("envMapIntensity" in material) material.envMapIntensity = 0.48;
        if ("roughness" in material && typeof material.roughness === "number") {
          material.roughness = Math.max(0.24, material.roughness);
        }
        if (material.color && !material.map) {
          const luminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
          if (luminance > 0.42) {
            material.color.multiplyScalar(0.17);
            if ("metalness" in material) material.metalness = Math.max(0.68, material.metalness || 0);
            if ("roughness" in material) material.roughness = 0.34;
          }
        }
        material.needsUpdate = true;
      });
    });

    if (!screenMesh) throw new Error("MacBook screen mesh was not found");
    if (!keyboardEngraving) throw new Error("MacBook keyboard engraving mesh was not found");

    screenMesh.material = new THREE.MeshBasicMaterial({
      map: screenTexture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    keyboardEngraving.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    keyboardEngraving.castShadow = false;
    const engravingGlow = keyboardEngraving.clone();
    engravingGlow.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    engravingGlow.position.y += 0.018;
    engravingGlow.castShadow = false;
    engravingGlow.receiveShadow = false;
    keyboardEngraving.parent.add(engravingGlow);

    const bounds = new THREE.Box3().setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const modelScale = 2.9 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(modelScale);
    model.position.copy(center).multiplyScalar(-modelScale);
    modelPivot.add(model);
    modelPivot.updateMatrixWorld(true);

    // Build every close shot from the actual screen plane. The lid in this
    // GLB is tilted, so a generic lookAt(0, 0, 0) introduces visible keystone
    // distortion and aims below the product UI. Reading the mesh transform
    // gives us a stable screen-local right/up/normal frame for cinematic
    // dolly shots that remain optically aligned with the display.
    // Derive the display basis from its UV mapping, not from the mesh bounding
    // box. In this GLB the visible screen rectangle is rotated relative to the
    // object's local XYZ axes; UV derivatives are the only axes guaranteed to
    // match the browser pixels painted by screenTexture.
    const positions = screenMesh.geometry.getAttribute("position");
    const uvs = screenMesh.geometry.getAttribute("uv");
    const geometryCenter = new THREE.Vector3();
    let meanU = 0;
    let meanV = 0;
    for (let index = 0; index < positions.count; index += 1) {
      geometryCenter.x += positions.getX(index);
      geometryCenter.y += positions.getY(index);
      geometryCenter.z += positions.getZ(index);
      meanU += uvs.getX(index);
      meanV += uvs.getY(index);
    }
    geometryCenter.multiplyScalar(1 / positions.count);
    meanU /= positions.count;
    meanV /= positions.count;

    let covarianceUU = 0;
    let covarianceUV = 0;
    let covarianceVV = 0;
    const positionU = new THREE.Vector3();
    const positionV = new THREE.Vector3();
    for (let index = 0; index < positions.count; index += 1) {
      const deltaU = uvs.getX(index) - meanU;
      const deltaV = uvs.getY(index) - meanV;
      const position = new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      );
      covarianceUU += deltaU * deltaU;
      covarianceUV += deltaU * deltaV;
      covarianceVV += deltaV * deltaV;
      positionU.addScaledVector(position, deltaU);
      positionV.addScaledVector(position, deltaV);
    }
    const determinant = covarianceUU * covarianceVV - covarianceUV * covarianceUV;
    if (Math.abs(determinant) < 1e-9) throw new Error("MacBook screen UV basis is degenerate");
    const derivativeU = positionU.clone().multiplyScalar(covarianceVV)
      .addScaledVector(positionV, -covarianceUV)
      .multiplyScalar(1 / determinant);
    const derivativeV = positionV.clone().multiplyScalar(covarianceUU)
      .addScaledVector(positionU, -covarianceUV)
      .multiplyScalar(1 / determinant);

    function directionToPivot(direction) {
      const origin = geometryCenter.clone();
      const endpoint = geometryCenter.clone().add(direction);
      screenMesh.localToWorld(origin);
      screenMesh.localToWorld(endpoint);
      modelPivot.worldToLocal(origin);
      modelPivot.worldToLocal(endpoint);
      return endpoint.sub(origin).normalize();
    }

    screenCenter = geometryCenter.clone();
    screenMesh.localToWorld(screenCenter);
    modelPivot.worldToLocal(screenCenter);
    screenRight = directionToPivot(derivativeU);
    screenUp = directionToPivot(derivativeV);
    if (screenRight.x < 0) screenRight.negate();
    if (screenUp.y < 0) screenUp.negate();
    screenRight.addScaledVector(screenUp, -screenRight.dot(screenUp)).normalize();
    screenNormal = screenRight.clone().cross(screenUp).normalize();
    if (screenNormal.dot(shotPoses.wide.camera.clone().sub(screenCenter)) < 0) screenNormal.negate();

    const screenCornerPoints = [];
    for (let index = 0; index < positions.count; index += 1) {
      const point = new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index),
      );
      screenMesh.localToWorld(point);
      modelPivot.worldToLocal(point);
      screenCornerPoints.push(point);
    }
    const rightOffsets = screenCornerPoints.map((point) => point.clone().sub(screenCenter).dot(screenRight));
    const upOffsets = screenCornerPoints.map((point) => point.clone().sub(screenCenter).dot(screenUp));
    screenPlaneWidth = Math.max(...rightOffsets) - Math.min(...rightOffsets);
    screenPlaneHeight = Math.max(...upOffsets) - Math.min(...upOffsets);

    function configureScreenShot(mode, config) {
      const pose = shotPoses[mode];
      const modelQuaternion = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(pose.rotation.x, pose.rotation.y, pose.rotation.z)
      );
      const centerInShot = screenCenter.clone()
        .applyQuaternion(modelQuaternion)
        .add(pose.position);
      const normalInShot = screenNormal.clone().applyQuaternion(modelQuaternion).normalize();
      const upInShot = screenUp.clone().applyQuaternion(modelQuaternion).normalize();
      const rightInShot = screenRight.clone().applyQuaternion(modelQuaternion).normalize();
      const frameY = screenPlaneHeight * (config.frameYFraction || 0);

      pose.camera.copy(centerInShot)
        .addScaledVector(normalInShot, config.distance)
        .addScaledVector(rightInShot, config.cameraX)
        .addScaledVector(upInShot, config.cameraY + frameY);
      pose.lookAt.copy(centerInShot)
        .addScaledVector(rightInShot, config.targetX)
        .addScaledVector(upInShot, config.targetY + frameY);
      pose.up.copy(upInShot);
      pose.fov = config.fov;
    }

    // Compose the camera around the window's fixed screen-relative position
    // while preserving the established viewing angle.
    const extensionCameraShiftX = screenPlaneWidth * EXTENSION_SETTLED_SHIFT_LEFT;

    // Slide 8 keeps the established three-quarter angle, with a slightly
    // lower lens and tighter final framing around the display.
    configureScreenShot("extensionIntro", {
      distance: 5.72,
      cameraX: -1.72,
      cameraY: 0.1,
      targetX: 0,
      targetY: -0.08,
      frameYFraction: -0.25,
      fov: 25,
    });
    // On slide 9 the camera crosses to the right and aims at the extension's
    // fixed screen-relative centre.
    configureScreenShot("extension", {
      distance: 3.15,
      cameraX: 1.38 - extensionCameraShiftX,
      cameraY: 0.24,
      targetX: 1.08 - extensionCameraShiftX,
      targetY: -0.28,
      frameYFraction: -0.04,
      fov: 24,
    });
    configureScreenShot("agentScreen", {
      distance: 5.1,
      cameraX: 0,
      cameraY: -0.72,
      targetX: 0,
      targetY: -0.6,
      frameYFraction: -0.025,
      fov: 24.5,
    });
    // The card-training shot is taller than the shared 10–12 story frame.
    // Keep the colleague's wider, lower composition for this later mode.
    configureScreenShot("stages", {
      distance: 2.52,
      cameraX: -1.08,
      cameraY: 0.21,
      targetX: 0.48,
      targetY: -0.05,
      frameYFraction: -0.198,
      fov: 25.4,
    });
    configureScreenShot("rating", {
      distance: 2.65,
      cameraX: 1.28 - extensionCameraShiftX,
      cameraY: 0.2,
      targetX: 1.08 - extensionCameraShiftX,
      targetY: -0.22,
      frameYFraction: -0.06,
      fov: 22,
    });
    // Slide 10 starts from the exact final pose of slide 9. The move to the
    // front-facing display is triggered only when code typing actually starts.
    copyPose(shotPoses.agent, shotPoses.extension);

    const engravingCenter = new THREE.Box3()
      .setFromObject(keyboardEngraving)
      .getCenter(new THREE.Vector3());
    const keyboardLight = new THREE.PointLight(0xffffff, 0.18, 1.15, 2.2);
    keyboardLight.position.copy(engravingCenter);
    keyboardLight.position.y += 0.16;
    modelPivot.worldToLocal(keyboardLight.position);
    modelPivot.add(keyboardLight);

    const baseY = -size.y * modelScale * 0.5 - 0.035;
    const contactCanvas = document.createElement("canvas");
    contactCanvas.width = 512;
    contactCanvas.height = 256;
    const contactContext = contactCanvas.getContext("2d");
    const contactGradient = contactContext.createRadialGradient(256, 128, 12, 256, 128, 230);
    contactGradient.addColorStop(0, "rgba(12, 22, 36, 0.76)");
    contactGradient.addColorStop(0.5, "rgba(7, 13, 23, 0.34)");
    contactGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    contactContext.fillStyle = contactGradient;
    contactContext.fillRect(0, 0, contactCanvas.width, contactCanvas.height);
    const contactTexture = new THREE.CanvasTexture(contactCanvas);
    contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.7, 2.15),
      new THREE.MeshBasicMaterial({
        map: contactTexture,
        transparent: true,
        depthWrite: false,
        opacity: 0.78,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactBaseY = baseY;
    contactShadow.position.set(0, baseY + 0.006, 0.24);
    scene.add(contactShadow);

    syncActiveSlot();
    if (!activeSlot) mountSlot(slots[0]);
    activeSlot?.classList.add("is-ready");
    renderNow();
    stage.classList.add("has-macbook-3d");
    window.dispatchEvent(new CustomEvent("realgo:macbookready"));
  }).catch((error) => {
    stage.classList.add("macbook-3d-failed");
    console.error("MacBook 3D failed to load", error);
  });

  function animate(now) {
    if (model && activeSlot?.closest(".slide.is-active")) {
      const revealProgress = reduceMotion
        ? 1
        : THREE.MathUtils.clamp((now - revealStartedAt) / 1650, 0, 1);
      const lightReveal = 1 - Math.pow(1 - revealProgress, 3);
      keyLight.intensity = 5.05 * lightReveal;
      edgeLight.intensity = 4.15 * lightReveal;
      fillLight.intensity = 0.12 * lightReveal;
      topLight.intensity = 0.72 * lightReveal;
      renderer.toneMappingExposure = 0.48 + 0.31 * lightReveal;
      updateCameraMove(now);
      updateScreenStory(now);
      modelPivot.updateMatrixWorld(true);
      updateProductObject();
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

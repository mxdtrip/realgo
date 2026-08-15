"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import * as THREE from "three";

// The recovered Geometry Nodes scene supplies the motion graph: frames 240..960,
// 40 cards and one cubic Bezier curve. Mesh/camera composition is calibrated
// against the original 1920×810 MP4 because those parts of the .blend were only
// approximately reconstructed. Keeping it procedural avoids shipping a GLB.
const SCRUB_END_SECTION_ID = "memory";
const FRAME_START = 240;
const FRAME_END = 960;
const FRAME_OFFSET = -477;
const TIME_SPAN = 1467;
const CARD_COUNT = 40;
const CARD_GAP = 0.02;
const CARD_SCALE = 0.54;
const CARD_HEIGHT = 3.8;
const SPINS = 1;
const FLOW_HORIZONTAL_SCALE = 0.58;
const FLOW_HORIZONTAL_OFFSET = -0.1;
const FLOW_ROLL = THREE.MathUtils.degToRad(-5);
const EXIT_RUNOUT_START = 0.82;
const EXIT_RUNOUT_DISTANCE = 0.8;
const SMOOTHING = 0.12;
const SETTLE_MS = 1200;
// The shipped reference render is 1920×810, not 16:9.
const SOURCE_ASPECT = 1920 / 810;

// Blender Z-up → Three.js Y-up: (x, y, z) becomes (x, z, -y).
const CARD_CURVE = new THREE.CubicBezierCurve3(
  new THREE.Vector3(0, -0.01, 6.52),
  new THREE.Vector3(-1.16, -0.9, 1.99),
  new THREE.Vector3(0, 0, -0.29),
  new THREE.Vector3(0, 0.01, -7.09),
);
CARD_CURVE.arcLengthDivisions = 240;
const CARD_CURVE_LENGTH = CARD_CURVE.getLength();
const CARD_CURVE_START = CARD_CURVE.getPointAt(0);
const CARD_CURVE_END = CARD_CURVE.getPointAt(1);
const CARD_CURVE_START_TANGENT = CARD_CURVE.getTangentAt(0);
const CARD_CURVE_END_TANGENT = CARD_CURVE.getTangentAt(1);

// Blender Euler XYZ (60°, -30°, 180°), preceded by the Z-up → Y-up basis.
// Blender exposes quaternions as (w,x,y,z); Three.js expects (x,y,z,w).
const BASE_ROTATION = new THREE.Quaternion(
  0.25,
  0.9330127019,
  0.25,
  0.0669872981,
);
const GLOBAL_SPIN_AXIS = new THREE.Vector3(0, 0, -1);

function createRoundedCardGeometry() {
  const width = 2;
  const height = CARD_HEIGHT;
  const depth = 0.02;
  const radius = 0.12;
  const x = width / 2;
  const y = height / 2;
  const shape = new THREE.Shape();

  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 5,
  });
  // The Geometry Nodes graph recenters the source mesh before instancing it.
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function verticalFovForAspect(aspect: number) {
  const sourceVerticalFov = THREE.MathUtils.degToRad(18);

  // Match the old video's object-fit: cover behavior on unusually wide screens.
  if (aspect <= SOURCE_ASPECT) return THREE.MathUtils.radToDeg(sourceVerticalFov);
  return THREE.MathUtils.radToDeg(
    2 * Math.atan((Math.tan(sourceVerticalFov / 2) * SOURCE_ASPECT) / aspect),
  );
}

function sampleExtendedCurve(factor: number, target: THREE.Vector3) {
  if (factor < 0) {
    return target
      .copy(CARD_CURVE_START)
      .addScaledVector(CARD_CURVE_START_TANGENT, factor * CARD_CURVE_LENGTH);
  }
  if (factor > 1) {
    return target
      .copy(CARD_CURVE_END)
      .addScaledVector(
        CARD_CURVE_END_TANGENT,
        (factor - 1) * CARD_CURVE_LENGTH,
      );
  }
  return CARD_CURVE.getPointAt(factor, target);
}

function scrollProgress() {
  const section = document.getElementById(SCRUB_END_SECTION_ID);
  const fallbackBottom = document.documentElement.scrollHeight;
  const sectionBottom = section
    ? section.getBoundingClientRect().bottom + window.scrollY
    : fallbackBottom;
  const endScroll = Math.max(1, sectionBottom - window.innerHeight);
  return THREE.MathUtils.clamp(window.scrollY / endScroll, 0, 1);
}

export function ScrollVideoBackground() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLanding) return undefined;

    const host = hostRef.current;
    if (!host) return undefined;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      host.dataset.state = "fallback";
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(12.2, SOURCE_ASPECT, 0.1, 1000);
    camera.position.set(18.64, -0.56, 0);
    camera.up.set(0, Math.cos(FLOW_ROLL), -Math.sin(FLOW_ROLL));
    camera.lookAt(0, -0.56, 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.tabIndex = -1;
    renderer.domElement.setAttribute("role", "presentation");
    host.prepend(renderer.domElement);

    const geometry = createRoundedCardGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.82, 0.84, 0.88),
      metalness: 0,
      roughness: 0.26,
    });
    const cards = new THREE.InstancedMesh(geometry, material, CARD_COUNT);
    cards.frustumCulled = false;
    cards.castShadow = true;
    cards.receiveShadow = true;
    cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const instanceColors = new THREE.InstancedBufferAttribute(
      new Float32Array(CARD_COUNT * 3),
      3,
    );
    instanceColors.setUsage(THREE.DynamicDrawUsage);
    cards.instanceColor = instanceColors;
    scene.add(cards);

    const ambient = new THREE.AmbientLight(0xffffff, 0.008);
    const spot = new THREE.SpotLight(0xffffff, 800, 0, 0.25, 1, 2);
    spot.position.set(0, 10.13, 0);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = 40;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.015;
    scene.add(ambient, spot, spot.target);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const spin = new THREE.Quaternion();
    const rotation = new THREE.Quaternion();
    const instanceColor = new THREE.Color();

    let target = scrollProgress();
    let current = target;
    let lastRendered = Number.NaN;
    let rafId = 0;
    let settleUntil = performance.now() + SETTLE_MS;
    let disposed = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      const aspect = width / height;
      renderer.setSize(width, height, false);
      camera.aspect = aspect;
      camera.fov = verticalFovForAspect(aspect);
      camera.updateProjectionMatrix();
      lastRendered = Number.NaN;
    };

    const renderFrame = (progress: number) => {
      if (progress === lastRendered) return;

      const frame = THREE.MathUtils.lerp(FRAME_START, FRAME_END, progress);
      const streamRange = (CARD_COUNT - 1) * CARD_GAP + 1;
      const streamProgress = ((frame - FRAME_OFFSET) / TIME_SPAN) * streamRange;
      // The recovered timing leaves the final card at factor ~0.96 on the last
      // frame. Add a late run-out so the darkened tail continues along the end
      // tangent and clears the viewport instead of freezing in its corner.
      const exitRunout =
        THREE.MathUtils.smoothstep(progress, EXIT_RUNOUT_START, 1) *
        EXIT_RUNOUT_DISTANCE;
      let onCurveCards = 0;

      for (let index = 0; index < CARD_COUNT; index += 1) {
        const factor = streamProgress + exitRunout - index * CARD_GAP;
        const onCurve = factor >= 0 && factor <= 1;
        sampleExtendedCurve(factor, position);
        position.z =
          position.z * FLOW_HORIZONTAL_SCALE + FLOW_HORIZONTAL_OFFSET;
        spin.setFromAxisAngle(GLOBAL_SPIN_AXIS, factor * SPINS * Math.PI * 2);
        rotation.multiplyQuaternions(spin, BASE_ROTATION);
        scale.setScalar(CARD_SCALE);
        matrix.compose(position, rotation, scale);
        cards.setMatrixAt(index, matrix);

        // Cards do not get deleted at the end of the curve. They continue along
        // its tangent and lose the remaining fill light until they are black.
        const exitShadow = THREE.MathUtils.smoothstep(factor, 0.84, 1.16);
        const entryShadow = 1 - THREE.MathUtils.smoothstep(factor, -0.16, 0.04);
        const illumination = (1 - exitShadow) * (1 - entryShadow);
        instanceColor.setScalar(illumination);
        cards.setColorAt(index, instanceColor);
        if (onCurve) onCurveCards += 1;
      }

      cards.instanceMatrix.needsUpdate = true;
      instanceColors.needsUpdate = true;
      renderer.render(scene, camera);
      lastRendered = progress;
      host.dataset.progress = progress.toFixed(4);
      host.dataset.cardCount = String(CARD_COUNT);
      host.dataset.visibleCards = String(CARD_COUNT);
      host.dataset.onCurveCards = String(onCurveCards);
    };

    const tick = () => {
      rafId = 0;
      if (disposed) return;

      target = scrollProgress();
      if (reduceMotion || performance.now() < settleUntil) {
        current = target;
      } else {
        current += (target - current) * SMOOTHING;
        if (Math.abs(target - current) < 0.0001) current = target;
      }
      renderFrame(current);

      if (performance.now() < settleUntil || Math.abs(target - current) >= 0.0001) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const requestTick = () => {
      target = scrollProgress();
      if (reduceMotion) current = target;
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onResize = () => {
      resize();
      requestTick();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      host.dataset.state = "fallback";
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };
    const onContextRestored = () => {
      host.dataset.state = "ready";
      settleUntil = performance.now() + SETTLE_MS;
      resize();
      requestTick();
    };

    resize();
    renderFrame(current);
    host.dataset.state = "ready";
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", onResize);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);
    rafId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", requestTick);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      cards.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [isLanding]);

  if (!isLanding) return null;

  return (
    <div ref={hostRef} className="scroll-card-flow-bg" aria-hidden="true" data-state="loading">
      <div className="scroll-card-flow-bg__overlay" />
    </div>
  );
}

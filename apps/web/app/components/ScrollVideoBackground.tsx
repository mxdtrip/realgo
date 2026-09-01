"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

// The recovered Geometry Nodes scene supplies the motion graph: frames 240..960,
// a card stream and one cubic Bezier curve. Mesh/camera composition is calibrated
// against the original 1920×810 MP4 because those parts of the .blend were only
// approximately reconstructed. Keeping it procedural avoids shipping a GLB.
const SCRUB_END_SECTION_ID = "memory";
const FRAME_START = 240;
const FRAME_END = 960;
const FRAME_OFFSET = -477;
const TIME_SPAN = 1467;
const CARD_COUNT = 34;
const CARD_GAP = 0.0255;
const CARD_SCALE = 0.56;
const CARD_HEIGHT = 3.8;
const SPINS = 1;
const FLOW_HORIZONTAL_SCALE = 0.58;
const FLOW_HORIZONTAL_OFFSET = -0.1;
const FLOW_ROLL = THREE.MathUtils.degToRad(-5);
const EXIT_RUNOUT_START = 0.82;
const EXIT_RUNOUT_DISTANCE = 0.8;
const SMOOTHING = 0.12;
const SETTLE_MS = 1200;
const COMPOSITION_CAMERA_ZOOM = 1.28;
const MAX_RENDER_PIXELS = 4_000_000;
// The shipped reference render is 1920×810, not 16:9.
const SOURCE_ASPECT = 1920 / 810;

// The stream deliberately moves in depth as well as sideways. The central
// fold comes toward the lens while both tails recede, creating the focus falloff
// and wide-angle size change that a flat screen-space curve cannot provide.
const CARD_CURVE = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-1.3, -0.05, 4.85),
    new THREE.Vector3(-0.45, -0.4, 3.78),
    new THREE.Vector3(1.0, -0.38, 3.1),
    new THREE.Vector3(2.15, 0.08, 2.05),
    new THREE.Vector3(1.5, 0.2, 0.2),
    new THREE.Vector3(0.2, 0.75, -3.95),
    new THREE.Vector3(-1.15, 0.9, -7.15),
  ],
  false,
  "centripetal",
  0.48,
);
CARD_CURVE.arcLengthDivisions = 240;
const CARD_CURVE_LENGTH = CARD_CURVE.getLength();
const CARD_CURVE_START = CARD_CURVE.getPointAt(0);
const CARD_CURVE_END = CARD_CURVE.getPointAt(1);
const CARD_CURVE_START_TANGENT = CARD_CURVE.getTangentAt(0);
const CARD_CURVE_END_TANGENT = CARD_CURVE.getTangentAt(1);

// Recovered Blender orientation. A progressive optical pitch is added per-card
// below, so only the receding tail opens toward the lens.
const BASE_ROTATION = new THREE.Quaternion(
  0.25,
  0.9330127019,
  0.25,
  0.0669872981,
);
const GLOBAL_SPIN_AXIS = new THREE.Vector3(0, 0, -1);
const LOCAL_PITCH_AXIS = new THREE.Vector3(1, 0, 0);

const LENS_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    aspect: { value: SOURCE_ASPECT },
    distortion: { value: 0.09 },
    chromaticAberration: { value: 0.00055 },
    vignette: { value: 0.16 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float aspect;
    uniform float distortion;
    uniform float chromaticAberration;
    uniform float vignette;
    varying vec2 vUv;

    void main() {
      vec2 lensScale = vec2(aspect / 1.7777778, 1.0);
      vec2 point = (vUv * 2.0 - 1.0) * lensScale;
      float radius2 = dot(point, point);
      float warp = 1.0 + distortion * radius2 + distortion * 0.16 * radius2 * radius2;
      vec2 warped = point * warp;
      warped /= lensScale;
      warped = warped * 0.5 + 0.5;

      if (warped.x < 0.0 || warped.x > 1.0 || warped.y < 0.0 || warped.y > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec2 radial = normalize(point + vec2(0.000001)) * chromaticAberration * min(radius2, 1.5);
      radial /= lensScale;
      vec4 centre = texture2D(tDiffuse, warped);
      float red = texture2D(tDiffuse, warped + radial).r;
      float blue = texture2D(tDiffuse, warped - radial).b;
      float edgeShade = 1.0 - vignette * smoothstep(0.28, 1.28, radius2);
      vec3 lensColour = vec3(red, centre.g, blue);
      float luminance = dot(lensColour, vec3(0.2126, 0.7152, 0.0722));
      lensColour = mix(vec3(luminance), lensColour, 1.08);
      lensColour = (lensColour - 0.18) * 1.04 + 0.18;

      gl_FragColor = vec4(max(lensColour, vec3(0.0)) * edgeShade, centre.a);
    }
  `,
};

const DEPTH_OF_FIELD_FRAGMENT = /* glsl */ `
  #include <common>
  #include <packing>

  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform float maxblur;
  uniform float aperture;
  uniform float nearClip;
  uniform float farClip;
  uniform float focus;
  uniform float aspect;

  float readViewZ(vec2 uv) {
    float depth = unpackRGBAToDepth(texture2D(tDepth, uv));
    return perspectiveDepthToViewZ(depth, nearClip, farClip);
  }

  void addSample(inout vec3 colour, inout float weight, vec2 uv, float sampleWeight) {
    vec4 sampleColour = texture2D(tColor, uv);
    float coverage = smoothstep(0.002, 0.08, sampleColour.a);
    colour += sampleColour.rgb * sampleWeight * coverage;
    weight += sampleWeight * coverage;
  }

  void main() {
    vec4 centre = texture2D(tColor, vUv);
    // Do not spread card colour into empty transparent pixels. Bloom supplies
    // the external halo; this pass only softens genuinely out-of-focus geometry.
    if (centre.a < 0.002) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float viewZ = readViewZ(vUv);
    float blur = clamp(abs(focus + viewZ) * aperture, 0.0, maxblur);
    vec2 radius = vec2(blur, blur * aspect);
    vec3 colour = centre.rgb * 0.2;
    float weight = 0.2;

    // Three concentric rings prevent bright frame edges from turning into
    // eight visibly displaced copies when the scene is out of focus.
    addSample(colour, weight, vUv + vec2( radius.x, 0.0) * 0.34, 0.08);
    addSample(colour, weight, vUv + vec2(-radius.x, 0.0) * 0.34, 0.08);
    addSample(colour, weight, vUv + vec2(0.0,  radius.y) * 0.34, 0.08);
    addSample(colour, weight, vUv + vec2(0.0, -radius.y) * 0.34, 0.08);

    addSample(colour, weight, vUv + vec2( radius.x,  radius.y) * 0.46, 0.065);
    addSample(colour, weight, vUv + vec2(-radius.x,  radius.y) * 0.46, 0.065);
    addSample(colour, weight, vUv + vec2( radius.x, -radius.y) * 0.46, 0.065);
    addSample(colour, weight, vUv + vec2(-radius.x, -radius.y) * 0.46, 0.065);

    addSample(colour, weight, vUv + vec2( radius.x, 0.0), 0.04);
    addSample(colour, weight, vUv + vec2(-radius.x, 0.0), 0.04);
    addSample(colour, weight, vUv + vec2(0.0,  radius.y), 0.04);
    addSample(colour, weight, vUv + vec2(0.0, -radius.y), 0.04);
    addSample(colour, weight, vUv + vec2( radius.x,  radius.y) * 0.7, 0.04);
    addSample(colour, weight, vUv + vec2(-radius.x,  radius.y) * 0.7, 0.04);
    addSample(colour, weight, vUv + vec2( radius.x, -radius.y) * 0.7, 0.04);
    addSample(colour, weight, vUv + vec2(-radius.x, -radius.y) * 0.7, 0.04);

    gl_FragColor = vec4(colour / max(weight, 0.001), centre.a);
  }
`;

const CARD_FRAME_VERTEX = /* glsl */ `
  attribute vec2 instanceGlow;
  varying vec3 vInstanceColor;
  varying vec2 vInstanceGlow;
  varying vec3 vLocalPosition;

  void main() {
    vInstanceColor = instanceColor;
    vInstanceGlow = instanceGlow;
    vLocalPosition = position;
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * instancePosition;
  }
`;

const CARD_FRAME_FRAGMENT = /* glsl */ `
  uniform float opacity;
  varying vec3 vInstanceColor;
  varying vec2 vInstanceGlow;
  varying vec3 vLocalPosition;

  void main() {
    float vertical = clamp(vLocalPosition.y / ${CARD_HEIGHT.toFixed(1)} + 0.5, 0.0, 1.0);
    float sideEdge = 0.72 + 0.28 * smoothstep(0.5, 1.02, abs(vLocalPosition.x));
    float fanDirection = mix(0.1, 1.0, 1.0 - smoothstep(0.08, 0.72, vertical)) * sideEdge;
    float foldDirection = mix(0.1, 1.0, smoothstep(0.24, 0.94, vertical)) * sideEdge;
    vec3 fanLight = vec3(0.65, 1.1, 5.5) * vInstanceGlow.x * fanDirection;
    vec3 foldLight = vec3(0.58, 0.95, 5.0) * vInstanceGlow.y * foldDirection;
    gl_FragColor = vec4(vInstanceColor + fanLight + foldLight, opacity);
  }
`;

function createRoundedCardGeometry() {
  const width = 2;
  const height = CARD_HEIGHT;
  const depth = 0.055;
  const radius = 0.13;
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
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.022,
    bevelThickness: 0.014,
    curveSegments: 7,
  });
  // The Geometry Nodes graph recenters the source mesh before instancing it.
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createRoundedCardFrameGeometry() {
  const outerWidth = 2.025;
  const outerHeight = CARD_HEIGHT + 0.025;
  const innerWidth = 1.935;
  const innerHeight = CARD_HEIGHT - 0.065;
  const outerRadius = 0.14;
  const innerRadius = 0.105;
  const ox = outerWidth / 2;
  const oy = outerHeight / 2;
  const ix = innerWidth / 2;
  const iy = innerHeight / 2;
  const shape = new THREE.Shape();

  // Counter-clockwise outer contour.
  shape.moveTo(-ox + outerRadius, -oy);
  shape.lineTo(ox - outerRadius, -oy);
  shape.quadraticCurveTo(ox, -oy, ox, -oy + outerRadius);
  shape.lineTo(ox, oy - outerRadius);
  shape.quadraticCurveTo(ox, oy, ox - outerRadius, oy);
  shape.lineTo(-ox + outerRadius, oy);
  shape.quadraticCurveTo(-ox, oy, -ox, oy - outerRadius);
  shape.lineTo(-ox, -oy + outerRadius);
  shape.quadraticCurveTo(-ox, -oy, -ox + outerRadius, -oy);

  // Clockwise inner contour makes the emissive mesh a thin rounded frame,
  // rather than a second bright card face.
  const hole = new THREE.Path();
  hole.moveTo(-ix, -iy + innerRadius);
  hole.lineTo(-ix, iy - innerRadius);
  hole.quadraticCurveTo(-ix, iy, -ix + innerRadius, iy);
  hole.lineTo(ix - innerRadius, iy);
  hole.quadraticCurveTo(ix, iy, ix, iy - innerRadius);
  hole.lineTo(ix, -iy + innerRadius);
  hole.quadraticCurveTo(ix, -iy, ix - innerRadius, -iy);
  hole.lineTo(-ix + innerRadius, -iy);
  hole.quadraticCurveTo(-ix, -iy, -ix, -iy + innerRadius);
  shape.holes.push(hole);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.12,
    bevelEnabled: false,
    curveSegments: 7,
  });
  geometry.translate(0, 0, -0.06);
  geometry.computeVertexNormals();
  return geometry;
}

function createRadialGlowTexture() {
  const canvas = document.createElement("canvas");
  const textureSize = 512;
  const textureCentre = textureSize / 2;
  canvas.width = textureSize;
  canvas.height = textureSize;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(
    textureCentre,
    textureCentre,
    0,
    textureCentre,
    textureCentre,
    textureCentre,
  );
  gradient.addColorStop(0, "rgba(228, 233, 255, 0.96)");
  gradient.addColorStop(0.08, "rgba(153, 169, 255, 0.78)");
  gradient.addColorStop(0.28, "rgba(81, 101, 255, 0.38)");
  gradient.addColorStop(0.62, "rgba(46, 65, 211, 0.12)");
  gradient.addColorStop(1, "rgba(22, 33, 112, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function glowPeak(value: number, centre: number, width: number) {
  const distance = (value - centre) / width;
  return Math.exp(-(distance * distance));
}

function flowCurveFactor(factor: number) {
  if (factor <= 0 || factor >= 1) return factor;
  // Open the near/left fan and progressively compress the receding right stack.
  return 1 - Math.pow(1 - factor, 1.42);
}

function verticalFovForAspect(aspect: number) {
  // Recreate the former CSS zoom optically. Post-processing now stays at its
  // native backing resolution instead of being enlarged after rendering.
  const sourceVerticalFov =
    2 *
    Math.atan(
      Math.tan(THREE.MathUtils.degToRad(28) / 2) /
        COMPOSITION_CAMERA_ZOOM,
    );

  // Match the old video's object-fit: cover behavior on unusually wide screens.
  if (aspect <= SOURCE_ASPECT) return THREE.MathUtils.radToDeg(sourceVerticalFov);
  return THREE.MathUtils.radToDeg(
    2 * Math.atan((Math.tan(sourceVerticalFov / 2) * SOURCE_ASPECT) / aspect),
  );
}

function renderPixelRatio(width: number, height: number) {
  const deviceRatio = window.devicePixelRatio || 1;
  const desiredRatio = THREE.MathUtils.clamp(deviceRatio, 1, 2);
  const budgetRatio = Math.sqrt(MAX_RENDER_PIXELS / Math.max(1, width * height));
  return THREE.MathUtils.clamp(Math.min(desiredRatio, budgetRatio), 1, 2);
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
  return CARD_CURVE.getPointAt(flowCurveFactor(factor), target);
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

    // Show the CSS fallback while Three.js is booting as well as when WebGL is
    // unavailable. Previously the host stayed in `loading` with an invisible
    // canvas, so any setup exception or slow dev hydration looked like a
    // missing background instead of a graceful fallback.
    host.dataset.state = "fallback";

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
    const camera = new THREE.PerspectiveCamera(28, SOURCE_ASPECT, 0.1, 80);
    camera.position.set(12.6, -0.34, 0);
    camera.up.set(0, Math.cos(FLOW_ROLL), -Math.sin(FLOW_ROLL));
    camera.lookAt(0.25, 0.15, 0);

    const initialWidth = Math.max(1, host.clientWidth);
    const initialHeight = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(renderPixelRatio(initialWidth, initialHeight));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.tabIndex = -1;
    renderer.domElement.setAttribute("role", "presentation");
    host.prepend(renderer.domElement);

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.6,
      0.58,
      0.78,
    );
    const bokehPass = new BokehPass(scene, camera, {
      focus: 10.55,
      aperture: 0.00075,
      maxblur: 0.0042,
    });
    bokehPass.materialBokeh.fragmentShader = DEPTH_OF_FIELD_FRAGMENT;
    bokehPass.materialBokeh.transparent = false;
    bokehPass.materialBokeh.blending = THREE.NoBlending;
    bokehPass.materialBokeh.needsUpdate = true;
    const lensPass = new ShaderPass(LENS_SHADER);
    lensPass.material.transparent = false;
    lensPass.material.blending = THREE.NoBlending;
    const outputPass = new OutputPass();
    const preBloomFxaaPass = new ShaderPass(FXAAShader);
    const fxaaPass = new ShaderPass(FXAAShader);
    composer.addPass(renderPass);
    composer.addPass(bokehPass);
    composer.addPass(preBloomFxaaPass);
    composer.addPass(bloomPass);
    composer.addPass(lensPass);
    composer.addPass(outputPass);
    composer.addPass(fxaaPass);

    const geometry = createRoundedCardGeometry();
    const frameGeometry = createRoundedCardFrameGeometry();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x030610,
      emissive: 0x01030a,
      emissiveIntensity: 0.14,
      metalness: 0.68,
      roughness: 0.24,
      clearcoat: 0.68,
      clearcoatRoughness: 0.16,
      reflectivity: 0.72,
      side: THREE.DoubleSide,
    });
    const cards = new THREE.InstancedMesh(geometry, material, CARD_COUNT);
    cards.frustumCulled = false;
    cards.castShadow = true;
    cards.receiveShadow = true;
    cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const bodyColors = new THREE.InstancedBufferAttribute(
      new Float32Array(CARD_COUNT * 3),
      3,
    );
    bodyColors.setUsage(THREE.DynamicDrawUsage);
    cards.instanceColor = bodyColors;

    const frameMaterial = new THREE.ShaderMaterial({
      uniforms: {
        opacity: { value: 0.68 },
      },
      vertexShader: CARD_FRAME_VERTEX,
      fragmentShader: CARD_FRAME_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const frameGlows = new THREE.InstancedBufferAttribute(
      new Float32Array(CARD_COUNT * 2),
      2,
    );
    frameGlows.setUsage(THREE.DynamicDrawUsage);
    frameGeometry.setAttribute("instanceGlow", frameGlows);
    const frames = new THREE.InstancedMesh(frameGeometry, frameMaterial, CARD_COUNT);
    frames.frustumCulled = false;
    frames.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const frameColors = new THREE.InstancedBufferAttribute(
      new Float32Array(CARD_COUNT * 3),
      3,
    );
    frameColors.setUsage(THREE.DynamicDrawUsage);
    frames.instanceColor = frameColors;
    frames.renderOrder = 2;
    scene.add(cards, frames);

    const glowTexture = createRadialGlowTexture();
    const lightVolumeMaterials: THREE.SpriteMaterial[] = [];
    const lightVolumes: THREE.Sprite[] = [];
    const lightVolumeTracks: Array<{
      volume: THREE.Sprite;
      material: THREE.SpriteMaterial;
      factor: number;
      travel: number;
      width: number;
      height: number;
      yOffset: number;
      horizontalOffset: number;
      opacity: number;
    }> = [];
    if (glowTexture) {
      const addLightVolume = (
        factor: number,
        colour: number,
        opacity: number,
        width: number,
        height: number,
        yOffset: number,
        horizontalOffset: number,
        intensity: number,
      ) => {
        const lightMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: colour,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          // These are atmospheric layers behind the card stream. Keeping
          // depth testing off makes the soft volume continuous, while the
          // lower render order prevents it from reading as a bright stain on
          // the card faces themselves.
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        lightMaterial.color.multiplyScalar(intensity);
        const volume = new THREE.Sprite(lightMaterial);
        volume.scale.set(width, height, 1);
        volume.renderOrder = 0;
        lightVolumeMaterials.push(lightMaterial);
        lightVolumes.push(volume);
        lightVolumeTracks.push({
          volume,
          material: lightMaterial,
          factor,
          // Atmospheric light has a shallower scroll parallax than the cards.
          // It stays attached to the same bend, but recedes more slowly.
          travel: factor < 0.4 ? 0.48 : 0.38,
          width,
          height,
          yOffset,
          horizontalOffset,
          opacity,
        });
        scene.add(volume);
      };

      // Uneven pools of light replace the accidental fixed blobs: the left
      // fan carries the strongest cool glow, while the fold and receding tail
      // are intentionally quieter so the reference keeps its depth.
      addLightVolume(0.22, 0x254cff, 0.075, 2.8, 2.0, 1.05, -0.62, 1.9);
      addLightVolume(0.39, 0x193dff, 0.052, 2.25, 1.7, 0.15, -0.18, 1.45);
      addLightVolume(0.56, 0x1838ff, 0.062, 2.55, 2.0, -1.15, 1.02, 1.7);
      addLightVolume(0.76, 0x2745e8, 0.026, 3.3, 1.55, -0.25, 0.5, 1.15);
    }

    const ambient = new THREE.AmbientLight(0x40578f, 0.035);
    const spot = new THREE.SpotLight(0x7588ff, 34, 28, 0.3, 0.9, 2);
    spot.position.set(6.2, 7.6, 3.4);
    spot.target.position.set(1.25, -0.05, 1.4);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.camera.near = 0.1;
    spot.shadow.camera.far = 40;
    spot.shadow.bias = -0.0004;
    spot.shadow.normalBias = 0.015;
    const violetRim = new THREE.PointLight(0x7c86ff, 6, 14, 1.9);
    violetRim.position.set(6.8, 1.9, 3.1);
    const blueRim = new THREE.PointLight(0x315fff, 7, 12, 1.9);
    blueRim.position.set(5.8, -2.8, 0.15);
    scene.add(ambient, spot, spot.target, violetRim, blueRim);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const spin = new THREE.Quaternion();
    const opticalPitch = new THREE.Quaternion();
    const rotation = new THREE.Quaternion();
    const bodyColor = new THREE.Color();
    const frameColor = new THREE.Color();

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
      const pixelRatio = renderPixelRatio(width, height);
      renderer.setPixelRatio(pixelRatio);
      composer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = aspect;
      camera.fov = verticalFovForAspect(aspect);
      camera.updateProjectionMatrix();
      lensPass.uniforms.aspect.value = aspect;
      preBloomFxaaPass.uniforms.resolution.value.set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio),
      );
      fxaaPass.uniforms.resolution.value.set(
        1 / (width * pixelRatio),
        1 / (height * pixelRatio),
      );
      host.dataset.pixelRatio = pixelRatio.toFixed(3);
      host.dataset.renderSize = `${Math.round(width * pixelRatio)}x${Math.round(height * pixelRatio)}`;
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

      lightVolumeTracks.forEach((track, index) => {
        const lightFactor = track.factor + progress * track.travel;
        sampleExtendedCurve(lightFactor, position);
        position.z = position.z * FLOW_HORIZONTAL_SCALE + FLOW_HORIZONTAL_OFFSET;
        position.y += track.yOffset;
        position.z += track.horizontalOffset;
        track.volume.position.copy(position);

        // Keep each pool legible, but let the scene breathe as it advances.
        // The phase offsets are spatial rather than random, so screenshots
        // and reduced-motion renders remain deterministic.
        const phase = progress * Math.PI * 1.4 + index * 0.9;
        track.material.opacity = track.opacity * (0.82 + 0.18 * (0.5 + 0.5 * Math.sin(phase)));
        const scalePulse = 0.96 + 0.06 * (0.5 + 0.5 * Math.sin(phase + 0.7));
        track.volume.scale.set(track.width * scalePulse, track.height * scalePulse, 1);
      });

      for (let index = 0; index < CARD_COUNT; index += 1) {
        const factor = streamProgress + exitRunout - index * CARD_GAP;
        const onCurve = factor >= 0 && factor <= 1;
        const curveFactor = flowCurveFactor(THREE.MathUtils.clamp(factor, 0, 1));
        sampleExtendedCurve(factor, position);
        position.z =
          position.z * FLOW_HORIZONTAL_SCALE + FLOW_HORIZONTAL_OFFSET;
        spin.setFromAxisAngle(
          GLOBAL_SPIN_AXIS,
          (0.5 + curveFactor * SPINS * 1.32) * Math.PI,
        );
        rotation.multiplyQuaternions(spin, BASE_ROTATION);
        opticalPitch.setFromAxisAngle(
          LOCAL_PITCH_AXIS,
          THREE.MathUtils.degToRad(15) *
            THREE.MathUtils.smoothstep(curveFactor, 0.5, 0.92),
        );
        rotation.multiply(opticalPitch);
        const tailScale = THREE.MathUtils.lerp(
          1,
          1.3,
          THREE.MathUtils.smoothstep(curveFactor, 0.64, 0.95),
        );
        scale.setScalar(CARD_SCALE * tailScale);
        matrix.compose(position, rotation, scale);
        cards.setMatrixAt(index, matrix);
        frames.setMatrixAt(index, matrix);

        // Keep the faces almost black and put the visual energy into two local
        // edge-light clusters. This reproduces the reference's bright left fan,
        // central fold and quiet, receding right-hand stack without bleaching
        // every card face under one global light.
        const exitShadow = THREE.MathUtils.smoothstep(factor, 0.84, 1.16);
        const entryShadow = 1 - THREE.MathUtils.smoothstep(factor, -0.16, 0.04);
        const tailQuieting = THREE.MathUtils.lerp(
          1,
          0.06,
          THREE.MathUtils.smoothstep(curveFactor, 0.6, 0.94),
        );
        const illumination =
          (1 - exitShadow) * (1 - entryShadow) * tailQuieting;
        const fanLight = glowPeak(curveFactor, 0.28, 0.075);
        const foldLight = glowPeak(curveFactor, 0.55, 0.065);
        const faceLight = THREE.MathUtils.clamp(
          (0.035 + fanLight * 0.2 + foldLight * 0.13) * illumination,
          0,
          0.34,
        );

        bodyColor.setRGB(
          0.12 + faceLight * 0.16,
          0.17 + faceLight * 0.2,
          0.34 + faceLight * 0.28,
        );
        frameColor.setRGB(
          0.006 * illumination,
          0.012 * illumination,
          0.055 * illumination,
        );
        cards.setColorAt(index, bodyColor);
        frames.setColorAt(index, frameColor);
        frameGlows.setXY(
          index,
          fanLight * illumination,
          foldLight * illumination,
        );
        if (onCurve) onCurveCards += 1;
      }

      cards.instanceMatrix.needsUpdate = true;
      frames.instanceMatrix.needsUpdate = true;
      bodyColors.needsUpdate = true;
      frameColors.needsUpdate = true;
      frameGlows.needsUpdate = true;
      composer.render();
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
      frames.dispose();
      geometry.dispose();
      frameGeometry.dispose();
      material.dispose();
      frameMaterial.dispose();
      lightVolumes.forEach((volume) => scene.remove(volume));
      lightVolumeMaterials.forEach((lightMaterial) => lightMaterial.dispose());
      glowTexture?.dispose();
      renderPass.dispose();
      bloomPass.dispose();
      bokehPass.dispose();
      lensPass.dispose();
      outputPass.dispose();
      preBloomFxaaPass.dispose();
      fxaaPass.dispose();
      composer.dispose();
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

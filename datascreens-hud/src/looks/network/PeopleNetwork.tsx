import React, { useMemo } from "react";
import * as THREE from "three";
import { LOOP_FRAMES, hexToRgb, loopFrame } from "../../lib/loop";
import { PostChain } from "../../lib/post";
import { int, mulberry32, range } from "../../lib/random";
import { StageCtx, StageFactory, ThreeStage } from "../../lib/ThreeStage";

export interface PeopleNetworkProps {
  bgTop: string;
  bgBottom: string;
  badgeA: string; // badge fill (main)
  badgeB: string; // badge fill (secondary; same as A for a single-colour look)
  glyph: string; // pictogram on filled badges
  line: string;
  lineAlpha: number;
  pulse: string;
  pulseAdditive: boolean;
  halo: string;
  grain: number;
  farFade: number; // how much far badges fade (0..1)
  badgeAlpha: number;
  background: string;
}

// ---------------------------------------------------------------------------
// Network, generated once. The volume is periodic in x with period P; the
// camera trucks exactly one period per loop, so the loop is exact. P is wider
// than the view at the far plane, so badges wrap outside the frame.
// ---------------------------------------------------------------------------
const P = 56;
const Y_HALF = 13;
const Z_NEAR = 2.6;
const Z_FAR = 28;
const COUNT = 350;
const FOCUS = 10;
const FOV = 50;

interface Badge {
  x: number;
  y: number;
  z: number; // distance in front of the camera
  r: number; // world radius
  filled: boolean;
  colourB: boolean;
  glow: boolean;
  bob: number;
  bobCycles: number;
  phase: number;
}

const rng = mulberry32(0x9e0b1e);
const BADGES: Badge[] = Array.from({ length: COUNT }, () => {
  // a few extra near badges for the big soft foreground ones
  const near = rng() < 0.05;
  const z = near ? range(rng, Z_NEAR, 5) : range(rng, 4, Z_FAR);
  return {
    x: range(rng, -P / 2, P / 2),
    y: range(rng, -Y_HALF, Y_HALF) * (0.35 + 0.65 * (z / Z_FAR)),
    z,
    r: range(rng, 0.42, 0.62),
    filled: rng() < 0.92,
    glow: rng() < 0.08,
    colourB: rng() < 0.35,
    bob: range(rng, 0.03, 0.12),
    bobCycles: int(rng, 1, 2),
    phase: rng() * Math.PI * 2,
  };
});

const minImage = (dx: number) => dx - P * Math.round(dx / P);

// links: each badge to its 2-3 nearest neighbours (periodic distance)
const LINKS: [number, number][] = [];
{
  const seen = new Set<string>();
  BADGES.forEach((a, i) => {
    const k = rng() < 0.7 ? 2 : 3;
    const d = BADGES.map((b, j) => {
      if (j === i) return [Infinity, j];
      const dx = minImage(b.x - a.x);
      return [dx * dx + (b.y - a.y) ** 2 + (b.z - a.z) ** 2, j];
    }).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (let n = 0; n < k; n++) {
      const j = d[n][1];
      if (d[n][0] > 36) continue; // no long cross-frame links
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        LINKS.push([i, j]);
      }
    }
  });
}

const PULSES = Array.from({ length: 28 }, () => ({
  link: Math.floor(rng() * LINKS.length),
  cycles: int(rng, 1, 3) * (rng() < 0.5 ? 1 : -1),
  phase: rng(),
}));

// ---------------------------------------------------------------------------
// badge atlas: 2 variants (filled / outline) x N blur levels, drawn once.
// Channels: R = disc coverage, G = pictogram coverage, B = outline-variant coverage.
// ---------------------------------------------------------------------------
const LEVELS = 8;
const BADGE_R = 0.28; // badge radius as a fraction of the cell
const MAX_SIGMA = 0.075; // max blur (std dev) as a fraction of the cell

const drawPictogram = (c: CanvasRenderingContext2D, cx: number, cy: number, R: number, stroke: boolean) => {
  // generic head + shoulders
  const headR = R * 0.24;
  const headY = cy - R * 0.2;
  c.beginPath();
  c.arc(cx, headY, headR, 0, Math.PI * 2);
  if (stroke) c.stroke();
  else c.fill();
  // rounded shoulders: the top half of an ellipse, closed along the bottom
  const sw = R * 0.46;
  const top = cy + R * 0.1;
  const bottom = cy + R * 0.46;
  c.beginPath();
  c.ellipse(cx, bottom, sw, bottom - top, 0, Math.PI, 2 * Math.PI);
  c.closePath();
  if (stroke) c.stroke();
  else c.fill();
};

const buildAtlas = (cell: number) => {
  const cv = document.createElement("canvas");
  cv.width = cell * LEVELS;
  cv.height = cell * 2;
  const c = cv.getContext("2d")!;
  c.fillStyle = "#000";
  c.fillRect(0, 0, cv.width, cv.height);
  const sharp = document.createElement("canvas");
  sharp.width = cell;
  sharp.height = cell;
  const s = sharp.getContext("2d")!;
  for (let variant = 0; variant < 2; variant++) {
    s.globalCompositeOperation = "source-over";
    s.fillStyle = "#000";
    s.fillRect(0, 0, cell, cell);
    s.globalCompositeOperation = "lighter";
    const R = cell * BADGE_R;
    const cx = cell / 2;
    if (variant === 0) {
      s.fillStyle = "#ff0000";
      s.beginPath();
      s.arc(cx, cx, R, 0, Math.PI * 2);
      s.fill();
      // pictogram as a solid silhouette drawn in G
      s.fillStyle = "#00ff00";
      drawPictogram(s, cx, cx, R, false);
    } else {
      s.strokeStyle = "#0000ff";
      s.lineWidth = R * 0.07;
      s.beginPath();
      s.arc(cx, cx, R * 0.96, 0, Math.PI * 2);
      s.stroke();
      s.lineJoin = "round";
      drawPictogram(s, cx, cx, R, true);
      // faint fill so outline badges still read as discs
      s.fillStyle = "rgb(0,0,40)";
      s.beginPath();
      s.arc(cx, cx, R * 0.93, 0, Math.PI * 2);
      s.fill();
    }
    for (let l = 0; l < LEVELS; l++) {
      const sigma = (l / (LEVELS - 1)) * MAX_SIGMA * cell;
      c.save();
      c.beginPath();
      c.rect(l * cell, variant * cell, cell, cell);
      c.clip();
      c.filter = sigma > 0.01 ? `blur(${sigma.toFixed(2)}px)` : "none";
      c.drawImage(sharp, l * cell, variant * cell);
      c.restore();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
};

const BADGE_VS = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BADGE_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tAtlas;
uniform float uLevel;   // 0..LEVELS-1, fractional
uniform float uVariant; // 0 filled, 1 outline
uniform vec3 uFill;
uniform vec3 uGlyph;
uniform float uAlpha;
const float LEVELS = ${LEVELS.toFixed(1)};
vec3 at(float level) {
  vec2 uv = vec2((vUv.x + level) / LEVELS, (vUv.y + (1.0 - uVariant)) / 2.0);
  return texture(tAtlas, uv).rgb;
}
void main() {
  float l0 = floor(uLevel);
  float l1 = min(l0 + 1.0, LEVELS - 1.0);
  vec3 m = mix(at(l0), at(l1), uLevel - l0);
  vec3 col;
  float a;
  if (uVariant < 0.5) {
    float g = min(m.g, m.r);
    a = m.r;
    col = uFill * (m.r - g) + uGlyph * g; // premultiplied
  } else {
    a = m.b;
    col = uFill * m.b;
  }
  outColor = vec4(col * uAlpha, a * uAlpha);
}`;

const LINE_VS = /* glsl */ `
in vec3 aA;
in vec3 aB;
in float aAlpha;
uniform vec2 uRes;
uniform float uHalfWidth; // physical px
out float vAlpha;
out float vSide;
void main() {
  vec4 ca = projectionMatrix * viewMatrix * vec4(aA, 1.0);
  vec4 cb = projectionMatrix * viewMatrix * vec4(aB, 1.0);
  vec2 na = ca.xy / ca.w;
  vec2 nb = cb.xy / cb.w;
  vec2 dir = (nb - na) * uRes;
  dir = length(dir) > 1e-5 ? normalize(dir) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = mix(ca, cb, position.x);
  c.xy += nrm * position.y * (uHalfWidth + 0.5) * 2.0 / uRes * c.w;
  vAlpha = aAlpha;
  vSide = position.y * (uHalfWidth + 0.5);
  gl_Position = c;
}`;

const LINE_FS = /* glsl */ `
precision highp float;
in float vAlpha;
in float vSide;
uniform vec3 uColor;
uniform float uHalfWidth;
out vec4 outColor;
void main() {
  // analytic edge AA across the line
  float cov = clamp(uHalfWidth + 0.5 - abs(vSide), 0.0, 1.0);
  float a = vAlpha * cov;
  outColor = vec4(uColor * a, a);
}`;

const DOT_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 uColor;
uniform float uAlpha;
uniform float uAdditive;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = exp(-d * d * 7.0) * uAlpha;
  outColor = vec4(uColor * a, uAdditive > 0.5 ? 0.0 : a);
}`;

const BG_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 uTop;
uniform vec3 uBottom;
void main() {
  float k = smoothstep(0.0, 1.0, 1.0 - vUv.y * 0.85 - vUv.x * 0.15);
  outColor = vec4(mix(uTop, uBottom, k), 1.0);
}`;

const premul = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendEquation: THREE.AddEquation,
} as const;

const createApp = (props: PeopleNetworkProps) => (ctx: StageCtx) => {
  const { gl, width: W, height: H, u } = ctx;
  const post = new PostChain(gl, W, H, { msaa: 4, dither: true, grain: props.grain });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
  const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180);
  const cell = H > 1000 ? 512 : 256;
  const atlas = buildAtlas(cell);

  // background
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: BG_FS,
      uniforms: {
        uTop: { value: new THREE.Vector3(...hexToRgb(props.bgTop)) },
        uBottom: { value: new THREE.Vector3(...hexToRgb(props.bgBottom)) },
      },
      depthTest: false,
      depthWrite: false,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // links (instanced screen-space quads)
  const lineGeo = new THREE.InstancedBufferGeometry();
  lineGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
  );
  lineGeo.setIndex([0, 1, 2, 0, 2, 3]);
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(LINKS.length * 3), 3);
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(LINKS.length * 3), 3);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(LINKS.length), 1);
  aA.setUsage(THREE.DynamicDrawUsage);
  aB.setUsage(THREE.DynamicDrawUsage);
  aAlpha.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("aA", aA);
  lineGeo.setAttribute("aB", aB);
  lineGeo.setAttribute("aAlpha", aAlpha);
  lineGeo.instanceCount = LINKS.length;
  const lineMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: LINE_VS,
    fragmentShader: LINE_FS,
    uniforms: {
      uRes: { value: new THREE.Vector2(W, H) },
      uHalfWidth: { value: 0.8 * u },
      uColor: { value: new THREE.Vector3(...hexToRgb(props.line)) },
    },
    ...premul,
  });
  const lines = new THREE.Mesh(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = -5;
  scene.add(lines);

  // badges
  const quad = new THREE.PlaneGeometry(1, 1);
  const fillA = new THREE.Vector3(...hexToRgb(props.badgeA));
  const fillB = new THREE.Vector3(...hexToRgb(props.badgeB));
  const glyph = new THREE.Vector3(...hexToRgb(props.glyph));
  const badgeMeshes = BADGES.map((b) => {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BADGE_VS,
      fragmentShader: BADGE_FS,
      uniforms: {
        tAtlas: { value: atlas },
        uLevel: { value: 0 },
        uVariant: { value: b.filled ? 0 : 1 },
        uFill: { value: b.colourB ? fillB : fillA },
        uGlyph: { value: glyph },
        uAlpha: { value: 1 },
      },
      ...premul,
    });
    const m = new THREE.Mesh(quad, mat);
    m.frustumCulled = false;
    const size = (2 * b.r) / (2 * BADGE_R);
    m.scale.set(size, size, 1);
    scene.add(m);
    return m;
  });

  // pulses
  const pulseColor = new THREE.Vector3(...hexToRgb(props.pulse));
  const pulseMeshes = PULSES.map(() => {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BADGE_VS,
      fragmentShader: DOT_FS,
      uniforms: {
        uColor: { value: pulseColor },
        uAlpha: { value: 1 },
        uAdditive: { value: props.pulseAdditive ? 1 : 0 },
      },
      ...premul,
    });
    const m = new THREE.Mesh(quad, mat);
    m.frustumCulled = false;
    m.renderOrder = -4;
    scene.add(m);
    return m;
  });

  // a few "lit" badges carry a soft halo that breathes (whole cycles per loop)
  const haloColor = new THREE.Vector3(...hexToRgb(props.halo));
  const halos = BADGES.map((b, i) => ({ b, i })).filter(({ b }) => b.glow).map(({ b, i }) => {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BADGE_VS,
      fragmentShader: DOT_FS,
      uniforms: {
        uColor: { value: haloColor },
        uAlpha: { value: 0 },
        uAdditive: { value: props.pulseAdditive ? 1 : 0 },
      },
      ...premul,
    });
    const m = new THREE.Mesh(quad, mat);
    m.frustumCulled = false;
    const sz = b.r * 4.4;
    m.scale.set(sz, sz, 1);
    scene.add(m);
    return { m, i, cycles: 1 + (i % 2), phase: b.phase };
  });

  const pos = BADGES.map(() => new THREE.Vector3());
  const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

  return {
    render(frame: number) {
      const f = loopFrame(frame);
      const t = f / LOOP_FRAMES;
      camera.position.set(0, 0, 0);
      camera.rotation.set(0.015 * Math.sin(2 * Math.PI * t), 0.055 * Math.cos(2 * Math.PI * t), 0);
      camera.updateMatrixWorld();

      BADGES.forEach((b, i) => {
        const x = minImage(b.x - P * t);
        const y = b.y + b.bob * Math.sin(2 * Math.PI * b.bobCycles * t + b.phase);
        pos[i].set(x, y, -b.z);
      });

      BADGES.forEach((b, i) => {
        const m = badgeMeshes[i];
        m.position.copy(pos[i]);
        m.quaternion.copy(camera.quaternion);
        const mat = m.material as THREE.ShaderMaterial;
        // depth of field: blur from the circle of confusion around FOCUS
        const coc = Math.abs(1 - FOCUS / b.z);
        const blurPx = (b.z < FOCUS ? 3 : 2.5) * coc * u;
        const rPx = (b.r / (b.z * tanHalf)) * (H / 2);
        const sigmaFrac = (blurPx * BADGE_R) / Math.max(rPx, 1);
        mat.uniforms.uLevel.value = Math.min(LEVELS - 1, (sigmaFrac / MAX_SIGMA) * (LEVELS - 1));
        const nearSoft = b.z < 6 ? 0.3 + 0.55 * smooth(2.6, 6, b.z) : 1;
        const far = 1 - props.farFade * smooth(11, Z_FAR, b.z);
        mat.uniforms.uAlpha.value = props.badgeAlpha * nearSoft * far;
      });

      LINKS.forEach(([i, j], n) => {
        const a = pos[i];
        const bx = a.x + minImage(BADGES[j].x - BADGES[i].x);
        const b = pos[j];
        aA.setXYZ(n, a.x, a.y, a.z);
        aB.setXYZ(n, bx, b.y, b.z);
        const zMin = Math.min(BADGES[i].z, BADGES[j].z);
        const zAvg = (BADGES[i].z + BADGES[j].z) / 2;
        const alpha = props.lineAlpha * smooth(3, 6, zMin) * (1 - 0.75 * smooth(10, Z_FAR, zAvg));
        aAlpha.setX(n, alpha);
      });
      aA.needsUpdate = true;
      aB.needsUpdate = true;
      aAlpha.needsUpdate = true;

      PULSES.forEach((p, n) => {
        const [i, j] = LINKS[p.link];
        const a = pos[i];
        const k = ((p.phase + p.cycles * t) % 1 + 1) % 1;
        const bx = a.x + minImage(BADGES[j].x - BADGES[i].x);
        const m = pulseMeshes[n];
        m.position.set(a.x + (bx - a.x) * k, a.y + (pos[j].y - a.y) * k, a.z + (pos[j].z - a.z) * k);
        m.quaternion.copy(camera.quaternion);
        const s = 0.32;
        m.scale.set(s, s, 1);
        const zz = -m.position.z;
        (m.material as THREE.ShaderMaterial).uniforms.uAlpha.value =
          Math.sin(Math.PI * k) * smooth(3, 6, zz) * (1 - 0.6 * smooth(12, Z_FAR, zz));
      });

      for (const h of halos) {
        // sits just behind its badge so depth sorting draws it first
        h.m.position.set(pos[h.i].x, pos[h.i].y, pos[h.i].z - 0.02);
        h.m.quaternion.copy(camera.quaternion);
        const b = BADGES[h.i];
        const far = 1 - props.farFade * smooth(11, Z_FAR, b.z);
        (h.m.material as THREE.ShaderMaterial).uniforms.uAlpha.value =
          (0.85 + 0.15 * Math.sin(2 * Math.PI * h.cycles * t + h.phase)) * far;
      }
      post.render(scene, camera, f);
    },
    dispose() {
      post.dispose();
      atlas.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      quad.dispose();
      badgeMeshes.forEach((m) => (m.material as THREE.Material).dispose());
      pulseMeshes.forEach((m) => (m.material as THREE.Material).dispose());
    },
  };
};

export const PeopleNetwork: React.FC<PeopleNetworkProps> = (props) => {
  const factory: StageFactory = useMemo(
    () => createApp(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(props)],
  );
  return <ThreeStage factory={factory} background={props.background} />;
};

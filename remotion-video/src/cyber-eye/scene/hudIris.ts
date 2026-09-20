import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  NormalBlending,
  PlaneGeometry,
  RingGeometry,
  Sprite,
  SpriteNodeMaterial,
  Texture,
} from "three/webgpu";
import {
  Fn,
  PI2,
  atan,
  exp,
  float,
  floor,
  fract,
  hash,
  instancedBufferAttribute,
  length,
  max,
  mix,
  oneMinus,
  pow,
  saturate,
  sin,
  smoothstep,
  step,
  texture,
  uv,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { colorVec3, floatUniform, type FloatUniform } from "./tsl-helpers";
import type { Palette } from "../palettes";
import { HUD_RADIUS, HUD_Z } from "../constants";
import { mulberry32 } from "../random";

export type HudIris = {
  group: Group;
  setTime: (t: number) => void;
};

const DEG = Math.PI / 180;

type RingSpec = {
  r: number;
  w: number;
  opacity: number;
  /** dash count around the ring */
  segments?: number;
  /** fraction of each dash cell that is lit */
  duty?: number;
  /** probability that a given dash exists at all (hashed) */
  fill?: number;
  seed?: number;
  /** degrees per second, positive = counter-clockwise */
  speed: number;
  phase?: number;
  color?: "primary" | "bright" | "secondary";
};

type ArcSpec = RingSpec & { start: number; len: number };

// Structural rings: pupil rim, a few solid guides, the bright disc edge.
const RINGS: RingSpec[] = [
  { r: 0.052, w: 0.0025, opacity: 1.0, speed: 0, color: "bright" },
  { r: 0.068, w: 0.004, opacity: 0.9, segments: 12, duty: 0.22, speed: 4 },
  { r: 0.15, w: 0.0018, opacity: 0.45, speed: 0 },
  { r: 0.205, w: 0.0018, opacity: 0.35, segments: 6, duty: 0.9, speed: -1 },
  { r: 0.248, w: 0.0022, opacity: 0.7, speed: 0 },
  { r: 0.262, w: 0.007, opacity: 0.45, segments: 180, duty: 0.4, speed: -5 },
  { r: 0.276, w: 0.0016, opacity: 0.5, segments: 4, duty: 0.94, speed: 1.5 },
  { r: 0.31, w: 0.0014, opacity: 0.28, segments: 4, duty: 0.9, speed: 1 },
  { r: 0.345, w: 0.001, opacity: 0.16, segments: 240, duty: 0.5, speed: 2 },
];

// Feature arcs: the glowing cyan panels on the left, accents on the right.
const ARCS: ArcSpec[] = [
  { r: 0.19, w: 0.03, opacity: 1.35, start: 160, len: 22, speed: 0.6, color: "bright" },
  { r: 0.152, w: 0.022, opacity: 1.2, start: 188, len: 17, speed: -0.8, color: "bright" },
  { r: 0.228, w: 0.012, opacity: 0.9, start: 132, len: 14, speed: 0.6, color: "bright" },
  { r: 0.135, w: 0.014, opacity: 0.95, start: 20, len: 55, speed: -9 },
  { r: 0.185, w: 0.008, opacity: 0.6, start: 90, len: 120, speed: 5 },
  { r: 0.232, w: 0.01, opacity: 0.85, start: 300, len: 70, speed: -3, color: "secondary" },
  { r: 0.255, w: 0.004, opacity: 0.5, start: 0, len: 200, speed: 2 },
  { r: 0.108, w: 0.006, opacity: 0.9, start: 140, len: 40, speed: 14, color: "secondary" },
  { r: 0.292, w: 0.003, opacity: 0.45, start: 230, len: 90, speed: -1.5 },
  { r: 0.33, w: 0.0025, opacity: 0.35, start: 20, len: 60, speed: 1.2 },
];

// Dozens of fine "data rings": dashed, partially filled, each rotating at its own pace.
const makeDataRings = (): RingSpec[] => {
  const rand = mulberry32(2024);
  const specs: RingSpec[] = [];
  const segmentChoices = [48, 72, 96, 120, 144, 192, 288, 360];
  for (let i = 0; i < 22; i++) {
    const r = 0.08 + i * 0.0092 + rand() * 0.003;
    specs.push({
      r,
      w: 0.0025 + rand() * 0.004,
      opacity: 0.12 + rand() * 0.3,
      segments: segmentChoices[Math.floor(rand() * segmentChoices.length)],
      duty: 0.3 + rand() * 0.45,
      fill: 0.45 + rand() * 0.45,
      seed: Math.floor(rand() * 1000),
      speed: (rand() - 0.5) * 6,
      phase: rand() * 360,
      color: rand() < 0.2 ? "bright" : "primary",
    });
  }
  return specs;
};

const pick = (palette: Palette, which: RingSpec["color"]) => {
  if (which === "bright") return palette.primaryBright;
  if (which === "secondary") return palette.secondary;
  return palette.primary;
};

// Ring / arc material. RingGeometry UVs are planar (0..1 across the bounding
// square), so the angle is recovered from uv - 0.5 for dash patterns.
const makeRingMaterial = (hex: string, spec: RingSpec) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.side = DoubleSide;
  const base = colorVec3(hex).mul(spec.opacity);
  if (spec.segments) {
    const pattern = Fn(() => {
      const p = uv().sub(0.5);
      const a = atan(p.y, p.x).div(PI2).add(0.5).mul(spec.segments ?? 1);
      const dash = step(fract(a), float(spec.duty ?? 0.5));
      if (spec.fill !== undefined && spec.fill < 1) {
        const on = step(float(1 - spec.fill), hash(floor(a).add(spec.seed ?? 0)));
        return dash.mul(on);
      }
      return dash;
    })();
    material.colorNode = base.mul(pattern);
  } else {
    material.colorNode = base;
  }
  material.opacityNode = float(1);
  return material;
};

// Opaque base of the disc: dark, slightly lighter than the background, with
// a faint concentric "circuit" texture and dotted data grid baked in.
const makeBaseMaterial = (palette: Palette) => {
  const material = new MeshBasicNodeMaterial();
  material.blending = NormalBlending;
  material.colorNode = Fn(() => {
    const p = uv().sub(0.5).mul(2);
    const r = length(p);
    const ang = atan(p.y, p.x).div(PI2).add(0.5);
    const base = mix(colorVec3(palette.irisBase), colorVec3(palette.background), smoothstep(float(0.86), float(1.0), r));
    const fine = smoothstep(float(0.9), float(1.0), fract(r.mul(38))).mul(0.10);
    const dots = step(float(0.82), hash(floor(r.mul(30)).mul(977).add(floor(ang.mul(140))))).mul(
      step(float(0.5), fract(r.mul(30))),
    ).mul(0.16);
    const grid = fine.add(dots).mul(smoothstep(float(0.22), float(0.3), r)).mul(oneMinus(smoothstep(float(0.85), float(1.0), r)));
    return base.add(colorVec3(palette.primary).mul(grid));
  })();
  return material;
};

// The luminous burst: layers of tapered radial streaks with hashed brightness,
// a strong light blast in the lower half, thin glow rings and a soft core.
const makeStreakMaterial = (palette: Palette, time: FloatUniform) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;

  const layers = [
    { n: 64, r0: 0.16, r1: 0.3, r2: 0.7, r3: 1.0, speed: 0.012, power: 3, weight: 0.55, seed: 11 },
    { n: 140, r0: 0.2, r1: 0.36, r2: 0.6, r3: 0.85, speed: -0.007, power: 4, weight: 0.5, seed: 23 },
    { n: 260, r0: 0.22, r1: 0.28, r2: 0.95, r3: 1.0, speed: 0.004, power: 6, weight: 0.5, seed: 37 },
    { n: 22, r0: 0.18, r1: 0.32, r2: 0.55, r3: 0.75, speed: -0.003, power: 2, weight: 0.3, seed: 51 },
    { n: 420, r0: 0.3, r1: 0.4, r2: 0.9, r3: 1.0, speed: 0.009, power: 8, weight: 0.45, seed: 77 },
  ];
  const glowRings = [0.28, 0.5, 0.66, 0.84, 0.93];

  material.colorNode = Fn(() => {
    const p = uv().sub(0.5).mul(2);
    const r = length(p);
    const ang = atan(p.y, p.x).div(PI2).add(0.5);
    // -1 at the bottom of the disc, +1 at the top
    const sinA = p.y.div(max(r, float(0.0001)));
    const lower = saturate(sinA.negate());
    const angularBoost = float(0.6).add(pow(lower, 1.6).mul(1.4));
    let acc: Node<"float"> = float(0);
    for (const l of layers) {
      const scaled = ang.add(time.mul(l.speed)).mul(l.n);
      const cell = floor(scaled);
      const taper = pow(oneMinus(fract(scaled).sub(0.5).abs().mul(2)), 2.5);
      const spoke = pow(hash(cell.add(l.seed)), l.power).mul(taper);
      const radial = smoothstep(float(l.r0), float(l.r1), r).mul(oneMinus(smoothstep(float(l.r2), float(l.r3), r)));
      acc = acc.add(spoke.mul(radial).mul(l.weight));
    }
    acc = acc.mul(angularBoost);
    for (const gr of glowRings) {
      acc = acc.add(exp(r.sub(gr).abs().div(0.012).negate()).mul(0.35));
    }
    // light blast: a bright crescent in the lower half plus a soft flood
    const crescent = exp(pow(r.sub(0.58).div(0.12), 2).negate()).mul(pow(lower, 2.5)).mul(0.9);
    const flood = oneMinus(smoothstep(float(0.15), float(0.9), r)).mul(pow(lower, 2)).mul(0.45);
    acc = acc.add(crescent).add(flood);
    // core glow + faint overall disc glow
    acc = acc.add(pow(oneMinus(smoothstep(float(0.0), float(0.45), r)), 2).mul(0.45));
    acc = acc.add(oneMinus(smoothstep(float(0.3), float(1.0), r)).mul(0.1));
    // dark pupil and the disc edge
    acc = acc.mul(smoothstep(float(0.15), float(0.21), r));
    acc = acc.mul(oneMinus(smoothstep(float(0.92), float(1.0), r)));
    // subtle shimmer over time
    acc = acc.mul(float(0.92).add(sin(time.mul(2.3).add(ang.mul(40))).mul(0.08)));
    const c = mix(colorVec3(palette.primary), colorVec3(palette.primaryBright), saturate(acc.mul(0.3)));
    return c.mul(acc);
  })();
  material.opacityNode = float(1);
  return material;
};

const makeSprite = (tex: Texture, hex: string, scale: number, intensityUniform: FloatUniform) => {
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.blending = AdditiveBlending;
  material.colorNode = texture(tex, uv()).rgb.mul(colorVec3(hex)).mul(intensityUniform);
  material.opacityNode = float(1);
  const sprite = new Sprite(material);
  sprite.scale.set(scale, scale, 1);
  return sprite;
};

// Hundreds of tiny sparkles scattered over the disc, each flashing on its own clock.
const makeSparkles = (palette: Palette, dotTexture: Texture, time: FloatUniform, count: number) => {
  const rand = mulberry32(4242);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = 0.07 + Math.sqrt(rand()) * 0.25;
    const a = rand() * Math.PI * 2;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.sin(a) * r;
    positions[i * 3 + 2] = 0.009;
    seeds[i] = rand();
  }
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;
  material.blending = AdditiveBlending;
  const pos = instancedBufferAttribute<"vec3">(new InstancedBufferAttribute(positions, 3), "vec3");
  const seed = instancedBufferAttribute<"float">(new InstancedBufferAttribute(seeds, 1), "float");
  material.positionNode = pos;
  material.scaleNode = float(0.007).mul(seed.mul(1.2).add(0.4));
  const flash = pow(sin(time.mul(seed.mul(4).add(1)).add(seed.mul(200))).mul(0.5).add(0.5), 6);
  const soft = texture(dotTexture, uv()).r;
  material.colorNode = colorVec3(palette.primaryBright).mul(flash.mul(1.6).add(0.05)).mul(soft);
  material.opacityNode = float(1);
  const mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, count);
  mesh.frustumCulled = false;
  return mesh;
};

const makeLine = (hex: string, opacity: number, length_: number, width: number) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;
  material.colorNode = colorVec3(hex).mul(opacity);
  material.opacityNode = float(1);
  return new Mesh(new PlaneGeometry(width, length_), material);
};

export const buildHudIris = (
  palette: Palette,
  textures: { flare: Texture; streak: Texture; dot: Texture },
): HudIris => {
  const group = new Group();
  group.position.z = HUD_Z;
  const time = floatUniform(0);

  // Opaque base disc, then the burst on top.
  const base = new Mesh(new CircleGeometry(HUD_RADIUS * 1.08, 128), makeBaseMaterial(palette));
  base.position.z = -0.002;
  group.add(base);
  const disc = new Mesh(new CircleGeometry(HUD_RADIUS, 128), makeStreakMaterial(palette, time));
  group.add(disc);

  // Opaque pupil so nothing shines through the centre.
  const pupilMaterial = new MeshBasicNodeMaterial();
  pupilMaterial.colorNode = colorVec3(palette.background);
  pupilMaterial.blending = NormalBlending;
  const pupil = new Mesh(new CircleGeometry(0.046, 96), pupilMaterial);
  pupil.position.z = 0.0005;
  group.add(pupil);

  const rotating: { mesh: Mesh; speed: number; phase: number }[] = [];
  const panelPulse = floatUniform(1);
  for (const spec of [...makeDataRings(), ...RINGS]) {
    const geo = new RingGeometry(spec.r - spec.w / 2, spec.r + spec.w / 2, 256);
    const mesh = new Mesh(geo, makeRingMaterial(pick(palette, spec.color), spec));
    mesh.position.z = 0.001;
    group.add(mesh);
    rotating.push({ mesh, speed: spec.speed, phase: spec.phase ?? 0 });
  }
  ARCS.forEach((spec, i) => {
    const geo = new RingGeometry(spec.r - spec.w / 2, spec.r + spec.w / 2, 128, 1, spec.start * DEG, spec.len * DEG);
    const material = makeRingMaterial(pick(palette, spec.color), spec);
    if (spec.color === "bright" && spec.w >= 0.012 && material.colorNode) {
      // the glowing panels breathe slowly
      material.colorNode = (material.colorNode as Node<"vec3">).mul(panelPulse);
    }
    const mesh = new Mesh(geo, material);
    mesh.position.z = 0.0015 + i * 0.00001;
    group.add(mesh);
    rotating.push({ mesh, speed: spec.speed, phase: 0 });
  });

  // Crosshair: full-height vertical line, short horizontal stubs, a diagonal
  // leader line to the upper right, and the tiny centre square.
  const vertical = makeLine(palette.primary, 0.55, 0.64, 0.0012);
  vertical.position.z = 0.0025;
  group.add(vertical);
  const hstubL = makeLine(palette.primary, 0.5, 0.0012, 0.09);
  hstubL.position.set(-0.075, 0, 0.0025);
  group.add(hstubL);
  const hstubR = makeLine(palette.primary, 0.5, 0.0012, 0.09);
  hstubR.position.set(0.075, 0, 0.0025);
  group.add(hstubR);
  const leader = makeLine(palette.primaryBright, 0.6, 0.36, 0.0012);
  const leaderAngle = 38 * DEG;
  leader.rotation.z = leaderAngle - Math.PI / 2;
  leader.position.set(Math.cos(leaderAngle) * 0.18, Math.sin(leaderAngle) * 0.18, 0.0025);
  group.add(leader);
  const centreSquare = new Mesh(
    new PlaneGeometry(0.007, 0.007),
    (() => {
      const m = new MeshBasicNodeMaterial();
      m.colorNode = colorVec3(palette.primaryBright).mul(1.4);
      m.blending = AdditiveBlending;
      m.transparent = true;
      m.depthWrite = false;
      return m;
    })(),
  );
  centreSquare.position.z = 0.003;
  group.add(centreSquare);

  // Core highlight up-right of the pupil, plus a soft centre glow.
  const coreIntensity = floatUniform(1);
  const core = makeSprite(textures.flare, palette.primaryBright, 0.11, coreIntensity);
  core.position.set(0.048, 0.042, 0.004);
  group.add(core);
  const centreGlow = floatUniform(0.18);
  const centre = makeSprite(textures.flare, palette.primary, 0.16, centreGlow);
  centre.position.set(0, 0, 0.003);
  group.add(centre);
  const leaderDots = [0.11, 0.24, 0.33].map((d) => {
    const s = makeSprite(textures.dot, palette.primaryBright, 0.012, coreIntensity);
    s.position.set(Math.cos(leaderAngle) * d, Math.sin(leaderAngle) * d, 0.0045);
    group.add(s);
    return s;
  });
  void leaderDots;

  // Accent hot-spots riding on the rings (orange with anamorphic streaks).
  const spots: { sprite: Sprite; r: number; a0: number; speed: number; u: FloatUniform; f: number }[] = [];
  const spotSpecs = [
    { r: 0.265, a0: 4, speed: -1.5, scale: 0.19, f: 1.1, color: palette.secondary },
    { r: 0.215, a0: 30, speed: 2, scale: 0.12, f: 1.7, color: palette.secondary },
    { r: 0.285, a0: 212, speed: 1, scale: 0.17, f: 0.8, color: palette.secondary },
    { r: 0.135, a0: 47, speed: -9, scale: 0.09, f: 2.3, color: palette.primaryBright },
    { r: 0.2, a0: 300, speed: 3, scale: 0.075, f: 1.3, color: palette.primaryBright },
    { r: 0.24, a0: 150, speed: -2, scale: 0.08, f: 2.9, color: palette.primaryBright },
  ];
  spotSpecs.forEach((s) => {
    const u = floatUniform(1);
    const sprite = makeSprite(textures.flare, s.color, s.scale, u);
    sprite.position.z = 0.005;
    group.add(sprite);
    spots.push({ sprite, r: s.r, a0: s.a0, speed: s.speed, u, f: s.f });
  });

  // Sparkles
  group.add(makeSparkles(palette, textures.dot, time, 420));

  // Warm horizontal light streak across the lower half of the iris and a
  // cooler one just above centre.
  const streakIntensity = floatUniform(0.6);
  const makeStreak = (hex: string, w: number, h: number) => {
    const material = new MeshBasicNodeMaterial();
    material.transparent = true;
    material.depthWrite = false;
    material.blending = AdditiveBlending;
    material.colorNode = texture(textures.streak, uv()).rgb.mul(colorVec3(hex)).mul(streakIntensity);
    material.opacityNode = float(1);
    return new Mesh(new PlaneGeometry(w, h), material);
  };
  const streak = makeStreak(palette.secondary, 0.8, 0.06);
  streak.position.set(-0.08, -0.085, 0.006);
  group.add(streak);
  const streak2 = makeStreak(palette.primaryBright, 0.6, 0.03);
  streak2.position.set(0.05, 0.02, 0.006);
  group.add(streak2);

  // Thin scan line that sweeps down through the disc every few seconds.
  const scanIntensity = floatUniform(0);
  const scanMaterial = new MeshBasicNodeMaterial();
  scanMaterial.transparent = true;
  scanMaterial.depthWrite = false;
  scanMaterial.blending = AdditiveBlending;
  scanMaterial.colorNode = texture(textures.streak, uv()).rgb.mul(colorVec3(palette.primaryBright)).mul(scanIntensity);
  scanMaterial.opacityNode = float(1);
  const scan = new Mesh(new PlaneGeometry(0.56, 0.006), scanMaterial);
  scan.position.z = 0.007;
  group.add(scan);

  const setTime = (t: number) => {
    time.value = t;
    for (const item of rotating) {
      item.mesh.rotation.z = (item.phase + item.speed * t) * DEG;
    }
    panelPulse.value = 0.85 + 0.25 * Math.sin(t * 1.4) * Math.sin(t * 0.5 + 1.1);
    for (const s of spots) {
      const a = (s.a0 + s.speed * t) * DEG;
      s.sprite.position.x = Math.cos(a) * s.r;
      s.sprite.position.y = Math.sin(a) * s.r;
      const flicker = 0.55 + 0.45 * Math.sin(t * s.f * 2.1 + s.a0) * Math.sin(t * s.f * 0.7 + 1.3);
      s.u.value = 0.35 + flicker;
    }
    coreIntensity.value = 0.95 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.3 + 0.4);
    centreGlow.value = 0.17 + 0.05 * Math.sin(t * 0.9);
    streakIntensity.value = 0.55 + 0.2 * Math.sin(t * 0.6 + 1.0) + 0.1 * Math.sin(t * 4.3);
    streak.position.x = -0.08 + 0.03 * Math.sin(t * 0.35);
    const period = 4;
    const phase = (t % period) / period;
    const visible = phase < 0.6 ? phase / 0.6 : -1;
    if (visible >= 0) {
      scan.position.y = 0.27 - visible * 0.54;
      scanIntensity.value = 0.9 * Math.sin(visible * Math.PI);
    } else {
      scanIntensity.value = 0;
    }
  };

  return { group, setTime };
};

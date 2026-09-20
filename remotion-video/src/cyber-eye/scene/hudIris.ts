import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
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
  length,
  mix,
  oneMinus,
  pow,
  saturate,
  smoothstep,
  step,
  texture,
  uv,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { colorVec3, floatUniform, type FloatUniform } from "./tsl-helpers";
import type { Palette } from "../palettes";
import { HUD_RADIUS, HUD_Z } from "../constants";

export type HudIris = {
  group: Group;
  setTime: (t: number) => void;
};

const DEG = Math.PI / 180;

type RingSpec = {
  r: number;
  w: number;
  opacity: number;
  segments?: number;
  duty?: number;
  /** degrees per second, positive = counter-clockwise */
  speed: number;
  phase?: number;
  color?: "primary" | "bright" | "secondary";
};

type ArcSpec = RingSpec & { start: number; len: number };

// Radii are in world units; HUD_RADIUS (0.26) is the outer edge of the disc.
const RINGS: RingSpec[] = [
  { r: 0.056, w: 0.003, opacity: 1.0, speed: 0, color: "bright" },
  { r: 0.094, w: 0.002, opacity: 0.4, segments: 120, duty: 0.5, speed: 6 },
  { r: 0.124, w: 0.01, opacity: 0.55, segments: 36, duty: 0.55, speed: -4 },
  { r: 0.15, w: 0.0025, opacity: 0.55, speed: 0 },
  { r: 0.172, w: 0.007, opacity: 0.45, segments: 72, duty: 0.35, speed: 3 },
  { r: 0.198, w: 0.0035, opacity: 0.6, segments: 8, duty: 0.82, speed: -2 },
  { r: 0.222, w: 0.012, opacity: 0.32, segments: 60, duty: 0.6, speed: 2.5 },
  { r: 0.245, w: 0.002, opacity: 0.65, speed: 0 },
  { r: 0.262, w: 0.006, opacity: 0.35, segments: 180, duty: 0.4, speed: -5 },
  { r: 0.3, w: 0.0015, opacity: 0.28, segments: 4, duty: 0.9, speed: 1 },
  { r: 0.335, w: 0.001, opacity: 0.14, segments: 240, duty: 0.5, speed: 2 },
];

const ARCS: ArcSpec[] = [
  { r: 0.135, w: 0.014, opacity: 1.0, start: 20, len: 55, speed: -9, color: "bright" },
  { r: 0.135, w: 0.014, opacity: 0.85, start: 200, len: 30, speed: -9 },
  { r: 0.185, w: 0.008, opacity: 0.7, start: 90, len: 120, speed: 5 },
  { r: 0.232, w: 0.01, opacity: 0.9, start: 300, len: 70, speed: -3, color: "secondary" },
  { r: 0.255, w: 0.004, opacity: 0.5, start: 0, len: 200, speed: 2 },
  { r: 0.108, w: 0.006, opacity: 0.95, start: 140, len: 40, speed: 14, color: "secondary" },
  { r: 0.282, w: 0.003, opacity: 0.45, start: 230, len: 90, speed: -1.5 },
];

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
      const a = atan(p.y, p.x).div(PI2).add(0.5);
      return step(fract(a.mul(spec.segments ?? 1)), float(spec.duty ?? 0.5));
    })();
    material.colorNode = base.mul(pattern);
  } else {
    material.colorNode = base;
  }
  material.opacityNode = float(1);
  return material;
};

// The luminous "burst" inside the rings: layers of radial streaks with
// hashed brightness per spoke, several thin glow rings and a hot core.
const makeStreakMaterial = (palette: Palette, time: FloatUniform) => {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.depthWrite = false;
  material.blending = AdditiveBlending;

  const layers = [
    { n: 64, r0: 0.18, r1: 0.34, r2: 0.72, r3: 1.0, speed: 0.012, power: 3, weight: 0.7, seed: 11 },
    { n: 140, r0: 0.22, r1: 0.4, r2: 0.6, r3: 0.85, speed: -0.007, power: 4, weight: 0.55, seed: 23 },
    { n: 260, r0: 0.25, r1: 0.3, r2: 0.95, r3: 1.0, speed: 0.004, power: 6, weight: 0.5, seed: 37 },
    { n: 22, r0: 0.2, r1: 0.35, r2: 0.55, r3: 0.75, speed: -0.003, power: 2, weight: 0.35, seed: 51 },
  ];
  const glowRings = [0.31, 0.52, 0.68, 0.86];

  material.colorNode = Fn(() => {
    const p = uv().sub(0.5).mul(2);
    const r = length(p);
    const ang = atan(p.y, p.x).div(PI2).add(0.5);
    let acc: Node<"float"> = float(0);
    for (const l of layers) {
      const scaled = ang.add(time.mul(l.speed)).mul(l.n);
      const cell = floor(scaled);
      const taper = pow(oneMinus(fract(scaled).sub(0.5).abs().mul(2)), 2.5);
      const spoke = pow(hash(cell.add(l.seed)), l.power).mul(taper);
      const radial = smoothstep(float(l.r0), float(l.r1), r).mul(
        oneMinus(smoothstep(float(l.r2), float(l.r3), r)),
      );
      acc = acc.add(spoke.mul(radial).mul(l.weight));
    }
    for (const gr of glowRings) {
      acc = acc.add(exp(r.sub(gr).abs().div(0.012).negate()).mul(0.5));
    }
    // soft core glow and the overall disc glow
    acc = acc.add(pow(oneMinus(smoothstep(float(0.0), float(0.5), r)), 2).mul(0.55));
    acc = acc.add(oneMinus(smoothstep(float(0.3), float(1.0), r)).mul(0.12));
    // dark pupil and the disc edge
    acc = acc.mul(smoothstep(float(0.17), float(0.23), r));
    acc = acc.mul(oneMinus(smoothstep(float(0.9), float(1.0), r)));
    const c = mix(
      colorVec3(palette.primary),
      colorVec3(palette.primaryBright),
      saturate(acc.mul(0.45)),
    );
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

export const buildHudIris = (
  palette: Palette,
  textures: { flare: Texture; streak: Texture },
): HudIris => {
  const group = new Group();
  group.position.z = HUD_Z;
  const time = floatUniform(0);

  // Streak disc
  const disc = new Mesh(new CircleGeometry(HUD_RADIUS, 128), makeStreakMaterial(palette, time));
  group.add(disc);

  // Opaque pupil so nothing shines through the centre, plus a rim.
  const pupilMaterial = new MeshBasicNodeMaterial();
  pupilMaterial.colorNode = colorVec3(palette.background);
  pupilMaterial.blending = NormalBlending;
  const pupil = new Mesh(new CircleGeometry(0.05, 96), pupilMaterial);
  pupil.position.z = 0.0005;
  group.add(pupil);

  const rotating: { mesh: Mesh; speed: number; phase: number }[] = [];
  for (const spec of RINGS) {
    const geo = new RingGeometry(spec.r - spec.w / 2, spec.r + spec.w / 2, 256);
    const mesh = new Mesh(geo, makeRingMaterial(pick(palette, spec.color), spec));
    mesh.position.z = 0.001;
    group.add(mesh);
    rotating.push({ mesh, speed: spec.speed, phase: spec.phase ?? 0 });
  }
  for (const spec of ARCS) {
    const geo = new RingGeometry(
      spec.r - spec.w / 2,
      spec.r + spec.w / 2,
      128,
      1,
      spec.start * DEG,
      spec.len * DEG,
    );
    const mesh = new Mesh(geo, makeRingMaterial(pick(palette, spec.color), spec));
    mesh.position.z = 0.0015;
    group.add(mesh);
    rotating.push({ mesh, speed: spec.speed, phase: 0 });
  }

  // Core highlight: the bright dot sitting up-right of the pupil in the
  // references, plus a soft centre glow.
  const coreIntensity = floatUniform(1);
  const core = makeSprite(textures.flare, palette.primaryBright, 0.065, coreIntensity);
  core.position.set(0.016, 0.011, 0.004);
  group.add(core);
  const centreGlow = floatUniform(0.3);
  const centre = makeSprite(textures.flare, palette.primary, 0.16, centreGlow);
  centre.position.set(0, 0, 0.003);
  group.add(centre);

  // Accent hot-spots riding on the rings.
  const spots: { sprite: Sprite; r: number; a0: number; speed: number; u: FloatUniform; f: number }[] = [];
  const spotSpecs = [
    { r: 0.135, a0: 47, speed: -9, scale: 0.11, f: 1.7 },
    { r: 0.232, a0: 335, speed: -3, scale: 0.13, f: 1.1 },
    { r: 0.108, a0: 160, speed: 14, scale: 0.08, f: 2.3 },
    { r: 0.2, a0: 210, speed: 1.5, scale: 0.09, f: 0.8 },
  ];
  spotSpecs.forEach((s, i) => {
    const u = floatUniform(1);
    const hex = i % 2 === 0 ? palette.secondary : palette.primaryBright;
    const sprite = makeSprite(textures.flare, hex, s.scale, u);
    sprite.position.z = 0.005;
    group.add(sprite);
    spots.push({ sprite, r: s.r, a0: s.a0, speed: s.speed, u, f: s.f });
  });

  // Warm horizontal light streak across the lower half of the iris.
  const streakIntensity = floatUniform(0.6);
  const streakMaterial = new MeshBasicNodeMaterial();
  streakMaterial.transparent = true;
  streakMaterial.depthWrite = false;
  streakMaterial.blending = AdditiveBlending;
  streakMaterial.colorNode = texture(textures.streak, uv()).rgb
    .mul(mix(colorVec3(palette.secondary), colorVec3(palette.primaryBright), 0.35))
    .mul(streakIntensity);
  streakMaterial.opacityNode = float(1);
  const streak = new Mesh(new PlaneGeometry(0.95, 0.07), streakMaterial);
  streak.position.set(-0.05, -0.05, 0.006);
  group.add(streak);

  // Thin scan line that sweeps down through the disc every few seconds.
  const scanIntensity = floatUniform(0);
  const scanMaterial = new MeshBasicNodeMaterial();
  scanMaterial.transparent = true;
  scanMaterial.depthWrite = false;
  scanMaterial.blending = AdditiveBlending;
  scanMaterial.colorNode = texture(textures.streak, uv())
    .rgb.mul(colorVec3(palette.primaryBright))
    .mul(scanIntensity);
  scanMaterial.opacityNode = float(1);
  const scan = new Mesh(new PlaneGeometry(0.56, 0.006), scanMaterial);
  scan.position.z = 0.007;
  group.add(scan);

  const setTime = (t: number) => {
    time.value = t;
    for (const item of rotating) {
      item.mesh.rotation.z = (item.phase + item.speed * t) * DEG;
    }
    for (const s of spots) {
      const a = (s.a0 + s.speed * t) * DEG;
      s.sprite.position.x = Math.cos(a) * s.r;
      s.sprite.position.y = Math.sin(a) * s.r;
      const flicker =
        0.55 + 0.45 * Math.sin(t * s.f * 2.1 + s.a0) * Math.sin(t * s.f * 0.7 + 1.3);
      s.u.value = 0.35 + flicker;
    }
    coreIntensity.value = 0.9 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.3 + 0.4);
    centreGlow.value = 0.28 + 0.08 * Math.sin(t * 0.9);
    streakIntensity.value = 0.5 + 0.2 * Math.sin(t * 0.6 + 1.0) + 0.1 * Math.sin(t * 4.3);
    streak.position.x = -0.05 + 0.03 * Math.sin(t * 0.35);
    // Scan sweep: 4 s period, visible for the first 60% of it.
    const period = 4;
    const phase = (t % period) / period;
    const visible = phase < 0.6 ? phase / 0.6 : -1;
    if (visible >= 0) {
      scan.position.y = 0.26 - visible * 0.52;
      scanIntensity.value = 0.9 * Math.sin(visible * Math.PI);
    } else {
      scanIntensity.value = 0;
    }
  };

  return { group, setTime };
};

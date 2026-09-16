import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { attribute, color, float, fract, mix, uniform, uv } from "three/tsl";
import { CORE_RADIUS } from "./cable";
import type { Palette } from "./palette";
import { createRng, range, type Rng } from "./rng";

export const FIBERS_PER_CABLE = 110;

/** Where the strands start, inside the connector sleeve. */
const FIBER_START_X = -1.6;

export type FiberBundle = {
  strands: THREE.Mesh;
  tips: THREE.Mesh;
  /** Moves the light pulses travelling out along the strands. */
  setPulse: (value: number) => void;
};

/**
 * One strand: packed tight inside the sleeve, then flaring out into the fan.
 * The flare is eased so the strands stay parallel for a moment after leaving
 * the ferrule and only then separate, which is what reads as "fiber optic"
 * rather than "bunch of sticks".
 */
const buildStrandCurve = (rng: Rng) => {
  const angle = rng() * Math.PI * 2;
  // sqrt keeps the roots evenly spread over the disc instead of clumping.
  const rootRadius = Math.sqrt(rng()) * CORE_RADIUS;

  const endAngle = angle + range(rng, -0.2, 0.2);
  const endRadius = 0.4 + rootRadius * 1.3 + rng() * rng() * 1.5;
  // Cubed, so most strands end around the same place and a handful shoot well
  // past the rest — a fan of equal-length strands reads as a brush, not fiber.
  const endX = 3.6 + Math.pow(rng(), 3) * 7.0;
  const wobble = range(rng, -0.05, 0.05);

  const points: THREE.Vector3[] = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Hold, then flare: 0 until ~0.15, accelerating after.
    const flare = Math.pow(THREE.MathUtils.smoothstep(t, 0.14, 1), 1.45);
    const radius = rootRadius + (endRadius - rootRadius) * flare;
    const a = angle + (endAngle - angle) * flare + Math.sin(t * 3.1) * wobble;
    const x = FIBER_START_X + (endX - FIBER_START_X) * t;
    points.push(
      new THREE.Vector3(x, Math.cos(a) * radius, Math.sin(a) * radius),
    );
  }
  return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
};

export const buildFiberBundle = ({
  palette,
  seed,
  dim,
}: {
  palette: Palette;
  seed: number;
  /** Overall brightness, used to push cables behind the hero one back. */
  dim: number;
}): FiberBundle => {
  const rng = createRng(seed);
  const pulse = uniform(0);

  const strandGeometries: THREE.BufferGeometry[] = [];
  const tipGeometries: THREE.BufferGeometry[] = [];

  for (let i = 0; i < FIBERS_PER_CABLE; i++) {
    const curve = buildStrandCurve(rng);
    const radius = range(rng, 0.012, 0.023);
    // Generous segment counts: a strand is only a couple of pixels wide, and a
    // coarse tube shows up as banding along its length once bloom hits it.
    const geometry = new THREE.TubeGeometry(curve, 40, radius, 8, false);

    // Per-strand phase for the travelling pulse, and a per-strand brightness
    // so the bundle doesn't read as one flat mass.
    const phase = rng();
    const gain = range(rng, 0.42, 1.15);
    const vertexCount = geometry.attributes.position.count;
    const phases = new Float32Array(vertexCount);
    const gains = new Float32Array(vertexCount);
    phases.fill(phase);
    gains.fill(gain);
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute("aGain", new THREE.BufferAttribute(gains, 1));
    strandGeometries.push(geometry);

    // A small additive ball on the cut end, so tips bloom into bright dots.
    const end = curve.getPoint(1);
    const tip = new THREE.SphereGeometry(radius * 1.35, 8, 6);
    tip.translate(end.x, end.y, end.z);
    const tipGains = new Float32Array(tip.attributes.position.count);
    tipGains.fill(gain);
    tip.setAttribute("aGain", new THREE.BufferAttribute(tipGains, 1));
    tipGeometries.push(tip);
  }

  const strandGeometry = mergeGeometries(strandGeometries, false)!;
  const tipGeometry = mergeGeometries(tipGeometries, false)!;
  for (const geometry of [...strandGeometries, ...tipGeometries]) {
    geometry.dispose();
  }

  const rootColor = color(palette.fiberRoot);
  const tipColor = color(palette.fiberTip);
  const glowColor = color(palette.tipGlow);

  // --- Strands ------------------------------------------------------------
  // Opaque, so strands occlude each other and the fan reads as real geometry;
  // the glow comes from bloom rather than from additive blending.
  const strandMaterial = new THREE.MeshBasicNodeMaterial();
  const along = uv().x;
  const gainNode = attribute<"float">("aGain", "float");

  // Shading around the strand: bright core, darker edges, so a strand reads as
  // a round rod rather than a flat ribbon.
  const round = uv().y.sub(0.5).abs().mul(2.0).oneMinus().pow(0.55);

  const base = mix(rootColor, tipColor, along.smoothstep(0.42, 1.0).pow(1.2));
  // Most of a strand stays deep blue; only the last stretch near the cut end
  // lifts towards the tip colour, which is what makes the tips read as lit.
  const tipRamp = float(0.34).add(along.smoothstep(0.55, 1.0).mul(1.05));

  // A narrow bright head sliding from root to tip, like data going down the line.
  const travel = fract(
    along.mul(0.85).sub(pulse).add(attribute<"float">("aPhase", "float")),
  );
  const pulseGlow = travel.pow(22.0).mul(0.85);

  strandMaterial.colorNode = base
    .mul(tipRamp)
    .mul(gainNode)
    .mul(round.mul(0.75).add(0.35))
    .add(glowColor.mul(pulseGlow))
    .mul(dim);
  const strands = new THREE.Mesh(strandGeometry, strandMaterial);

  // --- Tips ---------------------------------------------------------------
  const tipMaterial = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  tipMaterial.colorNode = glowColor
    .mul(attribute<"float">("aGain", "float"))
    .mul(0.4 * dim);
  const tips = new THREE.Mesh(tipGeometry, tipMaterial);
  tips.renderOrder = 4;

  return {
    strands,
    tips,
    setPulse: (value: number) => {
      pulse.value = value;
    },
  };
};

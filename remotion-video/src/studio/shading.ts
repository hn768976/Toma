import { Vector3 } from "three";
import { MeshBasicNodeMaterial, type Node } from "three/webgpu";
import {
  abs,
  dot,
  exp,
  float,
  fract,
  length,
  mix,
  normalWorld,
  positionWorld,
  screenUV,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import type { StudioSpec, Tint, Vec3 } from "./spec";

type F = Node<"float">;
type V2 = Node<"vec2">;
type V3 = Node<"vec3">;

const TAU = Math.PI * 2;

/**
 * One sRGB step expressed in linear light, around the 0.82 display level where
 * this whole palette sits. Used to dial grain in perceptual units even though
 * it is added before the sRGB encode.
 */
const SRGB_STEP_IN_LINEAR = 1.7446 / 255;

const tintNode = (t: Tint): V3 => vec3(t[0], t[1], t[2]);

const dirNode = (v: Vec3): V3 => {
  const n = new Vector3(v[0], v[1], v[2]).normalize();
  return vec3(n.x, n.y, n.z);
};

/**
 * Wrapped Lambert. A large softbox does not terminate at N.L = 0; `w` pushes
 * the terminator round the form, which is most of what makes these renders
 * read as a soft studio rather than a point light.
 */
const wrapDiffuse = (n: V3, l: V3, w: number): F =>
  dot(n, l)
    .add(w)
    .div(1 + w)
    .clamp(0, 1);

/** Signed distance to an axis-aligned rounded box in 2D. */
const sdRoundBox = (p: V2, bx: number, by: number, r: number): F => {
  const q = abs(p).sub(vec2(bx - r, by - r));
  return q.max(vec2(0, 0)).length().add(q.x.max(q.y).min(0)).sub(r);
};

export interface StudioMaterials {
  cyclorama: MeshBasicNodeMaterial;
  podium: MeshBasicNodeMaterial;
  /** `phase` is 0..1 across one loop; `seed` drives the grain. */
  update: (phase: number, seed: number) => void;
  dispose: () => void;
}

export const createStudioMaterials = (spec: StudioSpec): StudioMaterials => {
  const { light, shadow, gobo, podium } = spec;

  const phase = uniform(0);
  const seed = uniform(0);

  // ---------------------------------------------------------------- gobo ----
  // Projected from the gobo light's direction, so the pattern lands on the
  // cyclorama and the floor with correct perspective instead of being pasted
  // onto the wall in screen space.
  const goboLight = new Vector3(...gobo.lightDir).normalize();
  const helper =
    Math.abs(goboLight.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const gU = new Vector3().crossVectors(helper, goboLight).normalize();
  const gV = new Vector3().crossVectors(goboLight, gU).normalize();

  const goboMask = (factor: F): F => {
    if (!gobo.enabled) return float(1);

    const a = (gobo.angleDeg * Math.PI) / 180;
    const ca = Math.cos(a);
    const sa = Math.sin(a);

    // World position projected into the plane perpendicular to the light, then
    // rotated in that plane. `angleDeg` is the in-plane rotation, not the tilt
    // you see on the backdrop - it was solved so that the projection lands at
    // the measured 26.6 degrees (see tools/reference-match/gobo_angle.mjs).
    const u = dot(positionWorld, vec3(gU.x, gU.y, gU.z));
    const v = dot(positionWorld, vec3(gV.x, gV.y, gV.z));
    const px = u.mul(ca).sub(v.mul(sa));
    const py = u.mul(sa).add(v.mul(ca));

    const q = px.div(gobo.period);
    const qy = py.div(gobo.period);

    // Time only ever enters as sin(2*pi*phase), so frame 0 and frame N are
    // bit-identical and the clip loops seamlessly.
    const t = phase.mul(TAU);
    const w1 = sin(t).mul(gobo.breathe);
    const w2 = sin(t.add(1.95)).mul(gobo.breathe * 0.8);
    const w3 = sin(t.add(4.1)).mul(gobo.breathe * 0.6);

    // Integer harmonics keep the pattern exactly periodic in space too.
    // The fundamental carries most of the weight and the cross-terms in qy are
    // small, because the reference's bands are broad, soft and near-parallel -
    // heavier harmonics read as harsh stripes rather than window light.
    const band = sin(q.add(w1).mul(TAU))
      .mul(0.74)
      .add(sin(q.mul(2).add(qy.mul(0.12)).add(w2).mul(TAU)).mul(0.18))
      .add(sin(q.mul(3).sub(qy.mul(0.2)).add(w3).mul(TAU)).mul(0.08))
      .mul(0.5)
      .add(0.5);

    // Broad window pool under the streaks, drifting slowly.
    const pool = smoothstep(
      gobo.poolRadius,
      0,
      length(
        vec2(
          px.sub(gobo.poolCentre[0]).add(w1.mul(0.9)),
          py.sub(gobo.poolCentre[1]).mul(0.65).add(w2.mul(0.7)),
        ),
      ),
    );

    // Zero-mean, so the probe-solved ambient/key/fill stay the *average*
    // illumination and the gobo only adds the measured spread around it.
    return float(1)
      .add(float(gobo.contrast * 2).mul(band.sub(0.5)).mul(factor))
      .add(float(gobo.poolStrength).mul(pool.sub(gobo.poolMean)).mul(factor));
  };

  // ------------------------------------------------------------ occlusion ----
  /** Signed distance to the prop's footprint, in the XZ plane. */
  const footprintSdf = (p: V2): F => {
    if (podium.kind === "slab") {
      const a = (-podium.rotationDeg * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rx = p.x.mul(ca).sub(p.y.mul(sa));
      const rz = p.x.mul(sa).add(p.y.mul(ca));
      return sdRoundBox(
        vec2(rx, rz),
        podium.width / 2,
        podium.depth / 2,
        podium.fillet,
      );
    }
    return length(p).sub(podium.radius);
  };

  /** Contact ring plus offset cast shadow, confined to the floor. */
  const floorOcclusion = (): F => {
    const p = vec2(positionWorld.x, positionWorld.z);

    const dContact = footprintSdf(p).max(0);
    const contact = float(1).sub(
      float(shadow.contactStrength).mul(exp(dContact.div(-shadow.contactRadius))),
    );

    const dCast = footprintSdf(
      vec2(p.x.sub(shadow.castOffset[0]), p.y.sub(shadow.castOffset[1])),
    ).max(0);
    const cast = float(1).sub(
      float(shadow.castStrength).mul(
        float(1).sub(smoothstep(0, shadow.castRadius, dCast)),
      ),
    );

    // Only near the floor - the prop's own top face must not be darkened.
    const nearFloor = smoothstep(0.12, 0, positionWorld.y);
    return mix(float(1), contact.mul(cast), nearFloor);
  };

  /** Concave-corner occlusion along the cove, falling off either side of it. */
  const coveOcclusion = (): F => {
    if (shadow.coveStrength <= 0) return float(1);
    const d = length(
      vec2(
        positionWorld.y,
        positionWorld.z.sub(spec.cyclorama.curveStartZ),
      ),
    );
    return float(1).sub(
      float(shadow.coveStrength).mul(
        float(1).sub(smoothstep(0, shadow.coveRadius, d)),
      ),
    );
  };

  /** Full gobo on vertical surfaces, damped on horizontal ones; the cove
   *  blends between the two on its own. */
  const cycloramaGoboWeight = (): F =>
    float(gobo.floorFactor).add(
      float(1 - gobo.floorFactor).mul(float(1).sub(abs(normalWorld.y))),
    );

  // ------------------------------------------------------------- lighting ----
  const keyDir = dirNode(light.keyDir);
  const fillDir = dirNode(light.fillDir);

  const irradiance = (goboFactor: F): V3 => {
    const n = normalWorld;

    // Ambient loss toward the top of the backdrop and toward the back of the set.
    const falloff = float(1)
      .sub(
        float(light.wallFalloff).mul(
          positionWorld.y
            .div(light.wallFalloffHeight)
            .clamp(0, 1)
            .pow(light.wallFalloffPower),
        ),
      )
      .sub(
        // Zero-mean, so it tilts the gradient across the set without
        // changing the overall exposure the probe fit established.
        float(light.lateral).mul(
          float(0.5).sub(
            smoothstep(-light.lateralWidth, light.lateralWidth, positionWorld.x),
          ),
        ),
      )
      .sub(
        float(light.floorFalloff).mul(
          float(1).sub(
            smoothstep(
              spec.cyclorama.curveStartZ - light.floorFalloffDepth,
              spec.cyclorama.frontZ,
              positionWorld.z,
            ),
          ),
        ),
      );

    const hemi = float(light.hemi).mul(n.y.mul(0.5).add(0.5));
    const ambient = tintNode(light.ambientTint).mul(
      float(light.ambient).add(hemi).mul(falloff),
    );

    const key = tintNode(light.keyTint).mul(
      float(light.key).mul(wrapDiffuse(n, keyDir, light.keyWrap)),
    );

    const fill = tintNode(light.fillTint).mul(
      float(light.fill).mul(wrapDiffuse(n, fillDir, light.fillWrap)),
    );

    return ambient.add(key).add(fill).mul(goboMask(goboFactor));
  };

  // --------------------------------------------------------------- output ----
  /** Lens vignette and sensor grain, both in screen space. */
  const sensor = (colour: V3): V3 => {
    const centred = screenUV.sub(vec2(0.5, 0.5)).mul(2);
    const vignette = float(1).sub(
      float(spec.vignette).mul(dot(centred, centred).mul(0.5)),
    );

    const hash = fract(
      sin(dot(screenUV.add(seed), vec2(12.9898, 78.233))).mul(43758.5453),
    );
    const grain = hash.sub(0.5).mul(spec.grain * SRGB_STEP_IN_LINEAR);

    return colour.mul(vignette).add(grain);
  };

  const cyclorama = new MeshBasicNodeMaterial();
  {
    // A warm paper sweep standing on a neutral floor: the tint blends in with
    // height, which is exactly how reference A measures.
    const tint = mix(
      tintNode(spec.floorTint),
      tintNode(spec.wallTint),
      smoothstep(0, spec.tintBlendHeight, positionWorld.y),
    );
    const linear = tint
      .mul(spec.albedo)
      .mul(irradiance(cycloramaGoboWeight()))
      .mul(floorOcclusion())
      .mul(coveOcclusion());
    cyclorama.colorNode = sensor(linear);
  }

  const podiumMaterial = new MeshBasicNodeMaterial();
  {
    // Floor bounce climbing the vertical faces, and a dark hairline at the base.
    const vertical = float(1).sub(abs(normalWorld.y));
    const bounce = float(shadow.bounceStrength)
      .mul(vertical)
      .mul(float(1).sub(smoothstep(0, shadow.bounceHeight, positionWorld.y)));
    const baseLine = float(1).sub(
      float(shadow.baseLineStrength).mul(
        float(1).sub(smoothstep(0, shadow.baseLineHeight, positionWorld.y)),
      ),
    );

    const linear = tintNode(spec.podiumTint)
      .mul(spec.albedo)
      .mul(irradiance(float(gobo.podiumFactor)).add(bounce))
      .mul(baseLine);
    podiumMaterial.colorNode = sensor(linear);
  }

  return {
    cyclorama,
    podium: podiumMaterial,
    update: (p: number, s: number) => {
      phase.value = p;
      seed.value = s;
    },
    dispose: () => {
      cyclorama.dispose();
      podiumMaterial.dispose();
    },
  };
};


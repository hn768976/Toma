import * as THREE from "three/webgpu";
import type { Node } from "three/webgpu";
import {
  Break,
  dot,
  exp,
  float,
  Fn,
  If,
  Loop,
  max,
  min,
  mix,
  normalize,
  pow,
  saturate,
  smoothstep,
  uniform,
  uniformArray,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  BALL_COUNT,
  MAX_RAY_DISTANCE,
  MAX_RAY_STEPS,
  MIN_HIT_DISTANCE,
} from "./constants";
import type { Variant } from "./variants";

type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;
type Vec3Node = Node<"vec3">;

/**
 * The whole frame — backdrop and liquid alike — is produced by one fragment
 * shader written in TSL. TSL is three.js' backend-agnostic shading language:
 * the same node graph below is compiled to WGSL when the WebGPU backend is
 * live and to GLSL ES 3.0 when we fall back to WebGL2, so there is exactly
 * one implementation of the look rather than one per API.
 *
 * The liquid is a signed distance field: a union of spheres combined with a
 * polynomial smooth-minimum. Smooth-min is what produces the characteristic
 * necks and fillets as two blobs approach — they bulge toward each other and
 * fuse, instead of intersecting as hard spheres would.
 */

/** sRGB hex to a linear-space vec3, matching three's colour management. */
const linearColor = (hex: string): THREE.Vector3 => {
  const c = new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
  return new THREE.Vector3(c.r, c.g, c.b);
};

export type BlobUniforms = ReturnType<typeof createBlobUniforms>;

export const createBlobUniforms = (variant: Variant) => ({
  ballPositions: uniformArray(
    Array.from({ length: BALL_COUNT }, () => new THREE.Vector3()),
    "vec3",
  ),
  ballRadii: uniformArray(new Array<number>(BALL_COUNT).fill(1), "float"),
  cameraPosition: uniform(new THREE.Vector3(0, 0, 0)),
  /** tan(fov/2) vertically, and the same scaled by aspect horizontally. */
  halfExtent: uniform(new THREE.Vector2(1, 1)),
  /** Output size in pixels, used for the dither pattern. */
  resolution: uniform(new THREE.Vector2(1920, 1080)),
  /** Fusion radius of the smooth-minimum. Larger means fatter necks. */
  blendRadius: uniform(0.62),

  backgroundTop: uniform(linearColor(variant.backgroundTop)),
  backgroundBottom: uniform(linearColor(variant.backgroundBottom)),
  glowColor: uniform(linearColor(variant.glowColor)),
  glowParams: uniform(
    new THREE.Vector3(variant.glowX, variant.glowY, variant.glowOpacity),
  ),
  shoulderKnee: uniform(variant.shoulderKnee),

  blobColor: uniform(linearColor(variant.blobColor)),
  keyColor: uniform(linearColor(variant.keyColor)),
  keyIntensity: uniform(variant.keyIntensity),
  keyDirection: uniform(new THREE.Vector3(-0.42, 0.72, 0.55).normalize()),
  fillColor: uniform(linearColor(variant.fillColor)),
  fillIntensity: uniform(variant.fillIntensity),
  ambientIntensity: uniform(variant.ambientIntensity),
  wrap: uniform(variant.wrap),
  specularIntensity: uniform(variant.specularIntensity),
  specularPower: uniform(variant.specularPower),
  fresnelColor: uniform(linearColor(variant.fresnelColor)),
  fresnelIntensity: uniform(variant.fresnelIntensity),
  fresnelPower: uniform(variant.fresnelPower),
  subsurfaceColor: uniform(linearColor(variant.subsurfaceColor)),
  subsurfaceIntensity: uniform(variant.subsurfaceIntensity),
  occlusionStrength: uniform(variant.occlusionStrength),
});

export const applyVariantToUniforms = (
  uniforms: BlobUniforms,
  variant: Variant,
) => {
  uniforms.backgroundTop.value.copy(linearColor(variant.backgroundTop));
  uniforms.backgroundBottom.value.copy(linearColor(variant.backgroundBottom));
  uniforms.glowColor.value.copy(linearColor(variant.glowColor));
  uniforms.glowParams.value.set(
    variant.glowX,
    variant.glowY,
    variant.glowOpacity,
  );
  uniforms.shoulderKnee.value = variant.shoulderKnee;
  uniforms.blobColor.value.copy(linearColor(variant.blobColor));
  uniforms.keyColor.value.copy(linearColor(variant.keyColor));
  uniforms.keyIntensity.value = variant.keyIntensity;
  uniforms.fillColor.value.copy(linearColor(variant.fillColor));
  uniforms.fillIntensity.value = variant.fillIntensity;
  uniforms.ambientIntensity.value = variant.ambientIntensity;
  uniforms.wrap.value = variant.wrap;
  uniforms.specularIntensity.value = variant.specularIntensity;
  uniforms.specularPower.value = variant.specularPower;
  uniforms.fresnelColor.value.copy(linearColor(variant.fresnelColor));
  uniforms.fresnelIntensity.value = variant.fresnelIntensity;
  uniforms.fresnelPower.value = variant.fresnelPower;
  uniforms.subsurfaceColor.value.copy(linearColor(variant.subsurfaceColor));
  uniforms.subsurfaceIntensity.value = variant.subsurfaceIntensity;
  uniforms.occlusionStrength.value = variant.occlusionStrength;
};

/**
 * Builds the fragment node.
 *
 * `superSample` is the side length of the sample grid per pixel: 1 renders
 * one ray per pixel, 2 renders a rotated 2x2 grid and averages. The blob
 * silhouettes are produced inside the shader, so hardware MSAA cannot touch
 * them — this is the only antialiasing they get.
 */
export const createBlobFragmentNode = (
  u: BlobUniforms,
  superSample: 1 | 2 | 3,
) => {
  /**
   * Polynomial smooth minimum. Returns a value no greater than min(a, b),
   * which keeps the field a conservative distance estimate and therefore
   * keeps sphere tracing safe from overshooting.
   */
  const smin = Fn(([a, b, k]: [FloatNode, FloatNode, FloatNode]) => {
    const h = saturate(float(0.5).add(float(0.5).mul(b.sub(a)).div(k)));
    return mix(b, a, h).sub(k.mul(h).mul(float(1).sub(h)));
  });

  /** Signed distance to the fused blob field. */
  const map = Fn(([p]: [Vec3Node]) => {
    const d = float(1e9).toVar("d");
    Loop({ start: 0, end: BALL_COUNT, type: "int" }, ({ i }) => {
      // `uniformArray(...).element()` is typed loosely upstream; the element
      // type is known here because we declared the array's type above.
      const centre = u.ballPositions.element(i) as unknown as Vec3Node;
      const radius = u.ballRadii.element(i) as unknown as FloatNode;
      const sphere = p.sub(centre).length().sub(radius);
      d.assign(smin(d, sphere, u.blendRadius));
    });
    return d;
  });

  /** Gradient of the field, by the four-tap tetrahedron trick. */
  const calcNormal = Fn(([p]: [Vec3Node]) => {
    const e = float(0.0022);
    const k1 = vec3(1, -1, -1);
    const k2 = vec3(-1, -1, 1);
    const k3 = vec3(-1, 1, -1);
    const k4 = vec3(1, 1, 1);
    return normalize(
      k1
        .mul(map(p.add(k1.mul(e))))
        .add(k2.mul(map(p.add(k2.mul(e)))))
        .add(k3.mul(map(p.add(k3.mul(e)))))
        .add(k4.mul(map(p.add(k4.mul(e))))),
    );
  });

  /**
   * Ambient occlusion by marching a short way along the normal and comparing
   * the distance we expected to travel against the distance the field says is
   * free. This is what darkens the crease where two blobs fuse.
   */
  const calcAO = Fn(([p, n]: [Vec3Node, Vec3Node]) => {
    const occ = float(0).toVar("occ");
    const sca = float(1).toVar("sca");
    Loop({ start: 1, end: 6, type: "int" }, ({ i }) => {
      const h = float(i).mul(0.16).add(0.03);
      const d = map(p.add(n.mul(h)));
      occ.addAssign(h.sub(d).mul(sca));
      sca.mulAssign(0.72);
    });
    return saturate(float(1).sub(u.occlusionStrength.mul(occ)));
  });

  /**
   * Soft highlight rolloff.
   *
   * Sampling the references shows their brightest blob pixels sitting well
   * below where a linear response would put them — the channel that is
   * already strong barely moves while the others climb. That is a shoulder,
   * and reproducing it is what stops the lit side of a saturated blob from
   * blowing out to white. Applied to the liquid only; the backdrop is a
   * measured flat colour and must pass through untouched.
   */
  const shoulder = Fn(([x, knee]: [Vec3Node, FloatNode]) => {
    const headroom = float(1).sub(knee);
    const over = max(x.sub(knee), vec3(0, 0, 0));
    return min(x, vec3(knee, knee, knee)).add(
      headroom.mul(float(1).sub(exp(over.div(headroom).negate()))),
    );
  });

  /** Flat backdrop: gentle vertical ramp plus one soft off-centre glow. */
  const backdrop = Fn(([screenUv, aspect]: [Vec2Node, FloatNode]) => {
    const ramp = smoothstep(float(0), float(1), screenUv.y);
    const base = mix(u.backgroundBottom, u.backgroundTop, ramp);
    const delta = vec2(
      screenUv.x.sub(u.glowParams.x).mul(aspect),
      screenUv.y.sub(u.glowParams.y),
    );
    const falloff = exp(dot(delta, delta).mul(-2.1));
    return mix(base, u.glowColor, falloff.mul(u.glowParams.z));
  });

  /**
   * Lighting model for a point on the liquid surface.
   *
   * The references are lit like a photographed clay maquette, not like glass:
   * the body of each blob sits very close to its own albedo, with almost all
   * of the shaping carried by a bright lip at grazing angles and a gentle
   * darkening away from the key. Contrast is deliberately low — a textbook
   * Lambert terminator reads far too hard against these flat backdrops.
   */
  const shade = Fn(([p, n, rayDir]: [Vec3Node, Vec3Node, Vec3Node]) => {
    const view = rayDir.negate();
    const lightDir = normalize(u.keyDirection);

    // Half-Lambert wrap, then pulled most of the way back toward flat. What
    // survives is a soft gradient across the body rather than a lit side and
    // a dark side.
    const ndl = dot(n, lightDir);
    const wrapped = saturate(ndl.add(u.wrap).div(float(1).add(u.wrap)));
    const shaping = mix(float(1), wrapped.mul(wrapped), u.keyIntensity);

    // Bounce off the backdrop, arriving mostly from below and behind.
    const bounceDir = normalize(vec3(0.34, -0.78, 0.5));
    const bounce = saturate(dot(n, bounceDir).add(0.62).div(1.62));

    const ao = calcAO(p, n);

    // A single tight specular. Anything broader turns the small satellites
    // into glass beads with a highlight parked in the middle of them.
    const half = normalize(lightDir.add(view));
    const ndh = saturate(dot(n, half));
    const specular = pow(ndh, u.specularPower).mul(u.specularIntensity);

    // Grazing-angle lip. Weighted toward upward-facing edges, because the key
    // is high and that is where the references put their brightest band. This
    // is also what lights the concave neck between two fusing blobs, which
    // reads bright in the reference rather than dark.
    const upward = saturate(n.y.mul(0.5).add(0.62));
    const fresnel = pow(saturate(float(1).sub(dot(n, view))), u.fresnelPower)
      .mul(u.fresnelIntensity)
      .mul(upward);

    // Fake subsurface. Probe the field back along the normal: satellites are
    // thin enough that the probe exits the material and they glow through,
    // while the dominant mass stays opaque.
    const probeDepth = float(1.3);
    const thickness = saturate(
      map(p.sub(n.mul(probeDepth))).negate().div(probeDepth),
    );
    const thinness = float(1).sub(thickness);
    const throughDir = normalize(lightDir.add(n.mul(0.4)));
    const translucency = pow(saturate(dot(view, throughDir.negate())), float(2.4))
      .add(0.3)
      .mul(thinness)
      .mul(u.subsurfaceIntensity);

    const albedo = u.blobColor;
    // Occlusion is applied to the diffuse body only, at low strength. The
    // crease where two blobs meet should read as a soft fold, not a seam.
    const lit = shaping.mul(mix(float(1), ao, float(0.7)));
    let colour = albedo.mul(u.keyColor).mul(lit);
    colour = colour.add(albedo.mul(u.fillColor).mul(bounce.mul(u.fillIntensity)));
    colour = colour.add(albedo.mul(u.ambientIntensity));
    colour = colour.add(u.subsurfaceColor.mul(translucency));
    colour = colour.add(u.fresnelColor.mul(specular).mul(ao));
    colour = colour.add(u.fresnelColor.mul(fresnel).mul(ao));
    return shoulder(colour, u.shoulderKnee);
  });

  /** Traces one ray and returns the colour it sees. */
  const trace = Fn(([origin, rayDir, screenUv, aspect]: [Vec3Node, Vec3Node, Vec2Node, FloatNode]) => {
    const t = float(0.1).toVar("t");
    const hit = float(0).toVar("hit");
    Loop({ start: 0, end: MAX_RAY_STEPS, type: "int" }, () => {
      const p = origin.add(rayDir.mul(t));
      const d = map(p);
      If(d.lessThan(MIN_HIT_DISTANCE), () => {
        hit.assign(1);
        Break();
      });
      If(t.greaterThan(MAX_RAY_DISTANCE), () => {
        Break();
      });
      // Slightly under-relaxed steps: smooth-min makes the field a little
      // optimistic near the fused necks, and full steps can tunnel through
      // the thinnest bridges.
      t.addAssign(d.mul(0.92));
    });

    const sky = backdrop(screenUv, aspect).toVar("sky");
    const result = sky.toVar("result");
    If(hit.greaterThan(0.5), () => {
      const p = origin.add(rayDir.mul(t));
      const n = calcNormal(p);
      const lit = shade(p, n, rayDir);
      // Let the backdrop haze the most distant blobs very slightly, which
      // reads as atmosphere and keeps the far satellites from feeling pasted
      // on top of the background.
      const haze = saturate(t.sub(9.2).mul(0.028));
      result.assign(mix(lit, sky, haze));
    });
    return result;
  });

  return Fn(() => {
    const screenUv = uv();
    const aspect = u.resolution.x.div(u.resolution.y);
    const origin = u.cameraPosition;

    const accum = vec3(0, 0, 0).toVar("accum");
    const grid = superSample;
    // A rotated grid beats an axis-aligned one at the near-horizontal and
    // near-vertical silhouettes, which is most of a circle's outline.
    const rotation = 0.3217505544;
    for (let sy = 0; sy < grid; sy++) {
      for (let sx = 0; sx < grid; sx++) {
        const ox = (sx + 0.5) / grid - 0.5;
        const oy = (sy + 0.5) / grid - 0.5;
        const jx = ox * Math.cos(rotation) - oy * Math.sin(rotation);
        const jy = ox * Math.sin(rotation) + oy * Math.cos(rotation);
        const sampleUv = vec2(
          screenUv.x.add(float(jx).div(u.resolution.x)),
          screenUv.y.add(float(jy).div(u.resolution.y)),
        );
        const ndc = sampleUv.mul(2).sub(1);
        const rayDir = normalize(
          vec3(
            ndc.x.mul(u.halfExtent.x),
            ndc.y.mul(u.halfExtent.y),
            float(-1),
          ),
        );
        accum.addAssign(trace(origin, rayDir, sampleUv, aspect));
      }
    }
    const colour = accum.div(grid * grid);

    // Ordered dither at roughly half a code value. The backdrop is a very
    // shallow gradient across a wide frame, which bands badly in 8-bit; this
    // is fixed per pixel rather than per frame so it costs nothing in h264.
    const pixel = screenUv.mul(u.resolution);
    const dither = pixel.x
      .mul(0.7548776662)
      .add(pixel.y.mul(0.5698402909))
      .fract()
      .sub(0.5)
      .mul(1 / 255);

    return vec4(max(colour.add(dither), vec3(0, 0, 0)), 1);
  })();
};

export const createBlobMaterial = (
  uniforms: BlobUniforms,
  superSample: 1 | 2 | 3,
): THREE.NodeMaterial => {
  const material = new THREE.NodeMaterial();
  material.fragmentNode = createBlobFragmentNode(uniforms, superSample);
  material.depthTest = false;
  material.depthWrite = false;
  material.transparent = false;
  return material;
};

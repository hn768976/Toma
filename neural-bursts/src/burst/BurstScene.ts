import * as THREE from "three";
import {
  additive,
  instanced,
  RIBBON_CHUNK,
  RIBBON_FRAG,
  ribbonQuad,
} from "../lib/glsl";
import { StageFactory } from "../lib/GLStage";
import { CloudUniforms, makeCloud, PointSpec, tw } from "../lib/cloud";
import {
  easeInCubic,
  easeInOutSine,
  gaussian,
  Key,
  mulberry32,
  pickWeighted,
  randomUnitVector,
  range,
  smoothstep,
  track,
} from "../lib/math";
import { BurstPalette } from "./palettes";

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const RAY_VERT = /* glsl */ `
attribute vec2 corner;
attribute vec3 aDir;
attribute vec4 aLen;   // x: start radius, y: full length, z: retracted length, w: speed
attribute vec3 aColor;
attribute vec4 aMisc;  // x: half width px, y: alpha, z: phase, w: tip bias
uniform float uTime;
uniform float uBurstT;
uniform float uBurstDur;
uniform float uRetract;
uniform float uScale;
uniform float uOpacity;
uniform float uPx;
uniform float uFlicker;
varying vec3 vColor;
varying float vAlpha;
varying float vAcross;
${RIBBON_CHUNK}
void main() {
  float p = 1.0 - pow(1.0 - clamp(uBurstT * aLen.w / uBurstDur, 0.0, 1.0), 3.0);
  float endR = mix(aLen.y, aLen.z, uRetract) * p;
  float startR = min(aLen.x, endR);
  vec3 a = (modelViewMatrix * vec4(aDir * startR * uScale, 1.0)).xyz;
  vec3 b = (modelViewMatrix * vec4(aDir * endR * uScale, 1.0)).xyz;
  float behind;
  gl_Position = ribbon(a, b, corner, aMisc.x * uPx, aMisc.x * uPx, behind);
  float prof = mix(1.0 - 0.75 * corner.x, 0.3 + 0.7 * corner.x, aMisc.w);
  float fl = 1.0 - uFlicker + uFlicker * (0.5 + 0.5 * sin(uTime * 3.0 + aMisc.z));
  vColor = aColor;
  vAlpha = uOpacity * aMisc.y * prof * fl * smoothstep(0.0, 0.15, endR - startR);
  vAcross = corner.y;
}`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const SPHERE_FRAG = /* glsl */ `
uniform vec3 uRim;
uniform vec3 uAccent;
uniform float uOpacity;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(vN, vV));
  float rim = pow(f, 6.0) * 0.5 + pow(f, 22.0) * 2.2;
  // Violet crescents on the upper and lower inner rim, like a lit glass bubble.
  float accent = smoothstep(0.6, 0.98, abs(vN.y)) * pow(f, 4.0);
  vec3 col = uRim * rim + uAccent * accent * 0.6;
  gl_FragColor = vec4(col * uOpacity, 1.0);
}`;

type RayUniforms = {
  uTime: THREE.IUniform<number>;
  uBurstT: THREE.IUniform<number>;
  uBurstDur: THREE.IUniform<number>;
  uRetract: THREE.IUniform<number>;
  uScale: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uPx: THREE.IUniform<number>;
  uFlicker: THREE.IUniform<number>;
  uRes: THREE.IUniform<THREE.Vector2>;
  uNear: THREE.IUniform<number>;
};

// ---------------------------------------------------------------------------
// Geometry builders
// ---------------------------------------------------------------------------

type RaySpec = {
  dir: [number, number, number];
  len: [number, number, number, number];
  color: [number, number, number];
  misc: [number, number, number, number];
};

const makeRays = (rays: RaySpec[], ctx: { px: number; width: number; height: number }) => {
  const n = rays.length;
  const g = ribbonQuad();
  const dir = new Float32Array(n * 3);
  const len = new Float32Array(n * 4);
  const col = new Float32Array(n * 3);
  const misc = new Float32Array(n * 4);
  rays.forEach((r, i) => {
    dir.set(r.dir, i * 3);
    len.set(r.len, i * 4);
    col.set(r.color, i * 3);
    misc.set(r.misc, i * 4);
  });
  instanced(g, "aDir", dir, 3);
  instanced(g, "aLen", len, 4);
  instanced(g, "aColor", col, 3);
  instanced(g, "aMisc", misc, 4);
  g.instanceCount = n;
  const uniforms: RayUniforms = {
    uTime: { value: 0 },
    uBurstT: { value: 10 },
    uBurstDur: { value: 1 },
    uRetract: { value: 0 },
    uScale: { value: 1 },
    uOpacity: { value: 1 },
    uPx: { value: ctx.px },
    uFlicker: { value: 0 },
    uRes: { value: new THREE.Vector2(ctx.width, ctx.height) },
    uNear: { value: 0.06 },
  };
  const m = new THREE.ShaderMaterial({
    vertexShader: RAY_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms,
    ...additive,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return { object: mesh, u: uniforms };
};

// ---------------------------------------------------------------------------
// Timeline (seconds). Matches the reference: sphere 0-0.9s, first burst
// 0.7-1.3s, bead star 1.1-2.3s, fly-through 2.0-3.0s, network explosion
// from 2.85s, slow pull-back to the end.
// ---------------------------------------------------------------------------

const CAM_Z: Key[] = [
  { t: 0, v: 6.6 },
  { t: 1.3, v: 5.6 },
  { t: 2.3, v: 9.5 },
  { t: 3.25, v: 3.2, ease: easeInCubic },
  { t: 4.6, v: 12.5, ease: easeInOutSine },
  { t: 6.1, v: 9 },
  { t: 14.1, v: 12.5 },
];

export const createBurstStage =
  (pal: BurstPalette, seed: number): StageFactory =>
  (ctx) => {
    const { width, height, px } = ctx;
    const rng = mulberry32(seed);
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    scene.add(root);
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 400);
    const projScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(20)));

    const clouds: CloudUniforms[] = [];
    const addCloud = (c: ReturnType<typeof makeCloud>) => {
      c.u.uProjScale.value = projScale;
      clouds.push(c.u);
      root.add(c.object);
      return c.u;
    };
    const rays: RayUniforms[] = [];
    const addRays = (r: ReturnType<typeof makeRays>) => {
      rays.push(r.u);
      root.add(r.object);
      return r.u;
    };

    // --- Glass sphere ------------------------------------------------------
    const sphereMat = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: SPHERE_FRAG,
      uniforms: {
        uRim: { value: new THREE.Vector3(...pal.sphereRim) },
        uAccent: { value: new THREE.Vector3(...pal.sphereAccent) },
        uOpacity: { value: 1 },
      },
      ...additive,
      side: THREE.DoubleSide,
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), sphereMat);
    sphere.rotation.z = -0.15;
    root.add(sphere);

    // Nodes and links floating inside the sphere.
    const innerDirs = Array.from({ length: 16 }, () => randomUnitVector(rng));
    const inner = addCloud(
      makeCloud(
        innerDirs.map((d) => {
          const r = range(rng, 0.25, 0.62);
          return {
            pos: [d[0] * r, d[1] * r, d[2] * r],
            color: pickWeighted(rng, pal.beads),
            size: range(rng, 13, 20),
            seed: tw(rng, 1, range(rng, 0.7, 1.3)),
          };
        }),
        px,
        { twinkle: 0.3 },
      ),
    );
    const innerLinks = addRays(
      makeRays(
        innerDirs.map((d) => ({
          dir: d,
          len: [0.05, 0.55, 0.55, range(rng, 0.7, 1.3)],
          color: pickWeighted(rng, pal.rays),
          misc: [0.6, 0.18, rng() * 6, 0.2],
        })),
        ctx,
      ),
    );
    // Dim "ghost" rays around the sphere at the very start.
    const ghost = addRays(
      makeRays(
        Array.from({ length: 12 }, () => ({
          // Mostly below the sphere, as in the reference.
          dir: new THREE.Vector3(range(rng, -0.7, 0.7), range(rng, -1, -0.3), range(rng, -0.4, 0.4))
            .normalize()
            .toArray() as [number, number, number],
          len: [range(rng, 1.1, 1.8), range(rng, 2.5, 5), 0, 1],
          color: pickWeighted(rng, pal.rays),
          misc: [0.7, 0.1, rng() * 6, 0.9],
        })),
        ctx,
      ),
    );

    // --- Burst A: rays that retract into a bead-on-stick starburst ---------
    const aDirs = Array.from({ length: 58 }, () => {
      const d = randomUnitVector(rng);
      // Flatten slightly toward the screen plane so the star reads clearly.
      return new THREE.Vector3(d[0], d[1], d[2] * 0.7).normalize();
    });
    const aSticks = aDirs.map(() => range(rng, 0.9, 2.0));
    const aSpeeds = aDirs.map(() => range(rng, 0.75, 1.25));
    const burstA = addRays(
      makeRays(
        aDirs.map((d, i) => ({
          dir: [d.x, d.y, d.z],
          len: [0.12, range(rng, 1.3, 3.0), aSticks[i], aSpeeds[i]],
          color: pickWeighted(rng, pal.rays.slice(0, 4)),
          misc: [range(rng, 0.7, 1.3), range(rng, 0.55, 1), rng() * 6, 0.85],
        })),
        ctx,
      ),
    );
    const beads = addCloud(
      makeCloud(
        aDirs.map((d, i) => ({
          pos: [d.x * aSticks[i], d.y * aSticks[i], d.z * aSticks[i]],
          color: pickWeighted(rng, pal.beads),
          size: range(rng, 0.07, 0.11),
          seed: tw(rng, 1, aSpeeds[i]),
        })),
        px,
        { world: true, kind: 1, maxSize: 70 },
      ),
    );

    // Glossy hub bead at the centre of the bead star.
    const hub = addCloud(
      makeCloud(
        [{ pos: [0, 0, 0], color: pal.core, size: 0.32, seed: [0, 0, 1, 1] }],
        px,
        { world: true, kind: 1, maxSize: 120 },
      ),
    );

    // --- Core glow: a wide halo sprite plus a hot centre sprite ----------
    const coreCloud = makeCloud(
      [
        { pos: [0, 0, 0], color: pal.core, size: 1, seed: [0, 0, 1, 1] },
        { pos: [0, 0, 0], color: pal.node, size: 1, seed: [0, 0, 1, 0.9] },
      ],
      px,
      { maxSize: 400 },
    );
    addCloud(coreCloud);
    const coreSizeAttr = coreCloud.object.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const setCoreSize = (s: number) => {
      coreSizeAttr.setX(0, s * 2.6);
      coreSizeAttr.setX(1, s * 0.55);
      coreSizeAttr.needsUpdate = true;
    };

    // --- Background dust ----------------------------------------------------
    const dust = addCloud(
      makeCloud(
        Array.from({ length: 1400 }, () => {
          const d = randomUnitVector(rng);
          const r = range(rng, 25, 70);
          return {
            pos: [d[0] * r, d[1] * r, d[2] * r],
            color: pickWeighted(rng, pal.particles),
            size: range(rng, 1.2, 2.6),
            seed: tw(rng, range(rng, 0.3, 1)),
          };
        }),
        px,
        { twinkle: 0.5 },
      ),
    );

    // --- Burst B / network --------------------------------------------------
    const N_RAYS = 130;
    const netDirs = Array.from({ length: N_RAYS }, () => {
      const d = randomUnitVector(rng);
      return new THREE.Vector3(d[0], d[1] * 0.85, d[2]).normalize();
    });
    const netLens = netDirs.map(() => range(rng, 2.2, 5.8));
    const netSpeeds = netDirs.map(() => range(rng, 0.7, 1.3));
    const burstB = addRays(
      makeRays(
        netDirs.map((d, i) => ({
          dir: [d.x, d.y, d.z],
          len: [range(rng, 0.05, 0.3), netLens[i] * range(rng, 1.2, 2.2), netLens[i] * range(rng, 0.25, 0.7), netSpeeds[i]],
          color: pickWeighted(rng, pal.rays.slice(0, 3)),
          misc: [range(rng, 0.8, 1.7), range(rng, 0.45, 1), rng() * 6, 0.25],
        })),
        ctx,
      ),
    );
    // Dense short fibres around the hub.
    const fibres = addRays(
      makeRays(
        Array.from({ length: 140 }, () => ({
          dir: randomUnitVector(rng),
          len: [0.02, range(rng, 0.3, 2.2), 0, range(rng, 0.8, 1.2)],
          color: pickWeighted(rng, pal.rays),
          misc: [range(rng, 0.45, 0.8), range(rng, 0.25, 0.6), rng() * 6, 0],
        })),
        ctx,
      ),
    );

    // Filament particles: clustered around the network rays, plus a diffuse
    // cloud, giving the clumpy "galaxy of nodes" look.
    const particleSpecs: PointSpec[] = [];
    // Clumps sit out along the rays (the tufts at the ends of the network),
    // leaving dark gaps between them, as in the reference.
    const clumps = Array.from({ length: 60 }, () => {
      const k = Math.floor(rng() * N_RAYS);
      const r = netLens[k] * range(rng, 0.45, 1.15);
      const d = netDirs[k];
      return { k, c: new THREE.Vector3(d.x * r, d.y * r, d.z * r), spread: 0.075 * r + 0.08 };
    });
    for (let i = 0; i < 8000; i++) {
      let pos: [number, number, number];
      const speed = range(rng, 0.65, 1.35);
      const roll = rng();
      if (roll < 0.86) {
        const cl = clumps[Math.floor(rng() * clumps.length)];
        pos = [
          cl.c.x + gaussian(rng) * cl.spread,
          cl.c.y + gaussian(rng) * cl.spread,
          cl.c.z + gaussian(rng) * cl.spread,
        ];
      } else if (roll < 0.99) {
        const k = Math.floor(rng() * N_RAYS);
        const d = netDirs[k];
        const r = netLens[k] * range(rng, 0.15, 1.1);
        const spread = 0.025 * r;
        pos = [
          d.x * r + gaussian(rng) * spread,
          d.y * r + gaussian(rng) * spread,
          d.z * r + gaussian(rng) * spread,
        ];
      } else {
        const d = randomUnitVector(rng);
        const r = range(rng, 3, 9);
        pos = [d[0] * r, d[1] * r * 0.85, d[2] * r];
      }
      particleSpecs.push({
        pos,
        color: pickWeighted(rng, pal.particles),
        size: range(rng, 0.024, 0.05) * (rng() < 0.06 ? 1.7 : 1),
        seed: tw(rng, range(rng, 0.55, 1), speed),
      });
    }
    const particles = addCloud(
      makeCloud(particleSpecs, px, { world: true, twinkle: 0.45, maxSize: 50 }),
    );

    // Bright junction nodes along the rays.
    const nodes = addCloud(
      makeCloud(
        Array.from({ length: 240 }, (_, i) => {
          // Half the nodes mark clump centres, the rest sit along the rays.
          const cl = clumps[i % clumps.length];
          const k = i < 120 ? cl.k : Math.floor(rng() * N_RAYS);
          const d = netDirs[k];
          const r = i < 120 ? cl.c.length() : netLens[k] * range(rng, 0.3, 1.1);
          return {
            pos: [d.x * r, d.y * r, d.z * r],
            color: rng() < 0.55 ? pal.node : pickWeighted(rng, pal.beads.slice(1, 3)),
            size: range(rng, 0.07, 0.14),
            seed: tw(rng, range(rng, 0.6, 1), netSpeeds[k]),
          };
        }),
        px,
        { world: true, twinkle: 0.35, maxSize: 90 },
      ),
    );

    // Large soft foreground stars that fill the frame during the pull-back.
    const stars = addCloud(
      makeCloud(
        Array.from({ length: 650 }, () => {
          const d = randomUnitVector(rng);
          const r = range(rng, 5, 22);
          return {
            pos: [d[0] * r, d[1] * r * 0.7, d[2] * r],
            color: pal.star,
            size: range(rng, 0.1, 0.2),
            seed: tw(rng, range(rng, 0.5, 1), range(rng, 0.8, 1.2)),
          };
        }),
        px,
        { world: true, twinkle: 0.4, maxSize: 60 },
      ),
    );

    const update = (t: number) => {
      // Camera ------------------------------------------------------------
      const z = track(CAM_Z, t);
      camera.position.set(
        Math.sin(t * 0.37) * 0.08 * z * 0.1,
        Math.cos(t * 0.29) * 0.06 * z * 0.1,
        z,
      );
      camera.lookAt(0, 0, 0);
      camera.rotation.z += Math.sin(t * 0.21) * 0.03;
      camera.updateMatrixWorld();
      root.rotation.set(0.12 * Math.sin(t * 0.15), 0.6 * easeInOutSine((t - 0.8) / 2) + 0.035 * t, 0.02 * t);

      for (const u of clouds) u.uTime.value = t;
      for (const u of rays) u.uTime.value = t;

      // Sphere phase --------------------------------------------------------
      const sScale = track(
        [
          { t: 0, v: 1 },
          { t: 0.5, v: 0.76 },
          { t: 0.75, v: 0.64 },
          { t: 1.0, v: 0.32 },
          { t: 1.35, v: 0.24 },
        ],
        t,
      );
      sphere.scale.setScalar(sScale);
      sphereMat.uniforms.uOpacity.value = 1 - smoothstep(1.15, 1.4, t);
      sphere.visible = t < 1.4;
      inner.uScale.value = sScale;
      inner.uOpacity.value = 1.6 * smoothstep(0.0, 0.35, t + 0.08) * (1 - smoothstep(0.9, 1.1, t));
      innerLinks.uScale.value = sScale;
      innerLinks.uBurstT.value = t + 0.1;
      innerLinks.uBurstDur.value = 0.5;
      innerLinks.uOpacity.value = smoothstep(0.1, 0.45, t) * (1 - smoothstep(0.85, 1.05, t));
      ghost.uBurstT.value = 1;
      ghost.uOpacity.value = 1 - smoothstep(0.1, 0.45, t);

      // Burst A + bead star --------------------------------------------------
      burstA.uBurstT.value = t - 0.7;
      burstA.uBurstDur.value = 0.5;
      burstA.uRetract.value = easeInOutSine((t - 1.2) / 0.3);
      burstA.uOpacity.value =
        smoothstep(0.68, 0.78, t) * (1 - smoothstep(2.15, 2.5, t)) * (1.3 - 0.5 * smoothstep(1.2, 1.5, t));
      beads.uOpacity.value = smoothstep(1.15, 1.32, t) * (1 - smoothstep(2.2, 2.55, t));
      hub.uOpacity.value = smoothstep(1.15, 1.32, t) * (1 - smoothstep(2.2, 2.55, t));

      // Core ---------------------------------------------------------------
      const coreSize = track(
        [
          { t: 0, v: 6 },
          { t: 0.7, v: 10 },
          { t: 0.85, v: 26 },
          { t: 1.2, v: 18 },
          { t: 2.0, v: 14 },
          { t: 2.6, v: 22 },
          { t: 3.1, v: 34 },
          { t: 4.5, v: 22 },
          { t: 14.1, v: 12 },
        ],
        t,
      );
      setCoreSize(coreSize * (1 + 0.08 * Math.sin(t * 5.3)));

      // Dust ------------------------------------------------------------------
      dust.uOpacity.value = smoothstep(1.6, 2.4, t) * 0.5;

      // Burst B / network ---------------------------------------------------
      burstB.uBurstT.value = t - 2.3;
      burstB.uBurstDur.value = 1.1;
      burstB.uRetract.value = easeInOutSine((t - 3.3) / 1.8);
      burstB.uOpacity.value =
        smoothstep(2.3, 2.45, t) *
        track([{ t: 2.8, v: 1.0 }, { t: 3.6, v: 0.55 }, { t: 5, v: 0.3 }, { t: 9, v: 0.13 }, { t: 14, v: 0.08 }], t);
      burstB.uScale.value = 1 + 0.06 * Math.max(0, t - 3);
      burstB.uFlicker.value = 0.3;

      const growth = 1 + 0.06 * Math.max(0, t - 4);
      particles.uBurstT.value = t - 3.25;
      particles.uBurstDur.value = 1.8;
      nodes.uBurstT.value = t - 2.85;
      nodes.uBurstDur.value = 1.0;
      for (const u of [particles, nodes]) u.uScale.value = growth;
      particles.uOpacity.value = smoothstep(3.45, 4.2, t) * track([{ t: 4, v: 1.5 }, { t: 14, v: 1.2 }], t);
      nodes.uOpacity.value = smoothstep(3.15, 3.4, t) * track([{ t: 3.6, v: 2.8 }, { t: 5, v: 2.0 }, { t: 14, v: 1.3 }], t);
      fibres.uBurstT.value = t - 2.1;
      fibres.uBurstDur.value = 0.8;
      fibres.uOpacity.value = smoothstep(2.1, 2.3, t) * track([{ t: 2.4, v: 0.9 }, { t: 3.5, v: 0.4 }, { t: 8, v: 0.2 }, { t: 14, v: 0.14 }], t);
      fibres.uScale.value = growth;
      stars.uOpacity.value = smoothstep(4.5, 7.5, t) * 1.6;
      stars.uScale.value = growth;

      return {
        scene,
        camera,
        post: {
          bloom: 0.9,
          threshold: 0.15,
          exposure: 0.95 * pal.exposure,
          vignette: 0.55,
          background: pal.background,
          bgGlowColor: [0, 0, 0] as [number, number, number],
          bgGlowPos: [0.5, 0.5] as [number, number],
          bgGlow: 0,
          fade: 1,
        },
      };
    };

    return {
      update,
      dispose: () => {
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          (m.material as THREE.Material | undefined)?.dispose();
        });
      },
    };
  };

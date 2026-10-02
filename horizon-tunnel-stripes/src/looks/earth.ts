import * as THREE from "three";
import { makeBackdrop } from "../engine/backdrop";
import { Dot, makeDots } from "../engine/dots";
import { makeLines, Seg } from "../engine/lines";
import { gauss, mulberry32, range } from "../engine/random";
import { LookFactory } from "../engine/Stage";
import { EarthColors } from "../versions";

// Look 1 - Earth Horizon Rays.
// The top of a large globe curves across the lower frame. Rays rise from
// behind the horizon, a soft light column sits in the centre, plexus lines
// and dots cover the globe, stars and two dotted orbit arcs fill the sky.
//
// Loop (600 frames): the globe turns exactly one full turn; ray streaks use
// integer repeat counts; every twinkle uses cycle counts that divide 600.

export type EarthParams = { colors: EarthColors };

const R = 10;
// Solved so the horizon apex sits ~72% down the frame and the limb meets
// the bottom edge near the frame corners (fov 32).
const CENTER = new THREE.Vector3(0, -11.536, -11.549);
const FOV = 32;
const LOOP = 600;
const RAY_Z = CENTER.z - 0.5;

const lin = (hex: string) => new THREE.Color(hex);

// Module-level seeded generators: identical geometry in every render tab.
const buildPlexus = () => {
  const rng = mulberry32(0x1a2b3c);
  const pts: THREE.Vector3[] = [];
  while (pts.length < 1400) {
    const z = range(rng, -1, 1);
    const th = range(rng, 0, Math.PI * 2);
    const r = Math.sqrt(1 - z * z);
    const v = new THREE.Vector3(r * Math.cos(th), z, r * Math.sin(th));
    // Only the northern part is ever visible.
    if (v.y < -0.15) continue;
    pts.push(v);
  }
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => ({ j, d: p.distanceTo(q) }))
      .filter((e) => e.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    const k = rng() < 0.35 ? 3 : 2;
    near.slice(0, k).forEach(({ j, d }) => {
      if (d > 0.16) return;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push([i, j]);
    });
  });
  const dotParams = pts.map(() => ({
    phase: rng(),
    cycles: [1, 2, 3, 4, 5, 6][Math.floor(rng() * 6)],
    bright: rng(),
  }));
  return { pts, edges, dotParams };
};
const PLEXUS = buildPlexus();

// Find the screen-space horizon on the ray plane: lowest y at x that the
// globe does not hide.
const horizonY = (x: number) => {
  const hidden = (y: number) => {
    const d = new THREE.Vector3(x, y, RAY_Z).normalize();
    const tca = CENTER.dot(d);
    const b2 = CENTER.lengthSq() - tca * tca;
    return tca > 0 && b2 < R * R;
  };
  let lo = -20;
  let hi = 10;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (hidden(mid)) lo = mid;
    else hi = mid;
  }
  return hi;
};

const buildRays = () => {
  const rng = mulberry32(0x5eed01);
  const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.abs(RAY_Z);
  const halfW = halfH * (16 / 9);
  const rays: {
    x: number;
    y0: number;
    y1: number;
    w: number;
    intensity: number;
    phase: number;
    cycles: number;
    streak: number;
    base: number;
    hot: number;
  }[] = [];
  for (let i = 0; i < 110; i++) {
    let x: number;
    if (rng() < 0.6) x = gauss(rng) * halfW * 0.28;
    else x = range(rng, -halfW, halfW);
    const centre = Math.exp(-Math.pow(x / (halfW * 0.38), 2));
    const yh = horizonY(x);
    const maxL = (0.8 + 0.3 * centre) * (halfH - yh + 0.3);
    const L = maxL * (0.15 + 0.85 * rng());
    const hot = rng() < 0.08 ? 1 : 0;
    rays.push({
      x,
      y0: yh - 0.4,
      y1: yh + L,
      w: hot ? range(rng, 0.0018, 0.0026) : range(rng, 0.0009, 0.0018),
      intensity: (hot ? range(rng, 0.9, 1.4) : range(rng, 0.35, 0.8)) * (0.8 + 0.2 * centre),
      phase: rng(),
      cycles: [1, 2, 2, 3, 3, 4, 5][Math.floor(rng() * 7)],
      streak: range(rng, 0.08, 0.35),
      base: range(rng, 0.15, 0.6),
      hot,
    });
  }
  return { rays, halfW, halfH };
};
const RAYS = buildRays();

const buildStars = () => {
  const rng = mulberry32(0x57a25);
  const z = -90;
  const halfH = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * Math.abs(z);
  const halfW = halfH * (16 / 9);
  return Array.from({ length: 120 }, () => ({
    p: [range(rng, -halfW, halfW), range(rng, -halfH * 0.5, halfH), z] as [number, number, number],
    size: Math.pow(rng(), 3) * 0.0028 + 0.0011,
    intensity: Math.pow(rng(), 2.2) * 2.2 + 0.25,
    warm: rng() < 0.25,
    phase: rng(),
    cycles: [1, 2, 3, 4, 5, 6, 8, 10][Math.floor(rng() * 8)],
  }));
};
const STARS = buildStars();

const TWINKLE = /* glsl */ `
uniform float uT;
float dotMod(vec4 p) {
  float s = 0.5 + 0.5 * sin(6.28318530718 * (p.x + uT * p.y));
  return mix(1.0, s * s * 1.6, p.z);
}
`;

export const earthLook: LookFactory<EarthParams> = ({ assets, params }) => {
  const c = params.colors;
  const rim = lin(c.rim);
  const land = lin(c.land);
  const ocean = lin(c.ocean);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.5, 300);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);

  const uT = { value: 0 };

  // Sky, centre light column (globe is drawn over it, so it sits behind).
  const sky = makeBackdrop(
    /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uRim;
    vec3 backdrop(vec2 uv, vec2 p) {
      float v = smoothstep(1.1, 0.25, uv.y);
      vec3 col = mix(uTop, uHorizon, v);
      // darker toward the sides
      col *= mix(1.0, 0.18, smoothstep(0.12, 0.85, length(p * vec2(1.0, 1.2))));
      // centre light column, brightest at the horizon
      float h = max(uv.y - 0.22, 0.0);
      float colW = 0.2 + h * 0.06;
      float column = exp(-pow(p.x / colW, 2.0)) * (0.16 * exp(-h / 0.2) + 0.3 * smoothstep(0.0, 0.2, h) * exp(-h / 1.1));
      float wide = exp(-pow(p.x / 0.6, 2.0)) * 0.1;
      col += uRim * (column + wide);
      return col;
    }
  `,
    {
      uTop: { value: lin(c.skyTop) },
      uHorizon: { value: lin(c.skyHorizon) },
      uRim: { value: rim },
    },
  );
  scene.add(sky);

  // Stars.
  const starDots: Dot[] = STARS.map((s) => ({
    p: s.p,
    color: s.warm ? lin("#FFD9B0") : lin(c.star),
    intensity: s.intensity,
    size: s.size,
    param: [s.phase, s.cycles, 0.7, 0],
  }));
  scene.add(makeDots(starDots, { dotMod: TWINKLE, uniforms: { uT }, softness: 0.7, minPx: 1.2 }));

  // Globe.
  const globeRoot = new THREE.Group();
  globeRoot.position.copy(CENTER);
  globeRoot.rotation.x = THREE.MathUtils.degToRad(-12);
  scene.add(globeRoot);
  const spin = new THREE.Group();
  globeRoot.add(spin);

  const globeMat = new THREE.ShaderMaterial({
    uniforms: {
      tLand: { value: assets.land },
      uOcean: { value: ocean },
      uLand: { value: land },
      uRim: { value: rim },
    },
    vertexShader: /* glsl */ `
      out vec3 vObjN;
      out vec3 vWorldN;
      out vec3 vWorldPos;
      void main() {
        vObjN = normal;
        vWorldN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tLand;
      uniform vec3 uOcean;
      uniform vec3 uLand;
      uniform vec3 uRim;
      in vec3 vObjN;
      in vec3 vWorldN;
      in vec3 vWorldPos;
      const float PI = 3.14159265359;
      float landAt(vec3 n, float lod) {
        float lat = asin(clamp(n.y, -1.0, 1.0));
        float u1 = atan(n.x, n.z) / (2.0 * PI) + 0.5;
        float u2 = fract(u1 + 0.5) - 0.5;
        float v = 0.5 + lat / PI;
        // Tarini seam fix: use whichever u is continuous here.
        float u = fwidth(u1) > fwidth(u2) + 1e-6 ? u2 : u1;
        if (lod > 0.0) return textureLod(tLand, vec2(u, v), lod).r;
        return texture(tLand, vec2(u, v)).r;
      }
      void main() {
        vec3 n = normalize(vObjN);
        float l = landAt(n, 0.0);
        float ls = landAt(n, 5.0);
        float coast = clamp((l - ls) * 1.6, 0.0, 1.0);
        vec3 N = normalize(vWorldN);
        vec3 V = normalize(cameraPosition - vWorldPos);
        float facing = clamp(dot(N, V), 0.0, 1.0);
        float limb = 1.0 - facing;
        vec3 col = mix(uOcean, uLand * 0.2, 0.3) * (0.9 + 0.3 * ls);
        vec3 landCol = uLand * (0.3 + 0.08 * ls) + uLand * coast * 0.15;
        col = mix(col, landCol, l);
        // brighter toward the horizon, darker close to camera
        col *= mix(0.7, 1.2, smoothstep(0.0, 0.9, limb));
        // light from the column above, scattered at the top of the globe
        float topLight = exp(-pow(vWorldPos.x / 5.0, 2.0)) * pow(limb, 3.0);
        col += uRim * (0.10 * pow(limb, 4.0) + 0.12 * topLight);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 160), globeMat);
  spin.add(globe);

  // Plexus over the globe (rotates with it).
  const plexSegs: Seg[] = [];
  const PR = R * 1.003;
  const rimSoft = rim.clone().lerp(new THREE.Color(1, 1, 1), 0.15);
  PLEXUS.edges.forEach(([i, j], k) => {
    const a = PLEXUS.pts[i];
    const b = PLEXUS.pts[j];
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const p0 = a.clone().lerp(b, s / steps).normalize().multiplyScalar(PR);
      const p1 = a.clone().lerp(b, (s + 1) / steps).normalize().multiplyScalar(PR);
      plexSegs.push({
        a: [p0.x, p0.y, p0.z],
        b: [p1.x, p1.y, p1.z],
        color: rimSoft,
        intensity: 0.12 + 0.12 * ((k * 7919) % 13) / 13,
        widthA: 0.0011,
      });
    }
  });
  spin.add(makeLines(plexSegs, { worldWidth: false, softness: 0.4, minHalfPx: 0.55 }));
  const plexDots: Dot[] = PLEXUS.pts.map((p, i) => {
    const dp = PLEXUS.dotParams[i];
    const q = p.clone().multiplyScalar(R * 1.004);
    const bright = dp.bright > 0.8;
    return {
      p: [q.x, q.y, q.z],
      color: bright ? lin("#FFF2E0") : rimSoft,
      intensity: bright ? 3.0 : 1.1,
      size: bright ? 0.0034 : 0.0022,
      param: [dp.phase, dp.cycles, 0.85, 0],
    };
  });
  spin.add(makeDots(plexDots, { dotMod: TWINKLE, uniforms: { uT }, softness: 0.5, minPx: 1.1 }));

  // Short spikes rising off the surface with warm glowing tips.
  const spikeRng = mulberry32(0x5b1e);
  const spikeSegs: Seg[] = [];
  const tipDots: Dot[] = [];
  const warm = lin(c.star).lerp(lin("#FFB070"), 0.6);
  for (let i = 0; i < 90; i++) {
    const p = PLEXUS.pts[Math.floor(spikeRng() * PLEXUS.pts.length)];
    const len = range(spikeRng, 0.25, 1.1);
    const lean = new THREE.Vector3(range(spikeRng, -0.4, 0.4), 0, range(spikeRng, -0.4, 0.4));
    const dir = p.clone().add(lean).normalize();
    const a = p.clone().multiplyScalar(R * 1.004);
    const b = a.clone().addScaledVector(dir, len);
    spikeSegs.push({ a: [a.x, a.y, a.z], b: [b.x, b.y, b.z], color: rimSoft, intensity: 0.45, widthA: 0.001 });
    tipDots.push({ p: [b.x, b.y, b.z], color: spikeRng() < 0.6 ? warm : rimSoft, intensity: 2.0, size: 0.0026,
      param: [spikeRng(), [1, 2, 3, 4][Math.floor(spikeRng() * 4)], 0.6, 0] });
  }
  spin.add(makeLines(spikeSegs, { worldWidth: false, softness: 0.4, minHalfPx: 0.55 }));
  spin.add(makeDots(tipDots, { dotMod: TWINKLE, uniforms: { uT }, softness: 0.6, minPx: 1.1 }));

  // Warm bokeh and cyan sparkles floating in the sky.
  const bokehRng = mulberry32(0xb0e4);
  const bokeh: Dot[] = [];
  for (let i = 0; i < 34; i++) {
    const z = range(bokehRng, -30, -9);
    const hh = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * -z;
    const isWarm = bokehRng() < 0.55;
    bokeh.push({
      p: [range(bokehRng, -hh * 1.6, hh * 1.6), range(bokehRng, -hh * 0.3, hh), z],
      color: isWarm ? lin("#FFC48A") : lin("#8FE0FF"),
      intensity: isWarm ? range(bokehRng, 0.6, 1.8) : range(bokehRng, 0.8, 2.2),
      size: isWarm ? range(bokehRng, 0.0018, 0.0035) : range(bokehRng, 0.0014, 0.0026),
      param: [bokehRng(), [1, 2, 3][Math.floor(bokehRng() * 3)], 0.5, 0],
    });
  }
  scene.add(makeDots(bokeh, { dotMod: TWINKLE, uniforms: { uT }, softness: 0.45, minPx: 1.2 }));

  // Atmosphere: analytic ray/sphere distance gives a thin crisp rim line,
  // an inner limb glow and an outer haze.
  const atmo = makeBackdrop(
    /* glsl */ `
    uniform vec3 uCenter;
    uniform float uR;
    uniform vec3 uRim;
    vec3 backdrop(vec2 uv, vec2 p) {
      vec3 ro = (uCamWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 rd = camRayDir(uv);
      vec3 oc = uCenter - ro;
      float tca = dot(oc, rd);
      if (tca < 0.0) return vec3(0.0);
      float b = sqrt(max(dot(oc, oc) - tca * tca, 0.0));
      float x = b - uR;
      float line = exp(-pow(x / 0.016, 2.0));
      float outer = x > 0.0 ? exp(-x / 0.14) * 0.55 + exp(-x / 0.6) * 0.12 : 0.0;
      float inner = x < 0.0 ? exp(x / 0.10) * 0.65 + exp(x / 0.7) * 0.22 : 0.0;
      float centre = 1.0 + 0.6 * exp(-pow(p.x / 0.35, 2.0));
      return uRim * (line * 1.0 + outer * 0.6 + inner * 0.55) * (1.0 + 0.5 * smoothstep(0.3, 0.8, abs(p.x)));
    }
  `,
    { uCenter: { value: CENTER }, uR: { value: R }, uRim: { value: rim } },
    { additive: true, renderOrder: 50 },
  );
  scene.add(atmo);

  // Rays rising from behind the horizon.
  const rayMod = /* glsl */ `
    uniform float uT;
    float lineMod(float u, vec4 p) {
      float body = p.w * (0.55 + 0.45 * (1.0 - u)) * smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.8, u);
      float pos = fract(p.x + uT * p.y);
      float d = pos - u;
      float tail = d >= 0.0 ? exp(-d / p.z) : 0.0;
      float head = exp(-d * d / 0.00018);
      float life = smoothstep(0.0, 0.1, pos) * smoothstep(1.0, 0.7, pos);
      return body + (tail * 0.6 + head * 1.6) * life;
    }
  `;
  const raySegs: Seg[] = RAYS.rays.map((r) => {
    const col = r.hot ? rim.clone().lerp(new THREE.Color(1, 1, 1), 0.3) : rim;
    return {
      a: [r.x, r.y0, RAY_Z],
      b: [r.x, r.y1, RAY_Z],
      color: col,
      intensity: r.intensity,
      widthA: r.w,
      param: [r.phase, r.cycles, r.streak, r.base],
    };
  });
  const rays = makeLines(raySegs, {
    worldWidth: false,
    softness: 0.35,
    lineMod: rayMod,
    uniforms: { uT },
    minHalfPx: 0.5,
  });
  rays.renderOrder = 5;
  scene.add(rays);

  // Two faint dotted orbit arcs framing the sky: halves of large ellipses
  // behind the globe, so they rise from the horizon up the left and right
  // sides. A soft brightness pulse runs along each arc in whole cycles.
  const arcDefs = [
    { z: -16, a: 0.86, b: 1.5, cy: -0.55, n: 520, inten: 0.85, k: 3 },
    { z: -20, a: 0.95, b: 1.7, cy: -0.6, n: 600, inten: 0.6, k: -2 },
  ];
  arcDefs.forEach((d) => {
    const hh = Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * -d.z;
    const hw = hh * (16 / 9);
    const dots: Dot[] = [];
    for (let i = 0; i < d.n; i++) {
      const th = (i / d.n) * Math.PI * 2;
      dots.push({
        p: [Math.cos(th) * d.a * hw, (d.cy + Math.sin(th) * d.b) * hh, d.z],
        color: rimSoft,
        intensity: d.inten,
        size: 0.0014,
        param: [i / d.n, d.k, 0, 0],
      });
    }
    scene.add(
      makeDots(dots, {
        softness: 0.5,
        minPx: 0.8,
        uniforms: { uT },
        // gentle pulse running along the arc; whole cycles per loop
        dotMod: `uniform float uT;
float dotMod(vec4 p) { return 0.55 + 0.45 * sin(6.28318530718 * (p.x * 3.0 - uT * p.y)); }`,
      }),
    );
  });

  const update = (frame: number) => {
    const t = (frame % LOOP) / LOOP;
    uT.value = t;
    // Exactly one full turn per loop.
    spin.rotation.y = THREE.MathUtils.degToRad(-75) + t * Math.PI * 2;
  };

  return { scene, camera, update };
};

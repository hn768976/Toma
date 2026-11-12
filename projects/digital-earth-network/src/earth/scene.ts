import * as THREE from "three";
import { mulberry32, range } from "../lib/random";

export type Palette = {
  ocean: [number, number, number];
  land: [number, number, number];
  cloud: [number, number, number];
  rim: [number, number, number];
  city: [number, number, number];
  line: [number, number, number];
  haze: [number, number, number];
};

export const PALETTE: Palette = {
  ocean: [0.1, 0.36, 0.64],
  land: [0.4, 0.6, 0.8],
  cloud: [0.86, 0.94, 1.0],
  rim: [0.3, 0.62, 1.0],
  city: [1.0, 0.28, 0.04],
  line: [0.72, 0.84, 1.0],
  haze: [0.05, 0.17, 0.48],
};

export type Textures = {
  day: THREE.Texture;
  lights: THREE.Texture;
  clouds: THREE.Texture;
  ocean: THREE.Texture;
};

/** Direction the light comes from (right, slightly above): leaves the left ~40% of the globe in shadow. */
export const SUN = new THREE.Vector3(1.0, 0.42, 0.12).normalize();

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uLights;
  uniform sampler2D uClouds;
  uniform sampler2D uOcean;
  uniform vec3 uSun;
  uniform vec3 uOceanCol;
  uniform vec3 uLandCol;
  uniform vec3 uCloudCol;
  uniform vec3 uRimCol;
  uniform vec3 uCityCol;
  uniform float uCity;
  uniform float uFill;
  uniform float uCloudShift;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  float dither(vec2 c) { return (fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; }

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    vec3 day = texture2D(uDay, vUv).rgb;
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    float water = texture2D(uOcean, vUv).r;
    float cloud = texture2D(uClouds, vUv + vec2(uCloudShift, 0.0)).r;

    // Stylised blue "digital" earth: oceans deep blue, land icy blue-white.
    vec3 land = uLandCol * (0.6 + 1.2 * lum);
    vec3 ocean = uOceanCol * (0.75 + 1.4 * lum);
    vec3 col = mix(land, ocean, smoothstep(0.3, 0.7, water));
    col = mix(col, uCloudCol, smoothstep(0.0, 0.8, cloud) * 0.85);

    float ndl = dot(N, uSun);
    float diffuse = smoothstep(-0.45, 0.75, ndl);
    col *= uFill + 1.35 * diffuse;

    // Orange city hot spots (glow taken from a blurred mip of the light map).
    float lightsSharp = texture2D(uLights, vUv).r;
    float lightsSoft = texture2D(uLights, vUv, 2.5).r;
    float cityMask = 1.0 - 0.35 * smoothstep(0.3, 1.0, ndl);
    float hot = lightsSharp * lightsSharp * lightsSharp;
    col = mix(col, col * vec3(0.55, 0.6, 0.75), clamp(lightsSoft * 2.0 * uCity, 0.0, 0.6));
    float cluster = smoothstep(0.22, 0.6, lightsSoft);
    col += uCityCol * (hot * 1.6 * cluster + cluster * 2.0 + lightsSoft * 1.0) * uCity * cityMask;

    // Fresnel rim, stronger on the lit limb.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
    col += uRimCol * fres * (0.25 + 1.3 * smoothstep(-0.2, 0.8, ndl));

    gl_FragColor = vec4(col + dither(gl_FragCoord.xy), 1.0);
  }
`;

const atmoVertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const atmoFragment = /* glsl */ `
  uniform vec3 uRimCol;
  uniform vec3 uSun;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  float dither(vec2 c) { return (fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; }
  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vPosW);
    // Back faces: 0 at the outer edge of the shell, 1 at the planet limb.
    float a = pow(clamp(-dot(N, V) / 0.36, 0.0, 1.0), 1.8);
    float lit = 0.2 + 1.0 * smoothstep(-0.35, 0.8, dot(N, uSun));
    gl_FragColor = vec4(uRimCol * a * lit * 1.1 + dither(gl_FragCoord.xy) * 2.0, 1.0);
  }
`;

// Round soft sprites for network nodes and dust.
const pointVertex = /* glsl */ `
  attribute float aSize;
  attribute float aBright;
  uniform float uPixelRatio;
  uniform float uTime;
  varying float vBright;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.3 + aBright * 2.0) + position.x * 17.0);
    vBright = aBright * twinkle * clamp(-mv.z * 0.9, 0.0, 1.0);
    gl_PointSize = clamp(aSize * uPixelRatio * 1.0 / -mv.z, 1.0, 160.0 * uPixelRatio);
    gl_Position = projectionMatrix * mv;
  }
`;
const pointFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vBright;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float r = dot(p, p);
    float core = smoothstep(0.35, 0.0, r);
    float halo = exp(-r * 4.0) * 0.45;
    float a = (core + halo) * vBright;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// "X" cross markers.
const crossFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vBright;
  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d1 = abs(p.x - p.y) * 0.7071;
    float d2 = abs(p.x + p.y) * 0.7071;
    float w = 0.045;
    float line = max(smoothstep(w, 0.0, d1 - w * 0.4), smoothstep(w, 0.0, d2 - w * 0.4));
    line *= smoothstep(1.0, 0.85, max(abs(p.x), abs(p.y)));
    float a = line * vBright;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const lineVertex = /* glsl */ `
  attribute float aAlpha;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // fade lines that are right on top of the lens or very far away
    float near = smoothstep(0.05, 0.5, -mv.z);
    float far = 1.0 - smoothstep(6.0, 11.0, -mv.z);
    vAlpha = aAlpha * near * far;
    gl_Position = projectionMatrix * mv;
  }
`;
const lineFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float a = vAlpha * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const hazeFragment = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  float dither(vec2 c) { return (fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0; }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = exp(-r * r * 4.5) * 0.6;
    // dither breaks up 8-bit banding in the smooth glow
    gl_FragColor = vec4(uColor * a + dither(gl_FragCoord.xy) * 1.5, a);
  }
`;
const hazeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export type NetworkNode = { p: THREE.Vector3; surface: boolean };

type Built = {
  scene: THREE.Scene;
  earthGroup: THREE.Group; // spins with the planet
  shellGroup: THREE.Group; // outer network, drifts slowly
  earthMat: THREE.ShaderMaterial;
  pointMats: THREE.ShaderMaterial[];
  shellLineMat: THREE.ShaderMaterial;
  haze: THREE.Mesh;
};

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  premultipliedAlpha: true,
} as const;

const vec = (c: [number, number, number]) => new THREE.Vector3(...c);

const randomOnSphere = (rng: () => number) => {
  const u = rng() * 2 - 1;
  const th = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
};

/** Builds a plexus: connects every node to its nearest neighbours within maxDist. */
const buildPlexus = (
  nodes: THREE.Vector3[],
  maxDist: number,
  maxLinks: number,
  alpha: number,
  rng: () => number,
) => {
  const pos: number[] = [];
  const alphas: number[] = [];
  const links = new Array(nodes.length).fill(0);
  for (let i = 0; i < nodes.length; i++) {
    const cand: [number, number][] = [];
    for (let j = i + 1; j < nodes.length; j++) {
      const d = nodes[i].distanceTo(nodes[j]);
      if (d < maxDist) cand.push([d, j]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [d, j] of cand) {
      if (links[i] >= maxLinks) break;
      if (links[j] >= maxLinks) continue;
      links[i]++;
      links[j]++;
      pos.push(nodes[i].x, nodes[i].y, nodes[i].z, nodes[j].x, nodes[j].y, nodes[j].z);
      const a = alpha * (1 - d / maxDist) * (0.55 + 0.45 * rng());
      alphas.push(a, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAlpha", new THREE.Float32BufferAttribute(alphas, 1));
  return g;
};

const pointsGeometry = (pts: THREE.Vector3[], size: () => number, bright: () => number) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3),
  );
  g.setAttribute("aSize", new THREE.Float32BufferAttribute(pts.map(size), 1));
  g.setAttribute("aBright", new THREE.Float32BufferAttribute(pts.map(bright), 1));
  return g;
};

export const buildScene = (tex: Textures, palette: Palette): Built => {
  const rng = mulberry32(20261112);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const earthGroup = new THREE.Group();
  const shellGroup = new THREE.Group();
  scene.add(earthGroup, shellGroup);

  // --- Earth ---------------------------------------------------------
  const earthMat = new THREE.ShaderMaterial({
    vertexShader: earthVertex,
    fragmentShader: earthFragment,
    uniforms: {
      uDay: { value: tex.day },
      uLights: { value: tex.lights },
      uClouds: { value: tex.clouds },
      uOcean: { value: tex.ocean },
      uSun: { value: SUN },
      uOceanCol: { value: vec(palette.ocean) },
      uLandCol: { value: vec(palette.land) },
      uCloudCol: { value: vec(palette.cloud) },
      uRimCol: { value: vec(palette.rim) },
      uCityCol: { value: vec(palette.city) },
      uCity: { value: 1 },
      uFill: { value: 0.05 },
      uCloudShift: { value: 0 },
    },
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), earthMat);
  earthGroup.add(earth);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.07, 128, 96),
    new THREE.ShaderMaterial({
      vertexShader: atmoVertex,
      fragmentShader: atmoFragment,
      uniforms: { uRimCol: { value: vec(palette.rim) }, uSun: { value: SUN } },
      side: THREE.BackSide,
      ...additive,
    }),
  );
  scene.add(atmo);

  // Soft blue haze behind the planet, offset toward the sun.
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      vertexShader: hazeVertex,
      fragmentShader: hazeFragment,
      uniforms: { uColor: { value: vec(palette.haze) } },
      ...additive,
      depthTest: true,
    }),
  );
  haze.renderOrder = -1;
  scene.add(haze);

  const lineColor = vec(palette.line);

  // --- Surface network (rotates with the planet) ----------------------
  const surfaceNodes: THREE.Vector3[] = [];
  for (let i = 0; i < 900; i++) surfaceNodes.push(randomOnSphere(rng).multiplyScalar(1.004));
  const surfLineMat = new THREE.ShaderMaterial({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    uniforms: { uColor: { value: lineColor }, uOpacity: { value: 1 } },
    ...additive,
  });
  earthGroup.add(new THREE.LineSegments(buildPlexus(surfaceNodes, 0.22, 4, 0.8, rng), surfLineMat));

  // Lifted network just above the surface (the bright triangulated mesh).
  const liftNodes: THREE.Vector3[] = [];
  for (let i = 0; i < 160; i++) liftNodes.push(randomOnSphere(rng).multiplyScalar(range(rng, 1.03, 1.35)));
  earthGroup.add(new THREE.LineSegments(buildPlexus(liftNodes.concat(surfaceNodes.slice(0, 160)), 0.5, 4, 1.0, rng), surfLineMat));

  // Spikes: lines rising from surface nodes to nodes high above the globe.
  const spikeTips: THREE.Vector3[] = [];
  const spikePos: number[] = [];
  const spikeAlpha: number[] = [];
  for (let i = 0; i < 60; i++) {
    const base = surfaceNodes[(i * 13) % surfaceNodes.length];
    const n = 1 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const tip = base
        .clone()
        .add(randomOnSphere(rng).multiplyScalar(range(rng, 0.1, 0.4)))
        .setLength(range(rng, 1.25, 1.85));
      spikeTips.push(tip);
      spikePos.push(base.x, base.y, base.z, tip.x, tip.y, tip.z);
      const a = range(rng, 0.45, 0.9);
      spikeAlpha.push(a, a * 0.5);
    }
  }
  const spikeGeo = new THREE.BufferGeometry();
  spikeGeo.setAttribute("position", new THREE.Float32BufferAttribute(spikePos, 3));
  spikeGeo.setAttribute("aAlpha", new THREE.Float32BufferAttribute(spikeAlpha, 1));
  earthGroup.add(new THREE.LineSegments(spikeGeo, surfLineMat));

  // --- Outer data network in space -----------------------------------
  // Denser on the sun-lit (+x) side so the web bunches to the right of the
  // globe and the shadow side stays mostly dark, as in the reference.
  const shellNodes: THREE.Vector3[] = [];
  while (shellNodes.length < 520) {
    const dir = randomOnSphere(rng);
    const bias = Math.pow((dir.x + 1) / 2, 1.5);
    if (rng() > 0.2 + 0.8 * bias) continue;
    const r = 1.25 + Math.pow(rng(), 1.3) * 5.2;
    shellNodes.push(dir.multiplyScalar(r));
  }
  const shellLineMat = new THREE.ShaderMaterial({
    vertexShader: lineVertex,
    fragmentShader: lineFragment,
    uniforms: { uColor: { value: lineColor }, uOpacity: { value: 1 } },
    ...additive,
  });
  shellGroup.add(new THREE.LineSegments(buildPlexus(shellNodes, 1.15, 3, 1.0, rng), shellLineMat));
  // Long hub "spokes" - the fan of lines converging on bright hubs.
  const hubs: THREE.Vector3[] = [];
  const spokePos: number[] = [];
  const spokeAlpha: number[] = [];
  for (let h = 0; h < 26; h++) {
    const hub = randomOnSphere(rng).multiplyScalar(range(rng, 1.4, 3.2));
    hubs.push(hub);
    const n = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < n; k++) {
      const end = hub.clone().add(randomOnSphere(rng).multiplyScalar(range(rng, 0.5, 1.6)));
      if (end.length() < 1.05) end.setLength(1.02);
      spokePos.push(hub.x, hub.y, hub.z, end.x, end.y, end.z);
      const a = range(rng, 0.5, 0.95);
      spokeAlpha.push(a, a * 0.3);
    }
  }
  const spokes = new THREE.BufferGeometry();
  spokes.setAttribute("position", new THREE.Float32BufferAttribute(spokePos, 3));
  spokes.setAttribute("aAlpha", new THREE.Float32BufferAttribute(spokeAlpha, 1));
  shellGroup.add(new THREE.LineSegments(spokes, shellLineMat));

  // --- Nodes ------------------------------------------------------------
  const pointMats: THREE.ShaderMaterial[] = [];
  const mkPointMat = (frag: string, color: THREE.Vector3) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: pointVertex,
      fragmentShader: frag,
      uniforms: { uColor: { value: color }, uPixelRatio: { value: 1 }, uTime: { value: 0 } },
      ...additive,
    });
    pointMats.push(m);
    return m;
  };
  const nodeMat = mkPointMat(pointFragment, new THREE.Vector3(0.85, 0.93, 1.0));
  shellGroup.add(
    new THREE.Points(
      pointsGeometry(shellNodes, () => range(rng, 10, 22), () => range(rng, 0.45, 1)),
      nodeMat,
    ),
  );
  shellGroup.add(
    new THREE.Points(pointsGeometry(hubs, () => range(rng, 40, 70), () => 1), nodeMat),
  );
  earthGroup.add(
    new THREE.Points(
      pointsGeometry(liftNodes.concat(surfaceNodes.filter((_, i) => i % 3 === 0), spikeTips), () => range(rng, 5, 12), () => range(rng, 0.4, 1)),
      nodeMat,
    ),
  );

  // Dust / distant stars.
  const dust: THREE.Vector3[] = [];
  for (let i = 0; i < 1400; i++) dust.push(randomOnSphere(rng).multiplyScalar(range(rng, 1.6, 9)));
  shellGroup.add(
    new THREE.Points(pointsGeometry(dust, () => range(rng, 2, 6), () => range(rng, 0.12, 0.6)), nodeMat),
  );

  // X markers.
  const crosses: THREE.Vector3[] = [];
  for (let i = 0; i < 70; i++) crosses.push(randomOnSphere(rng).multiplyScalar(range(rng, 1.06, 3.4)));
  const crossMat = mkPointMat(crossFragment, new THREE.Vector3(0.9, 0.95, 1.0));
  shellGroup.add(
    new THREE.Points(pointsGeometry(crosses, () => range(rng, 45, 85), () => range(rng, 0.6, 1.0)), crossMat),
  );
  // Small X markers riding on the globe surface.
  const surfCrosses: THREE.Vector3[] = [];
  for (let i = 0; i < 30; i++) surfCrosses.push(randomOnSphere(rng).multiplyScalar(range(rng, 1.01, 1.06)));
  earthGroup.add(
    new THREE.Points(pointsGeometry(surfCrosses, () => range(rng, 22, 40), () => range(rng, 0.6, 1.0)), crossMat),
  );

  return { scene, earthGroup, shellGroup, earthMat, pointMats, shellLineMat, haze };
};

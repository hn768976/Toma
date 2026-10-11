import * as THREE from "three";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import land110 from "world-atlas/land-110m.json";
import { Look } from "../lib/LookCanvas";
import { Post } from "../lib/post";
import { Dots } from "../lib/points";
import { mulberry32 } from "../lib/rng";
import { loopPhase, TAU } from "../lib/loop";
import { buildTurbine } from "./turbine";

export interface WindFarmParams {
  bgBottom: string;
  bgTop: string;
  dots: string;
  glow: string;
}

const FOV = 32;
const LOOK_AT = new THREE.Vector3(-0.6, 4.3, 0);
const CAM_DIST = 23.5;
const CAM_H = 2.8;

// x, z, tower height, yaw, rotor revolutions per loop (multiples of 1/3 = 120 deg)
const TURBINES = [
  { x: -3.0, z: 0, h: 6.6, yaw: 0.18, revs: 4 },
  { x: -7.4, z: -6, h: 6.0, yaw: 0.45, revs: 11 / 3 },
  { x: -6.2, z: -17, h: 6.2, yaw: 0.3, revs: 10 / 3 },
  { x: 1.6, z: -5, h: 6.2, yaw: -0.25, revs: 3 },
];

/** Land mask (equirectangular) -> dot grid texture. */
const worldMapTexture = (dotRGB: string) => {
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
  const fc = feature(topo, topo.objects.land) as unknown as FeatureCollection<Geometry>;
  const LAT_TOP = 82, LAT_BOT = -58;
  const MW = 1440, MH = Math.round((MW * (LAT_TOP - LAT_BOT)) / 360);
  const mask = document.createElement("canvas");
  mask.width = MW; mask.height = MH;
  const mg = mask.getContext("2d")!;
  mg.fillStyle = "#fff";
  const proj = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * MW, ((LAT_TOP - lat) / (LAT_TOP - LAT_BOT)) * MH];
  mg.beginPath();
  const ring = (r: number[][]) => r.forEach(([lon, lat], i) => { const [x, y] = proj(lon, lat); if (i === 0) mg.moveTo(x, y); else mg.lineTo(x, y); });
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === "Polygon") g.coordinates.forEach(ring);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach(ring));
  }
  mg.fill("evenodd");
  const data = mg.getImageData(0, 0, MW, MH).data;
  // dot grid
  const COLS = 230;
  const step = MW / COLS;
  const TW = 4096, TH = Math.round((TW * MH) / MW);
  const out = document.createElement("canvas");
  out.width = TW; out.height = TH;
  const og = out.getContext("2d")!;
  og.fillStyle = dotRGB;
  const s = TW / MW;
  for (let y = step / 2; y < MH; y += step) {
    for (let x = step / 2; x < MW; x += step) {
      const i = (Math.floor(y) * MW + Math.floor(x)) * 4;
      if (data[i] > 127) {
        const r = step * 0.3 * s;
        og.fillRect(x * s - r, y * s - r, r * 2, r * 2);
      }
    }
  }
  const t = new THREE.CanvasTexture(out);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { texture: t, aspect: TW / TH };
};

const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.99999, 1.0); }`;
const BG_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform vec3 c0;
uniform vec3 c1;
uniform vec3 glow;
uniform vec2 glowPos;
uniform float aspect;
void main() {
  float g = clamp(vUv.y * 0.85 + vUv.x * 0.25 - 0.05, 0.0, 1.0);
  vec3 c = mix(c0, c1, smoothstep(0.0, 1.0, g));
  vec2 d = (vUv - glowPos) * vec2(aspect, 1.0);
  c += glow * (exp(-dot(d, d) / 0.012) * 0.32 + exp(-dot(d, d) / 0.07) * 0.16);
  fragColor = vec4(c, 1.0);
}`;

const GROUND_VERT = /* glsl */ `
in vec3 aBase;
in float aRnd;
uniform float time;
uniform float pxScale;
uniform float worldScale;
uniform vec3 color;
uniform vec4 bases[4];
out vec3 vColor;
out float vSize;
out float vAlpha;
void main() {
  vec3 p = aBase;
  float T = 6.2831853 * time;
  // rolling waves: whole cycles per loop (time on a circle) -> seamless
  float hgt = 0.22 * sin(dot(p.xz, vec2(0.21, 0.13)) - T * 2.0)
            + 0.14 * sin(dot(p.xz, vec2(-0.12, 0.31)) + T * 1.0 + 1.3)
            + 0.08 * sin(dot(p.xz, vec2(0.45, -0.27)) - T * 3.0 + 0.4);
  float flat0 = smoothstep(-3.5, 4.0, p.z); // flatter at the far edge (the light band)
  p.y += hgt * mix(0.35, 1.0, flat0);
  float b = 0.25 + 0.75 * smoothstep(0.0, 0.6, hgt + 0.2);
  // brighter near the turbine bases and along the far edge
  for (int i = 0; i < 4; i++) {
    vec2 d = p.xz - bases[i].xy;
    b += bases[i].z * exp(-dot(d, d) / 9.0);
  }
  b += 1.2 * exp(-pow((p.z + 4.5) / 4.0, 2.0));
  b *= 0.8 + 0.4 * aRnd;
  b *= smoothstep(-24.0, -14.0, p.z);   // fade out far behind
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = 0.036 * worldScale / max(-mv.z, 0.1);
  float fade = clamp(s, 0.0, 1.0);
  s = max(s, 1.0);
  vSize = s;
  vAlpha = fade * fade;
  vColor = color * b;
  gl_PointSize = s + 2.0;
}`;
const GROUND_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec3 vColor;
in float vSize;
in float vAlpha;
void main() {
  vec2 q = (gl_PointCoord - 0.5) * (vSize + 2.0);
  float d = length(q);
  float a = clamp(vSize * 0.5 + 0.5 - d, 0.0, 1.0) * vAlpha;
  if (a <= 0.003) discard;
  fragColor = vec4(vColor * a, 1.0);
}`;

const BAND_FRAG = /* glsl */ `
precision highp float;
layout(location = 0) out highp vec4 fragColor;
in vec2 vUv;
uniform vec3 color;
uniform vec3 hot;
void main() {
  float x = (vUv.x - 0.5) * 2.0, y = (vUv.y - 0.5) * 2.0;
  float across = exp(-y * y / 0.0012) * 0.9 + exp(-y * y / 0.012) * 0.25 + exp(-y * y / 0.12) * 0.05;
  float along = exp(-pow((x + 0.12) / 0.32, 2.0)) * 1.0 + exp(-pow(x / 0.75, 2.0)) * 0.45;
  vec3 c = mix(color, hot, exp(-pow((x + 0.12) / 0.15, 2.0)) * exp(-y * y / 0.01));
  fragColor = vec4(c * across * along, 1.0);
}`;

export const createWindFarm = (p: WindFarmParams) => (gl: THREE.WebGLRenderer, w: number, h: number): Look => {
  const pxScale = h / 2160;
  const worldScale = h / (2 * Math.tan((FOV * Math.PI) / 360));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(FOV, w / h, 0.5, 300);
  const dotsCol = new THREE.Color(p.dots), glowCol = new THREE.Color(p.glow);

  // background gradient + soft glow (drawn at the far plane)
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: BG_VERT, fragmentShader: BG_FRAG, depthWrite: false,
    uniforms: {
      c0: { value: new THREE.Color(p.bgBottom) }, c1: { value: new THREE.Color(p.bgTop) },
      glow: { value: glowCol }, glowPos: { value: new THREE.Vector2(0.6, 0.47) }, aspect: { value: w / h },
    },
  });
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const bg = new THREE.Mesh(bgGeo, bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // dotted world map far behind
  const map = worldMapTexture("#ffffff");
  const MAP_W = 84;
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_W / map.aspect),
    new THREE.MeshBasicMaterial({ map: map.texture, color: dotsCol.clone().lerp(new THREE.Color(1, 1, 1), 0.3).multiplyScalar(0.16),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  mapMesh.position.set(-1.5, 15.5, -62);
  mapMesh.renderOrder = -5;
  scene.add(mapMesh);

  // turbines
  const white = new THREE.MeshStandardMaterial({ color: "#F4F6F8", roughness: 0.55, metalness: 0 });
  const turbines = TURBINES.map((t) => {
    const tb = buildTurbine(t.h, white);
    tb.group.position.set(t.x, 0, t.z);
    tb.group.rotation.y = t.yaw;
    scene.add(tb.group);
    return { ...t, ...tb };
  });
  scene.add(new THREE.HemisphereLight(0xa8c8ff, 0x1a2a50, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-6, 10, 12);
  scene.add(key);
  const rim = new THREE.DirectionalLight(glowCol.clone().lerp(new THREE.Color(1, 1, 1), 0.5), 2.2);
  rim.position.set(6, 4, -12);
  scene.add(rim);

  // particle ground: 400 x 150 = 60,000 dots
  const GX = 400, GZ = 150;
  const base = new Float32Array(GX * GZ * 3), rndA = new Float32Array(GX * GZ);
  const rnd = mulberry32(4034);
  for (let j = 0; j < GZ; j++) {
    for (let i = 0; i < GX; i++) {
      const k = j * GX + i;
      base[k * 3] = -42 + (84 * i) / (GX - 1);
      base[k * 3 + 1] = 0;
      base[k * 3 + 2] = -24 + (40 * j) / (GZ - 1);
      rndA[k] = rnd();
    }
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(GX * GZ * 3), 3));
  gGeo.setAttribute("aBase", new THREE.BufferAttribute(base, 3));
  gGeo.setAttribute("aRnd", new THREE.BufferAttribute(rndA, 1));
  const groundMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG,
    uniforms: {
      time: { value: 0 }, pxScale: { value: pxScale }, worldScale: { value: worldScale }, color: { value: dotsCol },
      bases: { value: TURBINES.map((t, i) => new THREE.Vector4(t.x, t.z, i === 0 ? 1.6 : 1.0, 0)) },
    },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: true,
  });
  const ground = new THREE.Points(gGeo, groundMat);
  ground.frustumCulled = false;
  scene.add(ground);

  // horizontal light band at the base line
  const band = new THREE.Mesh(new THREE.PlaneGeometry(90, 6), new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: BAND_FRAG,
    uniforms: { color: { value: dotsCol.clone().lerp(glowCol, 0.35).multiplyScalar(0.55) }, hot: { value: new THREE.Color(1, 1, 1).multiplyScalar(1.2) } },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  band.position.set(0, 0.25, -3.5);
  band.renderOrder = 5;
  scene.add(band);

  // sparks rising near the bases (whole trips per loop)
  const N_SPARKS = 400;
  const sparks = new Dots({ count: N_SPARKS, pxScale, mode: 0, additive: true, worldSize: 1 });
  (sparks.points.material as THREE.ShaderMaterial).uniforms.worldScale.value = worldScale;
  const spark = Array.from({ length: N_SPARKS }, () => {
    const tb = TURBINES[Math.floor(rnd() * TURBINES.length)];
    return {
      x: tb.x + (rnd() - 0.5) * 6, z: tb.z + (rnd() - 0.5) * 3, rise: 1.5 + rnd() * 3.5,
      trips: 1 + Math.floor(rnd() * 3), phase: rnd(), sway: rnd() * TAU, size: 0.035 + rnd() * 0.05,
    };
  });
  sparks.points.renderOrder = 6;
  scene.add(sparks.points);

  const focus = CAM_DIST;
  const post = new Post(gl, w, h, {
    depth: true,
    dof: { focus, range: 18, farRange: 45, maxCocPx4k: 7, near: cam.near, far: cam.far },
    bloom: { strength: 0.55, threshold: 0.75, knee: 0.4, levels: 7, radius: 0.85 },
    grain: 0.015, shoulder: 0.8,
    vignette: { amount: 0.35, start: 0.55, end: 1.35 },
  });

  const c = new THREE.Color();
  return {
    render(frame) {
      const t = loopPhase(frame);
      // closed camera lap: +-3 deg yaw and a slight push
      const yaw = THREE.MathUtils.degToRad(3) * Math.sin(TAU * t);
      const d = CAM_DIST - 0.8 * (0.5 - 0.5 * Math.cos(TAU * t));
      cam.position.set(LOOK_AT.x + Math.sin(yaw) * d, CAM_H, LOOK_AT.z + Math.cos(yaw) * d);
      cam.lookAt(LOOK_AT);
      cam.updateMatrixWorld();
      post.setDofFocus(cam.position.distanceTo(new THREE.Vector3(TURBINES[0].x, 4, TURBINES[0].z)));
      // rotors: whole multiples of 120 deg per loop (3-fold symmetry)
      turbines.forEach((tb) => { tb.rotor.rotation.z = -TAU * tb.revs * t; });
      groundMat.uniforms.time.value = t;
      spark.forEach((s, i) => {
        const u = (t * s.trips + s.phase) % 1;
        sparks.pos.set([s.x + 0.3 * Math.sin(TAU * u + s.sway), u * s.rise, s.z + 0.3 * Math.cos(TAU * u + s.sway)], i * 3);
        c.copy(dotsCol).lerp(new THREE.Color(1, 1, 1), 0.4);
        const a = Math.sin(Math.PI * u) ** 1.5;
        sparks.rgba.set([c.r * 2, c.g * 2, c.b * 2, a], i * 4);
        sparks.size[i] = s.size;
      });
      sparks.update();
      post.render(scene, cam, frame);
    },
    dispose() {
      post.dispose();
      gGeo.dispose();
      sparks.dispose();
      map.texture.dispose();
    },
  };
};

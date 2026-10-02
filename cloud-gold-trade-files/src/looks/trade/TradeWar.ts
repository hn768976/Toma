import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTexture, loadStudioEnv, makeCanvas } from "../../lib/assets";
import { PostFX } from "../../lib/post";
import { clamp, easeInOutCubic, easeOutCubic, lerp, mulberry32, smoothstep } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";
import type { TradeRow } from "../../versions";
import { countryShape } from "./countries";
import { drawFlag } from "./flags";

export const TRADE_FRAMES = 450;

const MAP_W = 5.3;
const LEFT_C = new THREE.Vector3(-3.05, 0, 1.5);
const RIGHT_C = new THREE.Vector3(3.35, 0, -0.5);

// ---- ground shader: slate with fine static cracks, fully procedural so it holds
// up at any resolution --------------------------------------------------------------
const groundCommon = /* glsl */ `
varying vec3 vWP;
vec2 h22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float h21(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
// distance to Voronoi cell edges -> thin crack network
float vedge(vec2 p) {
  vec2 n = floor(p), f = fract(p); vec2 mg, mr; float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 o = h22(n + g); vec2 r = g + o - f; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j)); vec2 o = h22(n + g); vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}
float crackMask(vec2 p) {
  vec2 w = p + 0.35 * vec2(fbm(p * 1.3), fbm(p * 1.3 + 9.0));
  float e1 = vedge(w * 0.3);
  float e2 = vedge(w * 0.9 + 3.0);
  float c1 = (1.0 - smoothstep(0.0, 0.014, e1)) * smoothstep(0.35, 0.5, vnoise(p * 0.35 + 2.0));
  float c2 = (1.0 - smoothstep(0.0, 0.01, e2)) * smoothstep(0.6, 0.72, vnoise(p * 0.6));
  return max(c1, c2 * 0.8);
}
float groundH(vec2 p) { return fbm(p * 2.2) * 0.6 + fbm(p * 9.0) * 0.25 - crackMask(p) * 0.6; }
`;

function groundMaterial(env: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.05, envMap: env, envMapIntensity: 0.25 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + groundCommon)
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
vec2 gp = vWP.xz;
float n1 = fbm(gp * 0.8);
float n2 = fbm(gp * 4.0 + 5.0);
vec3 slate = mix(vec3(0.013, 0.014, 0.017), vec3(0.04, 0.04, 0.045), n1);
slate *= 0.75 + 0.5 * n2;
slate += vec3(0.02) * step(0.93, h21(floor(gp * 60.0))) ;
float cm = crackMask(gp);
slate *= 1.0 - 0.85 * cm;
diffuseColor.rgb = slate;
`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `#include <normal_fragment_maps>
{
  float e = 0.01;
  float h0 = groundH(gp);
  float hx = groundH(gp + vec2(e, 0.0));
  float hz = groundH(gp + vec2(0.0, e));
  vec3 nw = normalize(vec3(-(hx - h0) / e * 0.05, 1.0, -(hz - h0) / e * 0.05));
  normal = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
}
`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = clamp(0.7 + 0.25 * n2, 0.0, 1.0);",
      );
  };
  return m;
}

function corrugationNormal(): THREE.Texture {
  const W = 256;
  const [c, ctx] = makeCanvas(W, 4);
  const img = ctx.createImageData(W, 4);
  for (let x = 0; x < W; x++) {
    // trapezoid corrugation profile -> slope -> normal
    const ph = (x / W) * Math.PI * 2;
    const slope = Math.cos(ph) * 0.9;
    const l = Math.hypot(slope, 1);
    for (let y = 0; y < 4; y++) {
      const o = (y * W + x) * 4;
      img.data[o] = ((slope / l) * 0.5 + 0.5) * 255;
      img.data[o + 1] = 128;
      img.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = canvasTexture(c, false);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 1);
  return t;
}

function dustTexture(): THREE.Texture {
  const N = 128;
  const rng = mulberry32(0xd057);
  const [c, ctx] = makeCanvas(N, N);
  for (let i = 0; i < 40; i++) {
    const x = N / 2 + (rng() - 0.5) * N * 0.4;
    const y = N / 2 + (rng() - 0.5) * N * 0.4;
    const r = N * (0.12 + rng() * 0.22);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, N, N);
  }
  return canvasTexture(c, true);
}

// ---- crack plan --------------------------------------------------------------------
type Crack = { pts: THREE.Vector2[]; wmax: number[]; t0: number; t1: number; widen: number };
function planCracks(): Crack[] {
  const rng = mulberry32(0xc4ac);
  const main: THREE.Vector2[] = [];
  const N = 160;
  let x = 0.25;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    x += (rng() - 0.5) * 0.16 - (x - 0.1 * Math.sin(s * 5.0)) * 0.05;
    main.push(new THREE.Vector2(x + (rng() - 0.5) * 0.06, lerp(7.5, -7.5, s)));
  }
  const wmain = main.map((_, i) => {
    const s = i / N;
    return 0.2 * (0.55 + 0.45 * rng()) * smoothstep(0, 0.04, s) * (1 - smoothstep(0.9, 1, s));
  });
  const cracks: Crack[] = [{ pts: main, wmax: wmain, t0: 120, t1: 300, widen: 1 }];
  // branches
  const branchAt = [0.22, 0.38, 0.55, 0.7, 0.84];
  branchAt.forEach((bs, k) => {
    const i0 = Math.round(bs * N);
    const dir = k % 2 === 0 ? 1 : -1;
    const pts: THREE.Vector2[] = [main[i0].clone()];
    let ang = dir * (0.9 + rng() * 0.6) + Math.PI; // heading roughly sideways and back
    const len = 18 + Math.floor(rng() * 16);
    for (let j = 1; j <= len; j++) {
      ang += (rng() - 0.5) * 0.5;
      const p = pts[j - 1];
      pts.push(new THREE.Vector2(p.x + Math.sin(ang) * 0.09 * -1, p.y + Math.cos(ang) * 0.09));
    }
    const wm = pts.map((_, j) => 0.075 * (1 - j / len) * (0.6 + 0.4 * rng()));
    const tStart = 120 + bs * 180 + 10;
    cracks.push({ pts, wmax: wm, t0: tStart, t1: tStart + 70, widen: 0.6 });
  });
  return cracks;
}

type Debris = { crack: number; s: number; vx: number; vy: number; vz: number; size: number; spin: THREE.Vector3; side: number };
type Puff = { x: number; z: number; t0: number; size: number; drift: number };

export const createTradeWar: LookFactory<TradeRow> = async ({ gl, width, height, props: row }) => {
  const env = await loadStudioEnv(gl);
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), groundMaterial(env));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- maps
  const sides = [
    { def: row.left, c: LEFT_C },
    { def: row.right, c: RIGHT_C },
  ];
  const mapGroups: THREE.Group[] = [];
  for (const sd of sides) {
    const { shapes, w, h } = await countryShape(sd.def.iso, MAP_W);
    const depth = 0.04 * w;
    const uvOf = (x: number, y: number) => new THREE.Vector2((x + w / 2) / w, (y + h / 2) / h);
    const UVGenerator = {
      generateTopUV(_g: unknown, v: number[], a: number, b: number, c: number) {
        return [uvOf(v[a * 3], v[a * 3 + 1]), uvOf(v[b * 3], v[b * 3 + 1]), uvOf(v[c * 3], v[c * 3 + 1])];
      },
      generateSideWallUV(_g: unknown, v: number[], a: number, b: number, c: number, d: number) {
        return [a, b, c, d].map((i) => uvOf(v[i * 3], v[i * 3 + 1]));
      },
    };
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.12,
      bevelSize: depth * 0.1,
      bevelSegments: 2,
      curveSegments: 1,
      UVGenerator: UVGenerator as never,
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    const flag = canvasTexture(drawFlag(sd.def.flag));
    if (sd.def.flagUV) {
      flag.repeat.set(sd.def.flagUV[2], sd.def.flagUV[2]);
      flag.offset.set(sd.def.flagUV[0], sd.def.flagUV[1]);
    }
    const top = new THREE.MeshStandardMaterial({ map: flag, roughness: 0.6, metalness: 0.0, envMap: env, envMapIntensity: 0.08 });
    const side = new THREE.MeshStandardMaterial({ map: flag, color: 0x8c8c8c, roughness: 0.65, envMap: env, envMapIntensity: 0.08 });
    const mesh = new THREE.Mesh(geo, [top, side]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.add(mesh);
    g.position.copy(sd.c);
    scene.add(g);
    mapGroups.push(g);
  }

  // ---- containers
  const corr = corrugationNormal();
  const cGeo = new RoundedBoxGeometry(2.5, 0.95, 1.0, 2, 0.03);
  type Box = { mesh: THREE.Mesh; x: number; y: number; z: number; ry: number; t0: number };
  const boxes: Box[] = [];
  const stack = (base: THREE.Vector3, color: string, t0: number, flip: number) => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.62,
      metalness: 0.3,
      normalMap: corr,
      normalScale: new THREE.Vector2(0.45, 0.45),
      envMap: env,
      envMapIntensity: 0.2,
    });
    const slots = [
      [0, 0, 0],
      [0, 0, 1.06],
      [0.08 * flip, 1, 0.5],
    ];
    slots.forEach(([dx, layer, dz], k) => {
      const m = new THREE.Mesh(cGeo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
      boxes.push({ mesh: m, x: base.x + dx, y: layer * 0.97 + 0.475, z: base.z + dz, ry: (k - 1) * 0.015 * flip, t0: t0 + k * 22 });
    });
  };
  stack(new THREE.Vector3(-3.5, 0, -2.3), row.left.containers, 40, 1);
  stack(new THREE.Vector3(1.9, 0, -4.4), row.right.containers, 52, -1);

  // ---- cracks (rebuilt from the frame each time; fixed topology)
  const cracks = planCracks();
  const crackMeshes = cracks.map((c) => {
    const n = c.pts.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 5 * 3), 3));
    const col = new Float32Array(n * 5 * 4);
    for (let i = 0; i < n; i++) {
      const cols = [
        [0.09, 0.09, 0.1, 0.0],
        [0.0, 0.0, 0.0, 0.92],
        [0.0, 0.0, 0.0, 1.0],
        [0.0, 0.0, 0.0, 0.92],
        [0.16, 0.16, 0.17, 0.0],
      ];
      cols.forEach((cc, j) => col.set(cc, (i * 5 + j) * 4));
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 4));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < 4; j++) {
        const a = i * 5 + j, b = a + 1, c2 = a + 5, d = c2 + 1;
        idx.push(a, c2, b, b, c2, d);
      }
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    );
    m.frustumCulled = false;
    m.renderOrder = 1;
    scene.add(m);
    return m;
  });
  const openAt = (c: Crack, f: number, i: number) => {
    const n = c.pts.length;
    const s = i / (n - 1);
    const front = easeInOutCubic((f - c.t0) / (c.t1 - c.t0)) * 1.1;
    const o = smoothstep(0, 0.1, front - s);
    const widen = c.widen * (0.45 + 0.55 * easeOutCubic((f - c.t0 - 30) / 200));
    return c.wmax[i] * o * widen;
  };

  // ---- debris + dust: seeded, pure functions of frame
  const drng = mulberry32(0xdeb2);
  const debris: Debris[] = Array.from({ length: 70 }, () => ({
    crack: drng() < 0.75 ? 0 : 1 + Math.floor(drng() * (cracks.length - 1)),
    s: 0.05 + drng() * 0.85,
    vx: (drng() - 0.5) * 0.05,
    vy: 0.03 + drng() * 0.06,
    vz: (drng() - 0.5) * 0.03,
    size: 0.025 + Math.pow(drng(), 2) * 0.08,
    spin: new THREE.Vector3(drng() - 0.5, drng() - 0.5, drng() - 0.5).multiplyScalar(0.4),
    side: drng() < 0.5 ? -1 : 1,
  }));
  const debMesh = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.85, flatShading: true }),
    debris.length,
  );
  debMesh.castShadow = true;
  debMesh.frustumCulled = false;
  scene.add(debMesh);
  const prng = mulberry32(0x9bff);
  const dustTex = dustTexture();
  const puffs: (Puff & { sprite: THREE.Sprite })[] = [];
  const addPuff = (p: Puff) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: dustTex, color: 0x9a948c, transparent: true, depthWrite: false, opacity: 0 }),
    );
    scene.add(sprite);
    puffs.push({ ...p, sprite });
  };
  // puffs along the main crack as it opens
  for (let k = 0; k < 28; k++) {
    const s = 0.05 + (k / 27) * 0.85 + (prng() - 0.5) * 0.03;
    const i = Math.round(s * (cracks[0].pts.length - 1));
    const p = cracks[0].pts[i];
    const front = (cracks[0].t1 - cracks[0].t0) / 1.1;
    addPuff({ x: p.x + (prng() - 0.5) * 0.3, z: p.y, t0: cracks[0].t0 + s * front * 0.95 + prng() * 10, size: 0.7 + prng() * 0.9, drift: prng() - 0.5 });
  }
  // landing puffs for containers
  boxes.forEach((b) => {
    for (let k = 0; k < 2; k++) addPuff({ x: b.x + (k ? 1.2 : -1.2), z: b.z + 0.4, t0: b.t0 + 16, size: 0.9, drift: k ? 0.4 : -0.4 });
  });

  // ---- lights: cool on the left, warm red on the right
  scene.add(new THREE.HemisphereLight(0x8090a8, 0x101010, 0.15));
  const cool = new THREE.SpotLight(new THREE.Color(row.left.light), 380, 60, 0.62, 0.7, 2);
  cool.position.set(-12, 12, 6);
  cool.target.position.set(-3, 0, 0);
  cool.castShadow = true;
  cool.shadow.mapSize.set(2048, 2048);
  cool.shadow.bias = -0.0003;
  cool.shadow.radius = 5;
  const warm = new THREE.SpotLight(new THREE.Color(row.right.light), 380, 60, 0.62, 0.7, 2);
  warm.position.set(12, 11, 5);
  warm.target.position.set(3, 0, 0);
  warm.castShadow = true;
  warm.shadow.mapSize.set(2048, 2048);
  warm.shadow.bias = -0.0003;
  warm.shadow.radius = 5;
  scene.add(cool, cool.target, warm, warm.target);
  const front = new THREE.DirectionalLight(0xfff4ea, 0.35);
  front.position.set(0, 10, 12);
  scene.add(front);

  const camera = new THREE.PerspectiveCamera(32, width / height, 0.3, 200);
  const post = new PostFX(gl, width, height, {
    exposure: 1.0,
    bloomStrength: 0.06,
    bloomThreshold: 1.0,
    bloomKnee: 0.6,
    dof: { focus: 16, nearK: 1.0, farK: 1.0, maxBlur: 0.006 },
    grain: 0.02,
    grainPeriod: TRADE_FRAMES,
    vignette: 0.5,
    clearColor: 0x050506,
  });

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const tmp2 = new THREE.Vector2();
  const nrm = new THREE.Vector2();

  return {
    render(frame) {
      const f = clamp(frame, 0, TRADE_FRAMES - 1);
      // maps rise 0..60, then rock very slightly after 330
      mapGroups.forEach((g, k) => {
        const r = easeOutCubic((f - k * 8) / 52);
        g.position.y = lerp(-0.6, 0, r) + 0.02 * Math.sin(Math.PI * clamp((f - k * 8) / 60)) * (1 - r);
        const rock = clamp((f - 330) / 120);
        const amp = 0.006 * Math.sin(Math.PI * rock);
        g.rotation.set(amp * Math.sin(f * 0.11 + k * 2), 0, amp * Math.cos(f * 0.09 + k));
      });
      // containers drop 40..120
      boxes.forEach((b) => {
        const tau = f - b.t0;
        const FALL = 16;
        let y = b.y;
        if (tau < 0) y = b.y + 30;
        else if (tau < FALL) {
          const s = tau / FALL;
          y = b.y + 6 * (1 - s * s);
        } else if (tau < FALL + 10) {
          const s = (tau - FALL) / 10;
          y = b.y + 0.07 * Math.sin(Math.PI * s);
        }
        b.mesh.position.set(b.x, y, b.z);
        b.mesh.rotation.set(0, b.ry, 0);
        b.mesh.visible = tau >= 0;
      });
      // cracks
      cracks.forEach((c, ci) => {
        const pos = crackMeshes[ci].geometry.attributes.position as THREE.BufferAttribute;
        const n = c.pts.length;
        for (let i = 0; i < n; i++) {
          const a = c.pts[Math.max(0, i - 1)], b = c.pts[Math.min(n - 1, i + 1)];
          tmp2.subVectors(b, a).normalize();
          nrm.set(-tmp2.y, tmp2.x);
          const w = openAt(c, f, i);
          const p = c.pts[i];
          const lip = w > 0 ? 0.02 + w * 0.35 : 0;
          const offs = [-(w / 2 + lip), -w / 2 * 0.8, 0, w / 2 * 0.8, w / 2 + lip];
          offs.forEach((o, j) => pos.setXYZ(i * 5 + j, p.x + nrm.x * o, 0.004 + (j === 2 ? 0.0 : 0.0), p.y + nrm.y * o));
        }
        pos.needsUpdate = true;
      });
      // debris: fly out of the crack when the front passes, land, settle
      debris.forEach((d, i) => {
        const c = cracks[d.crack];
        const n = c.pts.length;
        const idx = Math.round(d.s * (n - 1));
        const front = (c.t1 - c.t0) / 1.1;
        const tb = c.t0 + d.s * front;
        const tt = f - tb;
        if (tt < 0) {
          debMesh.setMatrixAt(i, m4.makeScale(0, 0, 0));
          return;
        }
        const p = c.pts[idx];
        const g = 0.004;
        const tLand = (2 * d.vy) / g;
        const t = Math.min(tt, tLand);
        const side = d.side * (0.05 + Math.abs(d.vx) * t);
        pv.set(p.x + side, d.size * 0.6 + d.vy * t - 0.5 * g * t * t, p.y + d.vz * t);
        const spinT = tt < tLand ? tt : tLand + 6 * (1 - Math.exp(-(tt - tLand) / 6));
        e.set(d.spin.x * spinT, d.spin.y * spinT, d.spin.z * spinT);
        q.setFromEuler(e);
        sv.set(d.size, d.size * 0.7, d.size);
        m4.compose(pv, q, sv);
        debMesh.setMatrixAt(i, m4);
      });
      debMesh.instanceMatrix.needsUpdate = true;
      // dust puffs: grow, drift, fade; settled by the end
      puffs.forEach((p) => {
        const tt = f - p.t0;
        const L = 95;
        const s = clamp(tt / L);
        p.sprite.visible = tt > 0 && tt < L;
        const sz = p.size * (0.4 + 1.6 * easeOutCubic(s));
        p.sprite.scale.set(sz, sz * 0.7, 1);
        p.sprite.position.set(p.x + p.drift * 0.6 * s, 0.15 + 0.45 * easeOutCubic(s), p.z);
        p.sprite.material.opacity = 0.32 * smoothstep(0, 0.08, s) * (1 - smoothstep(0.25, 1, s));
        p.sprite.material.rotation = p.drift * 2 * s;
      });
      // camera: ~50 degrees above, slow push and drift
      const c = easeInOutCubic(f / (TRADE_FRAMES - 1)) * 0.7 + (f / (TRADE_FRAMES - 1)) * 0.3;
      const dist = lerp(15.2, 13.4, c);
      const el = THREE.MathUtils.degToRad(lerp(52, 49, c));
      const az = lerp(-0.07, 0.06, c);
      const tgt = new THREE.Vector3(0.2, 0, -1.0);
      camera.position.set(tgt.x + dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), tgt.z + dist * Math.cos(el) * Math.cos(az));
      camera.lookAt(tgt);
      camera.updateMatrixWorld();
      post.opts.dof!.focus = dist;
      post.render(scene, camera, f);
    },
  };
};

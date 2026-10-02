import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { canvasTexture, loadStudioEnv, makeCanvas } from "../../lib/assets";
import { PostFX } from "../../lib/post";
import { clamp, easeInOutCubic, easeOutCubic, lerp, mulberry32, smoothstep } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";
import type { GoldRow } from "../../versions";

export const GOLD_FRAMES = 360;

// ---- bar + layout constants ------------------------------------------------------
const BAR_L = 2.1; // along z (towards camera)
const BAR_W = 0.95; // along x
const BAR_H = 0.58;
const TOP_TAPER = 0.8; // classic ingot: top face ~80% of the base, sloped sides
const COL_DX = 1.3;
const COL_DZ = -0.38; // each column a little further back
const BAR_YAW = 0.5; // bars turned so their end faces catch the camera
const GOLD = "#E8B04A";
const ENV_ROT = 1.57; // studio HDRI yaw for the bars: softboxes land in their faces
const FALL_ENV_ROT = 4.71; // mirrored scene needs its own HDRI yaw
const ARROW_ENV_ROT = 0; // the curved arrow catches them at a different yaw

type BarPlan = { col: number; layer: number; jx: number; jz: number; ry: number; start: number; var: number };

function planBars(columns: number[], reverseOrder: boolean): BarPlan[] {
  const rng = mulberry32(0x601d + columns.length * 17 + columns[0]);
  const total = columns.reduce((a, b) => a + b, 0);
  const bars: BarPlan[] = [];
  let k = 0;
  const order = columns.map((_, i) => i);
  if (reverseOrder) order.reverse();
  order.forEach((col) => {
    const n = columns[col];
    for (let layer = 0; layer < n; layer++) {
      bars.push({
        col,
        layer,
        jx: (rng() - 0.5) * 0.14,
        jz: (rng() - 0.5) * 0.12,
        ry: BAR_YAW + (rng() - 0.5) * 0.14,
        // drops land between frames 20 and 210, left to right, bottom to top
        start: 20 + (k / Math.max(1, total - 1)) * 176,
        var: rng(),
      });
      k++;
    }
  });
  return bars;
}

function ingotGeometry(): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(BAR_W, BAR_H, BAR_L, 5, 0.07);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = (y + BAR_H / 2) / BAR_H; // 0 bottom .. 1 top
    const s = lerp(1, TOP_TAPER, t);
    p.setX(i, p.getX(i) * s);
    p.setZ(i, p.getZ(i) * lerp(1, 0.86, t));
  }
  g.translate(0, BAR_H / 2, 0); // origin at the bottom face
  g.computeVertexNormals();
  return g;
}

/** Fine scratches + brushed noise: roughness map and a normal map. */
function scratchMaps(): { rough: THREE.Texture; normal: THREE.Texture } {
  const N = 1024;
  const rng = mulberry32(0x5c4a7c);
  const [hc, hx] = makeCanvas(N, N);
  hx.fillStyle = "rgb(128,128,128)";
  hx.fillRect(0, 0, N, N);
  // brushed streaks
  for (let i = 0; i < 1400; i++) {
    const y = rng() * N;
    const v = 118 + rng() * 20;
    hx.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    hx.lineWidth = 0.5 + rng() * 1.5;
    hx.beginPath();
    hx.moveTo(0, y);
    hx.lineTo(N, y + (rng() - 0.5) * 6);
    hx.stroke();
  }
  // scratches: short random strokes
  for (let i = 0; i < 900; i++) {
    const x = rng() * N, y = rng() * N, a = rng() * Math.PI, l = 10 + rng() * 120;
    const v = rng() < 0.5 ? 90 : 170;
    hx.strokeStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.5})`;
    hx.lineWidth = 0.6 + rng() * 0.8;
    hx.beginPath();
    hx.moveTo(x, y);
    hx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (rng() - 0.5) * 8, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    hx.stroke();
  }
  const h = hx.getImageData(0, 0, N, N).data;
  const [nc, nx] = makeCanvas(N, N);
  const nimg = nx.createImageData(N, N);
  const [rc, rx] = makeCanvas(N, N);
  const rimg = rx.createImageData(N, N);
  const H = (x: number, y: number) => h[(((y + N) % N) * N + ((x + N) % N)) * 4] / 255;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 2.0;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 2.0;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * N + x) * 4;
      nimg.data[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      nimg.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      nimg.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      nimg.data[o + 3] = 255;
      const dev = Math.abs(H(x, y) - 0.5);
      const r = clamp(0.62 + dev * 1.4) * 255; // scratches rougher; multiplied by material roughness
      rimg.data[o] = rimg.data[o + 1] = rimg.data[o + 2] = r;
      rimg.data[o + 3] = 255;
    }
  }
  nx.putImageData(nimg, 0, 0);
  rx.putImageData(rimg, 0, 0);
  const normal = canvasTexture(nc, false);
  const rough = canvasTexture(rc, false);
  [normal, rough].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
  });
  return { rough, normal };
}

function goldMaterial(env: THREE.Texture, maps: { rough: THREE.Texture; normal: THREE.Texture }, roughness: number) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(GOLD),
    metalness: 1,
    roughness,
    roughnessMap: maps.rough,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    envMap: env,
    envMapIntensity: 1.35,
  });
  return m;
}

/** Per-instance roughness variation via an instanced attribute. */
function addRoughnessVariation(m: THREE.MeshPhysicalMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aVar; varying float vVar;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvVar = aVar;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vVar;")
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor * (0.78 + 0.5 * vVar), 0.16, 0.42);",
      );
  };
}

const arrowClip = (m: THREE.MeshPhysicalMaterial, uP: { value: number }, reverse: boolean) => {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uP = uP;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aS; varying float vS;")
      .replace("#include <begin_vertex>", reverse ? "#include <begin_vertex>\nvS = 1.0 - aS;" : "#include <begin_vertex>\nvS = aS;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uP; varying float vS;")
      .replace("void main() {", "void main() {\n if (vS > uP) discard;");
  };
};

function arrowCurve(columns: number[], dir: "rising" | "falling", z: number, x0 = -0.75, y0 = 0.3): THREE.CatmullRomCurve3 {
  const x1 = (columns.length - 1) * COL_DX - 0.15; // head overlaps the tallest stack
  const top = Math.max(...columns) * BAR_H * 0.72;
  const pts: THREE.Vector3[] = [];
  const k = 2.7;
  for (let i = 0; i <= 24; i++) {
    const s = i / 24;
    const e = (Math.exp(k * s) - 1) / (Math.exp(k) - 1);
    const y = dir === "rising" ? y0 + (top - y0) * e : top - (top - y0) * e;
    const x = lerp(x0, x1, s);
    pts.push(new THREE.Vector3(x, y, z + (COL_DZ * x) / COL_DX));
  }
  return new THREE.CatmullRomCurve3(pts, false, "centripetal");
}

/** Swept rounded-rectangle band (wide in the curve plane), with arc param aS. */
function bandGeometry(curve: THREE.CatmullRomCurve3, w: number, t: number): THREE.BufferGeometry {
  const SEG = 400;
  const RING = 16;
  const pos: number[] = [];
  const nor: number[] = [];
  const as: number[] = [];
  const idx: number[] = [];
  const zAxis = new THREE.Vector3(0, 0, 1);
  // rounded-rect profile in (n, z): superellipse
  const prof: [number, number, number, number][] = [];
  for (let j = 0; j < RING; j++) {
    const a = (j / RING) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    const pe = 0.45;
    const px = Math.sign(c) * Math.pow(Math.abs(c), pe) * (w / 2);
    const pz = Math.sign(s) * Math.pow(Math.abs(s), pe) * (t / 2);
    // normal of superellipse ~ gradient
    const nx = Math.sign(c) * Math.pow(Math.abs(c), 2 - pe) / (w / 2);
    const nz = Math.sign(s) * Math.pow(Math.abs(s), 2 - pe) / (t / 2);
    const l = Math.hypot(nx, nz) || 1;
    prof.push([px, pz, nx / l, nz / l]);
  }
  for (let i = 0; i <= SEG; i++) {
    const u = i / SEG;
    const p = curve.getPointAt(u);
    const tg = curve.getTangentAt(u);
    const n = new THREE.Vector3().crossVectors(zAxis, tg).normalize();
    for (let j = 0; j < RING; j++) {
      const [px, pz, nx, nz] = prof[j];
      pos.push(p.x + n.x * px, p.y + n.y * px, p.z + pz);
      const nn = new THREE.Vector3().addScaledVector(n, nx).addScaledVector(zAxis, nz).normalize();
      nor.push(nn.x, nn.y, nn.z);
      as.push(u);
    }
    if (i < SEG) {
      for (let j = 0; j < RING; j++) {
        const a = i * RING + j, b = i * RING + ((j + 1) % RING), c = a + RING, d = b + RING;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(as, 1));
  g.setIndex(idx);
  return g;
}

function headGeometry(len: number, base: number, t: number): THREE.BufferGeometry {
  const sh = new THREE.Shape();
  sh.moveTo(0, -base / 2);
  sh.lineTo(len, 0);
  sh.lineTo(0, base / 2);
  sh.lineTo(0.12 * len, 0);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: t, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 4 });
  g.translate(-0.1 * len, 0, -t / 2);
  const n = g.attributes.position.count;
  g.setAttribute("aS", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  g.computeVertexNormals();
  return g;
}

const bgVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const bgFrag = /* glsl */ `
uniform vec3 uWarm; varying vec2 vUv;
void main() {
  vec2 d = (vUv - vec2(0.6, 0.45)) * vec2(2.0, 1.6);
  float g = exp(-dot(d, d) * 18.0);
  vec3 c = uWarm * g + vec3(0.004, 0.003, 0.002);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const createGoldBarChart: LookFactory<GoldRow> = async ({ gl, width, height, props: row }) => {
  const env = await loadStudioEnv(gl);
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.environment = env;
  scene.environmentIntensity = 1;

  // Falling is built as the exact mirror image of Rising: the scene is laid out
  // rising in local space and the whole root is mirrored in x, so on screen the
  // columns get shorter left to right and the arrow curves down to the right.
  const falling = row.direction === "falling";
  const sgn = falling ? -1 : 1;
  const columns = falling ? [...row.columns].reverse() : row.columns;
  const bars = planBars(columns, falling);
  const root = new THREE.Group();
  root.scale.x = sgn;
  scene.add(root);
  const maps = scratchMaps();

  // ---- bars: one InstancedMesh + a mirrored copy for the floor reflection
  const ingot = ingotGeometry();
  const aVar = new THREE.InstancedBufferAttribute(new Float32Array(bars.map((b) => b.var)), 1);
  ingot.setAttribute("aVar", aVar);
  const goldMat = goldMaterial(env, maps, 0.3);
  if (falling) goldMat.envMapIntensity = 0.8;
  addRoughnessVariation(goldMat);
  const mesh = new THREE.InstancedMesh(ingot, goldMat, bars.length);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const tint = new THREE.Color();
  bars.forEach((b, i) => {
    tint.setRGB(1, 0.97 + 0.03 * b.var, 0.93 + 0.07 * b.var);
    mesh.setColorAt(i, tint);
  });
  root.add(mesh);
  const mirror = new THREE.Group();
  mirror.scale.y = -1;
  const mMesh = new THREE.InstancedMesh(ingot, goldMat, bars.length);
  mMesh.instanceMatrix = mesh.instanceMatrix;
  mMesh.instanceColor = mesh.instanceColor;
  mMesh.frustumCulled = false;
  mirror.add(mMesh);
  root.add(mirror);

  // ---- arrow
  const uP = { value: 0 };
  const zArrow = BAR_L / 2 + 0.55;
  // falling: the head ends a little higher and further in, so it stays in frame
  const curve = falling ? arrowCurve(columns, "rising", zArrow, 0.25, 0.75) : arrowCurve(columns, "rising", zArrow);
  const arrowMat = goldMaterial(env, maps, 0.3);
  arrowMat.envMapIntensity = 0.32;
  arrowMat.normalScale.set(0.12, 0.12);
  arrowClip(arrowMat, uP, falling);
  const band = new THREE.Mesh(bandGeometry(curve, 0.42, 0.075), arrowMat);
  band.castShadow = true;
  // head is never clipped; it rides the drawing tip
  const headMat = goldMaterial(env, maps, 0.3);
  headMat.envMapIntensity = arrowMat.envMapIntensity;
  headMat.normalScale.set(0.12, 0.12);
  const head = new THREE.Mesh(headGeometry(1.45, 1.35, 0.075), headMat);
  head.castShadow = true;
  const arrow = new THREE.Group();
  arrow.add(band, head);
  root.add(arrow);
  const mArrow = new THREE.Group();
  mArrow.add(new THREE.Mesh(band.geometry, arrowMat), new THREE.Mesh(head.geometry, headMat));
  mirror.add(mArrow);

  // ---- floor: dark gloss, semi-transparent over the mirrored copies
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x030201,
      roughness: 0.45,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
      envMap: env,
      envMapIntensity: 0.0,
    }),
  );
  floor.receiveShadow = true;
  root.add(floor);

  // ---- background warm glow
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 60),
    new THREE.ShaderMaterial({ vertexShader: bgVert, fragmentShader: bgFrag, uniforms: { uWarm: { value: new THREE.Color(0.018, 0.012, 0.007) } }, depthWrite: false }),
  );
  bg.position.set(10, 10, -30);
  root.add(bg);

  // ---- lights
  const key = new THREE.SpotLight(0xffb868, 90, 60, 0.55, 0.8, 2);
  key.position.set(-6, 11, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  root.add(key, key.target);
  const rim = new THREE.SpotLight(0xffa850, 45, 60, 0.6, 0.8, 2);
  rim.position.set(14, 9, -10);
  root.add(rim, rim.target);
  rim.target.position.set(5, 2, 0);
  const glint = new THREE.PointLight(0xfff0d0, 0, 12, 2);
  root.add(glint);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.3, 200);
  // the last column on screen is local column 0 when mirrored
  const lastCol = falling ? 0 : columns.length - 1;
  const tumbleN = falling ? 2 : 0;
  const tumbleRng = mulberry32(0x7b1e);
  // tumble outwards (local -x when mirrored = screen right)
  const tdir = falling ? -1 : 1;
  const tumble = Array.from({ length: tumbleN }, (_, k) => ({ start: 292 + k * 10, dx: tdir * (0.8 + tumbleRng() * 0.3 + k * 0.5), dz: 0.9 + tumbleRng() * 0.5 + k * 0.3 }));

  const post = new PostFX(gl, width, height, {
    exposure: 1.05,
    bloomStrength: 0.12,
    bloomThreshold: 2.5,
    bloomKnee: 0.8,
    bloomWeights: [0.6, 0.8, 1, 1, 0.8, 0.6],
    dof: { focus: 9, nearK: 1.6, farK: 1.4, maxBlur: 0.02 },
    grain: 0.02,
    grainPeriod: GOLD_FRAMES,
    vignette: 0.45,
    clearColor: 0x020101,
  });

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  return {
    render(frame) {
      const f = clamp(frame, 0, GOLD_FRAMES - 1);
      // bars
      bars.forEach((b, i) => {
        const tau = f - b.start;
        if (tau < 0) {
          mesh.setMatrixAt(i, zero);
          return;
        }
        const x = b.col * COL_DX + b.jx;
        const y0 = b.layer * BAR_H;
        const FALL = 11;
        let y = y0;
        let tilt = 0;
        if (tau < FALL) {
          const s = tau / FALL;
          y = y0 + 3.2 * (1 - s * s);
          tilt = (1 - s) * 0.08 * (b.var - 0.5);
        } else if (tau < FALL + 9) {
          const s = (tau - FALL) / 9;
          y = y0 + 0.06 * Math.sin(Math.PI * s) * (1 - s * 0.3);
        }
        e.set(tilt, b.ry, tilt * 0.6);
        pv.set(x, y, b.jz + b.col * COL_DZ);
        // falling version: the last column's top bars tumble off near the end
        if (tumbleN && b.col === lastCol && b.layer >= columns[lastCol] - tumbleN) {
          const k = columns[lastCol] - 1 - b.layer;
          const T = tumble[k];
          const tt = f - T.start;
          if (tt > 0) {
            const D = 26;
            const s = clamp(tt / D);
            // tip over the right edge, fall in an arc, land upside down
            const yTop = y0;
            const land = 0;
            const sx = easeOutCubic(s);
            const arc = Math.sin(Math.PI * Math.min(1, s * 1.15)) * 0.35;
            const fallS = s * s;
            pv.set(x + T.dx * sx, lerp(yTop, land + BAR_H, fallS) + arc, b.jz + b.col * COL_DZ + T.dz * sx);
            e.set(0, b.ry + 0.4 * sx * tdir, -tdir * Math.PI * easeInOutCubic(Math.min(1, s * 1.1)), "YXZ");
            if (tt > D) {
              const s2 = clamp((tt - D) / 8);
              pv.y = land + BAR_H + 0.05 * Math.sin(Math.PI * s2) * (1 - s2);
            }
          }
        }
        q.setFromEuler(e);
        m4.compose(pv, q, sv);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;

      // arrow draw-on 150..270
      const p = easeInOutCubic((f - 150) / 120);
      uP.value = p;
      arrow.visible = p > 0.001;
      mArrow.visible = arrow.visible;
      // falling draws the same local curve from its far end
      const hp = falling ? Math.min(0.999, 1 - p) : Math.max(0.001, p);
      const hpos = curve.getPointAt(hp);
      const tg = curve.getTangentAt(hp).multiplyScalar(falling ? -1 : 1);
      const hs = smoothstep(0.0, 0.06, p);
      [head, mArrow.children[1]].forEach((h) => {
        h.position.copy(hpos);
        h.rotation.set(0, 0, Math.atan2(tg.y, tg.x));
        h.scale.setScalar(hs);
      });

      // lights: a pool of light sweeps the empty surface, then settles
      const ls = easeInOutCubic(f / 70);
      key.target.position.set(lerp(-4, 3.6, ls), 0, lerp(3, 0, ls));
      key.target.updateMatrixWorld();
      key.intensity = lerp(50, 90, ls);
      // glint sweeps across the bars 270..360
      const g = clamp((f - 270) / 90);
      glint.position.set(lerp(-2, (columns.length - 1) * COL_DX + 2, g), 6.5, 4.5);
      glint.intensity = 30 * Math.sin(Math.PI * g);
      scene.environmentRotation.y = (falling ? FALL_ENV_ROT : ENV_ROT) + sgn * 0.35 * easeInOutCubic(g);
      goldMat.envMapRotation.y = scene.environmentRotation.y;
      arrowMat.envMapRotation.y = sgn * (ARROW_ENV_ROT + 0.35 * easeInOutCubic(g));
      headMat.envMapRotation.y = arrowMat.envMapRotation.y;

      // camera: slow push in with a sideways drift
      const c = easeInOutCubic(f / (GOLD_FRAMES - 1)) * 0.8 + (f / (GOLD_FRAMES - 1)) * 0.2;
      if (falling) {
        // mirrored framing, slightly wider and lower so the arrow head and the
        // tumbling bars (bottom right) stay in frame
        camera.position.set(-lerp(0.4, 1.0, c), lerp(4.4, 4.2, c), lerp(12.4, 11.4, c));
        camera.lookAt(-lerp(3.2, 3.6, c), lerp(2.6, 2.8, c), -1.4);
      } else {
        camera.position.set(lerp(0.9, 1.5, c), lerp(3.6, 3.4, c), lerp(8.0, 7.2, c));
        camera.lookAt(lerp(4.4, 4.8, c), lerp(3.2, 3.4, c), -1.4);
      }
      camera.updateMatrixWorld();
      // focus on the middle stacks
      post.opts.dof!.focus = camera.position.distanceTo(new THREE.Vector3(sgn * 3.5 * COL_DX, 2.0, 3 * COL_DZ + 1.0));
      post.render(scene, camera, f);
    },
  };
};

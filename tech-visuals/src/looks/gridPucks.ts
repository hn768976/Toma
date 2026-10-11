import * as THREE from "three";
import { easeInOut, TAU } from "../lib/ease";
import { Look } from "../lib/LookCanvas";
import { Pipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";

export type GridPucksPalette = {
  surfaceLow: string; // bottom of frame
  surfaceHigh: string; // top of frame
  line: string;
  lineAlpha: number;
  pucks: string[];
  shadow: number; // contact-shadow opacity
  vignette: number;
  vignetteColor: string;
};

export const SLATE: GridPucksPalette = {
  surfaceLow: "#4A5A6E",
  surfaceHigh: "#5A6A7E",
  line: "#8A9AAE",
  lineAlpha: 0.6,
  pucks: ["#F0B88A", "#F4C870", "#C8C0E0", "#7AB8E8", "#E8B8C8"],
  shadow: 0.5,
  vignette: 0.08,
  vignetteColor: "#2A3646",
};

export const WHITE: GridPucksPalette = {
  surfaceLow: "#EEEEF0",
  surfaceHigh: "#F6F6F8",
  line: "#BCBCC4",
  lineAlpha: 0.6,
  pucks: ["#9A7AE8", "#C87AD8", "#F0A04A", "#E8A88A", "#7A8AE8"],
  shadow: 0.3,
  vignette: 0.16,
  vignetteColor: "#D4D4DA",
};

// ---- Layout constants -------------------------------------------------------
export const LOOP = 600;
const PATCH = 40; // cells per periodic patch side
const PUCKS_PER_PATCH = 400;
const TILES = 1; // patches drawn each side of the centre patch (3×3 covers the whole view)
const PUCK_R = 0.17;
const PUCK_H = 0.045;
const SLIDE = 14; // frames per one-cell slide
const MOVER_SHARE = 0.66; // remaining pucks rest the whole loop → ~20% moving at any frame

type Walk = {
  path: [number, number][]; // lattice position after each move (path[0] = start)
  moves: number[]; // start frame of each slide (loop time, before phase)
  phase: number;
  color: number;
};

const wrap = (v: number) => ((v % PATCH) + PATCH) % PATCH;

/** Lattice position of a walk at loop time t (integer frames). Also returns slide progress. */
const walkAt = (w: Walk, t: number): { a: [number, number]; b: [number, number]; k: number } => {
  let i = 0;
  while (i < w.moves.length && t >= w.moves[i] + SLIDE) i++;
  if (i < w.moves.length && t >= w.moves[i]) {
    return { a: w.path[i], b: w.path[i + 1], k: easeInOut((t - w.moves[i]) / SLIDE) };
  }
  return { a: w.path[i], b: w.path[i], k: 0 };
};

// ---- Seeded closed walks (module level → identical in every render thread) ----
// Each walk is a random closed lattice walk (equal +x/−x and +z/−z steps, shuffled), so it
// returns to its start after exactly 600 frames. Walks are placed greedily against a
// time × intersection occupancy table (on the 40×40 torus), so no two pucks ever share
// or swap an intersection — collisions are impossible by construction.
const buildWalks = (): Walk[] => {
  const rnd = mulberry32(0x9e3779b1);
  const occ = new Uint8Array(LOOP * PATCH * PATCH);
  const cell = (x: number, z: number) => wrap(x) * PATCH + wrap(z);
  const walks: Walk[] = [];
  const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let guard = 0;
  while (walks.length < PUCKS_PER_PATCH && guard++ < 20000) {
    const sx = Math.floor(rnd() * PATCH);
    const sz = Math.floor(rnd() * PATCH);
    const mover = rnd() < MOVER_SHARE;
    const steps: [number, number][] = [];
    if (mover) {
      const n = 12 + 2 * Math.floor(rnd() * 2); // 12 or 14 moves
      const a = 1 + Math.floor(rnd() * (n / 2 - 1));
      const b = n / 2 - a;
      for (let i = 0; i < a; i++) steps.push(dirs[0], dirs[1]);
      for (let i = 0; i < b; i++) steps.push(dirs[2], dirs[3]);
      for (let i = steps.length - 1; i > 0; i--) {
        const k = Math.floor(rnd() * (i + 1));
        [steps[i], steps[k]] = [steps[k], steps[i]];
      }
    }
    const n = steps.length;
    const moves: number[] = [];
    if (n) {
      // pauses of 10–40 frames; slides + pauses sum to exactly 600
      const pauses = new Array(n).fill(10);
      let left = LOOP - n * SLIDE - 10 * n;
      while (left > 0) {
        const k = Math.floor(rnd() * n);
        if (pauses[k] < 40) {
          pauses[k]++;
          left--;
        }
      }
      let t = pauses[n - 1]; // last pause wraps around the loop start
      for (let i = 0; i < n; i++) {
        moves.push(t);
        t += SLIDE + (i < n - 1 ? pauses[i] : 0);
      }
    }
    const path: [number, number][] = [[sx, sz]];
    for (const [dx, dz] of steps) {
      const [px, pz] = path[path.length - 1];
      path.push([px + dx, pz + dz]);
    }
    const w: Walk = { path, moves, phase: Math.floor(rnd() * LOOP), color: Math.floor(rnd() * 1e6) };
    // test occupancy (current + destination, plus their 4-neighbourhood guard while sliding)
    const cellsAt = (t: number) => {
      const s = walkAt(w, (t + w.phase) % LOOP);
      return s.a === s.b ? [cell(s.a[0], s.a[1])] : [cell(s.a[0], s.a[1]), cell(s.b[0], s.b[1])];
    };
    let ok = true;
    for (let t = 0; t < LOOP && ok; t++) for (const c of cellsAt(t)) if (occ[t * PATCH * PATCH + c]) ok = false;
    if (!ok) continue;
    for (let t = 0; t < LOOP; t++) for (const c of cellsAt(t)) occ[t * PATCH * PATCH + c] = 1;
    walks.push(w);
  }
  return walks;
};
const WALKS = buildWalks();

/** Position of a puck (within its patch, centred) at a frame. Pure function of frame. */
const puckPos = (w: Walk, frame: number, out: THREE.Vector2) => {
  const t = (((frame + w.phase) % LOOP) + LOOP) % LOOP;
  const s = walkAt(w, t);
  const x = s.a[0] + (s.b[0] - s.a[0]) * s.k;
  const z = s.a[1] + (s.b[1] - s.a[1]) * s.k;
  // keep each walk's start inside the patch; the walk itself may roam across the patch seam
  out.set(x - PATCH / 2, z - PATCH / 2);
  return out;
};

const puckGeometry = () => {
  const r = PUCK_R;
  const h = PUCK_H;
  const b = 0.022;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, b + Math.sin(a) * b));
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, h - b + Math.sin(a) * b));
  }
  // gentle dome on top
  for (let i = 1; i <= 6; i++) {
    const u = 1 - i / 6;
    pts.push(new THREE.Vector2((r - b) * u, h + 0.016 * (1 - u * u)));
  }
  const g = new THREE.LatheGeometry(pts, 32);
  g.computeVertexNormals();
  return g;
};

const GROUND_VERT = /* glsl */ `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const GROUND_FRAG = /* glsl */ `
uniform vec3 cLow; uniform vec3 cHigh; uniform vec3 cLine; uniform float lineAlpha; uniform float lineW;
uniform vec2 res;
varying vec3 vW;
void main() {
  vec2 uv = vW.xz;
  // Anti-aliased procedural grid (constant world width, coverage-correct when sub-pixel → no crawl).
  vec2 deriv = fwidth(uv);
  vec2 lw = vec2(lineW);
  vec2 drawW = clamp(lw, deriv, vec2(0.5));
  vec2 aa = deriv * 1.5;
  vec2 g = 1.0 - abs(fract(uv) * 2.0 - 1.0);
  vec2 gl2 = smoothstep(drawW + aa, drawW - aa, g);
  gl2 *= clamp(lw / drawW, 0.0, 1.0);
  gl2 = mix(gl2, lw, clamp(deriv * 2.0 - 1.0, 0.0, 1.0));
  float line = mix(gl2.x, 1.0, gl2.y);
  float y = gl_FragCoord.y / res.y;
  vec3 base = mix(cLow, cHigh, smoothstep(0.0, 1.0, y));
  gl_FragColor = vec4(mix(base, cLine, line * lineAlpha), 1.0);
}
`;

const SHADOW_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 p = vec4(position.x, 0.0, position.y, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * p;
}
`;
const SHADOW_FRAG = /* glsl */ `
uniform float opacity; uniform float r;
varying vec2 vP;
void main() {
  float d = length(vP) / r;
  float a = exp(-d * d * 2.2) * opacity;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

export const createGridPucks = (pal: GridPucksPalette) => (): Look => {
  const pipe = new Pipeline(4);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(17, 16 / 9, 0.5, 200);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: {
        cLow: { value: new THREE.Color(pal.surfaceLow) },
        cHigh: { value: new THREE.Color(pal.surfaceHigh) },
        cLine: { value: new THREE.Color(pal.line) },
        lineAlpha: { value: pal.lineAlpha },
        lineW: { value: 0.01 },
        res: { value: new THREE.Vector2(1, 1) },
      },
    }),
  );
  scene.add(ground);

  const tiles = (2 * TILES + 1) ** 2;
  const count = WALKS.length * tiles;
  const pucks = new THREE.InstancedMesh(
    puckGeometry(),
    new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0 }),
    count,
  );
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(PUCK_R * 4.2, PUCK_R * 4.2),
    new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      uniforms: { opacity: { value: pal.shadow }, r: { value: PUCK_R * 1.45 } },
      transparent: true,
      depthWrite: false,
    }),
    count,
  );
  shadows.renderOrder = 1;
  pucks.renderOrder = 2;
  const colors = pal.pucks.map((c) => new THREE.Color(c));
  let n = 0;
  for (let ti = -TILES; ti <= TILES; ti++)
    for (let tj = -TILES; tj <= TILES; tj++)
      for (const w of WALKS) pucks.setColorAt(n++, colors[w.color % colors.length]);
  scene.add(shadows, pucks);

  scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(pal.surfaceLow), 1.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(-4, 7, -3);
  scene.add(key);

  const m = new THREE.Matrix4();
  const v2 = new THREE.Vector2();
  const clear = new THREE.Color(pal.surfaceLow);
  const frustum = new THREE.Frustum();
  const projView = new THREE.Matrix4();
  const sphere = new THREE.Sphere(new THREE.Vector3(), PUCK_R * 3);
  const shadowOff = new THREE.Vector2(0.035, 0.03);

  return {
    render(gl, frame) {
      const t = (((frame % LOOP) + LOOP) % LOOP) / LOOP; // frame 600 ≡ frame 0 exactly
      // One closed camera lap per loop.
      const target = new THREE.Vector3(0.9 * Math.cos(TAU * t), 0, 0.6 * Math.sin(TAU * t));
      const yaw = THREE.MathUtils.degToRad(30 + 2.5 * Math.sin(TAU * t));
      const pitch = THREE.MathUtils.degToRad(31);
      const dist = 12.5;
      camera.position.set(
        target.x - Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      camera.lookAt(target);
      camera.updateMatrixWorld();
      // contact shadow falls toward screen lower-right (key light from upper-left, behind)
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
      const toward = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).setY(0).normalize();
      shadowOff.set(right.x * 0.07 + toward.x * 0.06, right.z * 0.07 + toward.z * 0.06);

      pipe.begin(gl, clear);
      camera.aspect = pipe.w / pipe.h;
      camera.updateProjectionMatrix();
      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projView);

      // Only pucks inside the view frustum are instanced (CPU cull; the pattern is unchanged).
      let i = 0;
      for (let ti = -TILES; ti <= TILES; ti++)
        for (let tj = -TILES; tj <= TILES; tj++)
          for (const w of WALKS) {
            puckPos(w, frame, v2);
            const x = v2.x + ti * PATCH;
            const z = v2.y + tj * PATCH;
            sphere.center.set(x, 0, z);
            if (!frustum.intersectsSphere(sphere)) continue;
            m.makeTranslation(x, 0, z);
            pucks.setMatrixAt(i, m);
            pucks.setColorAt(i, colors[w.color % colors.length]);
            m.makeTranslation(x + shadowOff.x, 0.001, z + shadowOff.y);
            shadows.setMatrixAt(i, m);
            i++;
          }
      pucks.count = i;
      shadows.count = i;
      pucks.instanceMatrix.needsUpdate = true;
      shadows.instanceMatrix.needsUpdate = true;
      if (pucks.instanceColor) pucks.instanceColor.needsUpdate = true;

      (ground.material as THREE.ShaderMaterial).uniforms.res.value.set(pipe.w, pipe.h);
      gl.render(scene, camera);
      pipe.finish(gl, {
        camera,
        dof: { focus: dist, range: 0.7, aperture: 2.3, maxRadius: 0.01 },
        final: {
          frame,
          period: LOOP,
          grain: 0.02,
          vignette: pal.vignette,
          vignetteColor: new THREE.Color(pal.vignetteColor),
        },
      });
    },
    dispose() {
      pipe.dispose();
    },
  };
};

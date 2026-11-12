import * as THREE from "three";
import type { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import type { SceneFactory } from "../engine/ThreeStage";
import { PostFX } from "../engine/postfx";
import { Fader, Kit, boxEdges } from "./builders";
import { CUT_TIME, TRACK_A, TRACK_B } from "./camera";
import type { Palette } from "./palette";
import { makeRng, ss, wobble, clamp01 } from "./rng";
import { makeCodeTexture, makeDataTexture } from "./textures";

export type DataCubesProps = { palette: Palette };

const CUBE = 10; // edge length of every data cube
const PITCH = 10.5; // lattice spacing in shot 2
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

const WAVE_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixelH;
uniform vec2 uFog;
out float vGain;
void main() {
  vec3 p = position;
  float t = uTime;
  float h = sin(p.x * 0.85 + t * 1.25) * 0.55
          + sin(p.z * 1.05 - t * 0.9 + p.x * 0.4) * 0.42
          + sin((p.x + p.z) * 0.5 + t * 0.6 + 1.7) * 0.45
          + sin(p.x * 2.1 - p.z * 1.4 + t * 1.6) * 0.12;
  p.y += h * 0.95;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = max(-mv.z, 0.001);
  gl_PointSize = max(0.0048 * uPixelH * (14.0 / d), 1.0);
  vGain = (0.45 + 0.4 * smoothstep(-1.2, 1.4, h)) * (1.0 - smoothstep(uFog.x, uFog.y, d));
  gl_Position = projectionMatrix * mv;
}`;
const WAVE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
in float vGain;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float a = smoothstep(1.0, 0.35, length(p));
  outColor = vec4(uColor * a * vGain * uOpacity, 1.0);
}`;

/** Wireframe "terrain" (grid + diagonals) used inside lattice cubes. */
function terrainLines(w: number, d: number, nx: number, nz: number, amp: number, seed: number) {
  const rng = makeRng(seed);
  const H: number[][] = [];
  const px = rng.range(-0.3, 0.3);
  const pz = rng.range(-0.3, 0.3);
  for (let i = 0; i <= nx; i++) {
    H.push([]);
    for (let j = 0; j <= nz; j++) {
      const u = i / nx - 0.5 - px;
      const v = j / nz - 0.5 - pz;
      const peak = Math.exp(-(u * u + v * v) * 9);
      H[i].push(amp * (peak * 1.0 + rng.range(-0.12, 0.2) + 0.15 * Math.sin(i * 1.3 + j * 0.7)));
    }
  }
  const P = (i: number, j: number) => [(i / nx - 0.5) * w, H[i][j], (j / nz - 0.5) * d];
  const lines: number[] = [];
  const nodes: number[] = [];
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= nz; j++) {
      nodes.push(...P(i, j));
      if (i < nx) lines.push(...P(i, j), ...P(i + 1, j));
      if (j < nz) lines.push(...P(i, j), ...P(i, j + 1));
      if (i < nx && j < nz && (i + j) % 2 === 0) lines.push(...P(i, j), ...P(i + 1, j + 1));
    }
  }
  return { lines, nodes };
}

export const dataCubesFactory: SceneFactory<DataCubesProps> = ({
  renderer,
  width,
  height,
  pixelWidth,
  pixelHeight,
  fps,
  props,
}) => {
  const pal = props.palette;
  const post = new PostFX(renderer, pixelWidth, pixelHeight, { dof: false, samples: 4 });
  const kit = new Kit(pixelWidth, pixelHeight, pal, 26, 170);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 26, 170);
  renderer.setClearColor(0x000000, 1);
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.05, 800);

  const codeTex = [makeCodeTexture(renderer, 11), makeCodeTexture(renderer, 29)];
  const dataTex = makeDataTexture(renderer, 5);
  /** Things that need a per-frame update, called with time in seconds. */
  const updaters: Array<(t: number) => void> = [];
  const scrollers: Array<{ map: THREE.Texture; base: number; speed: number }> = [];
  const addScroll = (mesh: { material: THREE.MeshBasicMaterial }, speed: number) => {
    const map = mesh.material.map as THREE.Texture;
    scrollers.push({ map, base: map.offset.y, speed });
  };

  // ───────────────────────── background lattice ─────────────────────────
  const bgFade = new Fader();
  {
    const S = 44;
    const coords = [-3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((c) => c * S);
    const lines: number[] = [];
    const pts: number[] = [];
    for (const a of coords) {
      for (const b of coords) {
        // Short segments so distance fog is evaluated along the line.
        for (let k = 0; k < coords.length - 1; k++) {
          const c0 = coords[k];
          const c1 = coords[k + 1];
          lines.push(c0, a, b, c1, a, b, a, c0, b, a, c1, b, a, b, c0, a, b, c1);
        }
        for (const c of coords) pts.push(a, b, c);
      }
    }
    scene.add(kit.lines(lines, bgFade, { color: pal.grid, width: 1.1, opacity: 0.085 }));
    scene.add(kit.sparkles(pts, bgFade, { size: 0.034, opacity: 0.75, seed: 3 }));
  }

  // ───────────────────────── shot 1: the data cube ──────────────────────
  const setA = new THREE.Group();
  scene.add(setA);
  const cubeAFade = new Fader();
  const innerFade = new Fader(); // code, charts, net
  const waveFade = new Fader();
  const roofFade = new Fader(); // floating read-outs above the roof
  const beamAFade = new Fader();
  setA.add(kit.holoCube(CUBE, cubeAFade, { seed: 1, glints: 22 }));

  // Scrolling code wall and a narrower numeric column.
  {
    const code = kit.panel(codeTex[0], 4.4, 8.6, innerFade, { opacity: 0.42, uSpan: 0.8 });
    code.position.set(-0.6, 0.6, -1.0);
    setA.add(code);
    addScroll(code, 0.028);
    const nums = kit.panel(dataTex, 2.4, 1.3, innerFade, { opacity: 0.8, uSpan: 0.9 });
    nums.position.set(2.9, 3.6, -2.2);
    setA.add(nums);
    addScroll(nums, 0.05);
    const nums2 = kit.panel(dataTex, 2.0, 1.0, innerFade, { opacity: 0.6, uSpan: 0.8, vStart: 0.4 });
    nums2.position.set(0.2, 4.1, -3.4);
    setA.add(nums2);
    addScroll(nums2, 0.04);
    // Mini 2D bar charts hanging under the numeric columns.
    const mkBars = (x: number, y: number, z: number, n: number, seed: number) => {
      const rng = makeRng(seed);
      for (let i = 0; i < n; i++) {
        const geo = new THREE.PlaneGeometry(0.13, 1);
        geo.translate(0, -0.5, 0); // bars hang downwards from a common top line
        const bar = kit.faces(geo, innerFade, { color: pal.accent, opacity: 0.55 });
        bar.position.set(x + i * 0.19, y, z);
        const base = rng.range(0.25, 0.75);
        const sp = rng.range(0.8, 2.2);
        const ph = rng.range(0, 6.28);
        updaters.push((t) => {
          bar.scale.y = base * (0.75 + 0.35 * Math.sin(t * sp + ph));
        });
        setA.add(bar);
      }
    };
    mkBars(1.75, 2.75, -2.2, 9, 41);
    mkBars(-0.6, 3.45, -3.4, 7, 43);
  }

  // Dotted wave surface near the floor of the cube.
  {
    const NX = 170;
    const NZ = 76;
    const pos = new Float32Array(NX * NZ * 3);
    let k = 0;
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        pos[k++] = -4.6 + (9.2 * i) / (NX - 1);
        pos[k++] = -2.5;
        pos[k++] = -4.4 + (8.8 * j) / (NZ - 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: WAVE_VERT,
      fragmentShader: WAVE_FRAG,
      uniforms: {
        uTime: kit.time,
        uPixelH: { value: pixelHeight },
        uFog: kit.fog,
        uColor: { value: pal.dots },
        uOpacity: { value: 1.15 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    waveFade.add(mat, 1.15);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    setA.add(pts);
  }

  // Animated wire net hovering above the wave (lines + node glints).
  {
    const NX = 10;
    const NZ = 7;
    const rng = makeRng(77);
    const bx: number[] = [];
    const bz: number[] = [];
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        bx.push(-4.3 + (8.6 * i) / (NX - 1) + rng.range(-0.28, 0.28));
        bz.push(-3.3 + (6.9 * j) / (NZ - 1) + rng.range(-0.28, 0.28));
      }
    }
    const pairs: Array<[number, number]> = [];
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * NX + i;
        if (i < NX - 1 && rng.chance(0.9)) pairs.push([a, a + 1]);
        if (j < NZ - 1 && rng.chance(0.9)) pairs.push([a, a + NX]);
      }
    }
    const node = new Float32Array(NX * NZ * 3);
    const line = kit.lines(new Array(pairs.length * 6).fill(0), innerFade, { width: 1.3, opacity: 0.8 }) as LineSegments2;
    const buf = (line.geometry.attributes.instanceStart as THREE.InterleavedBufferAttribute).data;
    const arr = buf.array as Float32Array;
    const glints = kit.sparkles(Array.from(node), innerFade, { size: 0.016, sizeJitter: 0.3, opacity: 0.9, star: 0.5, seed: 9 });
    const gpos = glints.geometry.attributes.position as THREE.BufferAttribute;
    setA.add(line, glints);
    updaters.push((t) => {
      for (let n = 0; n < NX * NZ; n++) {
        node[n * 3] = bx[n];
        node[n * 3 + 1] = -0.9 + 0.75 * wobble(bx[n] * 0.8, bz[n] * 0.9, t * 0.9 + 4.0);
        node[n * 3 + 2] = bz[n];
      }
      for (let p = 0; p < pairs.length; p++) {
        const [a, b] = pairs[p];
        arr.set(node.subarray(a * 3, a * 3 + 3), p * 6);
        arr.set(node.subarray(b * 3, b * 3 + 3), p * 6 + 3);
      }
      buf.needsUpdate = true;
      (gpos.array as Float32Array).set(node);
      gpos.needsUpdate = true;
    });
  }

  // Translucent 3D bar blocks that grow out of the roof.
  {
    const blocks = [
      // x, z, width, depth, height, start time
      [-0.8, 1.6, 3.0, 3.0, 1.3, 6.2],
      [-1.6, -1.4, 2.6, 2.6, 2.0, 6.8],
      [0.6, -0.6, 2.4, 2.4, 2.6, 7.4],
      [2.6, -1.6, 1.6, 3.2, 4.3, 8.1],
    ];
    blocks.forEach(([x, z, w, d, h, t0], i) => {
      const fader = new Fader();
      const g = new THREE.Group();
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      g.add(kit.faces(geo, fader, { color: pal.accent, opacity: 0.022, edge: 1.5 }));
      g.add(kit.lines(boxEdges(1, 1, 1, 0, 0.5, 0), fader, { color: pal.accent, width: 1.3, opacity: 0.75 }));
      g.position.set(x, CUBE / 2, z);
      setA.add(g);
      updaters.push((t) => {
        const grow = easeOut((t - t0) / 2.2);
        const breathe = 1 + 0.05 * Math.sin(t * 1.4 + i * 1.9);
        g.scale.set(w, Math.max(0.001, h * grow * breathe), d);
        fader.set(ss(t0 - 0.3, t0 + 0.4, t) * setAVis);
      });
    });
    // Floating read-outs left and right of the blocks.
    const mk = (x: number, y: number, z: number, w: number, h: number, ry: number, vStart: number) => {
      const p = kit.panel(dataTex, w, h, roofFade, { opacity: 0.7, uSpan: 1.0, vStart });
      p.position.set(x, y, z);
      p.rotation.y = ry;
      setA.add(p);
      addScroll(p, 0.035);
    };
    mk(-5.6, 7.2, 1.5, 3.6, 0.9, 0.5, 0.1);
    mk(-5.2, 5.9, 3.2, 3.2, 1.1, 0.5, 0.55);
    mk(5.6, 8.6, -3.5, 3.4, 1.5, 0.5, 0.3);
    mk(4.6, 6.6, -1.0, 2.6, 0.8, 0.5, 0.8);
  }
  const beamA = kit.beam(2.2, 90, beamAFade, 0.05);
  beamA.position.set(2.7, 10, -0.6);
  setA.add(beamA);
  let setAVis = 0;

  // ───────────────────────── shot 2: the lattice ────────────────────────
  const setB = new THREE.Group();
  scene.add(setB);
  const coreFade = new Fader();
  const beamBFade = new Fader();
  setB.add(kit.holoCube(CUBE, coreFade, { seed: 2, glints: 18 }));
  const beamB = kit.beam(1.2, 120, beamBFade, 0.11);
  setB.add(beamB);

  // Solid core cube: six shaded faces that fly together and stop spinning.
  const core = new THREE.Group();
  const coreFaceFade = new Fader();
  const coreFaces: Array<{ mesh: THREE.Mesh; n: THREE.Vector3 }> = [];
  {
    const s = 1.7;
    const shades = [0.2, 0.12, 0.25, 0.08, 0.16, 0.12];
    const normals = [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];
    normals.forEach((nv, i) => {
      const n = new THREE.Vector3(nv[0], nv[1], nv[2]);
      const m = kit.faces(new THREE.PlaneGeometry(s, s), coreFaceFade, { color: pal.accent, opacity: shades[i] });
      m.lookAt(n);
      core.add(m);
      coreFaces.push({ mesh: m, n: n.clone().multiplyScalar(s / 2) });
    });
    setB.add(core);
  }

  type Cell = { fader: Fader; t0: number };
  const cells: Cell[] = [];
  {
    const rng = makeRng(2024);
    const forced = new Set(["-1,0,0", "1,0,0", "0,-1,0", "0,1,0", "-1,-1,1", "-1,1,0", "1,-1,0", "1,1,-1", "0,0,-1", "-1,0,-1", "1,-1,-1"]);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (let k = -1; k <= 1; k++) {
          const key = `${i},${j},${k}`;
          const keep = k === -1 && rng.chance(0.3);
          if ((i === 0 && j === 0 && k === 0) || key === "0,0,1" || key === "0,-1,1") continue;
          if (!forced.has(key) && !keep) continue;
          const fader = new Fader();
          const g = new THREE.Group();
          g.position.set(i * PITCH, j * PITCH, k * PITCH);
          const seed = 100 + (i + 1) * 9 + (j + 1) * 3 + (k + 1);
          g.add(kit.holoCube(CUBE, fader, { seed, glints: 10 }));
          const r = makeRng(seed * 7 + 1);
          // Every cube carries one or two scrolling code sheets…
          const sheets = r.int(1, 3);
          for (let s = 0; s < sheets; s++) {
            const w = r.range(2.8, 4.6);
            const h = r.range(3, 7.5);
            const p = kit.panel(r.pick(codeTex), w, h, fader, {
              opacity: r.range(0.3, 0.55),
              uSpan: 0.95,
              vStart: r.next(),
            });
            const face = r.int(0, 2);
            const off = r.range(-4.2, 4.2);
            if (face === 0) {
              p.position.set(r.range(-2.5, 2.5), r.range(-1.2, 1.2), off);
            } else if (face === 1) {
              p.rotation.y = Math.PI / 2;
              p.position.set(off, r.range(-1.2, 1.2), r.range(-2.5, 2.5));
            } else {
              p.rotation.x = -Math.PI / 2;
              p.position.set(r.range(-2.5, 2.5), off, r.range(-1.2, 1.2));
            }
            g.add(p);
            addScroll(p, r.range(0.008, 0.03));
          }
          // …plus one seeded data widget.
          const widget = r.int(0, 4);
          if (widget === 0 || key === "0,-1,0" || key === "-1,-1,1") {
            const tr = terrainLines(8, 7, 9, 8, 2.6, seed);
            const tg = new THREE.Group();
            tg.add(kit.lines(tr.lines, fader, { width: 1.1, opacity: 0.42 }));
            tg.add(kit.sparkles(tr.nodes, fader, { size: 0.012, sizeJitter: 0.3, opacity: 0.8, star: 0.4, seed }));
            tg.position.y = r.range(-3.5, -1.5);
            g.add(tg);
          } else if (widget === 1 || key === "1,0,0") {
            // nested wire boxes
            g.add(kit.lines(boxEdges(3.4, 5.2, 3.0, 0.4, -1.6, 0), fader, { width: 1.1, opacity: 0.5 }));
            g.add(kit.lines(boxEdges(1.6, 2.6, 1.6, -1.6, -3.0, 1.2), fader, { width: 1.0, opacity: 0.4 }));
            g.add(kit.lines(boxEdges(6.0, 0.2, 5.0, 0.2, -4.2, 0), fader, { width: 1.0, opacity: 0.3 }));
          } else if (widget === 2) {
            // 2D bar chart on a horizontal sheet
            const n = 6;
            const cg = new THREE.Group();
            for (let b = 0; b < n; b++) {
              const geo = new THREE.PlaneGeometry(0.55, 1);
              geo.translate(0, 0.5, 0);
              const bar = kit.faces(geo, fader, { color: pal.accent, opacity: 0.16 + 0.34 * r.next() });
              bar.position.x = (b - n / 2) * 0.72;
              const base = r.range(1.0, 2.6);
              const sp = r.range(0.5, 1.4);
              const ph = r.range(0, 6.28);
              updaters.push((t) => {
                bar.scale.y = base * (0.8 + 0.25 * Math.sin(t * sp + ph));
              });
              cg.add(bar);
            }
            cg.rotation.x = -Math.PI / 2;
            cg.position.set(r.range(-1, 1.5), r.range(2.5, 4.4), r.range(-1, 1));
            g.add(cg);
          } else if (widget === 3) {
            // pie chart
            const pg = new THREE.Group();
            let a0 = 0;
            for (const [frac, op] of [[0.58, 0.22], [0.27, 0.45], [0.15, 0.1]]) {
              pg.add(kit.faces(new THREE.CircleGeometry(1.5, 48, a0, frac * Math.PI * 2), fader, { color: pal.accent, opacity: op }));
              a0 += frac * Math.PI * 2;
            }
            pg.rotation.x = -Math.PI / 2;
            pg.position.set(r.range(-2.5, 2.5), r.range(3.0, 4.5), r.range(-2.5, 2.5));
            const spin = r.range(-0.25, 0.25);
            updaters.push((t) => {
              pg.rotation.z = t * spin;
            });
            g.add(pg);
          }
          setB.add(g);
          const dist = Math.hypot(i, j, k);
          cells.push({ fader, t0: 13.2 + (dist - 1) * 0.7 + r.range(0, 0.5) });
        }
      }
    }
  }

  // ───────────────────────── per-time update ────────────────────────────
  const update = (t: number) => {
    kit.time.value = t;
    const inA = t < CUT_TIME;
    (inA ? TRACK_A : TRACK_B).apply(camera, t);

    // Shot 1 visibility: fades in while tumbling closer, out during the dive.
    setAVis = ss(0.3, 1.9, t) * (1 - ss(10.55, 11.1, t));
    setA.visible = setAVis > 0.0005;
    cubeAFade.set(setAVis);
    innerFade.set(setAVis * (1 - 0.7 * ss(5.1, 6.3, t)));
    waveFade.set(setAVis * (1 - 0.8 * ss(5.0, 6.2, t)));
    roofFade.set(setAVis * ss(5.9, 7.0, t));
    beamAFade.set(setAVis * ss(4.6, 6.2, t));

    // Shot 2 visibility.
    const out = 1 - ss(26.0, 27.2, t);
    const coreVis = ss(10.6, 11.15, t) * out;
    setB.visible = coreVis > 0.0005;
    // The lone cube is lit a little hotter until its neighbours arrive.
    coreFade.set(coreVis * (1 + 0.7 * (1 - ss(13.3, 14.6, t))));
    beamBFade.set(coreVis * (0.4 + 0.6 * ss(19.5, 20.6, t) * (1 - ss(21.0, 22.5, t))));
    const assemble = easeOut((t - 11.55) / 1.1);
    coreFaceFade.set(coreVis * ss(11.5, 12.0, t));
    for (const f of coreFaces) {
      f.mesh.position.copy(f.n).multiplyScalar(1 + (1 - assemble) * 2.2);
    }
    core.rotation.set((1 - assemble) * 2.4, (1 - assemble) * 3.1 + t * 0.05, (1 - assemble) * 1.3);
    core.scale.setScalar(0.35 + 0.65 * assemble);
    for (const c of cells) {
      c.fader.set(ss(c.t0, c.t0 + 0.8, t) * out);
    }

    bgFade.set(ss(0.0, 1.2, t) * (1 - ss(26.3, 27.3, t)));
    for (const s of scrollers) {
      s.map.offset.y = s.base + s.speed * t;
    }
    for (const u of updaters) {
      u(t);
    }
  };

  /** Time ranges with fast camera moves that get temporal supersampling. */
  const BLUR: Array<[number, number]> = [
    [0.8, 2.2],
    [4.9, 6.3],
    [10.3, 12.3],
    [19.2, 21.2],
    [25.3, 27.0],
  ];
  const postParams = {
    focus: 20,
    aperture: 0,
    maxCoc: 0.02,
    bloomStrength: 0.75,
    bloomThreshold: 0.04,
    exposure: 1.0,
    tint: pal.tint,
    lift: pal.lift,
    vignette: 0.35,
    grain: 0.006,
    saturation: pal.saturation,
    contrast: 1,
    fade: 1,
    seed: 0,
  };

  return {
    render: (frame) => {
      const t = frame / fps;
      const blurred = BLUR.some(([a, b]) => t >= a && t <= b);
      const n = blurred ? 4 : 1;
      const shutter = 0.55 / fps;
      const subs: Array<() => void> = [];
      for (let i = 0; i < n; i++) {
        const ts = t + (n === 1 ? 0 : (i / (n - 1) - 0.5) * shutter);
        subs.push(() => update(Math.max(0, ts)));
      }
      postParams.seed = frame % 240;
      postParams.fade = ss(0, 0.5, t) * (1 - ss(26.4, 27.3, t));
      post.render(scene, camera, postParams, undefined, subs);
    },
    dispose: () => {
      post.dispose();
      kit.dispose();
      codeTex.forEach((x) => x.dispose());
      dataTex.dispose();
    },
  };
};

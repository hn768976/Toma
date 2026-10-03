import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Pipeline } from "../../lib/three/Pipeline";
import { SceneFactory, ThreeStage } from "../../lib/three/ThreeStage";
import { radialTexture } from "../../lib/three/textures";
import { mulberry32, TAU } from "../../lib/rng";
import type { NeonColors } from "../../versions";

const LOOP = 600;

type ShapeDef = {
  kind: "poly" | "prism";
  pts: THREE.Vector2[];
  depth: number;
  pos: THREE.Vector3;
  rot: THREE.Euler;
  bias: number; // colour bias along the blue→magenta blend
  // whole-cycle oscillations over the loop (frame 600 ≡ frame 0)
  osc: { axis: 0 | 1 | 2; amp: number; k: number; ph: number }[];
  spinK: number; // whole turns around the face normal per loop (0 = none)
  bob: { amp: number; k: number; ph: number };
};

const buildShapes = () => {
  const rand = mulberry32(0x5eed2);
  const polygon = (n: number, r0: number) => {
    const angs: number[] = [];
    for (let i = 0; i < n; i++) angs.push(((i + 0.2 + rand() * 0.6) / n) * TAU);
    return angs.map((a) => {
      const r = r0 * (0.6 + rand() * 0.5);
      return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    });
  };
  const shapes: ShapeDef[] = [];
  // a ring of large facets just outside the frame, leaning in toward the camera
  // like the walls of a tunnel; centre band left clear for text
  const N = 30;
  for (let i = 0; i < N; i++) {
    // 11 along the top, 11 along the bottom, 4 down each side
    let x: number, y: number;
    if (i < 22) {
      const k = i % 11;
      const top = i < 11 ? 1 : -1;
      x = -12 + k * 2.4 + (rand() - 0.5) * 1.2;
      y = top * (4.7 + rand() * 1.1);
    } else {
      const k = i - 22;
      x = (k % 2 ? 1 : -1) * (9.6 + rand() * 1.0);
      y = (Math.floor(k / 2) - 0.5) * 3.2 + (rand() - 0.5) * 0.8;
    }
    const len = Math.hypot(x / 11.5, y / 6.6);
    const ex = x / 11.5 / len, ey = y / 6.6 / len;
    const z = -2.5 - rand() * 4;
    const kind = i % 5 === 2 ? "prism" : "poly";
    const n = kind === "prism" ? 3 : rand() < 0.6 ? 3 : 4;
    shapes.push({
      kind,
      pts: polygon(n, 4.2 + rand() * 2.4),
      depth: 0.5 + rand() * 0.6,
      pos: new THREE.Vector3(x, y, z),
      // lean toward the frame centre (shared perspective), plus a little variety
      rot: new THREE.Euler(-ey * (0.75 + rand() * 0.35), ex * (0.75 + rand() * 0.35), rand() * TAU),
      bias: (rand() - 0.5) * 1.3,
      osc: [
        { axis: 0, amp: 0.05 + rand() * 0.09, k: 1 + Math.floor(rand() * 2), ph: rand() * TAU },
        { axis: 1, amp: 0.05 + rand() * 0.09, k: 1 + Math.floor(rand() * 2), ph: rand() * TAU },
        { axis: 2, amp: 0.04 + rand() * 0.08, k: 1, ph: rand() * TAU },
      ],
      spinK: 0,
      bob: { amp: 0.08 + rand() * 0.14, k: 1 + Math.floor(rand() * 2), ph: rand() * TAU },
    });
  }
  return shapes;
};
const SHAPES = buildShapes();

/** four-point star glint for the hot vertices */
const glintTexture = () => {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const R = S / 2;
  const grd = g.createRadialGradient(R, R, 0, R, R, R * 0.35);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "lighter";
  for (const horiz of [true, false]) {
    const lg = horiz ? g.createLinearGradient(0, R, S, R) : g.createLinearGradient(R, 0, R, S);
    lg.addColorStop(0, "rgba(255,255,255,0)");
    lg.addColorStop(0.5, "rgba(255,255,255,0.9)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    if (horiz) g.fillRect(0, R - 2, S, 4);
    else g.fillRect(R - 2, 0, 4, S);
  }
  return new THREE.CanvasTexture(c);
};

/** soft diagonal light ray */
const rayTexture = () => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 512;
  const g = c.getContext("2d")!;
  const lg = g.createLinearGradient(0, 0, 64, 0);
  lg.addColorStop(0, "rgba(255,255,255,0)");
  lg.addColorStop(0.5, "rgba(255,255,255,1)");
  lg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lg;
  g.fillRect(0, 0, 64, 512);
  g.globalCompositeOperation = "destination-in";
  const vg = g.createLinearGradient(0, 0, 0, 512);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(0.7, "rgba(0,0,0,0.6)");
  vg.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = vg;
  g.fillRect(0, 0, 64, 512);
  return new THREE.CanvasTexture(c);
};

const tubeBetween = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r, r, len, 6, 8, true);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
  return g;
};

const factory: SceneFactory<{ colors: NeonColors }> = ({ gl, props }) => {
  const { colors } = props;
  const rand = mulberry32(0xface); // local stream: identical every time the scene is built
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.bg).multiplyScalar(0.6);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 12);

  const colA = new THREE.Color(colors.a);
  const colB = new THREE.Color(colors.b);
  // saturate the neon colours before HDR scaling so the tonemapper keeps them saturated
  const sat = (c: THREE.Color) => new THREE.Color(Math.pow(c.r, 2.2), Math.pow(c.g, 2.2), Math.pow(c.b, 2.2));
  const lineA = sat(colA);
  const lineB = sat(colB);
  const glowTex = radialTexture();
  const glint = glintTexture();
  const TUBE_R = 0.014;
  const LINE_I = 2.8;

  const root = new THREE.Group();
  scene.add(root);
  scene.add(new THREE.HemisphereLight(0x2a1a70, 0x300a50, 0.12));

  // faint coloured haze near the edges + a few diagonal light rays from the bottom left
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowTex, color: (i % 2 ? colB : colA).clone().multiplyScalar(0.035), blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const a = (i / 6) * TAU + 0.4;
    s.position.set(Math.cos(a) * 9, Math.sin(a) * 4.8, -8);
    s.scale.setScalar(7 + rand() * 4);
    scene.add(s);
  }
  const rayTex = rayTexture();
  const rays: { m: THREE.Mesh; base: number; ph: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({ map: rayTex, color: (i === 2 ? colB : colA).clone().multiplyScalar(0.07), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6 + rand() * 0.6, 12), mat);
    m.position.set(-7.5 + i * 1.6 + rand(), -7.5, -5);
    m.rotation.z = -0.55 - rand() * 0.2;
    m.geometry.translate(0, 6, 0);
    scene.add(m);
    rays.push({ m, base: 0.14, ph: rand() * TAU });
  }

  const groups: { g: THREE.Group; d: ShapeDef }[] = [];
  const blend = (wx: number, wy: number, bias: number) =>
    THREE.MathUtils.smoothstep(wx / 30 + 0.5 + bias + 0.2 * Math.sin(wy * 0.6 + wx * 0.2), 0.2, 0.8);
  SHAPES.forEach((d, si) => {
    const g = new THREE.Group();
    g.position.copy(d.pos);
    g.rotation.copy(d.rot);
    g.updateMatrix();
    const faceMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#07040f"), roughness: 0.3, metalness: 0.6, side: THREE.DoubleSide });
    const tubes: THREE.BufferGeometry[] = [];
    const corners: THREE.Vector3[] = [];
    const n = d.pts.length;
    if (d.kind === "poly") {
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(d.pts)), faceMat));
      for (let i = 0; i < n; i++) {
        const a = new THREE.Vector3(d.pts[i].x, d.pts[i].y, 0);
        const b = new THREE.Vector3(d.pts[(i + 1) % n].x, d.pts[(i + 1) % n].y, 0);
        tubes.push(tubeBetween(a, b, TUBE_R));
        corners.push(a);
      }
    } else {
      // open prism: side walls only; rims + vertical edges outlined
      const h = d.depth / 2;
      const pos: number[] = [];
      for (let i = 0; i < n; i++) {
        const p = d.pts[i], q = d.pts[(i + 1) % n];
        pos.push(p.x, p.y, -h, q.x, q.y, -h, q.x, q.y, h, p.x, p.y, -h, q.x, q.y, h, p.x, p.y, h);
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      wg.computeVertexNormals();
      g.add(new THREE.Mesh(wg, faceMat));
      for (let i = 0; i < n; i++) {
        const p = d.pts[i], q = d.pts[(i + 1) % n];
        const a0 = new THREE.Vector3(p.x, p.y, -h), b0 = new THREE.Vector3(q.x, q.y, -h);
        const a1 = new THREE.Vector3(p.x, p.y, h), b1 = new THREE.Vector3(q.x, q.y, h);
        tubes.push(tubeBetween(a0, b0, TUBE_R), tubeBetween(a1, b1, TUBE_R), tubeBetween(a0, a1, TUBE_R));
        corners.push(a0, a1);
      }
    }
    // vertex colours: blue on the left/top drifting to magenta at the right/bottom,
    // so single lines blend between the two
    const merged = mergeGeometries(tubes)!;
    tubes.forEach((t) => t.dispose());
    const P = merged.getAttribute("position");
    const cols = new Float32Array(P.count * 3);
    const v = new THREE.Vector3();
    const c = new THREE.Color();
    for (let k = 0; k < P.count; k++) {
      v.fromBufferAttribute(P, k).applyMatrix4(g.matrix);
      c.copy(lineA).lerp(lineB, blend(v.x, v.y, d.bias)).multiplyScalar(LINE_I);
      cols[k * 3] = c.r;
      cols[k * 3 + 1] = c.g;
      cols[k * 3 + 2] = c.b;
    }
    merged.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.add(new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ vertexColors: true })));
    // star glints at a few vertices
    corners.forEach((cp) => {
      if (rand() < 0.72) return;
      v.copy(cp).applyMatrix4(g.matrix);
      const col = colA.clone().lerp(colB, blend(v.x, v.y, d.bias)).lerp(new THREE.Color(1, 1, 1), 0.55);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glint, color: col.multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.copy(cp);
      s.scale.setScalar(0.55 + rand() * 0.4);
      g.add(s);
    });
    // dim coloured light on every third shape: glow reflected on the dark faces
    if (si % 3 === 0) {
      v.copy(corners[0]).applyMatrix4(g.matrix);
      const L = new THREE.PointLight(colA.clone().lerp(colB, blend(v.x, v.y, d.bias)), 4, 6, 1.8);
      L.position.copy(corners[0]).multiplyScalar(0.85).add(new THREE.Vector3(0, 0, 0.5));
      g.add(L);
    }
    root.add(g);
    groups.push({ g, d });
  });

  const pipe = new Pipeline(gl, scene, camera, {
    bloom: { strength: 1.1, radius: 0.2, threshold: 0.3 },
    grain: 0.02,
    vignette: 0.3,
  });

  return {
    render(frame) {
      const { w, h } = pipe.ensureSize();
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const t = (frame % LOOP) / LOOP; // 0..1 around the loop
      for (const { g, d } of groups) {
        const v = [d.rot.x, d.rot.y, d.rot.z];
        for (const o of d.osc) v[o.axis] += o.amp * Math.sin(TAU * o.k * t + o.ph);
        v[2] += d.spinK * TAU * t;
        g.rotation.set(v[0], v[1], v[2]);
        g.position.y = d.pos.y + d.bob.amp * Math.sin(TAU * d.bob.k * t + d.bob.ph);
      }
      root.rotation.set(0.03 * Math.sin(TAU * t), 0.04 * Math.sin(TAU * t + 1.3), 0.02 * Math.sin(TAU * t + 0.4));
      root.position.x = 0.2 * Math.sin(TAU * t);
      for (const r of rays) (r.m.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * Math.sin(TAU * 2 * t + r.ph);
      pipe.render(frame % LOOP);
    },
    dispose() {
      pipe.dispose();
    },
  };
};

export const NeonPolygonFrame: React.FC<{ colors: NeonColors }> = ({ colors }) => (
  <ThreeStage factory={factory} props={{ colors }} background={colors.bg} />
);

import React, { useCallback } from "react";
import * as THREE from "three";
import { ThreeStage, WorldFactory } from "../../lib/ThreeStage";
import { PostPipeline } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import { loopPhase, loopTheta } from "../../lib/loop";

export interface PuzzleSurfaceProps {
  piece: string;
  dark: boolean;
}

// ---------- puzzle layout (module level, seeded) ----------
// The camera slides exactly one piece width per loop along +x, so for frame 600
// to equal frame 0 the cut pattern repeats every column: each row has its own
// seeded tab/blank shape (rows differ), instanced across the row. Neighbours
// interlock because both sides of an edge use the same curve.
const ROWS = 26;
const COLS = 28;
const COL0 = -10; // first column index (world x = column index)
const ROW0 = -2;

interface EdgeSpec { s: number; b: number; c: number; d: number; t: number }
const rnd = mulberry32(0x9e2a7004);
const edgeSpec = (): EdgeSpec => ({
  s: rnd() < 0.5 ? -1 : 1, // which side the tab sticks out
  b: (rnd() - 0.5) * 0.08,
  c: (rnd() - 0.5) * 0.06,
  d: (rnd() - 0.5) * 0.06,
  t: 0.095 + rnd() * 0.02,
});
// horizontal edge between row r-1 and r (index r), vertical edge inside row r
const hEdges = Array.from({ length: ROWS + 1 }, edgeSpec);
const vEdges = Array.from({ length: ROWS }, edgeSpec);
const rowTint = Array.from({ length: ROWS }, () => (rnd() - 0.5) * 0.035);
const rowHeight = Array.from({ length: ROWS }, () => (rnd() - 0.5) * 0.006);

// 3 lifts per loop: [row, col, start phase, tilt axis angle, tilt deg]
const lifts = [
  { row: 6, col: 1, start: 0.06, axis: rnd() * Math.PI * 2, tilt: 3 + rnd() * 3 },
  { row: 5, col: -1, start: 0.39, axis: rnd() * Math.PI * 2, tilt: 3 + rnd() * 3 },
  { row: 7, col: 2, start: 0.7, axis: rnd() * Math.PI * 2, tilt: 3 + rnd() * 3 },
];
const LIFT_LEN = 0.2;

// Draradech-style jigsaw edge, l along 0..1, w across (tab side positive)
const edgeCurve = (e: EdgeSpec, seg = 8): [number, number][] => {
  const { b, c, d, t } = e;
  const P: [number, number][] = [
    [0, 0], [0.2, 0], [0.5 + b + d, -t + c], [0.5 - t + b, t + c],
    [0.5 - 2 * t + b - d, 3 * t + c], [0.5 + 2 * t + b - d, 3 * t + c], [0.5 + t + b, t + c],
    [0.5 + b + d, -t + c], [0.8, 0], [1, 0],
  ];
  const out: [number, number][] = [];
  for (let k = 0; k < 3; k++) {
    const [p0, p1, p2, p3] = [P[k * 3], P[k * 3 + 1], P[k * 3 + 2], P[k * 3 + 3]];
    for (let i = k === 0 ? 0 : 1; i <= seg; i++) {
      const u = i / seg, v = 1 - u;
      out.push([
        v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
        v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
      ]);
    }
  }
  return out;
};

// outline of a piece in row r (local coords, piece spans 0..1 in x and y)
const pieceOutline = (r: number) => {
  const pts: [number, number][] = [];
  const bottom = edgeCurve(hEdges[r]);
  const top = edgeCurve(hEdges[r + 1]);
  const side = edgeCurve(vEdges[r]);
  const hb = hEdges[r].s, ht = hEdges[r + 1].s, vs = vEdges[r].s;
  // bottom: (0,0)→(1,0)
  bottom.forEach(([l, w]) => pts.push([l, hb * w]));
  // right: (1,0)→(1,1)
  side.slice(1).forEach(([l, w]) => pts.push([1 + vs * w, l]));
  // top: (1,1)→(0,1) (canonical edge runs left→right, so reverse it)
  top.slice(1).reverse().forEach(([l, w]) => pts.push([l, 1 + ht * w]));
  pts.pop();
  pts.push([0, 1]);
  // left: (0,1)→(0,0) — same vertical edge as the right side, one column over
  side.slice(1).reverse().forEach(([l, w]) => pts.push([vs * w, l]));
  pts.pop();
  return pts;
};

const PIECE_DEPTH = 0.07;
const pieceGeometry = (r: number) => {
  const shape = new THREE.Shape(pieceOutline(r).map(([x, y]) => new THREE.Vector2(x - 0.5, y - 0.5)));
  const bevel = 0.022;
  const gap = 0.004;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: PIECE_DEPTH - 0.032,
    bevelEnabled: true,
    bevelThickness: 0.016,
    bevelSize: bevel,
    bevelOffset: -bevel - gap / 2,
    bevelSegments: 3,
    curveSegments: 4,
  });
  // lie flat: shape xy → world xz, extrusion along +y
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
};

const createWorld = (props: PuzzleSurfaceProps): WorldFactory => (renderer, w, h) => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const base = new THREE.Color(props.piece);
  scene.background = props.dark ? new THREE.Color(0x0b0d12) : new THREE.Color(0xc8d0dc);

  const camera = new THREE.PerspectiveCamera(22, w / h, 0.3, 120);
  // atmospheric falloff: the far, defocused surface dissolves into pale haze
  scene.fog = props.dark ? new THREE.Fog(0x16181e, 7.5, 20) : new THREE.Fog(0xf2f6ff, 6.5, 17);

  // dark board under the pieces shows in the seams
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: props.dark ? 0x07080a : base.clone().multiplyScalar(0.86), roughness: 1 }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.002;
  under.receiveShadow = true;
  scene.add(under);

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: props.dark ? 0.55 : 0.7, metalness: 0 });
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpP = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const rows: THREE.InstancedMesh[] = [];
  for (let r = 0; r < ROWS; r++) {
    const im = new THREE.InstancedMesh(pieceGeometry(r), mat, COLS);
    im.castShadow = true;
    im.receiveShadow = true;
    const col = base.clone().offsetHSL(0, 0, rowTint[r]);
    for (let c = 0; c < COLS; c++) im.setColorAt(c, col);
    rows.push(im);
    scene.add(im);
  }

  // ---- light: soft key at a low angle so the seams read ----
  const key = new THREE.DirectionalLight(props.dark ? 0xe4eaf4 : 0xf4f8ff, props.dark ? 1.1 : 2.0);
  key.position.set(-8, 6, -10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 3;
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.01;
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = -22; sc.right = 22; sc.top = 22; sc.bottom = -22; sc.near = 0.5; sc.far = 60;
  scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight(props.dark ? 0x9098a8 : 0xe8f0ff, props.dark ? 0x101216 : 0x9aa4b4, props.dark ? 0.7 : 1.9);
  scene.add(hemi);
  if (props.dark) {
    // cool rim on the seams: light from behind catches the bevels
    const rim = new THREE.DirectionalLight(0xb4c8e8, 1.5);
    rim.position.set(3, 2.2, -12);
    scene.add(rim, rim.target);
  }

  const post = new PostPipeline(w, h, {
    samples: 4,
    ssao: { radius: 0.1, intensity: 1.2, strength: props.dark ? 0.5 : 0.3, bias: 0.004 },
    dof: { focus: 7, focusRange: 0.35, aperture: 0.07, maxCoc: 0.02 },
    final: props.dark
      ? { exposure: 1.0, tone: "neutral", grain: 0.015, vignette: 0.35, gain: [0.96, 0.985, 1.03], saturation: 0.75, bottomTint: [0.8, 0.84, 0.92] }
      : { exposure: 1.4, tone: "neutral", grain: 0.015, vignette: 0.32, bottomTint: [0.8, 0.84, 0.93], gain: [0.95, 0.985, 1.05], saturation: 0.9 },
  });

  // camera: ~25° above the surface, telephoto; slides one piece per loop
  const elev = (25 * Math.PI) / 180;
  const camDist = 7.0;
  const yaw = (-30 * Math.PI) / 180; // grid seen at an angle, seams run diagonally
  const lookZ = 4; // surface point at screen centre (rows grow toward -z)
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  return {
    update: (frame) => {
      const ph = loopPhase(frame);
      const th = loopTheta(frame);
      const x = ph; // exactly one piece width per loop
      const target = new THREE.Vector3(x + 0.5, 0, -lookZ);
      camera.position.set(target.x + Math.sin(yaw) * Math.cos(elev) * camDist, Math.sin(elev) * camDist, target.z + Math.cos(yaw) * Math.cos(elev) * camDist);
      camera.lookAt(target);
      camera.rotateZ((-8 * Math.PI) / 180); // grid runs diagonally across the frame
      camera.updateMatrixWorld();
      // focus about a third of the way up the frame
      ray.setFromCamera(new THREE.Vector2(0, -1 / 3), camera);
      if (ray.ray.intersectPlane(plane, hit)) post.setFocus(hit.sub(camera.position).dot(camera.getWorldDirection(fwd)));
      key.position.set(camera.position.x - 10, 5.5, -lookZ - 14);
      key.target.position.set(camera.position.x, 0, -lookZ);
      key.target.updateMatrixWorld();

      for (let r = 0; r < ROWS; r++) {
        const im = rows[r];
        const rz = -(ROW0 + r); // world z of row centre
        for (let c = 0; c < COLS; c++) {
          const cx = COL0 + c;
          let y = rowHeight[r];
          tmpQ.identity();
          for (const L of lifts) {
            if (L.row !== r || L.col !== cx) continue;
            const u = (ph - L.start) / LIFT_LEN;
            if (u > 0 && u < 1) {
              // eased up–hold–settle
              const e = Math.sin(Math.PI * u);
              const k = e * e * (3 - 2 * e);
              y += 0.05 * k;
              const ax = new THREE.Vector3(Math.cos(L.axis), 0, Math.sin(L.axis));
              tmpQ.setFromAxisAngle(ax, ((L.tilt * Math.PI) / 180) * k * Math.sin(Math.PI * u * 1.0 + 0.3));
            }
          }
          tmpP.set(cx + 0.5, y, rz - 0.5);
          tmpM.compose(tmpP, tmpQ, one);
          im.setMatrixAt(c, tmpM);
        }
        im.instanceMatrix.needsUpdate = true;
      }
      void th;
    },
    render: (r, lf) => post.render(r, scene, camera, lf),
    dispose: () => post.dispose(),
  };
};

export const PuzzleSurface: React.FC<PuzzleSurfaceProps> = (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useCallback(createWorld(props), [JSON.stringify(props)]);
  return <ThreeStage factory={factory} />;
};

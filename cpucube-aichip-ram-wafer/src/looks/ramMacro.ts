import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { lin } from "../lib/color";
import { LookFactory } from "../lib/LookCanvas";
import { cwave, phase, wave } from "../lib/loop";
import { defaultPost } from "../lib/post";
import { mulberry32 } from "../lib/random";

export interface RamParams {
  lightA: string; // from the left, above
  lightB: string; // from the right
  /** "anim" for the loop; "checkModule"/"checkRow" for the model-check stills. */
  mode?: "anim" | "checkModule" | "checkRow";
}

// World units are millimetres.
const MOD_L = 133;
const MOD_H = 31;
const MOD_T = 1.2;
const SLOT_PITCH = 9;
const N_MOD = 6;
const CHIPS = 8;
// Chip pitch along the module = loop period P. Everything the camera can see
// (module PCB, chips, pins, SMD parts, motherboard) is periodic in z with P,
// and the camera + light rig slide exactly P per loop.
const P = (MOD_L - 16) / CHIPS;
// TSOP-style body mounted long side along the module: thickness (x), height (y), length (z)
const CHIP = { t: 1.0, h: 9.6, w: 13.2 };
const PINS = 20; // per long edge (top and bottom)
const SLOT_TOP = 7.5; // housing height above the motherboard
const INSERT = 5.6; // depth of the module in the slot
const MOD_BOTTOM = SLOT_TOP - INSERT;
const CHIP_Y = MOD_BOTTOM + MOD_H - 3.0 - CHIP.h / 2;
const DEBUG_CLOSE = false;
const chipZ = (k: number) => -MOD_L / 2 + 8 + (k + 0.5) * P;

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

const texOf = (c: HTMLCanvasElement, srgb: boolean) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 16;
  return t;
};

/** Module PCB tile, one chip pitch wide, repeated along the module. */
const modulePcb = () => {
  const W = 1024;
  const H = Math.round((W * MOD_H) / P);
  const c = canvas(W, H);
  const r = c.getContext("2d")!;
  const rough = canvas(W, H);
  const rr = rough.getContext("2d")!;
  const s = W / P; // px per mm
  const rng = mulberry32(0x2a11);
  r.fillStyle = "#0C1A14";
  r.fillRect(0, 0, W, H);
  rr.fillStyle = "#8C8C8C";
  rr.fillRect(0, 0, W, H);
  // fine traces, drawn with wrap-around so the tile is seamless
  const strokeWrapped = (pts: [number, number][], lw: number, col: string) => {
    for (const off of [-W, 0, W]) {
      r.strokeStyle = col;
      r.lineWidth = lw;
      r.beginPath();
      pts.forEach(([x, y], i) => (i ? r.lineTo(x + off, y) : r.moveTo(x + off, y)));
      r.stroke();
      rr.strokeStyle = "#6A6A6A";
      rr.lineWidth = lw;
      rr.beginPath();
      pts.forEach(([x, y], i) => (i ? rr.lineTo(x + off, y) : rr.moveTo(x + off, y)));
      rr.stroke();
    }
  };
  r.lineCap = "round";
  r.lineJoin = "round";
  // canvas y=0 is the top edge of the module
  for (let i = 0; i < 12; i++) {
    const y = (1.0 + i * 0.32) * s;
    strokeWrapped([[0, y], [W, y]], s * 0.12, "#132A1E");
  }
  for (let i = 0; i < 12; i++) {
    const y = (MOD_H - 7.0 - i * 0.3) * s;
    strokeWrapped([[0, y], [W, y]], s * 0.12, "#132A1E");
  }
  for (let i = 0; i < 140; i++) {
    let x = rng() * W;
    let y = rng() * H;
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < 3; k++) {
      if (rng() < 0.5) x += (rng() - 0.5) * s * 8;
      else y += (rng() - 0.5) * s * 6;
      pts.push([x, y]);
    }
    strokeWrapped(pts, s * (0.09 + rng() * 0.1), rng() < 0.5 ? "#12261B" : "#163021");
  }
  for (let i = 0; i < 90; i++) {
    const x = rng() * W;
    const y = rng() * H;
    for (const off of [-W, 0, W]) {
      r.fillStyle = "#2B3E30";
      r.beginPath();
      r.arc(x + off, y, s * 0.22, 0, Math.PI * 2);
      r.fill();
      r.fillStyle = "#08100B";
      r.beginPath();
      r.arc(x + off, y, s * 0.1, 0, Math.PI * 2);
      r.fill();
    }
  }
  // pin pads and fan-out: the tile is centred on a chip (tile x = W/2 at the chip centre)
  const cy = (wy: number) => (MOD_H - (wy - MOD_BOTTOM)) * s;
  for (const e of [-1, 1]) {
    for (let j = 0; j < PINS; j++) {
      const pz = -CHIP.w / 2 + 0.5 + (j + 0.5) * ((CHIP.w - 1.0) / PINS);
      const px = W / 2 + pz * s;
      const footY = cy(CHIP_Y + e * (CHIP.h / 2 + 0.6));
      r.fillStyle = "#8C8A70"; // tinned pad
      r.fillRect(px - 0.17 * s, footY - 0.4 * s, 0.34 * s, 0.8 * s);
      const len = (0.6 + ((j * 7) % 5) * 0.25) * s;
      const vy = footY - e * len; // canvas y grows downwards
      const vx = px + (j % 2 ? -1 : 1) * 0.25 * s;
      strokeWrapped([[px, footY - e * 0.4 * s], [px, vy], [vx, vy - e * 0.25 * s]], s * 0.09, "#173523");
      if (j % 3 === 0) {
        r.fillStyle = "#2B3E30";
        r.beginPath();
        r.arc(vx, vy - e * 0.25 * s, s * 0.17, 0, Math.PI * 2);
        r.fill();
      }
    }
  }
  const map = texOf(c, true);
  const roughMap = texOf(rough, false);
  for (const t of [map, roughMap]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return { map, roughMap };
};

/** Plain routing for the board ends (no chip pads). */
const marginTexture = () => {
  const W = 256;
  const H = 1024;
  const c = canvas(W, H);
  const r = c.getContext("2d")!;
  const rng = mulberry32(0x3a7);
  r.fillStyle = "#0C1A14";
  r.fillRect(0, 0, W, H);
  r.lineCap = "round";
  for (let i = 0; i < 40; i++) {
    let x = rng() * W;
    let y = rng() * H;
    r.strokeStyle = rng() < 0.5 ? "#12261B" : "#163021";
    r.lineWidth = 2 + rng() * 2;
    r.beginPath();
    r.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      if (rng() < 0.5) x += (rng() - 0.5) * 120;
      else y += (rng() - 0.5) * 200;
      r.lineTo(x, y);
    }
    r.stroke();
  }
  for (let i = 0; i < 18; i++) {
    r.fillStyle = "#2B3E30";
    r.beginPath();
    r.arc(rng() * W, rng() * H, 5, 0, Math.PI * 2);
    r.fill();
  }
  return texOf(c, true);
};

/** Gold edge fingers with a gap at the key notch (they sit mostly inside the slot). */
const fingers = () => {
  const W = 4096;
  const H = 128;
  const c = canvas(W, H);
  const r = c.getContext("2d")!;
  const rough = canvas(W, H);
  const rr = rough.getContext("2d")!;
  r.fillStyle = "#0C1A14";
  r.fillRect(0, 0, W, H);
  rr.fillStyle = "#8C8C8C";
  rr.fillRect(0, 0, W, H);
  const s = W / MOD_L;
  const notch = MOD_L * 0.37;
  for (let z = 1.2; z < MOD_L - 1; z += 0.85) {
    if (Math.abs(z - notch) < 1.4) continue;
    r.fillStyle = "#D2A24A";
    r.fillRect(z * s, 0, 0.5 * s, H * 0.92);
    rr.fillStyle = "#2C2C2C";
    rr.fillRect(z * s, 0, 0.5 * s, H * 0.92);
  }
  return { map: texOf(c, true), roughMap: texOf(rough, false), notch };
};

/** Motherboard texture (dark PCB with routing and vias), periodic along z with P. */
const motherboard = () => {
  const W = 1024;
  const H = 1024;
  const c = canvas(W, H);
  const r = c.getContext("2d")!;
  const rng = mulberry32(0x30b0);
  r.fillStyle = "#08100C";
  r.fillRect(0, 0, W, H);
  r.lineCap = "round";
  r.lineJoin = "round";
  for (let i = 0; i < 220; i++) {
    let x = rng() * W;
    let y = rng() * H;
    r.strokeStyle = rng() < 0.5 ? "#0F2016" : "#122619";
    r.lineWidth = 2 + rng() * 4;
    for (const off of [-H, 0, H]) {
      r.beginPath();
      let xx = x;
      let yy = y;
      r.moveTo(xx, yy + off);
      const rr = mulberry32(i * 31 + 7);
      for (let k = 0; k < 4; k++) {
        if (rr() < 0.5) xx += (rr() - 0.5) * 300;
        else yy += (rr() - 0.5) * 300;
        r.lineTo(xx, yy + off);
      }
      r.stroke();
    }
    x = 0;
    y = 0;
  }
  for (let i = 0; i < 160; i++) {
    const x = rng() * W;
    const y = rng() * H;
    for (const off of [-H, 0, H]) {
      r.fillStyle = "#3A4636";
      r.beginPath();
      r.arc(x, y + off, 5, 0, Math.PI * 2);
      r.fill();
      r.fillStyle = "#050806";
      r.beginPath();
      r.arc(x, y + off, 2.2, 0, Math.PI * 2);
      r.fill();
    }
  }
  const t = texOf(c, true);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
};

/** One gull-wing pin pointing +z, its "down" towards -x (the PCB). Origin on the PCB surface at the body edge. */
const pinGeometry = () => {
  const w = 0.3;
  const th = 0.13;
  const out1 = new THREE.BoxGeometry(th, w, 0.35).translate(CHIP.t * 0.45, 0, 0.175);
  const bend = new THREE.BoxGeometry(CHIP.t * 0.5, w, th).translate(CHIP.t * 0.2, 0, 0.36);
  const foot = new THREE.BoxGeometry(th, w, 0.45).translate(th / 2, 0, 0.58);
  return mergeGeometries([out1, bend, foot]);
};

/**
 * Cheap occlusion: surfaces low between the modules get less light, so the
 * gaps fall into deep shadow. A function of world height only (deterministic).
 */
const withAO = <T extends THREE.MeshStandardMaterial>(mat: T, minK: number): T => {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAOMin = { value: minK };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vAOY;")
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vec4 aoW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          aoW = instanceMatrix * aoW;
        #endif
        vAOY = (modelMatrix * aoW).y;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vAOY;\nuniform float uAOMin;")
      .replace(
        "#include <opaque_fragment>",
        `outgoingLight *= mix(uAOMin, 1.0, smoothstep(${MOD_BOTTOM.toFixed(2)}, ${(MOD_BOTTOM + MOD_H).toFixed(2)}, vAOY));
        #include <opaque_fragment>`,
      );
  };
  mat.customProgramCacheKey = () => `ao${minK}`;
  return mat;
};

export const ramMacro: LookFactory<RamParams> = (p, gl) => {
  RectAreaLightUniformsLib.init();
  const mode = p.mode ?? "anim";
  const scene = new THREE.Scene();
  scene.background = lin(mode === "checkModule" ? "#1A1C20" : "#000000");
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.5, 900);
  const post = defaultPost();
  // All geometry lives in `world`, which slides along z by exactly one chip pitch
  // per loop (world.z = P * phase). Camera and lights stay put.
  const world = new THREE.Group();

  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = mode === "checkModule" ? 0.5 : 0.035;

  const pcb = modulePcb();
  // tile boundaries at chipZ(k) - P/2; uv.u = (z + MOD_L/2) / MOD_L
  for (const t of [pcb.map, pcb.roughMap]) {
    t.repeat.set(MOD_L / P, 1);
    t.offset.set(-8 / P, 0);
  }
  const pcbMat = new THREE.MeshStandardMaterial({ map: pcb.map, roughnessMap: pcb.roughMap, roughness: 0.6, metalness: 0.1 });
  const chipMat = new THREE.MeshStandardMaterial({ color: "#141518", roughness: 0.45, metalness: 0.05 });
  const dotMat = new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.75 });
  const pinMat = new THREE.MeshStandardMaterial({ color: "#D6D9DE", roughness: 0.28, metalness: 1 });
  const smdBodyMat = new THREE.MeshStandardMaterial({ color: "#2A2018", roughness: 0.5 });
  const smdCapMat = new THREE.MeshStandardMaterial({ color: "#C8CCD2", roughness: 0.3, metalness: 1 });
  const plasticMat = new THREE.MeshStandardMaterial({ color: "#0A0A0B", roughness: 0.5 });
  const fing = fingers();
  const fingerMat = new THREE.MeshStandardMaterial({ map: fing.map, roughnessMap: fing.roughMap, metalness: 0.85, roughness: 0.9 });

  if (mode !== "checkModule")
    for (const mt of [pcbMat, chipMat, dotMat, pinMat, smdBodyMat, smdCapMat, plasticMat, fingerMat]) withAO(mt, 0.22);
  const nMods = mode === "checkModule" ? 1 : N_MOD;
  const xOf = (i: number) => (i - (nMods - 1)) * SLOT_PITCH; // the last module sits at x = 0

  // the module board, with the key notch cut into the bottom edge
  const shape = new THREE.Shape();
  const nz = -MOD_L / 2 + fing.notch;
  shape.moveTo(-MOD_L / 2, 0);
  shape.lineTo(nz - 0.6, 0);
  shape.lineTo(nz - 0.6, 3.0);
  shape.absarc(nz, 3.0, 0.6, Math.PI, 0, true);
  shape.lineTo(nz + 0.6, 0);
  shape.lineTo(MOD_L / 2, 0);
  // latch notches in both short edges
  shape.lineTo(MOD_L / 2, 11.5);
  shape.absarc(MOD_L / 2, 13.0, 1.5, -Math.PI / 2, Math.PI / 2, true);
  shape.lineTo(MOD_L / 2, MOD_H);
  shape.lineTo(-MOD_L / 2, MOD_H);
  shape.lineTo(-MOD_L / 2, 14.5);
  shape.absarc(-MOD_L / 2, 13.0, 1.5, Math.PI / 2, -Math.PI / 2, true);
  shape.closePath();
  const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: MOD_T, bevelEnabled: false, curveSegments: 12 });
  boardGeo.translate(0, 0, -MOD_T / 2);
  boardGeo.rotateY(-Math.PI / 2); // shape x -> world z, thickness -> world x
  {
    const pos = boardGeo.attributes.position;
    const uv = boardGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getZ(i) + MOD_L / 2) / MOD_L, pos.getY(i) / MOD_H);
    uv.needsUpdate = true;
  }
  const fingerGeo = new THREE.PlaneGeometry(MOD_L, 3.0);
  const chipGeo = new RoundedBoxGeometry(CHIP.t, CHIP.h, CHIP.w, 2, 0.12);
  const dotGeo = new THREE.CircleGeometry(0.28, 24).rotateY(Math.PI / 2);
  const pinGeo = pinGeometry();

  const nChips = nMods * CHIPS * 2;
  const chips = new THREE.InstancedMesh(chipGeo, chipMat, nChips);
  const dots = new THREE.InstancedMesh(dotGeo, dotMat, nChips);
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, nChips * PINS * 2);
  const SMD_PER = 9;
  const nSmd = nMods * 2 * CHIPS * SMD_PER;
  const smdBody = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.8, 1.0), smdBodyMat, nSmd);
  const smdCap = new THREE.InstancedMesh(new THREE.BoxGeometry(0.47, 0.82, 0.3), smdCapMat, nSmd * 2);
  const m = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const v = new THREE.Vector3();
  const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const id = new THREE.Quaternion();
  const rotX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  // Pins point +z with "down" towards -x. The pin is symmetric in y, so each
  // side/edge variant is a proper rotation (no mirroring, so normals stay right).
  const rx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const rz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
  const ry = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  const pinRot = (side: number, e: number) => (side > 0 ? (e > 0 ? id : rx) : e > 0 ? rz : ry);
  // chip pins leave the long (top/bottom) edges: +z -> e*y, then mirror to the other face by a y-turn
  const up90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const dn90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const pinRotY = (side: number, e: number) => {
    const qe = e > 0 ? up90 : dn90;
    return side > 0 ? qe.clone() : ry.clone().multiply(qe);
  };
  let ci = 0;
  let pi = 0;
  let si = 0;
  let sc = 0;
  // SMD layout, the same in every chip pitch (periodic): decoupling caps in the gap
  // beside each chip's pin rows (vertical), and termination resistors below the chips.
  const smdLayout: { dz: number; y: number; rot: boolean }[] = [];
  const gapZ = P / 2; // the gap between neighbouring chips
  for (const fy of [0.3, 0.7]) smdLayout.push({ dz: gapZ, y: CHIP_Y - CHIP.h / 2 + fy * CHIP.h, rot: true });
  for (let i = 0; i < 4; i++) smdLayout.push({ dz: -CHIP.w / 2 + 1.6 + i * 3.3, y: CHIP_Y - CHIP.h / 2 - 2.4, rot: false });
  for (let i = 0; i < 3; i++) smdLayout.push({ dz: -CHIP.w / 2 + 3.0 + i * 3.6, y: CHIP_Y - CHIP.h / 2 - 4.3, rot: false });
  for (let mi = 0; mi < nMods; mi++) {
    const mx = xOf(mi);
    const board = new THREE.Mesh(boardGeo, pcbMat);
    board.position.set(mx, MOD_BOTTOM, 0);
    world.add(board);
    for (const side of [1, -1]) {
      const f = new THREE.Mesh(fingerGeo, fingerMat);
      f.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      f.position.set(mx + side * (MOD_T / 2 + 0.01), MOD_BOTTOM + 1.5, 0);
      world.add(f);
      const cx = mx + side * (MOD_T / 2 + CHIP.t / 2 + 0.03);
      for (let k = 0; k < CHIPS; k++) {
        const cz = chipZ(k);
        m.compose(v.set(cx, CHIP_Y, cz), id, one);
        chips.setMatrixAt(ci, m);
        // pin-1 dot (the only mark)
        m.compose(v.set(cx + side * (CHIP.t / 2 + 0.005), CHIP_Y + CHIP.h / 2 - 1.1, cz - side * (CHIP.w / 2 - 1.1)), side > 0 ? id : flip, one);
        dots.setMatrixAt(ci, m);
        ci++;
        for (const e of [1, -1]) {
          for (let j = 0; j < PINS; j++) {
            const pz = cz - CHIP.w / 2 + 0.5 + (j + 0.5) * ((CHIP.w - 1.0) / PINS);
            m.compose(v.set(mx + side * (MOD_T / 2), CHIP_Y + (e * CHIP.h) / 2, pz), pinRotY(side, e), one);
            pins.setMatrixAt(pi++, m);
          }
        }
        for (const L of smdLayout) {
          const sx = mx + side * (MOD_T / 2 + 0.225);
          const z = cz + L.dz;
          m.compose(v.set(sx, L.y, z), L.rot ? rotX : id, one);
          smdBody.setMatrixAt(si++, m);
          for (const e of [-0.5, 0.5]) {
            const off = L.rot ? new THREE.Vector3(0, e, 0) : new THREE.Vector3(0, 0, e);
            m.compose(v.set(sx, L.y, z).add(off), L.rot ? rotX : id, one);
            smdCap.setMatrixAt(sc++, m);
          }
        }
      }
    }
    if (mode !== "checkModule") {
      const wallT = 2.2;
      const len = mode === "anim" ? 600 : MOD_L + 6; // in the loop the housing is uniform along z
      for (const s of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(wallT, SLOT_TOP, len), plasticMat);
        wall.position.set(mx + s * (MOD_T / 2 + 0.3 + wallT / 2), SLOT_TOP / 2, 0);
        world.add(wall);
      }
      if (mode === "checkRow")
        for (const s of [-1, 1]) {
          // latch: a lever hinged at the socket end with a hook over the module corner
          const lever = new THREE.Mesh(new THREE.BoxGeometry(MOD_T + 0.6 + 2 * wallT, SLOT_TOP + 7, 2.2), plasticMat);
          lever.position.set(mx, (SLOT_TOP + 7) / 2, s * (MOD_L / 2 + 1.6));
          world.add(lever);
          const hook = new THREE.Mesh(new THREE.BoxGeometry(MOD_T + 2.4, 1.2, 2.4), plasticMat);
          hook.position.set(mx, SLOT_TOP + 6.2, s * (MOD_L / 2 + 0.2));
          world.add(hook);
        }
    }
  }
  // plain PCB over the end margins (the repeated chip tile would show stray pads there)
  const marginGeo = new THREE.PlaneGeometry(7.4, MOD_H - 3.4).rotateY(Math.PI / 2);
  const marginMat = new THREE.MeshStandardMaterial({ map: marginTexture(), roughness: 0.62, metalness: 0.1 });
  if (mode !== "checkModule") withAO(marginMat, 0.22);
  for (let mi = 0; mi < nMods; mi++)
    for (const side of [1, -1])
      for (const e of [-1, 1]) {
        const mg = new THREE.Mesh(marginGeo, marginMat);
        mg.position.set(xOf(mi) + side * (MOD_T / 2 + 0.004), MOD_BOTTOM + 3.4 + (MOD_H - 3.4) / 2, e * (MOD_L / 2 - 3.75));
        if (side < 0) mg.rotation.y = Math.PI;
        world.add(mg);
      }
  // contact shadow on the PCB under each chip
  const shadowGeo = new THREE.PlaneGeometry(CHIP.w + 0.9, CHIP.h + 0.5).rotateY(Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.55, depthWrite: false });
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, nChips);
  let shi = 0;
  for (let mi = 0; mi < nMods; mi++)
    for (const side of [1, -1])
      for (let k = 0; k < CHIPS; k++) {
        m.compose(v.set(xOf(mi) + side * (MOD_T / 2 + 0.006), CHIP_Y, chipZ(k)), side > 0 ? id : flip, one);
        shadows.setMatrixAt(shi++, m);
      }
  world.add(shadows);
  // SPD EEPROM: a small 8-pin package in the end margin (outside the looped view)
  const spdBody = new THREE.InstancedMesh(new RoundedBoxGeometry(0.9, 3.0, 4.0, 2, 0.08), chipMat, nMods);
  const spdPins = new THREE.InstancedMesh(pinGeo, pinMat, nMods * 8);
  let sp = 0;
  for (let mi = 0; mi < nMods; mi++) {
    const sx = xOf(mi) + (MOD_T / 2 + 0.45 + 0.03);
    const sz = MOD_L / 2 - 4.2;
    const sy = MOD_BOTTOM + 8.5;
    m.compose(v.set(sx, sy, sz), id, one);
    spdBody.setMatrixAt(mi, m);
    for (const e of [1, -1])
      for (let j = 0; j < 4; j++) {
        m.compose(v.set(xOf(mi) + MOD_T / 2, sy - 1.0 + j * 0.65, sz + e * 2.0), pinRot(1, e), one);
        spdPins.setMatrixAt(sp++, m);
      }
  }
  world.add(chips, dots, pins, smdBody, smdCap, spdBody, spdPins);
  scene.add(world);

  if (mode !== "checkModule") {
    const mbTex = motherboard();
    const spanZ = P * 60;
    mbTex.repeat.set(300 / (P * 7), spanZ / P);
    const mb = new THREE.Mesh(new THREE.PlaneGeometry(300, spanZ), new THREE.MeshStandardMaterial({ map: mbTex, roughness: 0.6 }));
    mb.rotation.x = -Math.PI / 2;
    mb.position.set(0, 0, chipZ(0) - P / 2);
    world.add(mb);
  }

  // ---- lights. In the loop they ride with the camera rig. ----
  let lightA: THREE.RectAreaLight;
  let lightB: THREE.RectAreaLight;
  let glow: THREE.RectAreaLight | null = null;
  if (mode === "checkModule") {
    const key = new THREE.RectAreaLight("#ffffff", 9, 240, 160);
    key.position.set(140, 100, 90);
    key.lookAt(0, 15, 0);
    scene.add(key);
    const fill = new THREE.RectAreaLight("#ffffff", 4, 240, 160);
    fill.position.set(-60, 80, -140);
    fill.lookAt(0, 15, 0);
    scene.add(fill);
    scene.add(new THREE.AmbientLight("#ffffff", 0.35));
    lightA = key;
    lightB = fill;
  } else {
    lightA = new THREE.RectAreaLight(lin(p.lightA), 12, 50, 50);
    lightB = new THREE.RectAreaLight(lin(p.lightB), 16, 80, 40);
    scene.add(lightA, lightB);
    scene.add(new THREE.AmbientLight(lin("#0B3A50"), 2.2));
    // a broad glow source far along the module (the bright haze at the top of the frame)
    glow = new THREE.RectAreaLight(lin(p.lightA), 14, 140, 80);
    scene.add(glow);
  }

  const look = new THREE.Vector3();
  const update = (frame: number) => {
    if (mode === "checkModule") {
      camera.fov = 26;
      if (DEBUG_CLOSE) {
        camera.position.set(14, CHIP_Y + 6, chipZ(4) + 12);
        camera.lookAt(0, CHIP_Y, chipZ(4));
      } else {
        camera.position.set(92, 46, 132);
        camera.lookAt(0, MOD_BOTTOM + 13, -4);
      }
      camera.updateProjectionMatrix();
      Object.assign(post, { aperture: 0, maxCoc: 0.0001 });
      return;
    }
    if (mode === "checkRow") {
      camera.fov = 30;
      camera.position.set(70, 95, 135);
      camera.lookAt(-22, 8, 0);
      camera.updateProjectionMatrix();
      lightA.position.set(-30, 80, 90);
      lightA.lookAt(-20, 15, 0);
      lightA.width = 160;
      lightA.height = 100;
      lightB.position.set(100, 40, -30);
      lightB.lookAt(-20, 15, 0);
      lightB.width = 160;
      lightB.height = 100;
      Object.assign(post, { aperture: 0.0, maxCoc: 0.0001 });
      return;
    }
    // slide exactly one chip pitch per loop
    world.position.z = P * phase(frame, 1);
    const zc = chipZ(4);
    const sway = wave(frame, 1);
    const top = MOD_BOTTOM + MOD_H;
    // Looking down across the bank at ~58°: each module shows its row of chips
    // above the next module, and the rows run diagonally across the frame.
    // The nearest chips are ~2.5 cm from the lens.
    camera.fov = 40;
    camera.updateProjectionMatrix();
    const tgt = new THREE.Vector3(-9.5, CHIP_Y - 1.5, zc - 2);
    const el = THREE.MathUtils.degToRad(57 + 2 * sway);
    const az = THREE.MathUtils.degToRad(32);
    const R = 27;
    camera.position.set(tgt.x + R * Math.cos(el) * Math.cos(az), tgt.y + R * Math.sin(el), tgt.z + R * Math.cos(el) * Math.sin(az));
    camera.lookAt(tgt);
    camera.updateMatrixWorld();
    // A (green) from the left and above, B (blue) from the right; whole-cycle drift
    lightA.position.set(-30 + 6 * wave(frame, 1, 0.1), top + 34 + 5 * cwave(frame, 2), zc + 30 + 8 * wave(frame, 1, 0.4));
    lightA.lookAt(-12, CHIP_Y, zc);
    lightB.position.set(26 + 5 * wave(frame, 1, 0.65), CHIP_Y + 2 + 4 * wave(frame, 2, 0.2), zc - 20 + 10 * cwave(frame, 1));
    lightB.lookAt(-12, CHIP_Y, zc - 4);
    // rack focus between the chips of the near module and of the next one (sine, 2 cycles)
    const fwdDir = new THREE.Vector3();
    camera.getWorldDirection(fwdDir);
    const dNear = new THREE.Vector3(-9 + 1.7, CHIP_Y, zc).sub(camera.position).dot(fwdDir);
    const dFar = new THREE.Vector3(-18 + 1.7, CHIP_Y, zc - 4).sub(camera.position).dot(fwdDir);
    post.focusDist = dNear + (dFar - dNear) * (0.5 - 0.5 * cwave(frame, 2));
    if (glow) {
      glow.position.set(-40, top + 30 + 4 * wave(frame, 1, 0.5), zc - 50);
      glow.lookAt(-12, CHIP_Y, zc - 6);
    }
  };

  Object.assign(post, {
    aperture: 0.12,
    maxCoc: 0.04,
    bloomStrength: 1.1,
    bloomThreshold: 0.45,
    bloomKnee: 0.5,
    bloomSpread: 0.7,
    exposure: 1.1,
    vignette: 0.2,
    grain: 0.02,
    saturation: 1.0,
  });
  if (mode !== "anim") Object.assign(post, { bloomStrength: 0.12, vignette: 0.1, grain: 0.005, exposure: 1.2 });
  return { scene, camera, post, update };
};

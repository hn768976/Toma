import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { clamp01, easeOutBack, easeOutCubic, range, TAU } from "../../lib/anim";
import { INTER, loadFonts, MONO } from "../../lib/fonts";
import { GLStage, LookFactory } from "../../lib/gl/Stage";
import { canvasTexture, hexToVec3, makeCanvas, premulBlend, rgba } from "../../lib/gl/tex";
import { drawIcon, IconName } from "../../lib/icons";
import { hash, mulberry32 } from "../../lib/random";
import { useAssets } from "../../lib/useAssets";
import type { NetworkRow } from "../../versions";

// Panel layout (panel-local units; panel lies on the ground plane) -------------
const PANEL_W = 6.4;
const PANEL_H = 4.2;
const CENTER_R = 0.56;
const NODE_R = 0.3;

const NODES: { icon: IconName; x: number; y: number }[] = (() => {
  const icons: IconName[] = ["user", "chart", "cloud", "gear", "database", "chat", "shield", "globe", "phone", "document"];
  const angles = [12, 48, 82, 118, 152, 192, 228, 262, 298, 334];
  const radial = [1.0, 0.86, 0.78, 0.9, 1.0, 0.98, 0.84, 0.76, 0.88, 0.95];
  return icons.map((icon, i) => {
    const a = (angles[i] * Math.PI) / 180;
    return { icon, x: Math.cos(a) * 2.5 * radial[i], y: Math.sin(a) * 1.58 * radial[i] };
  });
})();

// Build-in timing (frames)
const SPOKE_START = 92;
const SPOKE_STEP = 8;
const SPOKE_DUR = 18;
const spokeT0 = (i: number) => SPOKE_START + i * SPOKE_STEP;

// Static canvases ---------------------------------------------------------------
const groundCanvas = (row: NetworkRow) => {
  const S = 4096;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(1212);
  ctx.fillStyle = row.base;
  ctx.fillRect(0, 0, S, S);
  // faint circuit traces + block outlines
  for (let i = 0; i < 900; i++) {
    const x = r() * S;
    const y = r() * S;
    const t = r();
    ctx.strokeStyle = `rgba(90,130,190,${0.05 + r() * 0.14})`;
    ctx.lineWidth = r() < 0.8 ? 2 : 4;
    if (t < 0.5) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      const horiz = r() < 0.6;
      const L = 60 + r() * 600;
      const x1 = horiz ? x + L : x;
      const y1 = horiz ? y : y + L;
      ctx.lineTo(x1, y1);
      if (r() < 0.5) ctx.lineTo(horiz ? x1 + 40 : x1 + 40, horiz ? y1 + 40 : y1 + 40);
      ctx.stroke();
    } else if (t < 0.8) {
      ctx.strokeRect(x, y, 40 + r() * 260, 30 + r() * 200);
    } else {
      ctx.fillStyle = `rgba(150,180,230,${0.08 + r() * 0.2})`;
      for (let k = 0; k < 8; k++) if (r() < 0.6) ctx.fillRect(x + k * 22, y, 14, 6);
    }
  }
  return c;
};

const panelCanvas = (row: NetworkRow) => {
  const w = 2560;
  const h = Math.round((w * PANEL_H) / PANEL_W);
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.6);
  g.addColorStop(0, rgba(row.panel, 0.26));
  g.addColorStop(0.6, rgba(row.panel, 0.14));
  g.addColorStop(1, rgba(row.panel, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(180,210,255,0.08)";
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(190,215,255,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  // a few faint readouts on the panel
  ctx.font = `400 34px ${MONO}`;
  ctx.fillStyle = "rgba(190,215,255,0.35)";
  ctx.fillText("NODE LINK 10/10", 70, h - 70);
  ctx.fillText("SYNC 0.97", w - 300, 90);
  return c;
};

const centerCanvas = () => {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.translate(S / 2, S / 2);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.4, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.33, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fff";
  ctx.font = `800 ${S * 0.28}px ${INTER}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AI", 0, S * 0.02);
  return c;
};

const ringArcsCanvas = () => {
  const S = 1024;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = "#fff";
  for (const [r0, a0, a1, n] of [
    [0.46, 0.2, 2.2, 22],
    [0.46, 3.3, 5.6, 26],
    [0.4, 1.0, 1.9, 8],
    [0.4, 4.0, 4.8, 8],
  ] as [number, number, number, number][]) {
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r0 * S, Math.sin(a) * r0 * S, 7, 0, TAU);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 0.36 * S, -0.4, 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 0.36 * S, 2.7, 3.5);
  ctx.stroke();
  return c;
};

const nodeCanvas = (icon: IconName) => {
  const S = 512;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.4, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  drawIcon(ctx, icon, S / 2, S / 2, S * 0.48, "#fff", 1.8);
  return c;
};

const bracketCanvas = () => {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 16;
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(S - 20, 12);
  ctx.lineTo(12, 12);
  ctx.lineTo(12, S - 20);
  ctx.stroke();
  return c;
};

const glowCanvas = () => {
  const S = 256;
  const c = makeCanvas(S, S);
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.15, "rgba(220,235,255,0.8)");
  g.addColorStop(0.45, "rgba(120,170,255,0.15)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c;
};

// 5×7 dot-matrix digits
const DOT_FONT: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

const drawDotMatrix = (ctx: CanvasRenderingContext2D, w: number, h: number, seed: number, epoch: number, cols: number) => {
  ctx.clearRect(0, 0, w, h);
  const rowsN = 3;
  const cell = Math.min(w / (cols * 6 + 1), h / (rowsN * 8 + 1));
  for (let rr = 0; rr < rowsN; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      const d = String(Math.floor(hash(seed, rr, cc, epoch) * 10));
      const glyph = DOT_FONT[d];
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++) {
          const on = glyph[gy][gx] === "1";
          ctx.fillStyle = on ? "rgba(235,245,255,0.95)" : "rgba(120,150,200,0.12)";
          ctx.fillRect((cc * 6 + gx + 0.5) * cell, (rr * 8 + gy + 0.5) * cell, cell * 0.72, cell * 0.72);
        }
    }
  }
};

const tagCanvas = (row: NetworkRow, text: string, seed: number) => {
  const c = makeCanvas(512, 160);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(seed);
  ctx.fillStyle = rgba(row.tag, 0.95);
  ctx.fillRect(0, 10, 150, 54);
  ctx.fillStyle = "#1A0E04";
  ctx.font = `700 40px ${MONO}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 5), 10, 38);
  ctx.fillStyle = rgba(row.tag, 0.85);
  ctx.font = `500 34px ${MONO}`;
  ctx.fillText(text.slice(5), 168, 38);
  for (let k = 0; k < 9; k++) {
    ctx.fillStyle = rgba(row.tag, 0.25 + r() * 0.6);
    ctx.fillRect(k * 46, 92, 36, 16);
  }
  ctx.fillStyle = rgba(row.tag, 0.6);
  ctx.fillRect(0, 128, 300 + r() * 150, 6);
  return c;
};

// Scene ------------------------------------------------------------------------------
const quadMat = (tex: THREE.Texture, color: THREE.Vector3, additive = true) =>
  premulBlend(
    new THREE.ShaderMaterial({
      uniforms: { tMap: { value: tex }, uCol: { value: color }, uA: { value: 1 } },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `in vec2 vUv; uniform sampler2D tMap; uniform vec3 uCol; uniform float uA;
        void main(){ vec4 c = texture(tMap, vUv); gl_FragColor = vec4(c.rgb * uCol, c.a) * uA; }`,
    }),
    additive,
  );

const makeLook = (row: NetworkRow): LookFactory => ({ renderer, aspect }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, aspect, 0.2, 120);
  const white = hexToVec3(row.diagram);
  const rnd = mulberry32(4545);

  // ground
  const groundTex = canvasTexture(groundCanvas(row), renderer);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.repeat.set(3, 3);
  const envFade = { value: 0 };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.ShaderMaterial({
      uniforms: { tMap: { value: groundTex }, uFade: envFade },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv * 3.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `in vec2 vUv; uniform sampler2D tMap; uniform float uFade;
        void main(){ gl_FragColor = vec4(texture(tMap, vUv).rgb * uFade, 1.0); }`,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // dark blocks with faint edges (instanced boxes), keeping the panel area clear
  {
    const boxes: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let i = 0; i < 420; i++) {
      const x = (rnd() - 0.5) * 34;
      const z = (rnd() - 0.5) * 30 - 2;
      const w = 0.3 + rnd() * 1.6;
      const d = 0.3 + rnd() * 1.4;
      if (Math.abs(x) < PANEL_W / 2 + 1.9 + w / 2 && Math.abs(z) < PANEL_H / 2 + 1.7 + d / 2) continue;
      const h = 0.04 + Math.pow(rnd(), 2.2) * 1.1;
      boxes.push({ x, z, w, d, h });
    }
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uBlock: { value: hexToVec3(row.block) }, uFade: envFade },
      vertexShader: /* glsl */ `
        out vec2 vUv; out vec3 vN; out vec3 vScale;
        void main() {
          vUv = uv; vN = normal;
          vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        in vec2 vUv; in vec3 vN; in vec3 vScale;
        uniform vec3 uBlock; uniform float uFade;
        void main() {
          vec2 size = abs(vN.y) > 0.5 ? vScale.xz : (abs(vN.x) > 0.5 ? vScale.zy : vScale.xy);
          vec2 e = min(vUv, 1.0 - vUv) * size;
          float edge = 1.0 - smoothstep(0.0, 0.025, min(e.x, e.y));
          float top = step(0.5, vN.y);
          vec3 c = uBlock * (0.9 + 0.9 * top) + vec3(0.30, 0.42, 0.6) * edge * (0.35 + 0.45 * top);
          gl_FragColor = vec4(c * uFade, 1.0);
        }`,
    });
    const inst = new THREE.InstancedMesh(geo, mat, boxes.length);
    const m4 = new THREE.Matrix4();
    boxes.forEach((b, i) => {
      m4.compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
      inst.setMatrixAt(i, m4);
    });
    scene.add(inst);
  }

  // dot-matrix number grids (redrawn from the frame) and orange tags
  const dotGrids = [
    { x: -4.3, z: -1.6, w: 1.9, h: 1.0, cols: 6, y: 0.35, seed: 1 },
    { x: 4.3, z: -1.2, w: 1.1, h: 0.55, cols: 4, y: 0.25, seed: 2 },
    { x: 4.4, z: 2.7, w: 1.3, h: 0.6, cols: 5, y: 0.2, seed: 3 },
    { x: -4.4, z: 1.8, w: 1.1, h: 0.5, cols: 4, y: 0.15, seed: 4 },
  ].map((d) => {
    const c = makeCanvas(1024, Math.round((1024 * d.h) / d.w));
    const tex = canvasTexture(c, renderer);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), quadMat(tex, new THREE.Vector3(1, 1, 1)));
    m.rotation.x = -Math.PI / 2;
    m.position.set(d.x, d.y + 0.01, d.z);
    scene.add(m);
    // a dark pedestal block under it
    const ped = new THREE.Mesh(
      new THREE.BoxGeometry(d.w + 0.2, d.y, d.h + 0.2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(row.block) }),
    );
    ped.position.set(d.x, d.y / 2, d.z);
    scene.add(ped);
    return { ...d, canvas: c, tex, mat: m.material as THREE.ShaderMaterial };
  });

  const tags = [
    { x: -3.6, z: -2.9, text: "08:24TASK 07", s: 1.0 },
    { x: 4.4, z: 1.5, text: "47.12ROUTE 3", s: 1.1 },
    { x: 3.2, z: 3.4, text: "00:12SYNC OK", s: 1.0 },
    { x: -4.6, z: 0.5, text: "12.08LOAD 64", s: 0.9 },
    { x: 1.2, z: -3.4, text: "AX-09NODE 10", s: 0.9 },
  ].map((t, i) => {
    const tex = canvasTexture(tagCanvas(row, t.text, 30 + i), renderer);
    const mat = quadMat(tex, new THREE.Vector3(1, 1, 1), false);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * t.s, 0.5 * t.s), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(t.x, 0.05 + hash(i, 4) * 0.3, t.z);
    scene.add(m);
    return { mat, i };
  });

  // short glowing lines in the environment
  {
    const pos: number[] = [];
    for (let i = 0; i < 40; i++) {
      const x = (rnd() - 0.5) * 22;
      const z = (rnd() - 0.5) * 18;
      if (Math.abs(x) < PANEL_W / 2 + 0.5 && Math.abs(z) < PANEL_H / 2 + 0.5) continue;
      const horiz = rnd() < 0.6;
      const L = 0.4 + rnd() * 2;
      const y = 0.02 + rnd() * 0.6;
      const w = 0.018;
      const [x1, z1] = horiz ? [x + L, z] : [x, z + L];
      const nx = horiz ? 0 : w;
      const nz = horiz ? w : 0;
      pos.push(x - nx, y, z - nz, x + nx, y, z + nz, x1 - nx, y, z1 - nz, x1 - nx, y, z1 - nz, x + nx, y, z + nz, x1 + nx, y, z1 + nz);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { uFade: envFade },
        vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uFade; void main(){ gl_FragColor = vec4(vec3(0.45, 0.62, 0.9) * 0.6 * uFade, 0.0); }`,
        side: THREE.DoubleSide,
      }),
      true,
    );
    scene.add(new THREE.Mesh(geo, mat));
  }

  // ---- the panel and diagram
  const panel = new THREE.Group();
  panel.rotation.x = -Math.PI / 2;
  panel.position.y = 0.06;
  scene.add(panel);
  const panelMat = quadMat(canvasTexture(panelCanvas(row), renderer), new THREE.Vector3(1, 1, 1), false);
  const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), panelMat);
  panelMesh.renderOrder = 1;
  panel.add(panelMesh);

  const glowTex = canvasTexture(glowCanvas(), renderer);
  const centerGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), quadMat(glowTex, new THREE.Vector3(0.12, 0.2, 0.38)));
  centerGlow.position.z = 0.004;
  centerGlow.renderOrder = 2;
  panel.add(centerGlow);

  const centerMat = quadMat(canvasTexture(centerCanvas(), renderer), white);
  const centerMesh = new THREE.Mesh(new THREE.PlaneGeometry(CENTER_R * 2.5, CENTER_R * 2.5), centerMat);
  centerMesh.position.z = 0.01;
  centerMesh.renderOrder = 6;
  panel.add(centerMesh);

  const arcsMat = quadMat(canvasTexture(ringArcsCanvas(), renderer), white);
  const arcs = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), arcsMat);
  arcs.position.z = 0.008;
  arcs.renderOrder = 5;
  panel.add(arcs);

  // spokes: ribbons rebuilt each frame from draw-on progress
  const spokeGeo = new THREE.BufferGeometry();
  const spokePos = new Float32Array(NODES.length * 6 * 3);
  spokeGeo.setAttribute("position", new THREE.BufferAttribute(spokePos, 3).setUsage(THREE.DynamicDrawUsage));
  const spokeMat = premulBlend(
    new THREE.ShaderMaterial({
      uniforms: { uCol: { value: white } },
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uCol; void main(){ gl_FragColor = vec4(uCol * 0.8, 0.0); }`,
      side: THREE.DoubleSide,
    }),
    true,
  );
  const spokes = new THREE.Mesh(spokeGeo, spokeMat);
  spokes.renderOrder = 4;
  spokes.frustumCulled = false;
  panel.add(spokes);

  const nodes = NODES.map((n) => {
    const mat = quadMat(canvasTexture(nodeCanvas(n.icon), renderer), white);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(NODE_R * 2.5, NODE_R * 2.5), mat);
    m.position.set(n.x, n.y, 0.012);
    m.renderOrder = 7;
    panel.add(m);
    const g = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), quadMat(glowTex, new THREE.Vector3(0.12, 0.18, 0.32)));
    g.position.set(n.x, n.y, 0.006);
    g.renderOrder = 3;
    panel.add(g);
    return { m, mat, g, gm: g.material as THREE.ShaderMaterial };
  });

  // pulses along spokes
  const pulses = NODES.map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), quadMat(glowTex, new THREE.Vector3(0.8, 0.85, 1)));
    m.renderOrder = 8;
    panel.add(m);
    return m;
  });

  // HUD corner brackets
  const brTex = canvasTexture(bracketCanvas(), renderer);
  const brackets = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ].map(([sx, sy], i) => {
    const mat = quadMat(brTex, white);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), mat);
    m.rotation.z = [0, -Math.PI / 2, Math.PI, Math.PI / 2][i];
    m.renderOrder = 6;
    panel.add(m);
    return { m, mat, sx, sy };
  });

  const target = new THREE.Vector3(0, 0, 0.1);

  const update = (frame: number) => {
    const env = easeOutCubic(range(frame, 30, 90));
    envFade.value = 0.15 + 0.85 * env;

    // camera: pitch 40° (panel tilted ~50° to the view), yawed, slow drift
    const t = frame / 600;
    const yaw = 0.5 + 0.06 * Math.sin(TAU * t * 0.8) - 0.08 * t;
    const pitch = ((40 + 2 * Math.sin(TAU * t * 0.6)) * Math.PI) / 180;
    const dist = 11.8 - 0.7 * easeOutCubic(range(frame, 0, 240)) - 0.35 * t;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target.x + 0.25, 0, target.z);
    camera.updateMatrixWorld();

    // panel fades up with the environment; centre faint until the spokes start
    panelMat.uniforms.uA.value = 0.15 + 0.85 * env;
    const centerA = 0.28 * range(frame, 40, 80) + 0.72 * range(frame, SPOKE_START - 6, SPOKE_START + 6);
    centerMat.uniforms.uA.value = centerA;
    (centerGlow.material as THREE.ShaderMaterial).uniforms.uA.value = centerA * (0.85 + 0.15 * Math.sin(frame * 0.08));
    arcsMat.uniforms.uA.value = range(frame, SPOKE_START, SPOKE_START + 20) * 0.85;
    arcs.rotation.z = frame * 0.004;

    // spokes draw out, nodes pop in one by one
    NODES.forEach((n, i) => {
      const p = easeOutCubic(range(frame, spokeT0(i), spokeT0(i) + SPOKE_DUR));
      const L = Math.hypot(n.x, n.y);
      const ux = n.x / L;
      const uy = n.y / L;
      const s0 = CENTER_R * 1.02;
      const s1 = s0 + (L - NODE_R - s0) * p;
      const w = 0.019;
      const nx = -uy * w;
      const ny = ux * w;
      const v = [
        [ux * s0 + nx, uy * s0 + ny], [ux * s0 - nx, uy * s0 - ny], [ux * s1 + nx, uy * s1 + ny],
        [ux * s1 + nx, uy * s1 + ny], [ux * s0 - nx, uy * s0 - ny], [ux * s1 - nx, uy * s1 - ny],
      ];
      v.forEach(([x, y], k) => spokePos.set(p > 0 ? [x, y, 0.009] : [0, 0, 0], (i * 6 + k) * 3));

      const popT = spokeT0(i) + SPOKE_DUR - 4;
      const pop = range(frame, popT, popT + 8);
      const sc = pop > 0 ? 0.9 + 0.1 * easeOutBack(pop) : 0.9;
      // nodes glow in turn during the hold (period 120 frames)
      const ph = ((frame - 190) / 120 - i / NODES.length + 10) % 1;
      const glow = frame > 190 ? Math.exp(-Math.pow(Math.min(ph, 1 - ph) * 8, 2)) : 0;
      nodes[i].m.scale.setScalar(sc);
      const flick = frame - popT < 3 && frame >= popT ? 0.4 : 1;
      nodes[i].mat.uniforms.uA.value = clamp01(pop * 1.5) * flick * (0.7 + 0.3 * glow);
      nodes[i].gm.uniforms.uA.value = clamp01(pop) * (0.25 + 0.75 * glow);

      // pulses travel centre → node once the spoke is drawn
      const pm = pulses[i];
      if (frame > spokeT0(i) + SPOKE_DUR + 10) {
        const per = 54 + (i % 3) * 9;
        const u = ((frame - spokeT0(i)) / per + hash(i, 3)) % 1;
        const s = s0 + (L - NODE_R - s0) * u;
        pm.position.set(ux * s, uy * s, 0.011);
        (pm.material as THREE.ShaderMaterial).uniforms.uA.value = Math.sin(Math.PI * u) * 0.9;
      } else (pm.material as THREE.ShaderMaterial).uniforms.uA.value = 0;
    });
    spokeGeo.attributes.position.needsUpdate = true;

    // brackets snap in
    brackets.forEach((b, i) => {
      const st = SPOKE_START + 2 + i * 3;
      const p = range(frame, st, st + 6);
      const off = 0.45 * (1 - easeOutCubic(p));
      b.m.position.set(b.sx * (PANEL_W / 2 - 0.12 + off), b.sy * (PANEL_H / 2 - 0.12 + off), 0.01);
      const flick = frame - st >= 0 && frame - st < 3 ? 0.4 : 1;
      b.mat.uniforms.uA.value = p * flick;
    });

    // dot matrices tick, tags blink
    dotGrids.forEach((d) => {
      const ctx = d.canvas.getContext("2d")!;
      drawDotMatrix(ctx, d.canvas.width, d.canvas.height, d.seed, Math.floor(frame / (8 + d.seed * 3)), d.cols);
      d.tex.needsUpdate = true;
      d.mat.uniforms.uA.value = env * 0.85;
    });
    tags.forEach((tg) => {
      const blink = hash(tg.i, Math.floor(frame / 20)) < 0.15 ? 0.35 : 1;
      tg.mat.uniforms.uA.value = env * blink;
    });

    const focus = camera.position.distanceTo(target);
    return {
      frame,
      bloom: { strength: 0.95, threshold: 0.5, knee: 0.3, radius: 1.0 },
      dof: { focus, aperture: 0.022, maxBlur: 0.012, nearScale: 0.7 },
      exposure: range(frame, 20, 60),
      vignette: 0.6,
      grain: 0.015,
    };
  };

  return { scene, camera, update };
};

export const AINetworkPanel: React.FC<{ row: NetworkRow }> = ({ row }) => {
  const ready = useAssets(() => loadFonts(), "network assets");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeLook(row), [row.id]);
  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{ready ? <GLStage create={create} /> : null}</AbsoluteFill>;
};

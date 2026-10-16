import React, { useMemo } from "react";
import * as THREE from "three";
import { MONO, SANS } from "../../lib/fonts";
import { LOOP_FRAMES, hexToRgb, loopFrame } from "../../lib/loop";
import { PostChain } from "../../lib/post";
import { Rng, hexString, int, mulberry32, pick, range } from "../../lib/random";
import { StageCtx, StageFactory, ThreeStage } from "../../lib/ThreeStage";

export interface HUDTunnelProps {
  bgEdge: string;
  bgCentre: string;
  line: string;
  accent: string;
  background: string;
}

// The wall pattern repeats every L along the tunnel; the camera travels exactly
// L per loop. Ring sets sit L/2 apart, so the set that is at distance d at
// frame 600 is identical to the one that was there at frame 0.
const L = 18;
const RING_SPACING = L / 2;
const RING_SETS = 4; // they cycle over 2L
const HALF_W = 3.2;
const HALF_H = 1.8;
const FAR = 2 * L;
const STREAK_CYCLES = 4; // streak layer moves 4 pattern lengths per loop (walls move 1)
const ARC_TURNS = [1, -2]; // whole turns per loop of the broken arcs

// ---------------------------------------------------------------------------
// textures (seeded, drawn once). Texture x runs along the tunnel (wraps).
// ---------------------------------------------------------------------------
const wrapDraw = (tw: number, fn: (dx: number) => void) => {
  fn(0);
  fn(-tw);
  fn(tw);
};

const drawCircuit = (c: CanvasRenderingContext2D, tw: number, th: number, r: Rng) => {
  c.clearRect(0, 0, tw, th);
  const s = th / 1024; // design scale
  c.strokeStyle = "#fff";
  c.fillStyle = "#fff";
  c.lineCap = "square";
  // circuit traces: runs along the tunnel with right-angle jogs, pads at the ends
  for (let i = 0; i < 480; i++) {
    let x = r() * tw;
    let y = r() * th;
    const lw = pick(r, [1.5, 2, 2, 3]) * s;
    const alpha = range(r, 0.55, 1);
    const pts: [number, number][] = [[x, y]];
    const segs = int(r, 2, 5);
    for (let k = 0; k < segs; k++) {
      if (k % 2 === 0) x += range(r, 0.01, 0.06) * tw * (r() < 0.85 ? 1 : -1);
      else y += range(r, -90, 90) * s;
      y = Math.max(4, Math.min(th - 4, y));
      pts.push([x, y]);
    }
    wrapDraw(tw, (dx) => {
      c.globalAlpha = alpha;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(pts[0][0] + dx, pts[0][1]);
      for (const [px, py] of pts.slice(1)) c.lineTo(px + dx, py);
      c.stroke();
      const [ex, ey] = pts[pts.length - 1];
      const [sx, sy] = pts[0];
      c.beginPath();
      c.arc(ex + dx, ey, lw * 2.2, 0, Math.PI * 2);
      c.stroke();
      c.fillRect(sx + dx - lw * 1.6, sy - lw * 1.6, lw * 3.2, lw * 3.2);
    });
  }
  // long thin rails along the tunnel
  for (let i = 0; i < 12; i++) {
    const y = r() * th;
    const x = r() * tw;
    const len = range(r, 0.2, 0.7) * tw;
    const a = range(r, 0.2, 0.6);
    wrapDraw(tw, (dx) => {
      c.globalAlpha = a;
      c.fillRect(x + dx, y, len, 1.2 * s);
    });
  }
  // rungs across (give the rush its rhythm)
  for (let i = 0; i < 70; i++) {
    const x = r() * tw;
    const y = r() * th;
    const len = range(r, 40, 260) * s;
    const a = range(r, 0.3, 0.8);
    wrapDraw(tw, (dx) => {
      c.globalAlpha = a;
      c.fillRect(x + dx, y, 2 * s, len);
    });
  }
  // chip outlines with tiny text
  for (let i = 0; i < 60; i++) {
    const w = range(r, 0.015, 0.05) * tw;
    const h = range(r, 50, 160) * s;
    const x = r() * tw;
    const y = r() * (th - h);
    const lines = Array.from({ length: Math.floor(h / (16 * s)) - 1 }, () => hexString(r, int(r, 4, 12)));
    const boxed = r() < 0.2;
    wrapDraw(tw, (dx) => {
      c.globalAlpha = 0.7;
      c.lineWidth = 1.5 * s;
      if (boxed) c.strokeRect(x + dx, y, w, h);
      c.font = `500 ${12 * s}px "${MONO}"`;
      c.globalAlpha = 0.85;
      lines.forEach((ln, k) => c.fillText(ln, x + dx + 4 * s, y + (k + 1.4) * 16 * s, w - 8 * s));
    });
  }
  // free tiny text
  for (let i = 0; i < 320; i++) {
    const x = r() * tw;
    const y = r() * th;
    const str = r() < 0.5 ? hexString(r, int(r, 6, 22)) : `${pick(r, ["NODE", "SCAN", "LINK", "SEG", "TRK"])} ${int(r, 10, 99)}`;
    const size = range(r, 11, 18) * s;
    const a = range(r, 0.4, 0.9);
    wrapDraw(tw, (dx) => {
      c.globalAlpha = a;
      c.font = `500 ${size}px "${MONO}"`;
      c.fillText(str, x + dx, y);
    });
  }
  // bright dots
  for (let i = 0; i < 90; i++) {
    const x = r() * tw;
    const y = r() * th;
    const rad = range(r, 4, 11) * s;
    wrapDraw(tw, (dx) => {
      c.globalAlpha = 1;
      c.shadowColor = "#fff";
      c.shadowBlur = rad * 2;
      c.beginPath();
      c.arc(x + dx, y, rad, 0, Math.PI * 2);
      c.fill();
    });
  }
  c.shadowBlur = 0;
  // fine specks
  for (let i = 0; i < 1400; i++) {
    const x = r() * tw;
    const y = r() * th;
    const a = range(r, 0.3, 1);
    const sz = range(r, 1, 2.5) * s;
    wrapDraw(tw, (dx) => {
      c.globalAlpha = a;
      c.fillRect(x + dx, y, sz, sz);
    });
  }
  c.globalAlpha = 1;
};

const drawStreaks = (c: CanvasRenderingContext2D, tw: number, th: number, r: Rng, count: number) => {
  c.clearRect(0, 0, tw, th);
  for (let i = 0; i < count; i++) {
    const y = r() * th;
    const x = r() * tw;
    const len = range(r, 0.03, 0.12) * tw;
    const w = range(r, 1, 2.2) * (th / 512);
    const a = range(r, 0.5, 1);
    wrapDraw(tw, (dx) => {
      // head (toward the camera = smaller x) bright, tail fades
      const g = c.createLinearGradient(x + dx, 0, x + dx + len, 0);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(x + dx, y - w / 2, len, w);
    });
  }
};

const drawRing = (c: CanvasRenderingContext2D, S: number, r: Rng, variant: number) => {
  c.clearRect(0, 0, S, S);
  const cx = S / 2;
  const R = S / 2;
  const s = S / 2048;
  c.strokeStyle = "#fff";
  c.fillStyle = "#fff";
  c.lineCap = "butt";
  // outer ring with ticks
  c.globalAlpha = 1;
  c.shadowColor = "#fff";
  c.shadowBlur = 24 * s;
  c.lineWidth = 9 * s;
  c.beginPath();
  c.arc(cx, cx, R * 0.95, 0, Math.PI * 2);
  c.stroke();
  c.shadowBlur = 0;
  c.globalAlpha = 0.9;
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    const len = (i % 15 === 0 ? 34 : i % 5 === 0 ? 20 : 10) * s;
    c.lineWidth = (i % 15 === 0 ? 3 : 2) * s;
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * R * 0.95, cx + Math.sin(a) * R * 0.95);
    c.lineTo(cx + Math.cos(a) * (R * 0.95 - len), cx + Math.sin(a) * (R * 0.95 - len));
    c.stroke();
  }
  // dots on the outer ring
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    c.beginPath();
    c.arc(cx + Math.cos(a) * R * 0.95, cx + Math.sin(a) * R * 0.95, 9 * s, 0, Math.PI * 2);
    c.fill();
  }
  // middle ring
  c.globalAlpha = 1;
  c.lineWidth = 5 * s;
  c.beginPath();
  c.arc(cx, cx, R * 0.54, 0, Math.PI * 2);
  c.stroke();
  // inner glowing ring
  c.globalAlpha = 1;
  c.shadowColor = "#fff";
  c.shadowBlur = 30 * s;
  c.lineWidth = 9 * s;
  c.beginPath();
  c.arc(cx, cx, R * 0.3, 0, Math.PI * 2);
  c.stroke();
  c.shadowBlur = 0;
  // labels
  c.globalAlpha = 0.9;
  c.font = `500 ${40 * s}px "${SANS}"`;
  c.textAlign = "center";
  c.fillText(variant === 0 ? "N 30" : "N 32", cx, cx - R * 0.68);
  c.font = `500 ${30 * s}px "${MONO}"`;
  c.fillText(`TR-${hexString(r, 4)}`, cx - R * 0.42, cx + R * 0.76);
  c.fillText(`${int(r, 100, 999)}.${int(r, 10, 99)}`, cx + R * 0.45, cx + R * 0.76);
  c.textAlign = "left";
  c.fillText(hexString(r, 6), cx + R * 0.66, cx - R * 0.08);
  c.textAlign = "right";
  c.fillText(`SEG ${int(r, 10, 99)}`, cx - R * 0.66, cx - R * 0.08);
  c.textAlign = "left";
  c.globalAlpha = 1;
};

const drawArc = (c: CanvasRenderingContext2D, S: number, r: Rng, radius: number, width: number) => {
  c.clearRect(0, 0, S, S);
  const cx = S / 2;
  const s = S / 2048;
  c.strokeStyle = "#fff";
  c.lineCap = "butt";
  let a = r() * Math.PI * 2;
  // a bold tick ladder: short thick radial dashes along ~0.9 rad, like a gauge scale
  const R0 = (S / 2) * radius;
  c.globalAlpha = 0.95;
  c.lineWidth = width * s * 1.4;
  for (let k = 0; k < 26; k++) {
    const ang = a + (k / 26) * 0.9;
    c.beginPath();
    c.moveTo(cx + Math.cos(ang) * (R0 - 26 * s), cx + Math.sin(ang) * (R0 - 26 * s));
    c.lineTo(cx + Math.cos(ang) * (R0 + 26 * s), cx + Math.sin(ang) * (R0 + 26 * s));
    c.stroke();
  }
  a += 0.9 + range(r, 0.3, 0.6);
  for (let i = 0; i < 3; i++) {
    const len = range(r, 0.3, 1.1);
    c.globalAlpha = range(r, 0.6, 1);
    c.lineWidth = width * s * (i === 0 ? 2 : 1);
    c.beginPath();
    c.arc(cx, cx, (S / 2) * radius, a, a + len);
    c.stroke();
    a += len + range(r, 0.15, 0.6);
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------------------
const WALL_VS = /* glsl */ `
out vec2 vUv;
out float vDist;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDist = -wp.z;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const WALL_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vDist;
out vec4 outColor;
uniform sampler2D tCircuit;
uniform sampler2D tStreak;
uniform float uT;
uniform vec3 uLine;
uniform vec3 uAccent;
uniform float uL;
uniform float uStreakCycles;
uniform float uVOffset;
uniform float uGain;
void main() {
  float s = vDist / uL + uT;
  float a = texture(tCircuit, vec2(s, vUv.y + uVOffset)).a;
  float st = texture(tStreak, vec2(vDist / uL + uT * uStreakCycles, vUv.y + uVOffset)).a;
  float fog = exp(-vDist / 9.0) * smoothstep(26.0, 16.0, vDist) * smoothstep(0.0, 1.0, vDist);
  vec3 col = (uLine * a * 0.9 + uAccent * st * 1.4) * fog * uGain;
  outColor = vec4(col, 1.0);
}`;

const RING_VS = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D map;
uniform vec3 uColor;
uniform float uFade;
void main() {
  float a = texture(map, vUv).a;
  outColor = vec4(uColor * a * uFade, 1.0);
}`;

const BG_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 uEdge;
uniform vec3 uCentre;
uniform float uAspect;
void main() {
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float d = smoothstep(0.05, 0.85, length(q));
  outColor = vec4(mix(uCentre, uEdge, d), 1.0);
}`;

const additive = {
  transparent: true,
  depthTest: false,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendEquation: THREE.AddEquation,
} as const;

const createApp = (props: HUDTunnelProps) => (ctx: StageCtx) => {
  const { gl, width: W, height: H } = ctx;
  const post = new PostChain(gl, W, H, {
    msaa: 4,
    bloom: { threshold: 0.6, strength: 0.85 },
    dither: true,
    grain: 0.01,
  });
  const r = mulberry32(0x7a11e1);
  const hi = H > 1000;
  const aniso = gl.capabilities.getMaxAnisotropy();

  const canvasTex = (w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, wrapS = true) => {
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    draw(cv.getContext("2d")!);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = aniso;
    if (wrapS) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
    }
    return tex;
  };

  const TW = hi ? 8192 : 4096;
  const TH = hi ? 2048 : 1024;
  const circuitSide = canvasTex(TW, TH, (c) => drawCircuit(c, TW, TH, r));
  const circuitFloor = canvasTex(TW, TH, (c) => drawCircuit(c, TW, TH, r));
  const streaks = canvasTex(TW / 2, TH / 2, (c) => drawStreaks(c, TW / 2, TH / 2, r, 220));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, W / H, 0.05, 200);

  // background gradient, drawn first
  const bgMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: BG_FS,
    uniforms: {
      uEdge: { value: new THREE.Vector3(...hexToRgb(props.bgEdge)) },
      uCentre: { value: new THREE.Vector3(...hexToRgb(props.bgCentre)) },
      uAspect: { value: W / H },
    },
    depthTest: false,
    depthWrite: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // walls
  const wallMats: THREE.ShaderMaterial[] = [];
  const wall = (tex: THREE.Texture, width: number, vOffset: number, gain: number, place: (m: THREE.Mesh) => void) => {
    const geo = new THREE.PlaneGeometry(FAR + 1, width, 1, 1);
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: WALL_VS,
      fragmentShader: WALL_FS,
      uniforms: {
        tCircuit: { value: tex },
        tStreak: { value: streaks },
        uT: { value: 0 },
        uLine: { value: new THREE.Vector3(...hexToRgb(props.line)) },
        uAccent: { value: new THREE.Vector3(...hexToRgb(props.accent)) },
        uL: { value: L },
        uStreakCycles: { value: STREAK_CYCLES },
        uVOffset: { value: vOffset },
        uGain: { value: gain },
      },
      side: THREE.DoubleSide,
      ...additive,
    });
    wallMats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    place(m);
    scene.add(m);
  };
  // plane's local x runs along the tunnel; centre it from z=+0.5 to z=-FAR
  const zc = -(FAR - 0.5) / 2 - 0.25;
  wall(circuitSide, 2 * HALF_H, 0.0, 0.8, (m) => {
    m.rotation.y = Math.PI / 2;
    m.position.set(-HALF_W, 0, zc);
  });
  wall(circuitSide, 2 * HALF_H, 0.5, 0.8, (m) => {
    m.rotation.y = Math.PI / 2;
    m.position.set(HALF_W, 0, zc);
  });
  wall(circuitFloor, 2 * HALF_W, 0.0, 0.42, (m) => {
    m.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    m.position.set(0, -HALF_H, zc);
  });
  wall(circuitFloor, 2 * HALF_W, 0.5, 0.42, (m) => {
    m.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    m.position.set(0, HALF_H, zc);
  });

  // ring sets: two designs alternating (period 2 in index => exact loop)
  const RS = hi ? 4096 : 2048;
  const ringTex = [0, 1].map((v) => canvasTex(RS, RS, (c) => drawRing(c, RS, r, v), false));
  const arcTex = [0, 1].map((v) => [canvasTex(RS, RS, (c) => drawArc(c, RS, r, 0.92, v === 0 ? 12 : 9), false)]);
  const ringRadius = 5.0;
  const ringGeo = new THREE.PlaneGeometry((2 * ringRadius) / 0.95, (2 * ringRadius) / 0.95);
  const line = new THREE.Vector3(...hexToRgb(props.line));
  const accent = new THREE.Vector3(...hexToRgb(props.accent));
  const mkRingMesh = (tex: THREE.Texture, color: THREE.Vector3) => {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: RING_VS,
      fragmentShader: RING_FS,
      uniforms: { map: { value: tex }, uColor: { value: color }, uFade: { value: 1 } },
      ...additive,
    });
    const m = new THREE.Mesh(ringGeo, mat);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const rings = Array.from({ length: RING_SETS }, (_, k) => ({
    k,
    base: mkRingMesh(ringTex[k % 2], line),
    arcs: [mkRingMesh(arcTex[k % 2][0], accent)],
  }));

  return {
    render(frame: number) {
      const f = loopFrame(frame);
      const t = f / LOOP_FRAMES;
      camera.position.set(0, 0, 0);
      camera.rotation.set(0, 0, ((1.6 * Math.PI) / 180) * Math.cos(2 * Math.PI * t));
      for (const m of wallMats) m.uniforms.uT.value = t;
      for (const ring of rings) {
        // distance shrinks by L per loop, wraps over RING_SETS * spacing = 2L
        const total = RING_SETS * RING_SPACING;
        const d = ((((ring.k * RING_SPACING - t * L + 1.2) % total) + total) % total);
        const z = -d;
        const fade = Math.exp(-d / 14) * THREE.MathUtils.smoothstep(27 - d, 0, 8) * THREE.MathUtils.smoothstep(d, 0.3, 1.2);
        ring.base.position.set(0, 0, z);
        (ring.base.material as THREE.ShaderMaterial).uniforms.uFade.value = fade;
        ring.arcs.forEach((a, i) => {
          a.position.set(0, 0, z);
          a.rotation.z = 2 * Math.PI * ARC_TURNS[i] * t + (ring.k % 2) * 1.3;
          (a.material as THREE.ShaderMaterial).uniforms.uFade.value = fade;
        });
      }
      post.render(scene, camera, f);
    },
    dispose() {
      post.dispose();
      [circuitSide, circuitFloor, streaks, ...ringTex, ...arcTex.flat()].forEach((x) => x.dispose());
      wallMats.forEach((m) => m.dispose());
    },
  };
};

export const HUDTunnel: React.FC<HUDTunnelProps> = (props) => {
  const factory: StageFactory = useMemo(
    () => createApp(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(props)],
  );
  return <ThreeStage factory={factory} background={props.background} />;
};

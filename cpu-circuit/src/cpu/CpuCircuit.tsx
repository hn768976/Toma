import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { z } from "zod";
import { CameraVariant, poseAt } from "./camera";
import {
  PAD_PITCH,
  PKG,
  PKG_H,
  makeCaps,
  makeDust,
  makePads,
  makeParticles,
  makeTraces,
  pointOnTrace,
} from "./layout";
import { mulberry32 } from "./random";
import {
  BOARD_FRAG,
  BOARD_VERT,
  DOF_FRAG,
  FINAL_FRAG,
  PAD_FRAG,
  PAD_VERT,
  PARTICLE_FRAG,
  PARTICLE_VERT,
  PKG_FRAG,
  PKG_VERT,
  QUAD_VERT,
  TRACE_FRAG,
  TRACE_VERT,
} from "./shaders";

export const cpuCircuitSchema = z.object({
  camera: z.enum(["reference", "crane"]),
});
export type CpuCircuitProps = z.infer<typeof cpuCircuitSchema>;

const CYAN = new THREE.Color(0.22, 0.72, 1.0);
const AMBER = new THREE.Color(1.0, 0.6, 0.12);
const NEAR = 0.05;
const FAR = 80;
// Lens model is authored for a 2160 px tall frame and scaled to the canvas.
const REF_H = 2160;

type World = ReturnType<typeof buildWorld>;

// "100" marking and the gold corner key, drawn on the package top.
const makeLabelTexture = () => {
  const S = 1024;
  const c = new OffscreenCanvas(S, S);
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  // Texture x = world x, texture y = world z (both 0..1 across the package).
  const toPx = (wx: number, wz: number): [number, number] => [
    ((wx + PKG) / PKG) * S,
    ((wz + PKG) / PKG) * S,
  ];
  g.strokeStyle = "#f00";
  g.lineWidth = 3.2;
  // "100" printed along the front edge, near the left corner.
  const [lx, lz] = toPx(-5.55, -0.42);
  const digit = (x: number, one: boolean) => {
    g.beginPath();
    if (one) {
      g.moveTo(x, lz - 9);
      g.lineTo(x, lz + 9);
    } else {
      g.ellipse(x, lz, 5, 9, 0, 0, Math.PI * 2);
    }
    g.stroke();
  };
  digit(lx, true);
  digit(lx + 12, false);
  digit(lx + 26, false);
  // Gold triangle key mark in the corner.
  const [tx, tz] = toPx(-5.85, -0.15);
  g.fillStyle = "#0f0";
  g.beginPath();
  g.moveTo(tx, tz);
  g.lineTo(tx + 34, tz);
  g.lineTo(tx, tz - 34);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c as unknown as HTMLCanvasElement);
  tex.flipY = false;
  tex.anisotropy = 8;
  return tex;
};

const buildWorld = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0.01, 0.014, 0.02);
  const camera = new THREE.PerspectiveCamera(35, width / height, NEAR, FAR);

  // Board.
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2).translate(5, 0, -8),
    new THREE.ShaderMaterial({
      vertexShader: BOARD_VERT,
      fragmentShader: BOARD_FRAG,
      uniforms: {
        uBase: { value: new THREE.Color(0.026, 0.034, 0.045) },
        uGlowA: { value: CYAN.clone() },
        uGlowB: { value: AMBER.clone() },
        uPower: { value: 0 },
        uPkg: { value: PKG },
      },
    }),
  );
  scene.add(board);

  // Package substrate.
  const pkg = new THREE.Mesh(
    new THREE.BoxGeometry(PKG, PKG_H, PKG).translate(
      -PKG / 2,
      PKG_H / 2,
      -PKG / 2,
    ),
    new THREE.ShaderMaterial({
      vertexShader: PKG_VERT,
      fragmentShader: PKG_FRAG,
      uniforms: {
        uTop: { value: new THREE.Color(0.016, 0.03, 0.022) },
        uSide: { value: new THREE.Color(0.02, 0.07, 0.04) },
        uLabel: { value: makeLabelTexture() },
        uSize: { value: PKG },
      },
    }),
  );
  scene.add(pkg);

  // Gold lands.
  const pads = makePads();
  const padSize = PAD_PITCH;
  const padMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(padSize, padSize).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: PAD_VERT,
      fragmentShader: PAD_FRAG,
      transparent: true,
      uniforms: {
        uGold: { value: new THREE.Color(0.52, 0.33, 0.06) },
        uGoldHi: { value: new THREE.Color(0.95, 0.72, 0.28) },
      },
    }),
    pads.length,
  );
  const m = new THREE.Matrix4();
  pads.forEach((p, i) => {
    m.makeTranslation(p.x, PKG_H + 0.002, p.z);
    padMesh.setMatrixAt(i, m);
  });
  scene.add(padMesh);

  // Capacitors in the cavity.
  const caps = makeCaps();
  const capMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.32, 0.22, 0.12) }),
    caps.length,
  );
  caps.forEach((c, i) => {
    m.compose(
      new THREE.Vector3(c.x, PKG_H + 0.04, c.z),
      new THREE.Quaternion(),
      new THREE.Vector3(c.w, 0.08, c.d),
    );
    capMesh.setMatrixAt(i, m);
  });
  scene.add(capMesh);

  // Traces as flat ribbons (wider than the line; the shader AA's the edge).
  const traces = makeTraces();
  const halfW = 0.007;
  const ribbon = halfW * 3;
  const pos: number[] = [];
  const across: number[] = [];
  const idx: number[] = [];
  for (const tr of traces) {
    for (let i = 1; i < tr.pts.length; i++) {
      const [x0, z0] = tr.pts[i - 1];
      const [x1, z1] = tr.pts[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1e-4) continue;
      // Extend by half a width so joints overlap cleanly.
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      const nx = -uz * ribbon;
      const nz = ux * ribbon;
      const ax = x0 - ux * halfW;
      const az = z0 - uz * halfW;
      const bx = x1 + ux * halfW;
      const bz = z1 + uz * halfW;
      const base = pos.length / 3;
      pos.push(
        ax + nx,
        0.004,
        az + nz,
        ax - nx,
        0.004,
        az - nz,
        bx + nx,
        0.004,
        bz + nz,
        bx - nx,
        0.004,
        bz - nz,
      );
      across.push(ribbon, -ribbon, ribbon, -ribbon);
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  traceGeo.setAttribute("across", new THREE.Float32BufferAttribute(across, 1));
  traceGeo.setIndex(idx);
  const traceMat = new THREE.ShaderMaterial({
    vertexShader: TRACE_VERT,
    fragmentShader: TRACE_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0.36, 0.4, 0.45) },
      uHalfW: { value: halfW },
      uWake: { value: 0 },
    },
  });
  scene.add(new THREE.Mesh(traceGeo, traceMat));

  // Glowing particles (rendered after the DOF pass, sized by their own CoC).
  const particles = makeParticles(traces);
  const dust = makeDust();
  const N = particles.length + dust.length;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(N * 3);
  const pCol = new Float32Array(N * 3);
  const pSize = new Float32Array(N);
  const pInt = new Float32Array(N);
  const rnd = mulberry32(7);
  particles.forEach((p, i) => {
    const c = p.amber ? AMBER : CYAN;
    const v = 0.85 + rnd() * 0.3;
    pCol.set([c.r * v, c.g * v, c.b * v], i * 3);
    pSize[i] = p.size;
  });
  dust.forEach((_, j) => {
    const i = particles.length + j;
    pCol.set([0.75, 0.8, 0.85], i * 3);
    pSize[i] = 0.012;
  });
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  pGeo.setAttribute("size", new THREE.BufferAttribute(pSize, 1));
  pGeo.setAttribute("intensity", new THREE.BufferAttribute(pInt, 1));
  const pMat = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uFocalPx: { value: 1 },
      uFocus: { value: 1 },
      uAperture: { value: 1 },
      uMaxCoc: { value: 1 },
    },
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  const pScene = new THREE.Scene();
  pScene.add(points);

  // Render targets. The opaque scene is low dynamic range (8-bit is enough
  // and much faster to filter); the composite is half-float so the lights
  // can exceed 1.0 before bloom.
  const rtOpts = {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: true,
    depthBuffer: true,
  };
  const rtScene = new THREE.WebGLRenderTarget(width, height, {
    ...rtOpts,
    type: THREE.UnsignedByteType,
  });
  rtScene.depthTexture = new THREE.DepthTexture(width, height);
  rtScene.depthTexture.type = THREE.FloatType;
  const rtComp = new THREE.WebGLRenderTarget(width, height, {
    ...rtOpts,
    depthBuffer: false,
  });

  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const dofMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: DOF_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: rtScene.texture },
      tDepth: { value: rtScene.depthTexture },
      uRes: { value: new THREE.Vector2(width, height) },
      uNear: { value: NEAR },
      uFar: { value: FAR },
      uFocus: { value: 1 },
      uAperture: { value: 1 },
      uMaxCoc: { value: 1 },
    },
  });
  const finalMat = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT,
    fragmentShader: FINAL_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: rtComp.texture },
      uRes: { value: new THREE.Vector2(width, height) },
      uMotion: { value: new THREE.Vector2() },
      uFrame: { value: 0 },
      uLift: { value: new THREE.Color(0.006, 0.01, 0.016) },
      uGain: { value: new THREE.Color(1.0, 1.0, 1.04) },
      uBloom: { value: 0.35 },
    },
  });
  const dofScene = new THREE.Scene();
  dofScene.add(new THREE.Mesh(quadGeo, dofMat));
  const finalScene = new THREE.Scene();
  finalScene.add(new THREE.Mesh(quadGeo, finalMat));
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  return {
    renderer,
    scene,
    camera,
    board,
    traceMat,
    traces,
    particles,
    dust,
    pGeo,
    pMat,
    pScene,
    rtScene,
    rtComp,
    dofMat,
    dofScene,
    finalMat,
    finalScene,
    orthoCam,
  };
};

const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const applyPose = (
  cam: THREE.PerspectiveCamera,
  variant: CameraVariant,
  t: number,
) => {
  const p = poseAt(variant, t);
  cam.position.set(...p.pos);
  cam.fov = p.fov;
  cam.up.set(0, 1, 0);
  cam.lookAt(new THREE.Vector3(...p.target));
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return p;
};

const renderFrame = (
  w: World,
  variant: CameraVariant,
  frame: number,
  fps: number,
) => {
  const { renderer, camera } = w;
  const t = frame / fps;
  const H = renderer.domElement.height;
  const lensScale = H / REF_H;

  // Screen-space motion of the look-at point between this frame and the
  // previous one drives the camera motion blur (strong during whip moves).
  applyPose(camera, variant, Math.max(0, t - 1 / fps));
  const probe = new THREE.Vector3(...poseAt(variant, t).target).project(camera);
  const pose = applyPose(camera, variant, t);
  const now = new THREE.Vector3(...pose.target).project(camera);
  const motion = new THREE.Vector2(
    ((probe.x - now.x) * renderer.domElement.width) / 2,
    ((probe.y - now.y) * H) / 2,
  );
  if (t < 1 / fps) motion.set(0, 0);

  // Focus on the board where the line of sight lands.
  const eye = new THREE.Vector3(...pose.pos);
  const dir = new THREE.Vector3(...pose.target).sub(eye).normalize();
  const focus =
    dir.y < -0.05
      ? eye.y / -dir.y
      : eye.distanceTo(new THREE.Vector3(...pose.target));
  const aperture = pose.aperture * lensScale;
  const maxCoc = 160 * lensScale;
  const focalPx = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

  // Lights wake up from the package edge outward during the opening.
  const pos = w.pGeo.getAttribute("position") as THREE.BufferAttribute;
  const inten = w.pGeo.getAttribute("intensity") as THREE.BufferAttribute;
  const P = pos.array as Float32Array;
  const I = inten.array as Float32Array;
  let power = 0;
  w.particles.forEach((p, i) => {
    let x = p.x;
    let zz = p.z;
    if (p.kind === 0) {
      const tr = w.traces[p.trace];
      let s = (p.s0 + p.speed * t) % tr.len;
      if (s < 0) s += tr.len;
      [x, zz] = pointOnTrace(tr, s);
    }
    P[i * 3] = x;
    P[i * 3 + 1] = p.y;
    P[i * 3 + 2] = zz;
    const dist = Math.hypot(
      Math.max(-PKG - x, x, 0),
      Math.max(-PKG - zz, zz, 0),
    );
    const wake = smoothstep(
      0,
      0.7,
      t - (0.5 + dist * 0.45 + (p.phase % 1) * 0.9),
    );
    const twinkle = 0.75 + 0.25 * Math.sin(t * (2 + (p.phase % 3)) + p.phase);
    I[i] = (p.kind === 1 ? 3.2 : 4.2) * wake * twinkle;
    power += wake;
  });
  w.dust.forEach((d, j) => {
    const i = w.particles.length + j;
    P[i * 3] = d.x + d.vx * t * 10 + 0.05 * Math.sin(t * 0.7 + j);
    P[i * 3 + 1] = d.y + d.vy * t * 10;
    P[i * 3 + 2] = d.z + d.vz * t * 10;
    I[i] = 0.8;
  });
  pos.needsUpdate = true;
  inten.needsUpdate = true;

  (w.board.material as THREE.ShaderMaterial).uniforms.uPower.value =
    power / w.particles.length;
  // Traces are dark until the signals reach them.
  w.traceMat.uniforms.uWake.value = 0.12 + 0.88 * smoothstep(0.6, 3.2, t);

  // 1. Opaque scene (board, package, lands, traces) with depth.
  renderer.setRenderTarget(w.rtScene);
  renderer.clear();
  renderer.render(w.scene, camera);

  // 2. Depth-of-field into the composite buffer.
  w.dofMat.uniforms.uFocus.value = focus;
  w.dofMat.uniforms.uAperture.value = aperture;
  w.dofMat.uniforms.uMaxCoc.value = maxCoc;
  renderer.setRenderTarget(w.rtComp);
  renderer.clear();
  renderer.render(w.dofScene, w.orthoCam);

  // 3. Lights on top, each blurred by its own circle of confusion.
  w.pMat.uniforms.uFocalPx.value = focalPx;
  w.pMat.uniforms.uFocus.value = focus;
  w.pMat.uniforms.uAperture.value = aperture;
  w.pMat.uniforms.uMaxCoc.value = maxCoc;
  renderer.render(w.pScene, camera);

  // 4. Motion blur, bloom, grade to the canvas.
  w.finalMat.uniforms.uMotion.value.copy(motion);
  w.finalMat.uniforms.uFrame.value = frame;
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(w.finalScene, w.orthoCam);
};

export const CpuCircuit: React.FC<CpuCircuitProps> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);

  // Built synchronously on first layout, then redrawn for every frame before
  // Remotion captures it.
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    if (!worldRef.current)
      worldRef.current = buildWorld(canvasRef.current, width, height);
    renderFrame(worldRef.current, camera, frame, fps);
  }, [frame, fps, width, height, camera]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height }}
      />
    </AbsoluteFill>
  );
};

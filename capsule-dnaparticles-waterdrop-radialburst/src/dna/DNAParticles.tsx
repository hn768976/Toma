import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import { Container, Mesh, RenderTexture, WebGLRenderer } from 'pixi.js';
import { DNARow } from '../data';
import { PixiCanvas } from '../lib/PixiCanvas';
import { FULLSCREEN_VERT, fullscreenMesh, instancedQuadGeometry, makeShader } from '../lib/pixiUtil';
import { gauss, hexToRgb, mulberry32 } from '../lib/random';
import { ident, invRotateDir, mul, rotX, rotZ, translate } from '../lib/mat4';
import { DNA_FINAL_FRAG, DNA_FRAG, DNA_VERT } from './dnaShaders';

// ---- geometry constants (world units; frame height at the focus distance is ~3.2)
export const DNA = {
  N: 50, // base pairs along the helix (5 turns, ends off screen)
  bpPerTurn: 10,
  radius: 0.58,
  pitch: 2.02, // ~1.75 x diameter (B-DNA is ~1.7)
  groove: (120 / 360) * Math.PI * 2, // strand 2 offset: minor groove 120 deg, major 240 deg (1/3 : 2/3 along the axis)
  fovY: (30 * Math.PI) / 180,
  focus: 6.0,
  backbone: 80000,
  rungs: 25000,
  loose: 15000,
};

const LOOP_FRAMES = 600;

type Particles = { aA: Float32Array; aB: Float32Array; aC: Float32Array; aD: Float32Array; count: number };

// Generated once at module level from a fixed seed. Helix particles use the
// same pattern in every base-pair segment, so shifting the helix by exactly
// one step maps the particle set onto itself: the 600-frame loop is exact.
const buildParticles = (): Particles => {
  const { N, backbone, rungs, loose } = DNA;
  const count = backbone + rungs + loose;
  const aA = new Float32Array(count * 4);
  const aB = new Float32Array(count * 4);
  const aC = new Float32Array(count * 4);
  const aD = new Float32Array(count * 4);
  const rand = mulberry32(0xd1a);
  let i = 0;
  const put = (A: number[], B: number[], C: number[], D: number[]) => {
    aA.set(A, i * 4); aB.set(B, i * 4); aC.set(C, i * 4); aD.set(D, i * 4);
    i++;
  };
  const cloudOffset = () => {
    // a broad dusty cloud around the helix axis
    return [gauss(rand) * 0.6, gauss(rand) * 0.45, gauss(rand) * 0.35];
  };
  // backbone: per-segment pattern
  const perSegB = Math.floor(backbone / N);
  const segB: number[][][] = [];
  for (let j = 0; j < perSegB; j++) {
    const f = rand();
    const strand = j % 2;
    const r = Math.abs(gauss(rand)) < 2.2 ? gauss(rand) : 0;
    const thick = 0.05;
    const big = rand() < 0.03;
    const size = big ? 0.009 + rand() * 0.008 : 0.0035 + rand() * 0.0035;
    segB.push([
      [0, f, strand, rand()],
      [r * thick, gauss(rand) * thick * 0.6, gauss(rand) * thick, size],
      [0, 0, 0, 1.5 * (0.55 + rand() * 0.45) * (big ? 0.7 : 1)],
      [1 + Math.floor(rand() * 3), Math.floor(rand() * 9) - 4, rand(), 0],
    ]);
  }
  for (let k = 0; k < N; k++)
    for (let j = 0; j < perSegB; j++) {
      const t = segB[j];
      const c = cloudOffset();
      put([t[0][0], k + t[0][1], t[0][2], t[0][3]], t[1], [c[0], c[1], c[2], t[2][3]], t[3]);
    }
  // rungs: one base pair per step, drawn as two half lines with a small gap
  const perSegR = Math.floor(rungs / N);
  const segR: number[][][] = [];
  for (let j = 0; j < perSegR; j++) {
    let u = 0.04 + rand() * 0.92;
    if (Math.abs(u - 0.5) < 0.035) u += u < 0.5 ? -0.035 : 0.035;
    const big = rand() < 0.02;
    segR.push([
      [1, rand() * 0.04, u, rand()],
      [gauss(rand) * 0.016, gauss(rand) * 0.016, gauss(rand) * 0.016, big ? 0.008 : 0.003 + rand() * 0.0025],
      [0, 0, 0, 0.75 + rand() * 0.45],
      [1 + Math.floor(rand() * 3), Math.floor(rand() * 9) - 4, rand(), 0],
    ]);
  }
  for (let k = 0; k < N; k++)
    for (let j = 0; j < perSegR; j++) {
      const t = segR[j];
      const c = cloudOffset();
      put([t[0][0], k + t[0][1], t[0][2], t[0][3]], t[1], [c[0], c[1], c[2], t[2][3]], t[3]);
    }
  // loose particles (world/view space): most hug the helix, the rest fill the volume
  while (i < count) {
    const nearHelix = rand() < 0.6;
    let x: number, y: number, z: number;
    if (nearHelix) {
      // along the helix axis, spread around it (computed in helix-local space then placed)
      const s = (rand() - 0.5) * 5.5;
      // most drift off to the right of the helix, like debris
      const lx = (rand() < 0.72 ? 1 : -1) * (Math.abs(gauss(rand)) * 0.5 + 0.3), lz = gauss(rand) * 0.7;
      const p = helixLocalToView([lx, s, lz]);
      [x, y, z] = p;
      z += 0;
    } else {
      z = -(2.2 + rand() * 9.5);
      const h = Math.tan(DNA.fovY / 2) * -z;
      x = (rand() * 1.25 - 1) * h * (16 / 9) * 1.1; // keep the far right (copy space) nearly empty
      y = (rand() * 2 - 1) * h * 1.1;
    }
    const big = rand() < 0.06;
    const size = big ? 0.015 + rand() * 0.025 : 0.006 + rand() * 0.007;
    const amp = 0.04 + rand() * 0.12;
    put(
      [2, x, y, rand()],
      [nearHelix ? 1 : 0, 0, z, size],
      [amp * (rand() * 2 - 1), amp * (rand() * 2 - 1), amp * (rand() * 2 - 1), (nearHelix ? 0.32 : 0.2) * (0.4 + rand() * 0.6) * (big ? 0.55 : 1)],
      [1 + Math.floor(rand() * 3), 0, rand() < 0.6 ? 1 : rand() * 0.5, 1 + Math.floor(rand() * 2)],
    );
  }
  return { aA, aB, aC, aD, count };
};

// helix placement: centre left of frame, top leaning left and away
const HELIX_CENTER: [number, number, number] = [-0.75, -0.05, -DNA.focus];
const HELIX_ROLL = (25 * Math.PI) / 180; // in-plane lean (top to the left)
const HELIX_PITCH = (18 * Math.PI) / 180; // top recedes from the camera
const modelMatrix = () => mul(translate(...HELIX_CENTER), mul(rotZ(HELIX_ROLL), rotX(-HELIX_PITCH)));
const helixLocalToView = (p: [number, number, number]): [number, number, number] => {
  const m = modelMatrix();
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
};

const PARTICLES = buildParticles();

const easeInOut = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const createScene = (row: DNARow) => async (renderer: WebGLRenderer, pw: number, ph: number) => {
  const geometry = instancedQuadGeometry(
    {
      aA: { data: PARTICLES.aA, size: 4 },
      aB: { data: PARTICLES.aB, size: 4 },
      aC: { data: PARTICLES.aC, size: 4 },
      aD: { data: PARTICLES.aD, size: 4 },
    },
    PARTICLES.count,
  );
  const f = 1 / Math.tan(DNA.fovY / 2);
  const v3 = (hex: string) => new Float32Array(hexToRgb(hex));
  const { shader, group } = makeShader('dna-particles', DNA_VERT, DNA_FRAG, {
    uModel: { value: ident(), type: 'mat4x4<f32>' },
    uView: { value: ident(), type: 'mat4x4<f32>' },
    uViewDirLocal: { value: new Float32Array([0, 0, 1]), type: 'vec3<f32>' },
    uPhase: { value: 0, type: 'f32' },
    uLoopT: { value: 0, type: 'f32' },
    uN: { value: DNA.N, type: 'f32' },
    uRise: { value: DNA.pitch / DNA.bpPerTurn, type: 'f32' },
    uRadius: { value: DNA.radius, type: 'f32' },
    uTwist: { value: (Math.PI * 2) / DNA.bpPerTurn, type: 'f32' },
    uGroove: { value: DNA.groove, type: 'f32' },
    uFocalN: { value: f / 2, type: 'f32' },
    uAspect: { value: pw / ph, type: 'f32' },
    uFocus: { value: DNA.focus, type: 'f32' },
    uAperture: { value: 0.032, type: 'f32' },
    uPx: { value: 1 / ph, type: 'f32' },
    uGain: { value: 1, type: 'f32' },
    uColA: { value: v3(row.strandA), type: 'vec3<f32>' },
    uColB: { value: v3(row.strandB), type: 'vec3<f32>' },
    uColRung: { value: v3(row.rung), type: 'vec3<f32>' },
    uColLoose: { value: v3(row.loose), type: 'vec3<f32>' },
    uStory: { value: row.mode === 'form' ? 1 : 0, type: 'f32' },
    uTime: { value: 0, type: 'f32' },
    uCloudShift: { value: new Float32Array([0, 0, 0]), type: 'vec3<f32>' },
    uCloudAlpha: { value: 0, type: 'f32' },
    uCloudSwirl: { value: 0, type: 'f32' },
    uGatherStart: { value: 5.5, type: 'f32' },
    uGatherDur: { value: 1.9, type: 'f32' },
    uGatherStagger: { value: 1.6, type: 'f32' },
    uLooseAlpha: { value: 1, type: 'f32' },
  });
  const particles = new Mesh({ geometry, shader });
  particles.blendMode = 'add';
  const particleStage = new Container();
  particleStage.addChild(particles);

  const rt = RenderTexture.create({ width: pw, height: ph, format: 'rgba16float', resolution: 1, antialias: false });

  const fin = makeShader('dna-final', FULLSCREEN_VERT, DNA_FINAL_FRAG, {
    uBg: { value: v3(row.background), type: 'vec3<f32>' },
    uBgRight: { value: v3(row.backgroundRight), type: 'vec3<f32>' },
    uBgGlow: { value: v3(row.glow), type: 'vec3<f32>' },
    uGlowPos: { value: new Float32Array([0.08, 0.6]), type: 'vec2<f32>' },
    uGridAlpha: { value: 0.05, type: 'f32' },
    uGridPeriod: { value: 0.0068, type: 'f32' },
    uRes: { value: new Float32Array([pw, ph]), type: 'vec2<f32>' },
    uFrameMod: { value: 0, type: 'f32' },
    uExposure: { value: 0.7, type: 'f32' },
  }, { uTexture: rt.source });
  const { container: finalStage } = fullscreenMesh(fin.shader);

  // pixel gain: the particle energies are tuned against a 2160-line frame;
  // energy conservation keeps the look identical at any resolution.
  const u = group.uniforms as Record<string, unknown>;
  const fu = fin.group.uniforms as Record<string, unknown>;

  const render = (frame: number) => {
    const t = frame / 30;
    const loopT = (frame % LOOP_FRAMES) / LOOP_FRAMES;
    // screw motion: one base-pair step (36 deg turn + one rise) per 600 frames
    u.uPhase = row.mode === 'loop' ? loopT : frame / LOOP_FRAMES;
    u.uLoopT = loopT;
    u.uTime = t;
    const model = modelMatrix();
    let view = ident();
    if (row.mode === 'form') {
      // slow camera drift that settles into the final framing
      const k = 1 - easeInOut(t / 9);
      view = translate(-0.35 * k, 0.12 * k, -0.6 * k);
      const sweep = 1 - easeInOut((t - 2.6) / 3.6);
      (u.uCloudShift as Float32Array).set([-1.6 * sweep, -2.6 * sweep, 0.3 * sweep]);
      u.uCloudAlpha = easeInOut((t - 2.8) / 2.0);
      u.uCloudSwirl = 2.2;
      u.uLooseAlpha = 1;
    }
    u.uView = view;
    u.uModel = mul(view, model);
    const toCam = invRotateDir(model, [-model[12], -model[13], -model[14]]);
    const len = Math.hypot(...toCam);
    (u.uViewDirLocal as Float32Array).set([toCam[0] / len, toCam[1] / len, toCam[2] / len]);
    group.update();
    fu.uFrameMod = frame % row.durationInFrames;
    fin.group.update();
    renderer.render({ container: particleStage, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: finalStage });
  };

  return {
    render,
    destroy: () => {
      rt.destroy(true);
      particleStage.destroy({ children: true });
      finalStage.destroy({ children: true });
    },
  };
};

export const DNAParticles: React.FC<{ row: DNARow }> = ({ row }) => {
  const create = useCallback(createScene(row), [row]);
  return (
    <AbsoluteFill style={{ backgroundColor: row.background }}>
      <PixiCanvas create={create} />
    </AbsoluteFill>
  );
};

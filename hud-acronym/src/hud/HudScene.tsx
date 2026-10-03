/**
 * The 3D scene plus a hand-built post chain:
 *   board (+ pulses) -> depth-of-field blur
 *   outer rings      -> wide blur (out of focus, near camera)
 *   word + inner/middle rings -> sharp
 *   composite -> bloom -> ACES -> sRGB -> dither + grain -> screen
 *
 * Every value is derived from the Remotion frame number. The render callback
 * registered with R3F (priority 1) is only the hook ThreeCanvas calls via
 * advance() once per frame; it never reads R3F's clock.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { BOARD, BOARD_H, BOARD_W, TRACE_HALF_W } from "./board";
import { COLORS, cyc, LAYOUT, loopPhase } from "./constants";
import { flickerAt } from "./flicker";
import { LineBuilder, RINGS, ringGeometry } from "./rings";
import * as S from "./shaders";
import { makeWordTexture } from "./wordTexture";

const TAU = Math.PI * 2;
const v3 = (c: [number, number, number]) => new THREE.Vector3(...c);
const mix3 = (a: [number, number, number], b: [number, number, number], t: number) =>
  new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);

/** Look-dev parameters shared by all compositions. */
export const LOOK = {
  fov: 35,
  camDist: 4.35,
  camY: -0.32,
  lookY: -0.07,
  swayX: 0.24, // world units (~3.6° yaw)
  swayY: 0.12, // (~1.8° pitch)
  push: 0.1,
  focus: 4.35,
  boardCocK: 0.006, // blur sigma (fraction of height) per 1/m of defocus
  edgeCoc: 0.012, // extra blur toward frame edges (fraction of height at the corners)
  boardCocBias: 0.0006,
  farSigma: 0.009, // fraction of height
  ringGain: 1.0,
  traceGain: 0.25,
  padGain: 0.3,
  pulseGain: 0.9,
  wordCore: 1.25,
  wordGlow: 0.6,
  wordHalo: 0.1,
  centreGain: 2.4,
  falloff: 1.25,
  haze: 0.011,
  bloomThreshold: 0.4,
  bloomKnee: 0.4,
  bloomGain: 1.15,
  bloomRadius: 1.4,
  exposure: 0.92,
  grain: 0.02,
  vignette: 0.12,
};

const lineMat = (vert: string, frag: string, uniforms: Record<string, THREE.IUniform>, preserveAlpha: boolean) => {
  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
  });
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneFactor;
  // Board layer keeps its view-distance alpha for the DoF pass.
  m.blendSrcAlpha = preserveAlpha ? THREE.ZeroFactor : THREE.OneFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
};

const boardUniforms = () => ({
  uCentreGain: { value: LOOK.centreGain },
  uFalloff: { value: LOOK.falloff },
});

const buildBoard = () => {
  const group = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_W, BOARD_H),
    new THREE.ShaderMaterial({
      vertexShader: S.boardBaseVert,
      fragmentShader: S.boardBaseFrag,
      uniforms: { ...boardUniforms(), uBase: { value: v3(COLORS.board) }, uHaze: { value: v3(COLORS.glow).multiplyScalar(LOOK.haze) } },
      depthWrite: false,
      depthTest: false,
    }),
  );
  base.renderOrder = 0;
  group.add(base);

  // Traces: a cooler, slightly desaturated blend of the glow cyan.
  const tc = mix3(COLORS.glow, COLORS.traceBlue, 0.45);
  const traceColor = tc.clone().lerp(new THREE.Vector3(1, 1, 1).multiplyScalar((tc.x + tc.y + tc.z) / 3), 0.25);
  const tb = new LineBuilder();
  for (const t of BOARD.traces) {
    for (let k = 1; k < t.pts.length; k++) {
      const [ax, ay] = t.pts[k - 1];
      const [bx, by] = t.pts[k];
      tb.segment(ax, ay, bx, by, TRACE_HALF_W * t.width, t.intensity, 0, 0, TRACE_HALF_W * t.width);
    }
  }
  const traces = new THREE.Mesh(
    tb.geometry(),
    lineMat(S.traceVert, S.traceFrag, { ...boardUniforms(), uColor: { value: traceColor }, uGain: { value: LOOK.traceGain } }, true),
  );
  traces.renderOrder = 1;
  group.add(traces);

  // Pads / vias as SDF quads.
  const pos: number[] = [];
  const local: number[] = [];
  const rr: number[] = [];
  const rin: number[] = [];
  const ii: number[] = [];
  const idx: number[] = [];
  for (const p of BOARD.pads) {
    const e = p.r + 0.012;
    const b = pos.length / 3;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      pos.push(p.x + sx * e, p.y + sy * e, 0);
      local.push(sx * e, sy * e);
      rr.push(p.r);
      rin.push(p.rIn);
      ii.push(p.intensity);
    }
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute("aLocal", new THREE.Float32BufferAttribute(local, 2));
  pg.setAttribute("aR", new THREE.Float32BufferAttribute(rr, 1));
  pg.setAttribute("aRin", new THREE.Float32BufferAttribute(rin, 1));
  pg.setAttribute("aI", new THREE.Float32BufferAttribute(ii, 1));
  pg.setIndex(idx);
  const pads = new THREE.Mesh(
    pg,
    lineMat(S.padVert, S.padFrag, { ...boardUniforms(), uColor: { value: traceColor }, uGain: { value: LOOK.padGain } }, true),
  );
  pads.renderOrder = 2;
  group.add(pads);

  // Pulses travel from the outer end of a trace toward the rings.
  const pulses = BOARD.pulses.map((p) => {
    const b = new LineBuilder();
    let s = 0;
    const pts = p.trace.pts;
    for (let k = 1; k < pts.length; k++) {
      const L = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      b.segment(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], TRACE_HALF_W, 1, s, s + L, 0);
      s += L;
    }
    const mat = lineMat(
      S.traceVert,
      S.pulseFrag,
      {
        ...boardUniforms(),
        uColor: { value: mix3(COLORS.glow, COLORS.core, 0.5) },
        uGain: { value: LOOK.pulseGain },
        uHead: { value: -1 },
        uTail: { value: 0.12 },
      },
      true,
    );
    const mesh = new THREE.Mesh(b.geometry(), mat);
    mesh.renderOrder = 3;
    group.add(mesh);
    return { mesh, mat, length: s, repeats: p.repeats, offset: p.offset };
  });

  // Behind and below the rings, top edge tilted away from camera.
  group.position.set(0, -0.05, -2.3);
  group.rotation.x = -0.45;
  return { group, pulses };
};


const buildRings = () =>
  RINGS.map((ring) => {
    const mesh = new THREE.Mesh(
      ringGeometry(ring),
      lineMat(S.ringVert, S.ringFrag, { uColor: { value: mix3(COLORS.glow, COLORS.core, ring.white) }, uGain: { value: LOOK.ringGain } }, false),
    );
    mesh.position.z = ring.z;
    return { ring, mesh };
  });

const buildWord = (text: string) => {
  const wt = makeWordTexture(text);
  const n = text.length;
  const frac = n <= 2 ? LAYOUT.wordFracShort : LAYOUT.wordFrac;
  const inkW = frac * 2 * LAYOUT.innerR;
  // Width rule above; short words are additionally capped in letter height.
  const k = Math.min(inkW / wt.inkWidth, (LAYOUT.maxCapHeight * LAYOUT.innerR) / (wt.capHeight * LAYOUT.wordStretchY));
  const mat = lineMat(
    S.wordVert,
    S.wordFrag,
    {
      uTex: { value: wt.texture },
      uCore: { value: v3(COLORS.core) },
      uGlow: { value: v3(COLORS.glow) },
      uCoreGain: { value: LOOK.wordCore },
      uGlowGain: { value: LOOK.wordGlow },
      uHaloGain: { value: LOOK.wordHalo },
      uFlRect: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
      uFlAmt: { value: [1, 1, 1] },
    },
    false,
  );
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wt.width * k, wt.height * k * LAYOUT.wordStretchY), mat);
  return { mesh, mat, wt };
};

// ------------------------------------------------------------------ post chain
const rt = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });

const passMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: S.fsVert, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

class Post {
  w = 0;
  h = 0;
  targets: Record<string, THREE.WebGLRenderTarget> = {};
  bloomDown: THREE.WebGLRenderTarget[] = [];
  bloomUp: THREE.WebGLRenderTarget[] = [];
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  dof = passMat(S.dofFrag, { uTex: { value: null }, uDir: { value: new THREE.Vector2() }, uFocus: { value: 1 }, uCocK: { value: 0 }, uCocBias: { value: 0 }, uEdge: { value: 0 }, uAspect: { value: 1 } });
  blur = passMat(S.blurFrag, { uTex: { value: null }, uDir: { value: new THREE.Vector2() }, uSigma: { value: 1 } });
  add = passMat(S.addFrag, { uA: { value: null }, uB: { value: null }, uBGain: { value: 1 } });
  down = passMat(S.bloomDownFrag, { uTex: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uPrefilter: { value: false } });
  up = passMat(S.bloomUpFrag, { uTex: { value: null }, uBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uMix: { value: 1 } });
  final = passMat(S.finalFrag, {
    uScene: { value: null }, uBloom: { value: null }, uBloomGain: { value: 1 }, uExposure: { value: 1 },
    uFrame: { value: 0 }, uGrain: { value: 0.02 }, uRes: { value: new THREE.Vector2() }, uVignette: { value: 0 },
  });

  constructor() {
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const hw = Math.round(w / 2);
    const hh = Math.round(h / 2);
    this.targets = { board: rt(w, h), tmp: rt(w, h), boardBlur: rt(w, h), far: rt(hw, hh), farTmp: rt(hw, hh), comp: rt(w, h) };
    let bw = hw;
    let bh = hh;
    for (let i = 0; i < 7; i++) {
      this.bloomDown.push(rt(bw, bh));
      this.bloomUp.push(rt(bw, bh));
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
    }
  }

  run(gl: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.cam);
  }

  dispose() {
    Object.values(this.targets).forEach((t) => t.dispose());
    this.bloomDown.forEach((t) => t.dispose());
    this.bloomUp.forEach((t) => t.dispose());
    this.targets = {};
    this.bloomDown = [];
    this.bloomUp = [];
  }
}

export const HudScene: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame; // set on every render; nothing carries over between frames
  const gl = useThree((s) => s.gl);

  const world = useMemo(() => {
    const camera = new THREE.PerspectiveCamera(LOOK.fov, 16 / 9, 0.05, 60);
    const boardScene = new THREE.Scene();
    const farScene = new THREE.Scene();
    const sharpScene = new THREE.Scene();
    const board = buildBoard();
    boardScene.add(board.group);
    const rings = buildRings();
    for (const r of rings) (r.ring.layer === "far" ? farScene : sharpScene).add(r.mesh);
    const word = buildWord(text);
    sharpScene.add(word.mesh);
    return { camera, boardScene, farScene, sharpScene, board, rings, word, post: new Post() };
  }, [text]);

  useEffect(
    () => () => {
      world.post.dispose();
      world.word.wt.texture.dispose();
      for (const sc of [world.boardScene, world.farScene, world.sharpScene])
        sc.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (o.material as THREE.Material).dispose();
          }
        });
    },
    [world],
  );

  useFrame(() => {
    const f = frameRef.current;
    const p = loopPhase(f);
    const { camera, board, rings, word, post } = world;

    // Camera: closed sway path with whole-number frequencies.
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const W = size.x;
    const H = size.y;
    camera.aspect = W / H;
    const dist = LOOK.camDist + LOOK.push * Math.sin(TAU * p + 1.3);
    camera.position.set(
      LOOK.swayX * Math.sin(TAU * p),
      LOOK.camY + LOOK.swayY * Math.sin(TAU * 2 * p + 0.7),
      dist,
    );
    camera.up.set(0, 1, 0);
    camera.lookAt(0.03 * Math.sin(TAU * p + 2.1), LOOK.lookY, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Rings: whole turns + integer-frequency swing.
    for (const { ring, mesh } of rings) {
      mesh.rotation.z = ring.angle0 + TAU * ring.turns * p + ring.swing * Math.sin(TAU * (p + ring.phase));
    }
    // Pulses: whole number of passes per loop.
    for (const pl of board.pulses) {
      const travel = pl.length + 1.6; // includes an idle gap off-trace
      pl.mat.uniforms.uHead.value = cyc(f, pl.repeats, pl.offset) * travel - 0.4;
    }
    // Segment flicker at fixed frames.
    const fl = flickerAt(f, word.wt.cells);
    const rects = word.mat.uniforms.uFlRect.value as THREE.Vector4[];
    fl.rects.forEach((r, i) => rects[i].set(r[0], r[1], r[2], r[3]));
    word.mat.uniforms.uFlAmt.value = fl.amts;

    // ---- post chain
    post.resize(W, H);
    const T = post.targets;
    gl.autoClear = false;
    const clear = (t: THREE.WebGLRenderTarget) => {
      gl.setRenderTarget(t);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, true);
    };

    clear(T.board);
    gl.render(world.boardScene, camera);
    const dofU = post.dof.uniforms;
    dofU.uFocus.value = LOOK.focus;
    dofU.uCocK.value = LOOK.boardCocK * H;
    dofU.uCocBias.value = LOOK.boardCocBias * H;
    dofU.uEdge.value = LOOK.edgeCoc * H;
    dofU.uAspect.value = W / H;
    dofU.uTex.value = T.board.texture;
    dofU.uDir.value.set(1 / W, 0);
    post.run(gl, post.dof, T.tmp);
    dofU.uTex.value = T.tmp.texture;
    dofU.uDir.value.set(0, 1 / H);
    post.run(gl, post.dof, T.boardBlur);

    clear(T.far);
    gl.render(world.farScene, camera);
    const bu = post.blur.uniforms;
    bu.uSigma.value = (LOOK.farSigma * H) / 2;
    bu.uTex.value = T.far.texture;
    bu.uDir.value.set(1 / T.far.width, 0);
    post.run(gl, post.blur, T.farTmp);
    bu.uTex.value = T.farTmp.texture;
    bu.uDir.value.set(0, 1 / T.far.height);
    post.run(gl, post.blur, T.far);

    post.add.uniforms.uA.value = T.boardBlur.texture;
    post.add.uniforms.uB.value = T.far.texture;
    post.run(gl, post.add, T.comp);
    gl.setRenderTarget(T.comp);
    gl.render(world.sharpScene, camera);

    // Bloom
    const dn = post.down.uniforms;
    dn.uThreshold.value = LOOK.bloomThreshold;
    dn.uKnee.value = LOOK.bloomKnee;
    let src = T.comp;
    post.bloomDown.forEach((t, i) => {
      dn.uTex.value = src.texture;
      dn.uTexel.value.set(1 / src.width, 1 / src.height);
      dn.uPrefilter.value = i === 0;
      post.run(gl, post.down, t);
      src = t;
    });
    const upU = post.up.uniforms;
    let acc = post.bloomDown[post.bloomDown.length - 1];
    for (let i = post.bloomDown.length - 2; i >= 0; i--) {
      upU.uTex.value = acc.texture;
      upU.uBase.value = post.bloomDown[i].texture;
      upU.uTexel.value.set(1 / acc.width, 1 / acc.height);
      upU.uRadius.value = LOOK.bloomRadius;
      upU.uMix.value = 1;
      post.run(gl, post.up, post.bloomUp[i]);
      acc = post.bloomUp[i];
    }

    const fu = post.final.uniforms;
    fu.uScene.value = T.comp.texture;
    fu.uBloom.value = acc.texture;
    fu.uBloomGain.value = LOOK.bloomGain / post.bloomDown.length;
    fu.uExposure.value = LOOK.exposure;
    fu.uFrame.value = ((f % 600) + 600) % 600;
    fu.uGrain.value = LOOK.grain;
    fu.uRes.value.set(W, H);
    fu.uVignette.value = LOOK.vignette;
    post.run(gl, post.final, null);
  }, 1);

  return null;
};

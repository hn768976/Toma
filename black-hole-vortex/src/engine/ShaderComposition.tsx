import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { BLACKHOLE_FRAG } from "../shaders/blackhole";
import { FULLSCREEN_VERT } from "../shaders/common";
import { COMPOSITE_FRAG, DOWNSAMPLE_FRAG, STREAK_FRAG, UPSAMPLE_FRAG } from "../shaders/post";
import { VORTEX_FRAG } from "../shaders/vortex";
import { LOOP_FRAMES, QualityLevel, ShotRow } from "../shots";
import { createNoiseTexture } from "./noiseTexture";
import { col, sceneUniforms } from "./uniforms";

export type QualityChoice = "auto" | "preview" | "high";

export type ShotProps = {
  shotId: string;
  quality: QualityChoice;
  /** Only for the loop check: render 601 frames. Visuals always loop on 600. */
  durationOverride: number | null;
};

const BLOOM_LEVELS = 6;

const makeRT = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

const rawMat = (frag: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, number> = {}) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
  });

const toUniforms = (o: Record<string, unknown>) => {
  const u: Record<string, THREE.IUniform> = {};
  for (const k of Object.keys(o)) u[k] = { value: o[k] };
  return u;
};

const pickQuality = (row: ShotRow, choice: QualityChoice, bufferH: number): QualityLevel => {
  if (choice === "high") return row.quality.high;
  if (choice === "preview") return row.quality.preview;
  return bufferH >= 1440 ? row.quality.high : row.quality.preview;
};

const Pipeline: React.FC<{ row: ShotRow; quality: QualityChoice }> = ({ row, quality }) => {
  const frame = useCurrentFrame();
  // The frame is captured during render and read by the render callback;
  // nothing else carries state between frames.
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const W = Math.round(size.width * dpr);
  const H = Math.round(size.height * dpr);

  const res = useMemo(() => {
    const q = pickQuality(row, quality, H);
    const noise = createNoiseTexture();
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();

    const initial = sceneUniforms(row, 0, W, H);
    const mainU = toUniforms({ ...initial, uNoise: noise });
    const main =
      row.look === "blackhole"
        ? rawMat(BLACKHOLE_FRAG, mainU, {
            MAX_STEPS: q.steps,
            OCTAVES: q.octaves,
            DECK: row.deck.enabled ? 1 : 0,
            DECK_STEPS: q.deckSteps,
            DECK_BISECT: q.deckBisect,
            DECK_GEOM_OCT: Math.min(3, q.octaves),
          })
        : rawMat(VORTEX_FRAG, mainU, { MODE: row.mode, OCTAVES: q.octaves, LAYERS: q.layers, MARCH_STEPS: q.marchSteps });
    mainU.uStepScale = { value: q.stepScale };

    const mesh = new THREE.Mesh(geom, main);
    mesh.frustumCulled = false;
    scene.add(mesh);

    const hdr = makeRT(W, H);
    const down: THREE.WebGLRenderTarget[] = [];
    const up: THREE.WebGLRenderTarget[] = [];
    for (let i = 1; i <= BLOOM_LEVELS; i++) {
      down.push(makeRT(W / 2 ** i, H / 2 ** i));
      up.push(makeRT(W / 2 ** i, H / 2 ** i));
    }
    // tall enough that the anamorphic streak stays a thin line
    const streakA = makeRT(W / 4, H / 2);
    const streakB = makeRT(W / 4, H / 2);

    const downM = rawMat(DOWNSAMPLE_FRAG, toUniforms({ uSrc: null, uTexel: new THREE.Vector2(), uThreshold: -1, uKnee: 0.3 }));
    const upM = rawMat(UPSAMPLE_FRAG, toUniforms({ uCoarse: null, uFine: null, uTexel: new THREE.Vector2(), uScatter: 1 }));
    const streakM = rawMat(STREAK_FRAG, toUniforms({ uSrc: null, uTexel: new THREE.Vector2(), uSpacing: 1, uThreshold: -1 }));
    const p = row.post;
    const compM = rawMat(
      COMPOSITE_FRAG,
      toUniforms({
        uHdr: hdr.texture,
        uBloom: up[0].texture,
        uStreak: streakB.texture,
        uRes: new THREE.Vector2(W, H),
        uFrameMod: 0,
        uExposure: p.exposure,
        uBloomStr: p.bloom,
        uStreakStr: p.streak,
        uStreakCol: col(p.streakColor),
        uHaloStr: p.halo,
        uHaloSrc: new THREE.Vector2(...p.haloSrc),
        uHaloCol: col(p.haloColor),
        uHaloR: p.haloRadius,
        uTint: new THREE.Vector3(...p.tint),
        uSaturation: p.saturation,
        uVignette: p.vignette,
        uGrain: p.grain,
        uLift: p.lift,
      }),
    );
    return { q, noise, geom, cam, scene, mesh, main, mainU, hdr, down, up, streakA, streakB, downM, upM, streakM, compM };
  }, [row, quality, W, H]);

  useEffect(() => {
    return () => {
      const r = res;
      r.noise.dispose();
      r.geom.dispose();
      [r.main, r.downM, r.upM, r.streakM, r.compM].forEach((m) => m.dispose());
      [r.hdr, r.streakA, r.streakB, ...r.down, ...r.up].forEach((t) => t.dispose());
    };
  }, [res]);

  // Priority 1 takes over rendering from R3F. The R3F clock is never read:
  // every value comes from frameRef (= useCurrentFrame()).
  useFrame(() => {
    const f = frameRef.current;
    const r = res;
    const u = sceneUniforms(row, f, W, H);
    for (const k of Object.keys(u)) r.mainU[k].value = u[k];

    const pass = (m: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      r.mesh.material = m;
      gl.setRenderTarget(target);
      gl.render(r.scene, r.cam);
    };

    pass(r.main, r.hdr);

    // bloom pyramid
    const p = row.post;
    let src: THREE.WebGLRenderTarget = r.hdr;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      r.downM.uniforms.uSrc.value = src.texture;
      r.downM.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      r.downM.uniforms.uThreshold.value = i === 0 ? p.bloomThreshold : -1;
      pass(r.downM, r.down[i]);
      src = r.down[i];
    }
    let coarse = r.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      r.upM.uniforms.uCoarse.value = coarse.texture;
      r.upM.uniforms.uFine.value = r.down[i].texture;
      r.upM.uniforms.uTexel.value.set(1 / coarse.width, 1 / coarse.height);
      r.upM.uniforms.uScatter.value = p.bloomScatter;
      pass(r.upM, r.up[i]);
      coarse = r.up[i];
    }

    // anamorphic streak
    if (p.streak > 0) {
      const spacings = [1, 2, 4, 8, 16, 32];
      let s: THREE.WebGLRenderTarget = r.hdr;
      spacings.forEach((sp, i) => {
        const dst = i % 2 === 0 ? r.streakA : r.streakB;
        r.streakM.uniforms.uSrc.value = s.texture;
        r.streakM.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
        r.streakM.uniforms.uSpacing.value = sp;
        r.streakM.uniforms.uThreshold.value = i === 0 ? p.streakThreshold : -1;
        pass(r.streakM, dst);
        s = dst;
      });
    }

    r.compM.uniforms.uFrameMod.value = ((f % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    gl.setViewport(0, 0, size.width, size.height);
    pass(r.compM, null);
  }, 1);

  return null;
};

export const ShaderComposition: React.FC<{ row: ShotRow; quality: QualityChoice }> = ({ row, quality }) => {
  const { width, height } = useVideoConfig();
  // Rendering: draw at the real output size (composition size x --scale).
  // Studio: cap the buffer at 1280 px wide so the preview stays interactive.
  const env = getRemotionEnvironment();
  const winDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const dpr = env.isRendering ? winDpr : Math.min(winDpr, 1280 / width);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        linear
        flat
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Pipeline row={row} quality={quality} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

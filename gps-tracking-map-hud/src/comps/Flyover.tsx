// Looks 6-7: 3D map flyover (three.js via @remotion/three, WebGL2).
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useDelayRender } from 'remotion';
import * as THREE from 'three';
import { raw, bakeGround, moves, shotAt, placeCamera, MOVE, POST_VS, POST_FS, type FlyStyle, type Ground } from '../render/flyover';
import { dpr } from '../render/MapCanvas';
import { HudCanvas } from '../hud/HudCanvas';
import { drawFlyoverHud, type FlyTheme } from '../hud/flyoverHud';

THREE.ColorManagement.enabled = false;

export const FLY_BLUE: FlyStyle = {
  land: '#3A6A88', dark: '#08141C', water: '#061017', runway: '#4E86A6',
  roads: {
    highway: { color: '#CFEFFF', w: 20, a: 1 },
    avenue: { color: '#A6DDF8', w: 11, a: 1 },
    street: { color: '#7AC8F0', w: 6, a: 0.92 },
    lane: { color: '#7AC8F0', w: 4, a: 0.7 },
    rail: { color: '#7AC8F0', w: 3.5, a: 0.7 },
  },
};
export const FLY_AMBER: FlyStyle = {
  land: '#8A5A2A', dark: '#1C1006', water: '#140B04', runway: '#A87440',
  roads: {
    highway: { color: '#FFF0D8', w: 20, a: 1 },
    avenue: { color: '#FFD8A0', w: 11, a: 1 },
    street: { color: '#F8C07A', w: 6, a: 0.92 },
    lane: { color: '#F8C07A', w: 4, a: 0.7 },
    rail: { color: '#F8C07A', w: 3.5, a: 0.7 },
  },
};

const MV = moves();
// the reference is darker and lower in contrast than the raw palette; expose down in the post pass
const EXPOSURE = 0.52;
// transitions at the 4 cuts: odd = soft-focus dissolve, even = glitch
const DISSOLVE = 9; // half-width in frames

interface FrameState { a: number; ta: number; b: number; tb: number; mix: number; blur: number; glitch: number; bright: number }
export function frameState(frame: number): FrameState {
  const m = Math.min(4, Math.floor(frame / MOVE));
  const t = (frame - m * MOVE) / MOVE;
  const st: FrameState = { a: m, ta: t, b: m, tb: t, mix: 0, blur: 0, glitch: 0, bright: 1 };
  for (let k = 1; k <= 4; k++) {
    const b = k * MOVE;
    const d = frame - b; // frames relative to cut
    if (k % 2 === 1 && d >= -DISSOLVE && d < DISSOLVE) {
      const w = (d + DISSOLVE) / (2 * DISSOLVE);
      const sw = w * w * (3 - 2 * w);
      st.a = k - 1; st.ta = (frame - (k - 1) * MOVE) / MOVE;
      st.b = k; st.tb = (frame - k * MOVE) / MOVE;
      st.mix = sw;
      st.blur = 3.4 * Math.sin(Math.PI * w);
      st.bright = 1 - 0.18 * Math.sin(Math.PI * w);
    }
    if (k % 2 === 0 && d >= -2 && d < 2) st.glitch = d < 0 ? 0.6 + 0.2 * (d + 2) : 1 - 0.3 * d;
  }
  return st;
}

function FlyoverScene({ style }: { style: FlyStyle }) {
  const frame = useCurrentFrame();
  const { gl } = useThree();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const s = useRef<{ ground: Ground; scene: THREE.Scene; cam: THREE.PerspectiveCamera; rtA: THREE.WebGLRenderTarget; rtB: THREE.WebGLRenderTarget; res: THREE.Vector2 } | null>(null);
  const post = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    uniforms: {
      uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uGlitch: { value: 0 }, uSeed: { value: 0 },
      uVig: { value: 0.5 }, uBright: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
    },
  }), []);

  const renderFrame = (f: number) => {
    const S = s.current!;
    const fs = frameState(f);
    const draw = (move: number, t: number, rt: THREE.WebGLRenderTarget) => {
      placeCamera(S.cam, shotAt(MV[move], t));
      for (const m of S.ground.mats) m.uniforms.uBlur.value = fs.blur;
      gl.setRenderTarget(rt);
      gl.render(S.scene, S.cam);
    };
    draw(fs.a, fs.ta, S.rtA);
    if (fs.mix > 0) draw(fs.b, fs.tb, S.rtB);
    gl.setRenderTarget(null);
    post.uniforms.uA.value = S.rtA.texture;
    post.uniforms.uB.value = fs.mix > 0 ? S.rtB.texture : S.rtA.texture;
    post.uniforms.uMix.value = fs.mix;
    post.uniforms.uGlitch.value = fs.glitch;
    post.uniforms.uSeed.value = f;
    post.uniforms.uBright.value = fs.bright * EXPOSURE;
  };

  useLayoutEffect(() => {
    const h = delayRender('Baking flyover map tiles');
    try {
      const size = gl.getDrawingBufferSize(new THREE.Vector2());
      const res = new THREE.Vector2(size.x, size.y);
      const ground = bakeGround(gl, style, res);
      const scene = new THREE.Scene();
      scene.background = raw(style.dark);
      scene.add(ground.group);
      const cam = new THREE.PerspectiveCamera(32, size.x / size.y, 50, 60000);
      const opts = { type: THREE.HalfFloatType, samples: 4, depthBuffer: false, colorSpace: THREE.NoColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter } as const;
      const rtA = new THREE.WebGLRenderTarget(size.x, size.y, opts);
      const rtB = new THREE.WebGLRenderTarget(size.x, size.y, opts);
      post.uniforms.uRes.value.set(size.x, size.y);
      s.current = { ground, scene, cam, rtA, rtB, res };
      renderFrame(frame);
      continueRender(h);
    } catch (e) {
      cancelRender(e as Error);
    }
    return () => {
      const S = s.current;
      if (S) { S.rtA.dispose(); S.rtB.dispose(); S.ground.targets.forEach((t) => t.dispose()); }
      s.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (s.current) renderFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  return (
    <mesh frustumCulled={false} material={post}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

const BLUE_T: FlyTheme = { text: '#E6F6FF', dim: '#8FC4E0', faint: '#5A8CAA', accent: '#5CF0C8', accent2: '#FFFFFF', panel: '#0A1A24', panelEdge: '#3A6A88', grid: '#BFE6FF', ring: '#FFD27A' };
const AMBER_T: FlyTheme = { text: '#FFF4E4', dim: '#E8B880', faint: '#A07040', accent: '#FFE07A', accent2: '#FFFFFF', panel: '#1C1006', panelEdge: '#8A5A2A', grid: '#FFE2B8', ring: '#7AF0FF' };

export const Flyover: React.FC<{ variant: 'blue' | 'amber' }> = ({ variant }) => {
  const style = variant === 'blue' ? FLY_BLUE : FLY_AMBER;
  return (
    <AbsoluteFill style={{ background: style.dark }}>
      <ThreeCanvas
        width={3840}
        height={2160}
        dpr={dpr()}
        linear
        flat
        gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false }}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        <FlyoverScene style={style} />
      </ThreeCanvas>
      <HudCanvas draw={drawFlyoverHud(variant === 'blue' ? BLUE_T : AMBER_T, frameState)} />
    </AbsoluteFill>
  );
};

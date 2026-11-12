import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CardEngine } from "./engine/CardEngine";
import { displayFrag, FULLSCREEN_VERT } from "./gl/shaders";
import { rngFor } from "./lib/rng";
import { activePersist, getSchedule } from "./lib/schedule";
import { BLEED, DENSITY, LOOP_FRAMES } from "./settings";
import { VARIANTS, type Variant } from "./variants";

export type GrungeProps = { variant: string; loopCheck?: boolean };

const hexToVec3 = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const OverlayPlane: React.FC<{ v: Variant; pxW: number; pxH: number }> = ({ v, pxW, pxH }) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const look = v.look;
  const sched = useMemo(() => getSchedule(look.id, look.schedule), [look]);
  const engine = useMemo(() => new CardEngine(gl, look, look.id, pxW, pxH, DENSITY[look.id]), [gl, look, pxW, pxH]);
  useEffect(() => () => engine.dispose(), [engine]);

  const material = useMemo(
    () =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: displayFrag(v.stainStyle, look.clearCentre),
        uniforms: {
          uCard: { value: null },
          uPersist: { value: engine.persistTex },
          uAspect: { value: pxW / pxH },
          uBleed: { value: BLEED },
          uPx: { value: 1 / pxH },
          uOffset: { value: new THREE.Vector2() },
          uScale: { value: 1 },
          uRot: { value: 0 },
          uGain: { value: 1 },
          uStain: { value: [new THREE.Vector4(), new THREE.Vector4()] },
          uStainStyle: { value: [new THREE.Vector4(), new THREE.Vector4()] },
          uMode: { value: v.mode },
          uInkScale: { value: v.inkScale },
          uBg: { value: hexToVec3(v.bg) },
          uMark: { value: hexToVec3(v.mark) },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [v, look, engine, pxW, pxH],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Everything below is a pure function of the frame number (runs before R3F renders the frame).
  useLayoutEffect(() => {
    const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    const si = sched.slotOfFrame[f];
    const slot = sched.slots[si];
    const u = material.uniforms;
    u.uCard.value = engine.getCard(slot.card);
    engine.updatePersist(sched, si);
    (u.uOffset.value as THREE.Vector2).set(slot.dx, slot.dy);
    u.uScale.value = slot.scale;
    u.uRot.value = slot.rot;
    u.uGain.value = sched.gain[f];
    const stains = activePersist(sched, si).filter((a) => a.ev.kind === 1);
    const uS = u.uStain.value as THREE.Vector4[];
    const uSS = u.uStainStyle.value as THREE.Vector4[];
    for (let k = 0; k < 2; k++) {
      const a = stains[k];
      if (!a) {
        uS[k].set(0, 0, 1, 0);
        continue;
      }
      const r = rngFor(look.id, "stain", a.ev.seed);
      const [radius, strength, grain, roughness] = look.stain(r);
      uS[k].set(a.ev.x + a.ev.driftX * a.age, a.ev.y + a.ev.driftY * a.age, radius, strength);
      uSS[k].set(grain, roughness, a.ev.seed % 100000, r() * Math.PI);
    }
  }, [frame, sched, engine, material, look]);

  return (
    <mesh material={material} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

export const GrungeOverlay: React.FC<GrungeProps> = ({ variant }) => {
  const v = VARIANTS.find((x) => x.id === variant);
  if (!v) throw new Error(`Unknown variant ${variant}`);
  const { width, height } = useVideoConfig();
  // Render the WebGL buffer at the output resolution (e.g. --scale=1/3 -> 1280x720), never above 4K.
  const pr = Math.min(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const pxW = Math.round(width * pr);
  const pxH = Math.round(height * pr);
  return (
    <AbsoluteFill style={{ backgroundColor: v.bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={pr}
        linear
        flat
        orthographic
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <OverlayPlane v={v} pxW={pxW} pxH={pxH} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

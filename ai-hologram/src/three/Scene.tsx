import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Easing, interpolate } from "remotion";
import { CircuitPlane } from "./CircuitPlane";
import { HudRing } from "./HudRing";
import { HoloCard } from "./HoloCard";
import { Nodes } from "./Nodes";
import { Panels, type PanelFrameState } from "./Panels";
import { Atmosphere } from "./Atmosphere";
import { ProjectionCone } from "./ProjectionCone";
import { CameraRig, cameraAzimuth } from "./CameraRig";
import { CARD, NODES, ORBIT, PANELS, RINGS } from "./layout";
import { getBackgroundTexture } from "../lib/uiTextures";
import { phase, stagger } from "../lib/timing";
import type { Palette } from "../palettes";

/**
 * The whole scene, driven from a single frame number.
 *
 * Build sequence:
 *   0–20    black
 *   15–90   the circuit plane lights from the centre outward
 *   60–120  the core ignites; the HUD rings sweep on around their circumference
 *   100–170 the card rises out of the platform, the chip icon drawing on
 *   140–260 the orbit path draws around, then the nodes land one by one
 *   200–330 the UI panels wipe in at staggered intervals
 *   330–600 steady state
 */
export const Scene: React.FC<{
  palette: Palette;
  frame: number;
  fps: number;
  duration: number;
  iconTexture: THREE.Texture;
}> = ({ palette, frame, fps, duration, iconTexture }) => {
  const seconds = frame / fps;

  // The scene opens on black: the background gradient lifts in with the plane
  // rather than sitting there from frame 0.
  const scene = useThree((s) => s.scene);
  const bg = getBackgroundTexture(palette);
  if (scene.background !== bg) scene.background = bg;
  scene.backgroundIntensity = phase(frame, 14, 62);

  // ------------------------------------------------------------ circuit plane
  const planeMaster = phase(frame, 15, 62);
  // Linear, so the wavefront crosses the visible board at a constant rate
  // rather than racing past the far fade inside the first second.
  const planeReveal = interpolate(frame, [15, 92], [0, 42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ------------------------------------------------------------------- core
  const ignite = phase(frame, 60, 112, Easing.out(Easing.cubic));
  // A short overshoot right at ignition, so the core snaps on rather than ramps.
  const flash = 1 + 0.85 * Math.exp(-Math.pow((frame - 84) / 13, 2));
  const coreIntensity = ignite * flash;
  const hazeAlpha = phase(frame, 84, 190) * (0.85 + 0.15 * Math.sin(seconds * 0.55));

  // ------------------------------------------------------------------- card
  const cardIn = phase(frame, 100, 168, Easing.out(Easing.cubic));
  const cardY =
    CARD.fromY + (CARD.y - CARD.fromY) * cardIn + Math.sin(seconds * 0.62 + 1.1) * 0.12 * cardIn;
  const cardAlpha = phase(frame, 100, 130);
  const cardRise = phase(frame, 102, 152, Easing.out(Easing.quad));
  const iconReveal = phase(frame, 126, 182, Easing.inOut(Easing.quad));
  // Fixed to the middle of the camera's arc: facing the viewer overall, but
  // turning with the world as the camera swings past.
  const cardYaw = useMemo(() => cameraAzimuth(duration / 2, duration), [duration]);

  // ------------------------------------------------------- orbit and nodes
  const orbitReveal = phase(frame, 140, 202, Easing.inOut(Easing.quad));
  const orbitPhase = seconds * ORBIT.speed * Math.PI * 2;
  const nodeReveals = NODES.map((_, i) => stagger(frame, i, NODES.length, 196, 268, 26));
  const nodeBobs = NODES.map((n) => Math.sin(seconds * 0.75 + n.bobPhase) * n.bob);

  // ------------------------------------------------------------------ panels
  const panelStates: PanelFrameState[] = PANELS.map((p) => {
    const wipe = phase(frame, p.fadeInStart, p.fadeInStart + 42, Easing.inOut(Easing.quad));
    const arrived = phase(frame, p.fadeInStart, p.fadeInStart + 30);
    // Panels breathe rather than sit: each fades in and out on its own cycle.
    const cycle = 0.62 + 0.38 * Math.sin((seconds / p.cyclePeriod) * Math.PI * 2 + p.cyclePhase);
    return {
      wipe,
      alpha: arrived * cycle,
      offsetY: Math.sin(seconds * 0.33 + p.driftPhase) * p.driftAmount,
      offsetR: Math.sin(seconds * 0.21 + p.driftPhase * 1.7) * p.driftAmount * 1.4,
    };
  });

  return (
    <>
      <CameraRig frame={frame} duration={duration} fps={fps} />

      <CircuitPlane
        palette={palette}
        reveal={planeReveal}
        pulseT={seconds * 0.28}
        shimmer={seconds * 0.7}
        coreGlow={coreIntensity}
        master={planeMaster}
      />

      {RINGS.map((r, i) => (
        <HudRing
          key={i}
          inner={r.inner}
          outer={r.outer}
          color={palette.ring}
          spin={seconds * r.spin}
          segments={r.segments}
          duty={r.duty}
          ticks={r.ticks}
          mode={r.ticks > 0 ? 1 : r.segments > 0 ? 2 : 0}
          reveal={phase(frame, r.drawStart, r.drawEnd, Easing.inOut(Easing.quad))}
          dir={r.drawDir}
          intensity={r.intensity}
          alpha={1}
          y={0.03 + i * 0.006}
          renderOrder={10 + i}
        />
      ))}

      <HudRing
        inner={ORBIT.radius - 0.022}
        outer={ORBIT.radius + 0.022}
        color={palette.node}
        spin={0}
        mode={0}
        reveal={orbitReveal}
        dir={1}
        intensity={0.62}
        alpha={1}
        y={ORBIT.y}
        stretchX={ORBIT.stretchX}
        renderOrder={9}
      />

      <ProjectionCone palette={palette} alpha={hazeAlpha * 0.12} height={4.6} />

      <Atmosphere
        palette={palette}
        seconds={seconds}
        coreIntensity={coreIntensity}
        hazeAlpha={hazeAlpha}
        particleAlpha={phase(frame, 40, 150)}
        pulseAlpha={phase(frame, 55, 140)}
      />

      <HoloCard
        palette={palette}
        width={CARD.width}
        y={cardY}
        yaw={cardYaw}
        alpha={cardAlpha}
        rise={cardRise}
        iconReveal={iconReveal}
        pinT={seconds * 0.42}
        iconTexture={iconTexture}
      />

      <Nodes palette={palette} orbitPhase={orbitPhase} reveals={nodeReveals} bobs={nodeBobs} />

      <Panels palette={palette} states={panelStates} />
    </>
  );
};

/** three's colour management is off: every material writes final pixel values. */
export const configureRenderer = (gl: THREE.WebGLRenderer) => {
  gl.toneMapping = THREE.NoToneMapping;
  gl.outputColorSpace = THREE.SRGBColorSpace;
};

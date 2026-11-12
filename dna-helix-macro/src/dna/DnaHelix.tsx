import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Vec3, dot, easeInOut, lerp, lerp3, norm, sub } from "./math";
import { Camera, DnaRenderer, Look } from "./renderer";
import { DNA_PALETTE, HELICES, buildDust, buildHelix } from "./scene";

export type DnaVariant = "match" | "orbit";

export type DnaHelixProps = {
  variant: DnaVariant;
};

const LOOK: Look = {
  bgDeep: [0.02, 0.05, 0.08],
  bgMid: [0.09, 0.2, 0.29],
  bgHaze: [0.55, 0.78, 0.9],
  hazeCenter: [0.86, 0.9],
  light: [0.45, 0.8, 0.6],
  rimTint: [0.75, 0.9, 1.0],
  dust: [0.8, 0.92, 1.0],
};

const HERO = HELICES[0].pos;
const FOREGROUND = HELICES[1].pos;
const FOV = (40 * Math.PI) / 180;
const APERTURE = 0.125;

/**
 * Version 1 – matches the reference: a slow, steady push-in on the hero
 * helix with the focus locked on it, the big foreground helix drifting
 * further out of focus on the left.
 */
const matchCamera = (t: number, dur: number): Camera => {
  const u = t / dur;
  // gentle ease at both ends, close to linear in the middle (like the ref)
  // Dolly in 1/distance so the on-screen growth rate stays near-constant,
  // as in the reference; the camera trucks right so the hero drifts left.
  const e = lerp(u, easeInOut(u), 0.12);
  const k = (1 / lerp(1 / 6.0, 1 / 3.8, e) - 6.0) / (3.8 - 6.0);
  const pos: Vec3 = lerp3([0.25, 0.3, 6.0], [0.72, 0.02, 3.8], k);
  const target: Vec3 = lerp3([0.18, 0.14, 0], [0.62, 0.0, 0], k);
  const fwd = norm(sub(target, pos));
  return {
    pos,
    target,
    fov: FOV,
    // focus on the front face of the hero helix (axis distance minus radius)
    focus: dot(sub(HERO, pos), fwd) - 0.85,
    aperture: APERTURE,
    roll: 0,
  };
};

/**
 * Version 2 – alternative camera: a low-angle orbiting crane move around
 * the hero helix with a rack focus that starts on the foreground helix and
 * pulls to the hero as the camera arcs past it.
 */
const orbitCamera = (t: number, dur: number): Camera => {
  const u = t / dur;
  // ease in only: the camera keeps travelling at full speed until the last frame
  const k = u < 0.2 ? (u * u) / 0.4 / 0.9 : (u - 0.1) / 0.9;
  const yaw = lerp(-0.25, 0.85, k);
  const radius = lerp(7.4, 5.6, k);
  const height = lerp(-2.2, 2.4, k);
  const pos: Vec3 = [
    HERO[0] + Math.sin(yaw) * radius,
    height,
    HERO[2] + Math.cos(yaw) * radius,
  ];
  const target: Vec3 = [HERO[0], lerp(0.6, -0.3, k), HERO[2]];
  const fwd = norm(sub(target, pos));
  const dHero = dot(sub(HERO, pos), fwd);
  const fgPoint: Vec3 = [FOREGROUND[0], FOREGROUND[1], FOREGROUND[2]];
  const dFg = dot(sub(fgPoint, pos), fwd);
  const rack = easeInOut((t - 1.2) / 2.6);
  return {
    pos,
    target,
    fov: FOV,
    focus: lerp(dFg, dHero - 0.85, rack),
    aperture: APERTURE * 1.05,
    roll: lerp(-0.05, 0.03, k),
  };
};

export const DnaHelix: React.FC<DnaHelixProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DnaRenderer | null>(null);

  const scene = useMemo(
    () => ({
      helices: HELICES.map((place) => ({ place, atoms: buildHelix(place, DNA_PALETTE) })),
      dust: buildDust(110, 7),
    }),
    [],
  );

  useLayoutEffect(() => {
    const r = new DnaRenderer(canvasRef.current!, scene.helices, scene.dust);
    rendererRef.current = r;
    return () => {
      r.dispose();
      rendererRef.current = null;
    };
  }, [scene]);

  useLayoutEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const t = frame / fps;
    const dur = (durationInFrames - 1) / fps;
    const cam = variant === "match" ? matchCamera(t, dur) : orbitCamera(t, dur);
    r.render(t, cam, LOOK);
  }, [frame, fps, durationInFrames, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03080d" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

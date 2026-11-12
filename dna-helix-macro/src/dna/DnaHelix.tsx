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
  bgDeep: [0.015, 0.04, 0.065],
  bgMid: [0.07, 0.17, 0.25],
  bgHaze: [0.4, 0.62, 0.76],
  hazeCenter: [0.6, 0.86],
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
  const k = lerp(u, easeInOut(u), 0.35);
  const pos: Vec3 = lerp3([0.42, 0.25, 7.1], [0.34, 0.05, 4.45], k);
  const target: Vec3 = lerp3([0.3, 0.12, 0], [0.25, 0.02, 0], k);
  const fwd = norm(sub(target, pos));
  return {
    pos,
    target,
    fov: FOV,
    focus: dot(sub(HERO, pos), fwd),
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
  const k = easeInOut(u);
  const yaw = lerp(-0.25, 0.5, k);
  const radius = lerp(7.8, 6.3, k);
  const height = lerp(-2.2, 1.1, k);
  const pos: Vec3 = [
    HERO[0] + Math.sin(yaw) * radius,
    height,
    HERO[2] + Math.cos(yaw) * radius,
  ];
  const target: Vec3 = [HERO[0], lerp(0.6, -0.1, k), HERO[2]];
  const fwd = norm(sub(target, pos));
  const dHero = dot(sub(HERO, pos), fwd);
  const fgPoint: Vec3 = [FOREGROUND[0], FOREGROUND[1], FOREGROUND[2]];
  const dFg = dot(sub(fgPoint, pos), fwd);
  const rack = easeInOut((t - 1.2) / 2.6);
  return {
    pos,
    target,
    fov: FOV,
    focus: lerp(dFg, dHero, rack),
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
      dust: buildDust(260, 7),
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

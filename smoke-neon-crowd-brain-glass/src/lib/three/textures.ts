import * as THREE from "three";

/** Soft radial falloff sprite (white; tint with material colour). */
export const radialTexture = (stops: [number, number][] = [
  [0, 1],
  [0.2, 0.5],
  [0.5, 0.12],
  [1, 0],
]) => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [p, a] of stops) grd.addColorStop(p, `rgba(255,255,255,${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
};

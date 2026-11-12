import * as THREE from "three";

/**
 * Colours are linear-light RGB multipliers. Everything in the scene is drawn
 * additively, so a palette fully defines the look of a version.
 */
export type Palette = {
  name: string;
  /** CSS colour shown behind the canvas before WebGL draws. */
  css: string;
  /** Black level (linear) — the reference never reaches pure black. */
  lift: THREE.Vector3;
  line: THREE.Color; // cube edges, wireframes
  face: THREE.Color; // translucent cube faces
  grid: THREE.Color; // background lattice lines
  text: THREE.Color; // code / numeric read-outs
  accent: THREE.Color; // charts, 3D bar blocks, the solid core cube
  dots: THREE.Color; // dotted wave surface
  sparkle: THREE.Color;
  beam: THREE.Color;
  tint: THREE.Vector3;
  saturation: number;
};

const srgb = (v: number) => Math.pow(v / 255, 2.2);

/** Version 1 — monochrome, matched to the reference (black level RGB 13). */
export const MONO: Palette = {
  name: "mono",
  css: "#0d0d0d",
  lift: new THREE.Vector3(srgb(13), srgb(13), srgb(13)),
  line: new THREE.Color(1, 1, 1),
  face: new THREE.Color(1, 1, 1),
  grid: new THREE.Color(1, 1, 1),
  text: new THREE.Color(1, 1, 1),
  accent: new THREE.Color(1, 1, 1),
  dots: new THREE.Color(1, 1, 1),
  sparkle: new THREE.Color(1, 1, 1),
  beam: new THREE.Color(1, 1, 1),
  tint: new THREE.Vector3(1, 1, 1),
  saturation: 0,
};

/** Version 2 — cyan/teal hologram with amber data accents on blue-black. */
export const CYAN_AMBER: Palette = {
  name: "cyan-amber",
  css: "#050a12",
  lift: new THREE.Vector3(srgb(5), srgb(10), srgb(18)),
  line: new THREE.Color(0.2, 0.82, 1.0),
  face: new THREE.Color(0.08, 0.55, 0.85),
  grid: new THREE.Color(0.12, 0.5, 0.95),
  text: new THREE.Color(0.55, 0.95, 1.0),
  accent: new THREE.Color(1.0, 0.56, 0.12),
  dots: new THREE.Color(0.35, 0.9, 1.0),
  sparkle: new THREE.Color(0.75, 0.95, 1.0),
  beam: new THREE.Color(0.2, 0.7, 1.0),
  tint: new THREE.Vector3(1, 1, 1),
  saturation: 1.08,
};

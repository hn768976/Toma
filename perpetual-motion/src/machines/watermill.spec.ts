// Robert Fludd's water-screw mill (Utriusque Cosmi, 1618): water from an upper
// tank turns a waterwheel; through gearing the wheel turns an Archimedes screw
// that lifts the same water back to the tank, and a millstone beside it.
// World units are centimetres, z up. The main axle runs along world x; every
// gear and the wheel turn in y–z planes, seen on their +x faces.
import type { V3 } from "../lib/curve.ts";

export const MILL = {
  wheel: { centre: [0, 0, 78] as V3, outer: 46, sole: 33, shroudIn: 31, buckets: 16, width: 16, shroud: 1.6 },
  axle: { from: -30, to: 58, r: 3.6 },
  trestles: [-20, 20],
  /** spur pair: G1 on the main axle, G2 above and behind it, carrying the millstone */
  g1: { x: 30, teeth: 32, pitch: 24, width: 6 },
  g2: { teeth: 16, pitch: 12, width: 6, angle: -30 },
  stone: { x0: 41, x1: 53, r: 21 },
  /** crown wheel on the axle's end; its 30 pins face +x */
  crown: { x: 56, pins: 36, pitch: 24, disc: 26, thick: 3, pinLength: 4 },
  /** the lantern: a cage of 10 pins round the screw, where it crosses in front of the crown */
  lantern: { pins: 9, r: 15.5, half: 4 },
  screw: { x: 75, slope: 35, from: -90, to: 145, flight: 10.5, shaft: 2.8, pitch: 26, trough: 14.5, drum: 12.2, drumHalf: 7 },
  /** the upper tank: a hooped tub on a tower; its level is steady (a closed loop) */
  tank: { centre: [75, -132, 110] as V3, r: 20, h: 30, level: 136 },
  /** the launder from the tank's outlet: along −x, then along +y over the wheel */
  launder: { z: 133, half: 6.5, outletX: 55, y: -132, endY: 14 },
  /** the wheel pit under the wheel, and the race to the screw's foot */
  pit: { x0: -14, x1: 14, y0: -40, y1: 88 },
  race: { x0: 14, x1: 96, y0: 56, y1: 88 },
  basinTop: 34,
  basinWater: 29,
  /** wheel turns per 20 s loop; with the gear ratios every part closes the loop */
  wheelTurns: 2,
};

const deg = Math.PI / 180;
/** unit direction of the screw's axis, rising toward −y */
export const SCREW_DIR: V3 = [0, -Math.cos(MILL.screw.slope * deg), Math.sin(MILL.screw.slope * deg)];
/** the screw's axis passes in front of the crown's centre, at the axle's height */
export const SCREW_ORIGIN: V3 = [MILL.screw.x, MILL.wheel.centre[1], MILL.wheel.centre[2]];
export const screwPoint = (t: number): V3 => [SCREW_ORIGIN[0], SCREW_ORIGIN[1] + SCREW_DIR[1] * t, SCREW_ORIGIN[2] + SCREW_DIR[2] * t];
/** the lantern sits one crown radius down the screw's axis from the crossing */
export const LANTERN_T = -MILL.crown.pitch;

export const G2_CENTRE: V3 = (() => {
  const d = MILL.g1.pitch + MILL.g2.pitch;
  const a = MILL.g2.angle * deg;
  // flat +x = world −y, flat +y = world −z on an x-face
  return [MILL.g1.x, MILL.wheel.centre[1] - d * Math.cos(a), MILL.wheel.centre[2] + d * Math.sin(a) * -1];
})();

/** Angles in degrees, on each part's own face (positive = clockwise as seen). */
export function millAngles(frame: number, loop: number) {
  // the wheel turns anticlockwise as seen: water lands on its left (+y) side
  const wheel = (-360 * MILL.wheelTurns * frame) / loop;
  const ratioG = MILL.g1.teeth / MILL.g2.teeth;
  // meshing spur gears turn opposite ways, speeds in the inverse ratio of teeth;
  // G2's phase puts a tooth gap on the line of centres when a G1 tooth is there
  const line = MILL.g2.angle;
  const g2 = line + 180 + 180 / MILL.g2.teeth - (wheel - line) * ratioG;
  // crown (36 pins) drives the lantern (9 pins): the screw turns 4× the wheel.
  // At the contact the crown's pins move toward −y and down; the lantern pin
  // facing the crown must move the same way, which is +ψ about the screw's
  // axis in SCREW_FRAME — so the screw's angle rises as the wheel's falls.
  const screw = -wheel * (MILL.crown.pins / MILL.lantern.pins);
  return { wheel, g2, screw, line };
}

/**
 * The screw's own frame: a = its axis (up the slope), e1 toward the crown
 * (−x), e2 = a × e1. A point at angle ψ sits at r·(cos ψ·e1 + sin ψ·e2).
 */
export const SCREW_FRAME = (() => {
  const a = SCREW_DIR;
  const e1: V3 = [-1, 0, 0];
  const e2: V3 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
  return { a, e1, e2 };
})();

export const screwAt = (t: number, r: number, psiDeg: number): V3 => {
  const p = screwPoint(t);
  const c = Math.cos(psiDeg * deg);
  const s = Math.sin(psiDeg * deg);
  const { e1, e2 } = SCREW_FRAME;
  return [p[0] + r * (c * e1[0] + s * e2[0]), p[1] + r * (c * e1[1] + s * e2[1]), p[2] + r * (c * e1[2] + s * e2[2])];
};

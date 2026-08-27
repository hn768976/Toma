/**
 * camera-paths.ts — every camera move in the project.
 *
 * A path is a PURE FUNCTION of the Remotion frame. There is no `useFrame`
 * delta, no THREE.Clock and no state anywhere in this file, which is what
 * makes the render deterministic: frame 217 produces the same camera on a
 * fresh render, on a resumed render and on a different machine.
 *
 * `VARIANTS[variant].cameraPath` names one of these modes, so adding a
 * version never means writing new camera code.
 */

import {Easing, interpolate} from 'remotion';
import {CITY_TOP} from './city-layout';

export type CameraState = {
	position: [number, number, number];
	lookAt: [number, number, number];
};

export type CameraPathArgs = {
	frame: number;
	durationInFrames: number;
};

export type CameraPathFn = (args: CameraPathArgs) => CameraState;

/** Shared lens. Kept here so CAMERA-NOTES.md has one place to quote. */
export const LENS = {
	fov: 42,
	near: 0.1,
	far: 600,
} as const;

const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);

const degToRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Height of the look-at point that gives a chosen downward pitch.
 *
 * Framing a city is easier to reason about in degrees than in look-at
 * heights: the horizon sits `pitch / (fov / 2)` of the way from the centre of
 * frame to the top edge, so keeping pitch a little under 21 degrees (half of
 * the 42 degree vertical fov) is what keeps a real horizon in shot.
 */
const targetHeightForPitch = (
	cameraY: number,
	radius: number,
	pitchDownDeg: number,
) => cameraY - radius * Math.tan(degToRad(pitchDownDeg));

/** Normalised progress 0..1 over the shot. */
const progress = (frame: number, durationInFrames: number) =>
	durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);

const polar = (
	radius: number,
	angle: number,
	y: number,
): [number, number, number] => [
	Math.cos(angle) * radius,
	y,
	Math.sin(angle) * radius,
];

/**
 * Small non-repeating handheld drift. Built from sines of the frame number
 * at deliberately incommensurable frequencies, so it never visibly loops and
 * is still a pure function of the frame.
 */
const wobble = (frame: number, amp: number): [number, number, number] => [
	(Math.sin(frame * 0.031) * 0.62 + Math.sin(frame * 0.0173 + 1.3) * 0.38) * amp,
	(Math.sin(frame * 0.0227 + 0.7) * 0.55 + Math.sin(frame * 0.041 + 2.1) * 0.3) *
		amp,
	(Math.cos(frame * 0.0269 + 2.4) * 0.6 + Math.cos(frame * 0.0139 + 0.4) * 0.34) *
		amp,
];

/* ── mode: "orbit" (v1 mint) ────────────────────────────────────────────
 * Circles the city at roughly the height of the tallest towers, covering
 * about a third of a full orbit over the shot while drifting slowly inward.
 * Slight handheld wobble on top of the ideal path.
 * ------------------------------------------------------------------- */
const orbit: CameraPathFn = ({frame, durationInFrames}) => {
	const t = progress(frame, durationInFrames);

	const angle = -0.55 + ((Math.PI * 2) / 3) * t; // ~120 degrees of orbit
	const radius = interpolate(t, [0, 1], [262, 205], {easing: easeInOut});
	// Just above the tallest tower, so the landmark tops stay in frame and
	// read against the ground rather than running off the top edge.
	const y = interpolate(t, [0, 1], [CITY_TOP * 1.16, CITY_TOP * 1.04], {
		easing: easeInOut,
	});
	const targetY = targetHeightForPitch(
		y,
		radius,
		interpolate(t, [0, 1], [16.5, 17.5], {easing: easeInOut}),
	);

	const [wx, wy, wz] = wobble(frame, 2.2);
	const [tx, ty, tz] = wobble(frame + 40, 0.9);
	const [px, py, pz] = polar(radius, angle, y);

	return {
		position: [px + wx, py + wy, pz + wz],
		lookAt: [tx * 0.6, targetY + ty * 0.5, tz * 0.6],
	};
};

/* ── mode: "descend" (v2 emerald) ───────────────────────────────────────
 * Starts high above the city looking steeply down, then descends to street
 * level while the angle flattens toward the horizon. Ease-in-out, no stops.
 * Ends close enough that near buildings pass out of frame at the edges.
 * ------------------------------------------------------------------- */
const descend: CameraPathFn = ({frame, durationInFrames}) => {
	const t = progress(frame, durationInFrames);
	const e = easeInOut(t);

	const angle = 0.9 + 0.62 * e;
	const radius = interpolate(e, [0, 1], [212, 74]);
	const y = interpolate(e, [0, 1], [300, 6.5]);

	// Look-at rises from the city footprint (steep downward angle) to just
	// above street level ahead of the camera (near-level angle).
	const targetY = interpolate(e, [0, 1], [0, 15]);
	const targetRadius = interpolate(e, [0, 1], [0, 6]);
	const [tx, , tz] = polar(targetRadius, angle + Math.PI, 0);

	const [wx, wy, wz] = wobble(frame, 0.85);
	const [px, py, pz] = polar(radius, angle, y);

	return {
		position: [px + wx, py + wy, pz + wz],
		lookAt: [tx, targetY, tz],
	};
};

/* ── mode: "levelOrbit" (v3 blueprint) ──────────────────────────────────
 * Circles at street level, looking slightly upward at the buildings, about a
 * quarter orbit over the shot. No descent, no height change — the parallax
 * between near and far buildings is what keeps the flat blueprint treatment
 * reading as three dimensional.
 * ------------------------------------------------------------------- */
const levelOrbit: CameraPathFn = ({frame, durationInFrames}) => {
	const t = progress(frame, durationInFrames);

	const angle = 2.35 + (Math.PI / 2) * interpolate(t, [0, 1], [0, 1], {
		easing: Easing.bezier(0.35, 0, 0.65, 1),
	});
	const radius = 196; // constant — no descent, no height change
	const y = 7;

	const [wx, wy, wz] = wobble(frame, 1.1);
	const [px, py, pz] = polar(radius, angle, y);

	return {
		position: [px + wx, py + wy, pz + wz],
		// Slightly above the camera => a gentle upward look.
		lookAt: [0, 54, 0],
	};
};

export const CAMERA_PATHS: Record<string, CameraPathFn> = {
	orbit,
	descend,
	levelOrbit,
};

/**
 * Sample every path's ground track. Fed to `generateCity` so it can clear a
 * corridor and guarantee the camera is never inside a building.
 */
export const sampleAllGroundTracks = (
	durationInFrames: number,
	step = 3,
): {x: number; z: number; y: number}[] => {
	const out: {x: number; z: number; y: number}[] = [];
	for (const fn of Object.values(CAMERA_PATHS)) {
		for (let frame = 0; frame <= durationInFrames; frame += step) {
			const {position} = fn({frame, durationInFrames});
			out.push({x: position[0], y: position[1], z: position[2]});
		}
	}
	return out;
};

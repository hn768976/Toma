import * as THREE from 'three';

export type CameraMode = 'reference-dolly' | 'low-angle-crane';

export type CamPose = {
	pos: THREE.Vector3;
	yaw: number; // radians, + = turn left
	pitch: number; // radians, + = look up
	roll: number; // radians
	fov: number;
};

/** Total forward travel over the shot (m). The end bank of racks roughly doubles in size, as in the reference. */
export const TRAVEL = 1.4;

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Version 1: slow, steady push down the centre of the aisle towards the
 * racks at the far end (no sway), matching the reference.
 * Version 2: low-angle crane — starts 16 cm above the glossy floor looking up
 * at the racks from the left of the aisle, arcs across to the right while
 * craning up to ~2.15 m and tilting down, banking through the move.
 */
export const cameraPose = (mode: CameraMode, t: number, durationFrames: number): CamPose => {
	const p = clamp01(t / (durationFrames - 1));
	// near-constant speed with a very soft start/stop (avoids a hard cut-in feel)
	const travel = THREE.MathUtils.lerp(p, smooth(p), 0.15);
	const z = -travel * TRAVEL;
	if (mode === 'reference-dolly') {
		return {
			pos: new THREE.Vector3(0, 1.3, z),
			yaw: 0,
			pitch: 0.075,
			roll: 0,
			fov: 62,
		};
	}
	const k = smooth(p);
	return {
		pos: new THREE.Vector3(THREE.MathUtils.lerp(-0.6, 0.62, k), THREE.MathUtils.lerp(0.16, 2.15, k), z),
		yaw: THREE.MathUtils.lerp(-0.13, 0.1, k),
		pitch: THREE.MathUtils.lerp(0.38, -0.22, k),
		roll: THREE.MathUtils.lerp(-0.15, 0.06, k),
		fov: THREE.MathUtils.lerp(74, 60, k),
	};
};

import * as THREE from 'three';

export type CameraMode = 'reference-dolly' | 'low-angle-crane';

export type CamPose = {
	pos: THREE.Vector3;
	yaw: number; // radians, + = turn left
	pitch: number; // radians, + = look up
	roll: number; // radians
	fov: number;
};

export const SPEED = 2.35; // metres per second down the aisle
const FPS = 30;

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Version 1: steady eye-level dolly down the centre of the aisle with the
 * gentle hand-held sway seen in the reference.
 * Version 2: low-angle crane — starts 30 cm above the glossy floor looking up
 * at the racks, rises to eye level while weaving left/right and banking into
 * each turn.
 */
export const cameraPose = (mode: CameraMode, t: number, durationFrames: number): CamPose => {
	const s = t / FPS;
	const z = -s * SPEED;
	if (mode === 'reference-dolly') {
		return {
			pos: new THREE.Vector3(
				0.06 * Math.sin(s * 0.9) + 0.025 * Math.sin(s * 2.3 + 1.0),
				1.32 + 0.025 * Math.sin(s * 1.7 + 0.4),
				z,
			),
			yaw: 0.022 * Math.sin(s * 0.75 + 0.5) + 0.008 * Math.sin(s * 1.9),
			pitch: 0.015 + 0.01 * Math.sin(s * 1.1 + 2.0),
			roll: 0.012 * Math.sin(s * 0.8 + 1.3),
			fov: 62,
		};
	}
	const k = smooth(clamp01(t / durationFrames));
	const weave = Math.sin(s * 0.62);
	return {
		pos: new THREE.Vector3(0.38 * weave, 0.3 + 1.45 * k, z * 0.92),
		yaw: -0.07 * Math.cos(s * 0.62),
		pitch: THREE.MathUtils.lerp(0.32, -0.03, k),
		roll: -0.11 * weave,
		fov: THREE.MathUtils.lerp(70, 60, k),
	};
};

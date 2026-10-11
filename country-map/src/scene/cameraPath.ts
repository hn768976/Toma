import * as THREE from 'three';
import type { CountryRow } from '../rows';

export const FPS = 30;
export const DURATION = 450;
export const RACK_END = 90; // 3 s
export const CAMERA_ELEVATION = 32; // degrees above the paper
export const CAMERA_FOV = 22; // vertical, degrees
/** Frame width at the focus distance, in world units (the hi texture is 10 units). */
export const FRAME_WIDTH_AT_FOCUS = 4.4;
/** Fraction of frame height that stays sharp around the name. */
export const SHARP_BAND = 0.08;
/** CoC slope: CoC (fraction of frame height) at twice the sharp band's depth range. */
export const COC_AT_BAND_EDGE = 0.0013;
export const MAX_COC = 0.045;
/** Rack focus starts this much nearer than the name (fraction of focus distance). */
export const RACK_START = 0.84;

const ASPECT = 16 / 9;
const tanHalfV = Math.tan((CAMERA_FOV * Math.PI) / 360);
/** Frame width at focus for a row (row.zoom widens the shot for compact countries). */
export const frameWidth = (row: CountryRow) => FRAME_WIDTH_AT_FOCUS * (row.zoom ?? 1);
const cameraDistance = (row: CountryRow) => frameWidth(row) / (2 * tanHalfV * ASPECT);

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Slow continuous slide over the whole shot: gentle start, gentle end.
const easeSlide = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

export type Shot = {
	position: THREE.Vector3;
	target: THREE.Vector3;
	/** View-space depth that is in focus. */
	focusDepth: number;
	/** CoC = k * max(|z - zf| / z - dead, 0) (fraction of frame height). */
	cocScale: number;
	/** Relative depth inside which CoC is exactly 0: the sharp band. */
	cocDead: number;
};

/** Everything the camera does is a pure function of the frame number. */
export const shotAt = (row: CountryRow, frame: number, camera: THREE.PerspectiveCamera): Shot => {
	const f = ((frame % DURATION) + DURATION) % DURATION;
	const s = easeSlide(f / (DURATION - 1));
	const { start, end, yaw } = row.camera;
	const base = ((row.camera.baseYaw ?? 0) * Math.PI) / 180;
	const fw = frameWidth(row);
	const ox = (start[0] + (end[0] - start[0]) * s) * fw;
	const oz = (start[1] + (end[1] - start[1]) * s) * fw;
	const yawRad = base + ((yaw[0] + (yaw[1] - yaw[0]) * s) * Math.PI) / 180;
	const el = (CAMERA_ELEVATION * Math.PI) / 180;

	// Offsets are in the camera's own frame (lateral, forward), turned by baseYaw.
	const target = new THREE.Vector3(ox, 0, oz).applyAxisAngle(new THREE.Vector3(0, 1, 0), base);
	const back = new THREE.Vector3(0, Math.sin(el), Math.cos(el)).multiplyScalar(cameraDistance(row));
	back.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
	const position = target.clone().add(back);

	camera.position.copy(position);
	camera.up.set(0, 1, 0);
	camera.lookAt(target);
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	// Focus plane = the name (world origin).
	const name = new THREE.Vector3(0, 0, 0);
	const nameView = name.clone().applyMatrix4(camera.matrixWorldInverse);
	const zName = -nameView.z;

	// Calibrate the CoC so the sharp band is SHARP_BAND of the frame height:
	// intersect rays at the band edges with the paper (y = 0).
	const nameNdc = name.clone().project(camera);
	const depthAtNdcY = (ndcY: number) => {
		const p = new THREE.Vector3(nameNdc.x, ndcY, 0.5).unproject(camera);
		const dir = p.sub(camera.position).normalize();
		const t = -camera.position.y / dir.y;
		const hit = camera.position.clone().add(dir.multiplyScalar(t));
		return -hit.applyMatrix4(camera.matrixWorldInverse).z;
	};
	const zUp = depthAtNdcY(nameNdc.y + SHARP_BAND);
	const zDown = depthAtNdcY(nameNdc.y - SHARP_BAND);
	const rel = 0.5 * (Math.abs(zUp - zName) / zUp + Math.abs(zDown - zName) / zDown);
	const cocScale = COC_AT_BAND_EDGE / rel;

	const rack = easeInOutCubic(clamp01(f / RACK_END));
	const focusDepth = zName * (RACK_START + (1 - RACK_START) * rack);
	return { position, target, focusDepth, cocScale, cocDead: rel };
};

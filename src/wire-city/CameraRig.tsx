/**
 * CameraRig.tsx — the perspective camera and the frame-driven rig that moves
 * it.
 *
 * GOTCHA worth knowing before you copy this file into another project:
 * the drei-shaped pattern — `<PerspectiveCamera makeDefault />` in one
 * component and a rig that reads `useThree(s => s.camera)` in another — does
 * NOT work under Remotion. `set({camera})` updates the r3f store
 * synchronously but the React re-render that hands the new camera to
 * subscribers is deferred, and Remotion's render loop only ticks once per
 * frame (`advance()` in a passive effect). The rig therefore positions the
 * *previous* default camera and the frame is captured looking at the origin
 * from (0, 0, 5) — a close-up of whatever happens to be at the centre of the
 * scene, or plain background.
 *
 * The fix is to keep the camera object and its transform in the same place:
 * `useSceneCamera()` creates it, `CameraRig` both installs it as the default
 * and writes the frame-derived transform onto that exact object, and anything
 * else that needs the camera (the EffectComposer) is handed the object
 * explicitly rather than fishing it out of the store.
 *
 * There is deliberately no `useFrame` here. `useFrame`'s delta is wall-clock
 * based and would make the render non-deterministic.
 */

import {useThree} from '@react-three/fiber';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {CameraState} from './camera-paths';

export type Lens = {
	fov: number;
	near: number;
	far: number;
};

/** Creates the one camera object the whole scene shares. */
export const useSceneCamera = (lens: Lens): THREE.PerspectiveCamera => {
	return useMemo(
		() => new THREE.PerspectiveCamera(lens.fov, 1, lens.near, lens.far),
		[lens.fov, lens.near, lens.far],
	);
};

export const CameraRig: React.FC<{
	camera: THREE.PerspectiveCamera;
	lens: Lens;
	state: CameraState;
	makeDefault?: boolean;
}> = ({camera, lens, state, makeDefault = true}) => {
	const set = useThree((s) => s.set);
	const size = useThree((s) => s.size);

	useLayoutEffect(() => {
		if (!makeDefault) return;
		set({camera});
	}, [makeDefault, camera, set]);

	useLayoutEffect(() => {
		camera.fov = lens.fov;
		camera.near = lens.near;
		camera.far = lens.far;
		camera.aspect = size.width / size.height;
		camera.updateProjectionMatrix();
	}, [camera, lens.fov, lens.near, lens.far, size.width, size.height]);

	useLayoutEffect(() => {
		camera.position.set(state.position[0], state.position[1], state.position[2]);
		camera.up.set(0, 1, 0);
		camera.lookAt(state.lookAt[0], state.lookAt[1], state.lookAt[2]);
		camera.updateMatrixWorld(true);
	}, [camera, state]);

	return <primitive object={camera} />;
};

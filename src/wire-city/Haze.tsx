/**
 * Haze.tsx — the horizon glow.
 *
 * A large open-ended cylinder rendered from the inside, centred on the CAMERA
 * — all three of its coordinates, not just XZ. That is the detail that makes
 * it read as a horizon: on a cylinder centred on the eye, the ray elevation
 * is a pure function of local height, so an alpha that peaks at local y = 0
 * peaks exactly along the horizon line wherever the camera is and whichever
 * way it is pitched. Centring it at world y = 0 instead (the obvious first
 * guess) pins the band to the ground plane, and it slides down the frame into
 * a random-looking bright stripe as soon as the camera gains any height.
 *
 * Its radius is well inside the 600-unit far clip and well outside the city,
 * so it is always behind the buildings and never clipped.
 *
 * depthWrite is off and renderOrder is high, so it hazes the geometry behind
 * it instead of hiding it.
 */

import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {CameraState} from './camera-paths';
import type {VariantConfig} from './variants';

const RADIUS = 400;
const HEIGHT = 1200;

const VERT = /* glsl */ `
varying float vLocalY;
void main() {
  // Local, not world: the mesh is parented to the camera position, so local
  // y is height relative to the eye — i.e. ray elevation.
  vLocalY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uHaze;
uniform float uFalloff;
uniform float uStrength;
varying float vLocalY;
void main() {
  float a = exp(-abs(vLocalY) / uFalloff) * uStrength;
  gl_FragColor = vec4(uHaze, clamp(a, 0.0, 1.0));
}
`;

export const Haze: React.FC<{config: VariantConfig; camera: CameraState}> = ({
	config,
	camera,
}) => {
	const mesh = useMemo(() => {
		const geometry = new THREE.CylinderGeometry(
			RADIUS,
			RADIUS,
			HEIGHT,
			64,
			1,
			true,
		);
		const material = new THREE.ShaderMaterial({
			vertexShader: VERT,
			fragmentShader: FRAG,
			uniforms: {
				uHaze: {value: new THREE.Color(config.palette.haze)},
				uFalloff: {value: 26},
				uStrength: {value: 0.8},
			},
			transparent: true,
			depthWrite: false,
			side: THREE.BackSide,
			toneMapped: false,
		});
		const m = new THREE.Mesh(geometry, material);
		m.renderOrder = 10;
		m.frustumCulled = false;
		return m;
	}, [config.palette.haze]);

	mesh.position.set(
		camera.position[0],
		camera.position[1],
		camera.position[2],
	);

	useEffect(() => {
		return () => {
			mesh.geometry.dispose();
			(mesh.material as THREE.Material).dispose();
		};
	}, [mesh]);

	return <primitive object={mesh} />;
};

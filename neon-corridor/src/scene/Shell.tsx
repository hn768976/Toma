import React, {useMemo} from 'react';
import {Color, DoubleSide} from 'three';
import {
	CORRIDOR_DEPTH,
	FOG_DENSITY,
	HALF_WIDTH,
	HEIGHT_UNITS,
	RAMP_DEPTH,
	TUBE_THICKNESS,
	Z_SLOT0,
} from '../config';
import {neonColorAt, type Palette} from '../palette';

/** Fraction of tube brightness the walls pick up. */
const WALL_SPILL = 0.02;
/** The ceiling stays black; this is just enough to keep it from being a void. */
const CEILING_SPILL = 0.008;

const vertexShader = /* glsl */ `
	varying vec3 vWorldPos;
	void main() {
		vec4 wp = modelMatrix * vec4(position, 1.0);
		vWorldPos = wp.xyz;
		gl_Position = projectionMatrix * viewMatrix * wp;
	}
`;

/**
 * Light pooling on the shell.
 *
 * Without this the corridor's outer thirds fall to dead black and the tunnel
 * stops reading as an enclosed space — in the reference those regions are a
 * soft violet wash, brightest low down where the tubes meet the floor.
 */
const fragmentShader = /* glsl */ `
	uniform vec3 uSpillNear;
	uniform vec3 uSpillFar;
	uniform vec3 uBase;
	uniform vec3 uFogColor;
	uniform float uFogDensity;
	uniform float uRampDepth;
	uniform float uCamZ;
	uniform float uHeight;
	uniform float uGradient;

	varying vec3 vWorldPos;

	void main() {
		float d = max(uCamZ - vWorldPos.z, 0.0);
		float u = clamp(d / uRampDepth, 0.0, 1.0);

		// Brightest where the tubes meet the floor, falling off upward.
		float h = clamp(vWorldPos.y / uHeight, 0.0, 1.0);
		float vertical = mix(1.0, uGradient, h * h);

		vec3 col = uBase + mix(uSpillNear, uSpillFar, u) * vertical;

		float fd = uFogDensity * d;
		col = mix(col, uFogColor, 1.0 - exp(-fd * fd));

		gl_FragColor = vec4(col, 1.0);
	}
`;

const useShellUniforms = (palette: Palette, gain: number, gradient: number) =>
	useMemo(
		() => ({
			uSpillNear: {value: neonColorAt(14, palette, gain)},
			uSpillFar: {value: neonColorAt(RAMP_DEPTH, palette, gain)},
			uBase: {value: new Color(palette.shell)},
			uFogColor: {value: new Color(palette.background)},
			uFogDensity: {value: FOG_DENSITY},
			uRampDepth: {value: RAMP_DEPTH},
			uCamZ: {value: 0},
			uHeight: {value: HEIGHT_UNITS},
			uGradient: {value: gradient},
		}),
		[palette, gain, gradient],
	);

/** Walls and ceiling. */
export const Shell: React.FC<{palette: Palette}> = ({palette}) => {
	const wall = useShellUniforms(palette, WALL_SPILL, 0.28);
	const ceiling = useShellUniforms(palette, CEILING_SPILL, 1);

	const z = Z_SLOT0 - CORRIDOR_DEPTH / 2;
	const len = CORRIDOR_DEPTH + 8;

	return (
		<group>
			<mesh
				position={[-HALF_WIDTH - TUBE_THICKNESS, HEIGHT_UNITS / 2, z]}
				rotation={[0, Math.PI / 2, 0]}
			>
				<planeGeometry args={[len, HEIGHT_UNITS]} />
				<shaderMaterial
					uniforms={wall}
					vertexShader={vertexShader}
					fragmentShader={fragmentShader}
					toneMapped={false}
					side={DoubleSide}
				/>
			</mesh>
			<mesh
				position={[HALF_WIDTH + TUBE_THICKNESS, HEIGHT_UNITS / 2, z]}
				rotation={[0, -Math.PI / 2, 0]}
			>
				<planeGeometry args={[len, HEIGHT_UNITS]} />
				<shaderMaterial
					uniforms={wall}
					vertexShader={vertexShader}
					fragmentShader={fragmentShader}
					toneMapped={false}
					side={DoubleSide}
				/>
			</mesh>
			<mesh position={[0, HEIGHT_UNITS + TUBE_THICKNESS, z]} rotation={[Math.PI / 2, 0, 0]}>
				<planeGeometry args={[HALF_WIDTH * 2 + 0.4, len]} />
				<shaderMaterial
					uniforms={ceiling}
					vertexShader={vertexShader}
					fragmentShader={fragmentShader}
					toneMapped={false}
					side={DoubleSide}
				/>
			</mesh>
		</group>
	);
};

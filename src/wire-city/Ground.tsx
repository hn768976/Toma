/**
 * Ground.tsx — the dot-grid ground plane.
 *
 * Two co-planar regular lattices of points at y = 0:
 *   - a FINE lattice (3.5 units, offset half a cell so it never lands on top
 *     of the coarse one) that dissolves with distance
 *   - a COARSE lattice (14 units, the street pitch) that runs out to 900
 *     units, well past the 600-unit far clip
 *
 * "Denser and brighter near the camera" is done in the shader, not the
 * geometry: each fine point carries a seeded random value and is discarded
 * once its distance-derived coverage drops below it. That thins the lattice
 * stochastically with distance instead of cutting it off at a visible ring,
 * and because the test is against camera-space depth the dense region travels
 * with the camera.
 *
 * Point size follows three's own sizeAttenuation formula
 * (`size * halfBufferHeight / depth`), so a dot is a fixed WORLD size and the
 * 4K render and the --scale=0.5 preview agree. Sub-pixel dots are clamped up
 * to one pixel and dimmed instead, which is what keeps the far field from
 * turning into hard aliased speckle.
 *
 * Dots fade toward `palette.haze` rather than vanishing, so the far field
 * settles into the horizon glow.
 */

import React, {useEffect, useMemo} from 'react';
import {random} from 'remotion';
import * as THREE from 'three';
import {CELL} from './city-layout';
import {getDrawingBufferSize} from './three-helpers';
import type {VariantConfig} from './variants';

const buildVertexShader = (thinned: boolean) => /* glsl */ `
attribute float aRand;

uniform float uSize;
uniform float uHalfHeight;
uniform float uMixNear;
uniform float uMixFar;
uniform float uHazeStart;
uniform float uHazeEnd;
uniform float uCutStart;
uniform float uCutEnd;
uniform float uThinStart;
uniform float uThinEnd;

varying float vMix;
varying float vFade;
varying float vCut;
varying float vDim;
varying float vSizePx;
${thinned ? 'varying float vCull;' : ''}

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = -mv.z;
  gl_Position = projectionMatrix * mv;

  vMix = smoothstep(uMixNear, uMixFar, depth);
  // Two-stage distance fade: colour settles into the haze first (that is the
  // horizon glow), then the haze itself settles into the background before
  // the 600-unit far clip, so the lattice is already invisible by the time
  // the clip plane cuts it and the horizon reads as real rather than sawn off.
  vFade = 1.0 - smoothstep(uHazeStart, uHazeEnd, depth);
  vCut = 1.0 - smoothstep(uCutStart, uCutEnd, depth);

${
	thinned
		? `  // Stochastic thinning: coverage is 1 near the camera and 0 far away,
  // so a point survives only while its seeded random value is under it.
  float coverage = 1.0 - smoothstep(uThinStart, uThinEnd, depth);
  vCull = aRand - coverage;`
		: ''
}
  float sizePx = uSize * uHalfHeight / max(depth, 0.001);
  // A point thinner than a pixel is drawn at one pixel and dimmed instead,
  // which keeps the far field smooth rather than hard aliased speckle.
  vSizePx = max(sizePx, 1.0);
  gl_PointSize = vSizePx;
  vDim = clamp(sizePx, 0.3, 1.0);
}
`;

const buildFragmentShader = (thinned: boolean) => /* glsl */ `
uniform vec3 uNearColor;
uniform vec3 uFarColor;
uniform vec3 uHaze;
uniform vec3 uBackground;
uniform float uIntensity;

varying float vMix;
varying float vFade;
varying float vCut;
varying float vDim;
varying float vSizePx;
${thinned ? 'varying float vCull;' : ''}

void main() {
${thinned ? '  if (vCull > 0.0) discard;' : ''}
  // Round the dot off only once it is big enough for gl_PointCoord to mean
  // anything. At gl_PointSize 1 some drivers (SwiftShader among them) hand
  // the fragment a corner coordinate rather than the centre, and an
  // unconditional radius test then discards the entire far field.
  vec2 d = gl_PointCoord - 0.5;
  if (vSizePx > 2.5 && dot(d, d) > 0.25) discard;
  vec3 c = mix(uNearColor, uFarColor, vMix) * uIntensity;
  vec3 hazed = mix(uHaze, c, vFade * vDim);
  gl_FragColor = vec4(mix(uBackground, hazed, vCut), 1.0);
}
`;

type LatticeSpec = {
	id: string;
	spacing: number;
	offset: number;
	extent: number;
	size: number;
	mixNear: number;
	mixFar: number;
	hazeStart: number;
	hazeEnd: number;
	cutStart: number;
	cutEnd: number;
	/** Distance range over which the lattice stochastically thins away. */
	thinStart: number;
	thinEnd: number;
	thinned: boolean;
};

/*
 * The distances below are tuned to the depth range the three camera paths
 * actually see. A pitched-down orbit camera 130 units up never sees ground
 * closer than ~200 units, so a fine lattice that thins out by 330 would be
 * gone exactly where it is needed.
 */
const FINE: LatticeSpec = {
	id: 'fine',
	spacing: CELL / 4,
	offset: CELL / 8,
	extent: 430,
	size: 0.95,
	mixNear: 25,
	mixFar: 460,
	hazeStart: 330,
	hazeEnd: 470,
	cutStart: 500,
	cutEnd: 588,
	thinStart: 250,
	thinEnd: 620,
	thinned: true,
};

const COARSE: LatticeSpec = {
	id: 'coarse',
	spacing: CELL,
	offset: 0,
	extent: 900,
	size: 1.15,
	mixNear: 30,
	mixFar: 520,
	hazeStart: 380,
	hazeEnd: 520,
	cutStart: 535,
	cutEnd: 594,
	thinStart: 1e6,
	thinEnd: 2e6,
	thinned: false,
};

const buildLattice = (spec: LatticeSpec) => {
	const steps = Math.floor((spec.extent * 2) / spec.spacing) + 1;
	const positions = new Float32Array(steps * steps * 3);
	const rand = new Float32Array(steps * steps);
	let o = 0;
	let r = 0;
	for (let i = 0; i < steps; i++) {
		const x = -spec.extent + i * spec.spacing + spec.offset;
		for (let j = 0; j < steps; j++) {
			positions[o++] = x;
			positions[o++] = 0;
			positions[o++] = -spec.extent + j * spec.spacing + spec.offset;
			rand[r++] = random(`dot-${spec.id}-${i}-${j}`);
		}
	}
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
	return geometry;
};

const Lattice: React.FC<{spec: LatticeSpec; config: VariantConfig}> = ({
	spec,
	config,
}) => {
	const {palette} = config;

	const points = useMemo(() => {
		const geometry = buildLattice(spec);
		const material = new THREE.ShaderMaterial({
			vertexShader: buildVertexShader(spec.thinned),
			fragmentShader: buildFragmentShader(spec.thinned),
			uniforms: {
				uSize: {value: spec.size * config.ground.dotSize},
				uHalfHeight: {value: 1},
				uMixNear: {value: spec.mixNear},
				uMixFar: {value: spec.mixFar},
				uHazeStart: {value: spec.hazeStart},
				uHazeEnd: {value: spec.hazeEnd},
				uCutStart: {value: spec.cutStart},
				uCutEnd: {value: spec.cutEnd},
				uThinStart: {value: spec.thinStart},
				uThinEnd: {value: spec.thinEnd},
				uNearColor: {value: new THREE.Color(palette.groundBright)},
				uFarColor: {value: new THREE.Color(palette.groundDot)},
				uHaze: {value: new THREE.Color(palette.haze)},
				uBackground: {value: new THREE.Color(palette.background)},
				uIntensity: {value: config.ground.intensity},
			},
			transparent: false,
			depthWrite: true,
			toneMapped: false,
			fog: false,
		});
		const p = new THREE.Points(geometry, material);
		p.frustumCulled = false;
		// Point size follows three's own attenuation formula, which needs half
		// the drawing-buffer height. Read it at draw time — see the note on
		// getDrawingBufferSize().
		p.onBeforeRender = (renderer) => {
			material.uniforms.uHalfHeight.value =
				getDrawingBufferSize(renderer).y / 2;
		};
		return p;
	}, [
		spec,
		palette.groundBright,
		palette.groundDot,
		palette.haze,
		palette.background,
		config.ground.intensity,
		config.ground.dotSize,
	]);

	useEffect(() => {
		return () => {
			points.geometry.dispose();
			(points.material as THREE.Material).dispose();
		};
	}, [points]);

	return <primitive object={points} />;
};

export const Ground: React.FC<{config: VariantConfig}> = ({config}) => (
	<group>
		<Lattice spec={COARSE} config={config} />
		<Lattice spec={FINE} config={config} />
	</group>
);

/**
 * Windows.tsx — the lit-window points for the "windows" building mode
 * (the emerald version's signature).
 *
 * Every window in the city lives in ONE THREE.Points object — a regular grid
 * of candidate positions on each building's four side faces, thinned by a
 * seeded keep-test, so no window is modelled as geometry and the whole layer
 * is a single draw call.
 *
 * Windows switch on progressively: each surviving window carries a seeded
 * activation frame spread across config.windows.onFrom..onTo, and the
 * fragment shader compares it against a uFrame uniform driven by
 * useCurrentFrame(). The city therefore lights up over the shot, identically
 * on every render — the activation pattern is data, not time.
 *
 * Placement details that matter:
 *  - points sit 0.09 units OUTSIDE their face, so they cannot z-fight with
 *    the building fill (whose polygonOffset pushes it the other way);
 *  - depth testing stays on, so a window behind a nearer building is hidden
 *    by that building's fill exactly like the wireframe edges are;
 *  - depthWrite is off (the points fade in, so they render as transparent).
 */

import React, {useEffect, useLayoutEffect, useMemo} from 'react';
import {random} from 'remotion';
import * as THREE from 'three';
import type {CityLayout} from './city-layout';
import {getDrawingBufferSize} from './three-helpers';
import type {VariantConfig} from './variants';

const VERT = /* glsl */ `
attribute float aActivate;
attribute float aBright;

uniform float uSize;
uniform float uHalfHeight;
uniform float uFrame;
uniform float uFade;

varying float vAlpha;
varying float vBright;
varying float vSizePx;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float depth = -mv.z;
  gl_Position = projectionMatrix * mv;

  // 0 before the window's activation frame, 1 once it has faded up.
  vAlpha = smoothstep(aActivate, aActivate + uFade, uFrame);
  vBright = aBright;

  float sizePx = uSize * uHalfHeight / max(depth, 0.001);
  vSizePx = max(sizePx, 1.0);
  gl_PointSize = vSizePx;
  // Sub-pixel windows dim instead of vanishing, like the ground dots.
  vAlpha *= clamp(sizePx, 0.35, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;

varying float vAlpha;
varying float vBright;
varying float vSizePx;

void main() {
  if (vAlpha < 0.004) discard;
  // Same guard as Ground.tsx: gl_PointCoord is unreliable at point size 1.
  vec2 d = gl_PointCoord - 0.5;
  if (vSizePx > 2.5 && dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(uColor * vBright, vAlpha);
}
`;

/** Horizontal / vertical pitch of the candidate window grid, world units. */
const COL_SPACING = 1.9;
const ROW_SPACING = 2.6;
/** Keep-out from face edges so windows never touch the wireframe lines. */
const MARGIN = 0.95;
/** First row height — no windows at ground contact. */
const FIRST_ROW = 1.6;
/** Offset outside the face, defeating z-fighting with the fill. */
const FACE_OFFSET = 0.09;

type WindowBuffers = {
	positions: Float32Array;
	activate: Float32Array;
	bright: Float32Array;
	count: number;
};

const buildWindowBuffers = (
	city: CityLayout,
	config: VariantConfig,
	seed: string,
): WindowBuffers => {
	const {onFrom, onTo, density} = config.windows;
	const positions: number[] = [];
	const activate: number[] = [];
	const bright: number[] = [];

	for (const b of city.buildings) {
		// The four side faces: [axis along the face, fixed coordinate, normal sign]
		const faces = [
			{alongW: true, fixed: b.z - b.d / 2 - FACE_OFFSET},
			{alongW: true, fixed: b.z + b.d / 2 + FACE_OFFSET},
			{alongW: false, fixed: b.x - b.w / 2 - FACE_OFFSET},
			{alongW: false, fixed: b.x + b.w / 2 + FACE_OFFSET},
		];

		faces.forEach((face, f) => {
			const span = (face.alongW ? b.w : b.d) - MARGIN * 2;
			const cols = Math.max(1, Math.floor(span / COL_SPACING) + 1);
			const colStep = cols === 1 ? 0 : span / (cols - 1);
			const rows = Math.floor((b.h - FIRST_ROW - MARGIN) / ROW_SPACING) + 1;
			if (rows < 1) return;

			for (let c = 0; c < cols; c++) {
				const along =
					-(span / 2) + c * colStep + (cols === 1 ? span / 2 : 0);
				for (let r = 0; r < rows; r++) {
					const key = `${seed}-win-${b.i}-${b.j}-${f}-${c}-${r}`;
					if (random(`${key}-keep`) > density) continue;

					const y = FIRST_ROW + r * ROW_SPACING;
					positions.push(
						face.alongW ? b.x + along : face.fixed,
						y,
						face.alongW ? face.fixed : b.z + along,
					);
					activate.push(onFrom + random(`${key}-on`) * (onTo - onFrom));
					bright.push(0.72 + random(`${key}-br`) * 0.28);
				}
			}
		});
	}

	return {
		positions: new Float32Array(positions),
		activate: new Float32Array(activate),
		bright: new Float32Array(bright),
		count: positions.length / 3,
	};
};

export const Windows: React.FC<{
	city: CityLayout;
	config: VariantConfig;
	frame: number;
	seed: string;
}> = ({city, config, frame, seed}) => {
	const points = useMemo(() => {
		const buffers = buildWindowBuffers(city, config, seed);
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute(
			'position',
			new THREE.BufferAttribute(buffers.positions, 3),
		);
		geometry.setAttribute(
			'aActivate',
			new THREE.BufferAttribute(buffers.activate, 1),
		);
		geometry.setAttribute(
			'aBright',
			new THREE.BufferAttribute(buffers.bright, 1),
		);

		const material = new THREE.ShaderMaterial({
			vertexShader: VERT,
			fragmentShader: FRAG,
			uniforms: {
				uSize: {value: config.windows.size},
				uHalfHeight: {value: 1},
				uFrame: {value: 0},
				uFade: {value: config.windows.fadeFrames},
				uColor: {value: new THREE.Color(config.palette.windowLit)},
			},
			transparent: true,
			depthWrite: false,
			depthTest: true,
			toneMapped: false,
			fog: false,
		});

		const p = new THREE.Points(geometry, material);
		p.frustumCulled = false;
		p.renderOrder = 2; // after the opaque fills and edges, before the haze
		p.onBeforeRender = (renderer) => {
			material.uniforms.uHalfHeight.value =
				getDrawingBufferSize(renderer).y / 2;
		};
		return p;
	}, [city, config, seed]);

	useLayoutEffect(() => {
		(points.material as THREE.ShaderMaterial).uniforms.uFrame.value = frame;
	}, [points, frame]);

	useEffect(() => {
		return () => {
			points.geometry.dispose();
			(points.material as THREE.Material).dispose();
		};
	}, [points]);

	return <primitive object={points} />;
};

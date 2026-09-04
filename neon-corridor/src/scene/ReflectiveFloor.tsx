import React, {useEffect, useMemo, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
	Color,
	HalfFloatType,
	LinearFilter,
	LinearSRGBColorSpace,
	Matrix4,
	type Mesh,
	PerspectiveCamera,
	WebGLRenderTarget,
} from 'three';
import {
	CORRIDOR_DEPTH,
	FOG_DENSITY,
	HALF_WIDTH,
	RAMP_DEPTH,
	SPACING,
	Z_SLOT0,
} from '../config';
import {loopT} from '../loop';
import {neonColorAt, type Palette} from '../palette';

/** Reflection is blurred anyway, so half resolution costs nothing visible. */
const REFLECTION_SCALE = 0.5;
/** How much of the neon survives the bounce. */
const REFLECTION_STRENGTH = 0.46;
/** Fraction of tube brightness that lands on the slab as diffuse spill. */
const SPILL_GAIN = 0.009;

const MIRROR = new Matrix4().makeScale(1, -1, 1);

const vertexShader = /* glsl */ `
	uniform mat4 uTextureMatrix;
	varying vec3 vWorldPos;
	varying vec4 vReflUv;

	void main() {
		vec4 wp = modelMatrix * vec4(position, 1.0);
		vWorldPos = wp.xyz;
		vReflUv = uTextureMatrix * wp;
		gl_Position = projectionMatrix * viewMatrix * wp;
	}
`;

const fragmentShader = /* glsl */ `
	uniform sampler2D uRefl;
	uniform float uTravel;
	uniform float uSpacing;
	uniform float uCamZ;
	uniform float uStrength;
	uniform float uBlurNear;
	uniform float uBlurFar;
	uniform float uFogDensity;
	uniform vec3 uFogColor;
	uniform vec3 uFloorTint;
	uniform vec3 uSpillNear;
	uniform vec3 uSpillFar;
	uniform float uRampDepth;

	varying vec3 vWorldPos;
	varying vec4 vReflUv;

	float hash21(vec2 p) {
		p = fract(p * vec2(127.1, 311.7));
		p += dot(p, p + 34.23);
		return fract(p.x * p.y);
	}

	// Value noise that tiles exactly every 'per' cells along y.
	float tileNoise(vec2 p, float per) {
		vec2 i = floor(p);
		vec2 f = fract(p);
		f = f * f * (3.0 - 2.0 * f);
		float y0 = mod(i.y, per);
		float y1 = mod(i.y + 1.0, per);
		float a = hash21(vec2(i.x, y0));
		float b = hash21(vec2(i.x + 1.0, y0));
		float c = hash21(vec2(i.x, y1));
		float d = hash21(vec2(i.x + 1.0, y1));
		return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
	}

	// Damp-concrete mottling. Every octave tiles with a period of exactly one
	// frame-spacing in world z, so the texture scrolls toward the camera with
	// the corridor and still lands back on itself at the end of the loop.
	float mottle(vec2 w) {
		float cps = 2.0 / uSpacing;
		float n = 0.44 * tileNoise(vec2(w.x * 0.55, w.y * cps), 2.0);
		n += 0.26 * tileNoise(vec2(w.x * 1.40, w.y * cps * 2.0), 4.0);
		n += 0.18 * tileNoise(vec2(w.x * 3.60, w.y * cps * 4.0), 8.0);
		n += 0.12 * tileNoise(vec2(w.x * 8.10, w.y * cps * 8.0), 16.0);
		return n;
	}

	void main() {
		vec2 uv = vReflUv.xy / max(vReflUv.w, 1e-5);

		float d = max(uCamZ - vWorldPos.z, 0.0);
		float near01 = 1.0 - clamp(d / 26.0, 0.0, 1.0);

		vec2 w = vec2(vWorldPos.x, vWorldPos.z - uTravel);
		float m = mottle(w);
		float m2 = mottle(w + vec2(11.7, 5.3));

		// Puddle distortion. This does more than add wobble: the reflected top
		// bars arrive as clean horizontal lines, and a vertical displacement
		// that varies along x is what breaks them into the wavy, interrupted
		// banding a wet slab actually gives. Without it the floor reads as a
		// striped mirror.
		vec2 warp = vec2(m2 - 0.5, m - 0.5) * (0.007 + 0.020 * near01);

		// A wet floor smears reflections vertically. Blur in world terms is
		// constant, which in screen terms means wide up close and tight far off.
		float rv = mix(uBlurFar, uBlurNear, near01) * (0.7 + 0.6 * m);
		float rh = rv * 0.18;

		vec3 acc = vec3(0.0);
		float wsum = 0.0;
		for (int i = -4; i <= 4; i++) {
			float fi = float(i);
			float wt = exp(-0.5 * fi * fi / 4.4);
			acc += texture2D(uRefl, uv + warp + vec2(fi * rh, fi * rv)).rgb * wt;
			wsum += wt;
		}
		acc /= wsum;

		// Grazing angles reflect harder.
		vec3 v = normalize(cameraPosition - vWorldPos);
		float fres = mix(1.0, 0.45, abs(v.y));

		float mott = 0.08 + 0.92 * smoothstep(0.08, 0.78, m);
		vec3 col = acc * uStrength * mott * fres;

		// Light spilling directly onto the concrete. The reference floor is far
		// brighter than its reflections alone would make it — the tubes wash the
		// whole slab, and the mottling shows up in that wash as much as in the
		// reflection.
		float u = clamp(d / uRampDepth, 0.0, 1.0);
		col += mix(uSpillNear, uSpillFar, u) * (0.35 + 0.65 * m);
		col += uFloorTint * (0.5 + 0.8 * m);

		float fd = uFogDensity * d;
		col = mix(col, uFogColor, 1.0 - exp(-fd * fd));

		gl_FragColor = vec4(col, 1.0);
	}
`;

/**
 * Wet reflective floor.
 *
 * The reflection is a real mirrored-camera pass into a render target, sampled
 * back projectively on the floor plane and blurred there — cheaper and far
 * more controllable than screen-space reflections at this scale, and the
 * half-float target means reflected neon stays above 1.0 and blooms too.
 */
export const ReflectiveFloor: React.FC<{palette: Palette}> = ({palette}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const travel = loopT(frame, durationInFrames) * SPACING;

	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);
	const size = useThree((s) => s.size);
	const dpr = useThree((s) => s.viewport.dpr);

	const meshRef = useRef<Mesh>(null);

	const rtWidth = Math.max(2, Math.round(size.width * dpr * REFLECTION_SCALE));
	const rtHeight = Math.max(2, Math.round(size.height * dpr * REFLECTION_SCALE));

	const target = useMemo(() => {
		const rt = new WebGLRenderTarget(rtWidth, rtHeight, {
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			type: HalfFloatType,
			depthBuffer: true,
		});
		rt.texture.colorSpace = LinearSRGBColorSpace;
		rt.texture.generateMipmaps = false;
		return rt;
	}, [rtWidth, rtHeight]);

	useEffect(() => () => target.dispose(), [target]);

	const mirrorCam = useMemo(() => {
		const c = new PerspectiveCamera();
		c.matrixAutoUpdate = false;
		c.matrixWorldAutoUpdate = false;
		return c;
	}, []);

	const uniforms = useMemo(
		() => ({
			uRefl: {value: target.texture},
			uTextureMatrix: {value: new Matrix4()},
			uTravel: {value: 0},
			uSpacing: {value: SPACING},
			uCamZ: {value: 0},
			uStrength: {value: REFLECTION_STRENGTH},
			uBlurNear: {value: 0.016},
			uBlurFar: {value: 0.0045},
			uFogDensity: {value: FOG_DENSITY},
			uFogColor: {value: new Color(palette.background)},
			uFloorTint: {value: new Color(palette.floorTint)},
			uSpillNear: {value: new Color()},
			uSpillFar: {value: new Color()},
			uRampDepth: {value: RAMP_DEPTH},
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	uniforms.uRefl.value = target.texture;
	uniforms.uTravel.value = travel;
	uniforms.uFogColor.value.set(palette.background);
	uniforms.uFloorTint.value.set(palette.floorTint);
	uniforms.uSpillNear.value.copy(neonColorAt(14, palette, SPILL_GAIN));
	uniforms.uSpillFar.value.copy(neonColorAt(RAMP_DEPTH, palette, SPILL_GAIN));

	const clearColor = useMemo(() => new Color(), []);

	// Priority -1 runs before every other subscriber and before the render, and
	// (unlike a positive priority) does not take over the render loop — so this
	// slots in ahead of the EffectComposer without disturbing it.
	//
	// This callback reads nothing from the r3f clock: it is a pure function of
	// the camera's current transform, which itself comes from useCurrentFrame().
	useFrame(() => {
		const mesh = meshRef.current;
		if (!mesh) return;

		// Reflect the camera through the floor plane y = 0.
		mirrorCam.matrixWorld.multiplyMatrices(MIRROR, camera.matrixWorld);
		mirrorCam.matrixWorldInverse.copy(mirrorCam.matrixWorld).invert();
		mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
		mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);

		// bias * projection * view, for the projective lookup in the shader.
		const tm = uniforms.uTextureMatrix.value;
		tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
		tm.multiply(mirrorCam.projectionMatrix);
		tm.multiply(mirrorCam.matrixWorldInverse);

		uniforms.uCamZ.value = camera.position.z;

		// Hide the floor for the pass — otherwise it samples last frame's texture.
		mesh.visible = false;

		const prevTarget = gl.getRenderTarget();
		gl.getClearColor(clearColor);
		const prevAlpha = gl.getClearAlpha();

		gl.setRenderTarget(target);
		gl.setClearColor(palette.background, 1);
		// The composer forces autoClear off, so clear explicitly.
		gl.clear(true, true, true);
		gl.render(scene, mirrorCam);

		gl.setRenderTarget(prevTarget);
		gl.setClearColor(clearColor, prevAlpha);
		mesh.visible = true;
	}, -1);

	return (
		<mesh
			ref={meshRef}
			rotation={[-Math.PI / 2, 0, 0]}
			position={[0, 0, Z_SLOT0 - CORRIDOR_DEPTH / 2]}
		>
			<planeGeometry args={[HALF_WIDTH * 2 + 0.2, CORRIDOR_DEPTH + 10]} />
			<shaderMaterial
				uniforms={uniforms}
				vertexShader={vertexShader}
				fragmentShader={fragmentShader}
				toneMapped={false}
			/>
		</mesh>
	);
};

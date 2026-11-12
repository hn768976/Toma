import * as THREE from 'three';
import type {Rng} from '../engine/random';

export type StrandSpec = {
	p0: THREE.Vector3;
	p1: THREE.Vector3;
	p2: THREE.Vector3;
	p3: THREE.Vector3;
	delay: number; // frame the growth starts
	duration: number; // frames to grow root→tip
	width: number; // half width in world units
	bright: number;
	seed: number;
	stub?: boolean;
};

export const bezier = (s: StrandSpec, u: number, out = new THREE.Vector3()) => {
	const iu = 1 - u;
	const a = iu * iu * iu;
	const b = 3 * iu * iu * u;
	const c = 3 * iu * u * u;
	const d = u * u * u;
	return out.set(
		a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x,
		a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y,
		a * s.p0.z + b * s.p1.z + c * s.p2.z + d * s.p3.z,
	);
};

export const bezierTangent = (
	s: StrandSpec,
	u: number,
	out = new THREE.Vector3(),
) => {
	const iu = 1 - u;
	const a = -3 * iu * iu;
	const b = 3 * iu * iu - 6 * iu * u;
	const c = 6 * iu * u - 3 * u * u;
	const d = 3 * u * u;
	return out
		.set(
			a * s.p0.x + b * s.p1.x + c * s.p2.x + d * s.p3.x,
			a * s.p0.y + b * s.p1.y + c * s.p2.y + d * s.p3.y,
			a * s.p0.z + b * s.p1.z + c * s.p2.z + d * s.p3.z,
		)
		.normalize();
};

/** Growth head (0..1) — must match the GLSL in the strand / cable shaders. */
export const growth = (t: number, delay: number, duration: number) => {
	const x = Math.min(1, Math.max(0, (t - delay) / duration));
	return 1 - Math.pow(1 - x, 3);
};

export const GROWTH_GLSL = /* glsl */ `
	float growth(float t, float delay, float duration){
		float x = clamp((t - delay) / duration, 0.0, 1.0);
		return 1.0 - pow(1.0 - x, 3.0);
	}
`;

/**
 * Glowing fibre ribbons. Each strand is a camera-facing ribbon expanded in the
 * vertex shader; its width/softness widens with a physically motivated circle
 * of confusion to fake depth of field, and it grows root→tip over time.
 */
export const buildStrandMesh = (
	specs: StrandSpec[],
	segments: number,
	colors: {edge: string; core: string; head: string},
) => {
	const vertsPerStrand = (segments + 1) * 2;
	const n = specs.length * vertsPerStrand;
	const pos = new Float32Array(n * 3);
	const tan = new Float32Array(n * 3);
	const side = new Float32Array(n);
	const uu = new Float32Array(n);
	const grow = new Float32Array(n * 4);
	const look = new Float32Array(n * 2);
	const idx: number[] = [];
	const p = new THREE.Vector3();
	const tg = new THREE.Vector3();
	let v = 0;
	specs.forEach((s, si) => {
		for (let i = 0; i <= segments; i++) {
			const u = i / segments;
			bezier(s, u, p);
			bezierTangent(s, u, tg);
			for (let k = 0; k < 2; k++) {
				pos.set([p.x, p.y, p.z], v * 3);
				tan.set([tg.x, tg.y, tg.z], v * 3);
				side[v] = k === 0 ? -1 : 1;
				uu[v] = u;
				grow.set([s.delay, s.duration, s.width, s.bright], v * 4);
				look.set([s.seed, s.stub ? 1 : 0], v * 2);
				v++;
			}
			if (i < segments) {
				const base = si * vertsPerStrand + i * 2;
				idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
			}
		}
	});
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('aTangent', new THREE.BufferAttribute(tan, 3));
	geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
	geo.setAttribute('aU', new THREE.BufferAttribute(uu, 1));
	geo.setAttribute('aGrow', new THREE.BufferAttribute(grow, 4));
	geo.setAttribute('aLook', new THREE.BufferAttribute(look, 2));
	geo.setIndex(idx);

	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: {value: 0},
			uFocus: {value: 30},
			uAperture: {value: 0.06},
			uFogDensity: {value: 0.012},
			uIntensity: {value: 1},
			uStubAmt: {value: 1},
			uOpacityMix: {value: 0.8},
			uEdge: {value: new THREE.Color(colors.edge)},
			uCore: {value: new THREE.Color(colors.core)},
			uHead: {value: new THREE.Color(colors.head)},
		},
		vertexShader: /* glsl */ `
			attribute vec3 aTangent; attribute float aSide; attribute float aU;
			attribute vec4 aGrow; attribute vec2 aLook;
			uniform float uTime, uFocus, uAperture, uStubAmt;
			varying float vSide, vU, vBlur, vHead, vBright, vSeed, vDepth;
			${GROWTH_GLSL}
			void main(){
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				vec3 tv = normalize((modelViewMatrix * vec4(aTangent, 0.0)).xyz);
				vec3 viewDir = normalize(-mv.xyz);
				vec3 c = cross(tv, viewDir);
				float l = length(c);
				vec3 nrm = l > 1e-4 ? c / l : vec3(1.0, 0.0, 0.0);
				float depth = max(-mv.z, 0.05);
				float coc = min(uAperture * abs(depth - uFocus) / uFocus, 0.18);
				float w = aGrow.z;
				// keep ribbons at least ~0.6px wide so distant fibres do not shimmer
				float minW = depth * 0.0006;
				float halfW = max(w, minW) + coc;
				mv.xyz += nrm * aSide * halfW;
				vBlur = halfW / max(w, minW);
				vSide = aSide; vU = aU; vBright = aGrow.w * mix(1.0, uStubAmt, aLook.y); vSeed = aLook.x; vDepth = depth;
				vHead = growth(uTime, aGrow.x, aGrow.y);
				// fade fibres that pass right by the lens
				vBright *= smoothstep(1.2, 4.5, depth);
				// fibres that point straight at the lens collapse; fade them a little
				vBright *= mix(0.35, 1.0, smoothstep(0.0, 0.35, l));
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform float uTime, uFogDensity, uIntensity, uOpacityMix;
			uniform vec3 uEdge, uCore, uHead;
			varying float vSide, vU, vBlur, vHead, vBright, vSeed, vDepth;
			void main(){
				if (vU > vHead) discard;
				float d = abs(vSide);
				float sharpness = mix(6.0, 2.2, clamp((vBlur - 1.0) * 0.5, 0.0, 1.0));
				float profile = exp(-d * d * sharpness);
				float core = exp(-d * d * sharpness * 5.0);
				float energy = 1.0 / vBlur;
				float rootFade = smoothstep(0.0, 0.22, vU);
				float tipFade = 1.0 - smoothstep(0.82, 1.0, vU);
				float alongGlow = mix(0.55, 1.0, smoothstep(0.1, 0.7, vU));
				// bright growth front while the fibre is extending
				float front = 0.55 * exp(-max(vHead - vU, 0.0) * 45.0) * (1.0 - step(0.999, vHead));
				// slow light pulses travelling along each fibre
				float pulse = smoothstep(0.93, 1.0, sin(vU * 9.0 - uTime * 0.18 + vSeed * 40.0));
				vec3 col = mix(uEdge, uCore, core) * (alongGlow + pulse * 0.6);
				col = mix(col, uHead * 1.6, front);
				float fog = exp(-vDepth * uFogDensity);
				float a = profile * energy * rootFade * tipFade * vBright * fog * uIntensity;
				gl_FragColor = vec4(col * a, clamp(a * uOpacityMix, 0.0, 1.0));
			}
		`,
		transparent: true,
		depthWrite: false,
		depthTest: true,
		// premultiplied 'over' with partial additivity: dense overlaps do not clip to white
		blending: THREE.CustomBlending,
		blendSrc: THREE.OneFactor,
		blendDst: THREE.OneMinusSrcAlphaFactor,
		blendSrcAlpha: THREE.OneFactor,
		blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
		side: THREE.DoubleSide,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false;
	return {mesh, material: mat};
};

/** Bright cut-fibre end points with depth-of-field bokeh. */
export const buildTipPoints = (
	points: {p: THREE.Vector3; delay: number; size: number; seed: number}[],
	color: string,
) => {
	const n = points.length;
	const pos = new Float32Array(n * 3);
	const attr = new Float32Array(n * 3);
	points.forEach((pt, i) => {
		pos.set([pt.p.x, pt.p.y, pt.p.z], i * 3);
		attr.set([pt.delay, pt.size, pt.seed], i * 3);
	});
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	geo.setAttribute('aAttr', new THREE.BufferAttribute(attr, 3));
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: {value: 0},
			uFocus: {value: 30},
			uAperture: {value: 0.06},
			uProj: {value: 1000},
			uColor: {value: new THREE.Color(color)},
			uIntensity: {value: 1},
		},
		vertexShader: /* glsl */ `
			attribute vec3 aAttr;
			uniform float uTime, uFocus, uAperture, uProj;
			varying float vAlpha, vSoft;
			void main(){
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				float depth = max(-mv.z, 0.05);
				float coc = uAperture * abs(depth - uFocus) / uFocus;
				float sizeW = aAttr.y + coc;
				float px = sizeW * uProj / depth;
				gl_PointSize = clamp(px, 1.5, 120.0);
				float appear = smoothstep(aAttr.x, aAttr.x + 12.0, uTime);
				float twinkle = 0.75 + 0.25 * sin(uTime * 0.21 + aAttr.z * 31.0);
				vAlpha = appear * twinkle * min(1.0, (aAttr.y / sizeW) * (aAttr.y / sizeW) * 4.0 + 0.08);
				vSoft = clamp(coc / sizeW, 0.0, 1.0);
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 uColor; uniform float uIntensity;
			varying float vAlpha, vSoft;
			void main(){
				vec2 c = gl_PointCoord - 0.5;
				float r = length(c) * 2.0;
				float disc = mix(exp(-r * r * 6.0), smoothstep(1.0, 0.8, r) * (0.7 + 0.3 * r), vSoft);
				if (r > 1.0) discard;
				gl_FragColor = vec4(uColor * disc * vAlpha * uIntensity, 1.0);
			}
		`,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const pts = new THREE.Points(geo, mat);
	pts.frustumCulled = false;
	return {points: pts, material: mat};
};

export type {Rng};

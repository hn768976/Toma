import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {SceneFactory} from '../engine/GLStage';
import {createPostChain, createRenderer} from '../engine/post';
import {createRng, smoothstep} from '../engine/random';
import {sampleScalar, sampleTrack, type Key} from '../engine/track';
import {
	createConnectorMaterials,
	makeConnector,
	type ConnectorKind,
} from './connectors';
import type {FiberPalette} from './palette';
import {
	bezier,
	bezierTangent,
	buildStrandMesh,
	buildTipPoints,
	growth,
	GROWTH_GLSL,
	type StrandSpec,
} from './strands';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- camera ----
const ASPECT = 16 / 9;
/** Returns a look-at target so that world point `p` lands on screen at NDC (nx, ny). */
const aimAt = (cam: THREE.Vector3, p: THREE.Vector3, nx: number, ny: number, fov: number) => {
	const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
	const tanH = tanV * ASPECT;
	const m = new THREE.Matrix4().lookAt(cam, p, new THREE.Vector3(0, 1, 0));
	const r0 = new THREE.Quaternion().setFromRotationMatrix(m);
	const local = new THREE.Vector3(nx * tanH, ny * tanV, -1).normalize();
	const rl = new THREE.Quaternion().setFromUnitVectors(local, new THREE.Vector3(0, 0, -1));
	const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(r0.multiply(rl));
	return cam.clone().addScaledVector(fwd, 20);
};
const SOURCE = new THREE.Vector3(0, 0, 0);
const FINAL_A = new THREE.Vector3(36, 8, 11);
const FINAL_B = new THREE.Vector3(34.8, 8.1, 10.7);

// Phase A (0-150): slow drift beside the fibre bundle, fibres sweep bottom-left → top-right.
// Phase B (150-212): push into the bundle as connectors rise, then whip round.
// Phase C (212-300): low angle looking back down the bundle towards its source.
const CAM_POS: Key[] = [
	{t: 0, v: V(8.5, 2.2, 37)},
	{t: 150, v: V(13.5, 4.2, 30.5)},
	{t: 186, v: V(24, 7.5, 21)},
	{t: 214, v: FINAL_A, hold: true},
	{t: 300, v: FINAL_B},
];
const CAM_TARGET: Key[] = [
	{t: 0, v: V(17, 7.5, 0)},
	{t: 150, v: V(19.5, 9.2, 0)},
	{t: 186, v: V(17, 11, -4)},
	{t: 214, v: aimAt(FINAL_A, SOURCE, -0.78, -0.42, 50), hold: true},
	{t: 300, v: aimAt(FINAL_B, SOURCE, -0.8, -0.45, 49)},
];
const CAM_FOV = [
	{t: 0, v: 36},
	{t: 150, v: 36},
	{t: 214, v: 50, hold: true},
	{t: 300, v: 49},
];
const CAM_ROLL = [
	{t: 0, v: 0},
	{t: 150, v: 0.02},
	{t: 190, v: -0.08},
	{t: 214, v: 0.05, hold: true},
	{t: 300, v: 0.045},
];

const poseAt = (t: number) => {
	const pos = sampleTrack(CAM_POS, t);
	const target = sampleTrack(CAM_TARGET, t);
	const fov = sampleScalar(CAM_FOV, t);
	const roll = sampleScalar(CAM_ROLL, t);
	return {pos, target, fov, roll};
};

/** Motion-blur sample count, driven by how fast the image is moving. */
export const fiberMotionBlur = (frame: number) => {
	const a = poseAt(frame - 0.5);
	const b = poseAt(frame + 0.5);
	const speed = a.pos.distanceTo(b.pos) + a.target.distanceTo(b.target) * 0.6;
	if (frame > 150 && frame < 216) return Math.min(7, Math.max(3, Math.round(speed * 4)));
	return 1;
};

// ------------------------------------------------------------ background ----
const makeBackground = (pal: FiberPalette) => {
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTop: {value: new THREE.Color(pal.bgTop)},
			uMid: {value: new THREE.Color(pal.bgMid)},
			uBottom: {value: new THREE.Color(pal.bgBottom)},
			uGlow: {value: new THREE.Color(pal.bgGlow)},
			uGlowPos: {value: new THREE.Vector2(0, 0.3)},
			uGlowAmt: {value: 0.8},
			uLightPos: {value: new THREE.Vector2(0.45, 0.6)},
		},
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
		`,
		fragmentShader: /* glsl */ `
			uniform vec3 uTop, uMid, uBottom, uGlow; uniform vec2 uGlowPos, uLightPos; uniform float uGlowAmt;
			varying vec2 vUv;
			float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
			void main(){
				vec2 a = vec2(16.0/9.0, 1.0);
				float lightD = length((vUv - uLightPos) * a);
				vec3 col = mix(uBottom, uMid, smoothstep(1.25, 0.05, lightD));
				col = mix(col, uTop, smoothstep(0.55, 1.0, vUv.y) * 0.55);
				float g = length((vUv - uGlowPos) * a);
				col += uGlow * exp(-g * g * 5.0) * uGlowAmt;
				col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
				gl_FragColor = vec4(col, 1.0);
			}
		`,
		depthTest: false,
		depthWrite: false,
	});
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
	mesh.frustumCulled = false;
	mesh.renderOrder = -10;
	return {mesh, mat};
};

// ------------------------------------------------------------ environment ---
const makeEnvironment = (renderer: THREE.WebGLRenderer, pal: FiberPalette) => {
	const env = new THREE.Scene();
	const sky = new THREE.Mesh(
		new THREE.SphereGeometry(50, 32, 16),
		new THREE.ShaderMaterial({
			side: THREE.BackSide,
			uniforms: {
				uSky: {value: new THREE.Color(pal.envSky)},
				uHorizon: {value: new THREE.Color(pal.envHorizon)},
			},
			vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
			fragmentShader: `uniform vec3 uSky,uHorizon; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = mix(uHorizon*0.3, uHorizon, smoothstep(-0.6,0.0,h)); c = mix(c, uSky, smoothstep(0.0,0.9,h)); gl_FragColor = vec4(c,1.0);} `,
		}),
	);
	env.add(sky);
	const box = (color: string, intensity: number, pos: THREE.Vector3, size: [number, number]) => {
		const m = new THREE.Mesh(
			new THREE.PlaneGeometry(size[0], size[1]),
			new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide}),
		);
		m.position.copy(pos);
		m.lookAt(0, 0, 0);
		env.add(m);
	};
	box(pal.envSoftbox, 6, V(-10, 30, 10), [30, 8]);
	box(pal.envRim, 5, V(-40, 4, -6), [10, 30]);
	box(pal.envSoftbox, 2.5, V(30, 12, 25), [14, 6]);
	box(pal.envRim, 3, V(10, -20, -30), [30, 6]);
	const pmrem = new THREE.PMREMGenerator(renderer);
	const tex = pmrem.fromScene(env, 0.035).texture;
	pmrem.dispose();
	return tex;
};

// ------------------------------------------------------------- tube curve ---
class BezierCurve extends THREE.Curve<THREE.Vector3> {
	constructor(private spec: StrandSpec) {
		super();
	}
	getPoint(u: number, out = new THREE.Vector3()) {
		return bezier(this.spec, u, out);
	}
}

const makeCableMaterial = () => {
	const mat = new THREE.MeshPhysicalMaterial({
		color: '#07090e',
		roughness: 0.22,
		metalness: 0,
		clearcoat: 1,
		clearcoatRoughness: 0.12,
		envMapIntensity: 1.6,
		side: THREE.DoubleSide,
	});
	const uniforms = {uTime: {value: 0}};
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uniforms.uTime;
		shader.vertexShader = shader.vertexShader
			.replace(
				'#include <common>',
				`#include <common>\nattribute vec2 aGrow; uniform float uTime; varying float vU; varying float vHead;\n${GROWTH_GLSL}`,
			)
			.replace(
				'#include <begin_vertex>',
				`#include <begin_vertex>\nvU = uv.x; vHead = growth(uTime, aGrow.x, aGrow.y);`,
			);
		shader.fragmentShader = shader.fragmentShader
			.replace('#include <common>', `#include <common>\nvarying float vU; varying float vHead;`)
			.replace('void main() {', `void main() {\n if (vU > vHead || vHead <= 0.0) discard;`);
	};
	mat.customProgramCacheKey = () => 'cable-grow';
	return {mat, uniforms};
};

// ------------------------------------------------------------------ scene ---
export type DebugLayers = {strands?: boolean; cables?: boolean; bloom?: boolean; msaa?: number; smaa?: boolean};

export const createFiberScene =
	(pal: FiberPalette, seed = 7, debug: DebugLayers = {}): SceneFactory =>
	({canvas, width, height}) => {
		const rng = createRng(seed);
		const renderer = createRenderer(canvas, width, height);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 400);

		scene.environment = makeEnvironment(renderer, pal);
		scene.fog = new THREE.FogExp2(new THREE.Color(pal.bgMid).multiplyScalar(0.8), 0.014);
		const bg = makeBackground(pal);
		scene.add(bg.mesh);

		scene.add(new THREE.AmbientLight(new THREE.Color(pal.bgMid), 0.6));
		const key = new THREE.DirectionalLight(pal.keyLight, 1.6);
		key.position.set(-6, 20, 14);
		scene.add(key);
		const rim = new THREE.DirectionalLight(pal.rimLight, 1.4);
		rim.position.set(-20, -2, -8);
		scene.add(rim);
		const srcLight = new THREE.PointLight(pal.rimLight, 0, 0, 2);
		srcLight.position.set(4, 2, 0);
		scene.add(srcLight);

		// ---------------- glowing fibres
		const specs: StrandSpec[] = [];
		for (let i = 0; i < 100; i++) {
			const p0 = V(rng.range(-3, 2), rng.range(-1.2, 1.0), rng.range(-3.5, 3.5));
			const L = rng.range(30, 64);
			const th = Math.pow(rng.next(), 1.1) * 0.95 + 0.03;
			const dz = rng.range(-1, 1) * L * 0.1;
			specs.push({
				p0,
				p1: p0.clone().add(V(0.38 * L, 0.02 * L, dz * 0.25)),
				p2: p0.clone().add(V(0.7 * L * Math.cos(th * 0.8), 0.5 * L * Math.sin(th), dz * 0.65)),
				p3: p0.clone().add(V(L * Math.cos(th), L * Math.sin(th), dz)),
				delay: 14 + rng.next() * 70 + th * 14,
				duration: rng.range(30, 58),
				width: rng.range(0.08, 0.17),
				bright: rng.range(0.6, 1.5),
				seed: rng.next(),
			});
		}
		// short stubs crowding the bundle source, with bright cut ends
		const tips: {p: THREE.Vector3; delay: number; size: number; seed: number}[] = [];
		for (let i = 0; i < 220; i++) {
			const p0 = V(rng.range(-7, 3), rng.range(-2.4, 0.6), rng.range(-5, 5));
			const L = rng.range(2.5, 11);
			const th = rng.range(-0.05, 0.4);
			const dz = rng.range(-1, 1) * L * 0.3;
			const s: StrandSpec = {
				p0,
				p1: p0.clone().add(V(0.35 * L, 0, dz * 0.3)),
				p2: p0.clone().add(V(0.7 * L, 0.4 * L * Math.sin(th), dz * 0.7)),
				p3: p0.clone().add(V(L * Math.cos(th), L * Math.sin(th), dz)),
				delay: 22 + rng.next() * 60,
				duration: rng.range(18, 36),
				width: rng.range(0.03, 0.06),
				bright: rng.range(0.25, 0.6),
				seed: rng.next(),
				stub: true,
			};
			specs.push(s);
			if (rng.next() < 0.6)
				tips.push({p: s.p3.clone(), delay: s.delay + s.duration * 0.7, size: rng.range(0.05, 0.11), seed: rng.next()});
		}
		const strands = buildStrandMesh(specs, 72, {
			edge: pal.strandEdge,
			core: pal.strandCore,
			head: pal.strandHead,
		});
		scene.add(strands.mesh);
		const tipPts = buildTipPoints(tips, pal.tip);
		scene.add(tipPts.points);

		// ---------------- black cables & connectors
		// Hero connectors are staged in the final camera's space so the closing
		// low-angle shot reproduces the reference layout exactly.
		const fp = poseAt(300);
		const fcam = new THREE.PerspectiveCamera(fp.fov, width / height, 0.05, 400);
		fcam.position.copy(fp.pos);
		fcam.up.set(Math.sin(fp.roll), Math.cos(fp.roll), 0);
		fcam.lookAt(fp.target);
		fcam.updateMatrixWorld();
		const camQ = fcam.quaternion.clone();
		const tanV = Math.tan(THREE.MathUtils.degToRad(fp.fov / 2));
		const tanH = tanV * (width / height);
		const camNdc = (sx: number, sy: number, depth: number) =>
			V(sx * tanH * depth, sy * tanV * depth, -depth).applyMatrix4(fcam.matrixWorld);
		const camLocalPoint = (x: number, y: number, z: number) =>
			V(x, y, z).applyMatrix4(fcam.matrixWorld);
		const camDir = (x: number, y: number, z: number) => V(x, y, z).normalize().applyQuaternion(camQ);

		const cableGeos: THREE.BufferGeometry[] = [];
		const addCable = (spec: StrandSpec, radius: number) => {
			const tube = new THREE.TubeGeometry(new BezierCurve(spec), 110, radius, 14, false);
			const n = tube.attributes.position.count;
			const grow = new Float32Array(n * 2);
			for (let i = 0; i < n; i++) grow.set([spec.delay, spec.duration], i * 2);
			tube.setAttribute('aGrow', new THREE.BufferAttribute(grow, 2));
			cableGeos.push(tube);
		};

		type Hero = {spec: StrandSpec; obj: THREE.Object3D; up: THREE.Vector3; plugLen: number};
		const heroes: Hero[] = [];
		const caps: {spec: StrandSpec; mesh: THREE.Mesh}[] = [];
		const cm = createConnectorMaterials(pal.boot, pal.glowPort);
		const capGeo = new THREE.SphereGeometry(1, 16, 12);

		type HeroDef = {kind: ConnectorKind; sx: number; sy: number; d: number; dir: [number, number, number]; scale: number; delay: number; twist: number};
		const heroDefs: HeroDef[] = [
			{kind: 'rj45Clear', sx: 0.02, sy: -0.04, d: 6.0, dir: [0.25, -0.12, 1], scale: 2.3, delay: 144, twist: 0.1},
			{kind: 'usbc', sx: 0.6, sy: 0.08, d: 7.5, dir: [1, 0.12, 0.35], scale: 1.4, delay: 147, twist: 0.0},
			{kind: 'usbc', sx: 0.72, sy: 0.58, d: 8, dir: [0.75, 0.6, 0.4], scale: 1.4, delay: 146, twist: 0.3},
			{kind: 'rj45Blue', sx: 0.82, sy: -0.3, d: 8, dir: [0.9, 0.05, 0.6], scale: 1.4, delay: 149, twist: 0.0},
			{kind: 'usbc', sx: 0.32, sy: 0.92, d: 6.2, dir: [0.45, 1, 0.35], scale: 1.3, delay: 143, twist: 0.4},
			{kind: 'usbcGlow', sx: -0.88, sy: -0.64, d: 9, dir: [-0.15, -0.25, 1], scale: 1.1, delay: 150, twist: 1.2},
			{kind: 'usbcGlow', sx: -0.6, sy: 0.3, d: 16, dir: [-0.1, 0.2, 1], scale: 1.0, delay: 140, twist: 0.4},
			{kind: 'usbcGlow', sx: -0.8, sy: -0.06, d: 18, dir: [0, 0, 1], scale: 1.0, delay: 137, twist: 1.0},
			{kind: 'usbcGlow', sx: -0.38, sy: -0.42, d: 20, dir: [0.1, -0.1, 1], scale: 1.0, delay: 138, twist: 0.3},
			{kind: 'usba', sx: -0.15, sy: 0.56, d: 13, dir: [0.2, 0.6, 0.8], scale: 1.0, delay: 142, twist: 0.2},
			{kind: 'usbc', sx: 0.12, sy: -0.8, d: 10, dir: [0.4, -0.6, 0.7], scale: 1.0, delay: 150, twist: 0.6},
			{kind: 'rj45Clear', sx: -0.46, sy: -0.15, d: 24, dir: [0, 0, 1], scale: 1.0, delay: 136, twist: 0.0},
			{kind: 'usbcGlow', sx: -0.25, sy: 0.14, d: 28, dir: [0, 0, 1], scale: 1.0, delay: 135, twist: 0.2},
		];

		for (const h of heroDefs) {
			const tip = camNdc(h.sx, h.sy, h.d);
			const dir = camDir(...h.dir);
			const plugLen = 2.35 * h.scale;
			const end = tip.clone().addScaledVector(dir, -plugLen);
			const fromAbove = h.sy > 0.3 && h.sx > 0;
			const p0 = fromAbove
				? tip.clone().add(camDir(-0.35, 1, -0.9).multiplyScalar(28))
				: V(rng.range(-2, 2), rng.range(-1, 1), rng.range(-3, 3));
			const len = end.distanceTo(p0);
			const spec: StrandSpec = {
				p0,
				p1: p0.clone().lerp(end, 0.33),
				p2: end.clone().addScaledVector(dir, -Math.min(len * 0.18, 4.5)),
				p3: end,
				delay: h.delay,
				duration: 212 - h.delay + rng.range(-3, 2),
				width: 0,
				bright: 0,
				seed: rng.next(),
			};
			addCable(spec, 0.16 * h.scale);
			const obj = makeConnector(h.kind, cm);
			obj.scale.setScalar(h.scale);
			scene.add(obj);
			const up = camDir(Math.sin(h.twist), Math.cos(h.twist), 0);
			heroes.push({spec, obj, up, plugLen});
		}
		// background cables that sweep past / above the final camera
		for (let i = 0; i < 40; i++) {
			const upperLeft = rng.next() < 0.6;
			const phi = THREE.MathUtils.degToRad(upperLeft ? rng.range(96, 150) : rng.range(28, 72));
			const r = rng.range(4.5, 10);
			const end = camLocalPoint(r * Math.cos(phi), r * Math.sin(phi), rng.range(-3, 8));
			const p0 = V(rng.range(-3, 3), rng.range(-1.5, 1.5), rng.range(-5, 5));
			const spec: StrandSpec = {
				p0,
				p1: p0.clone().lerp(end, 0.33),
				p2: p0.clone().lerp(end, 0.66),
				p3: end,
				delay: rng.range(133, 158),
				duration: rng.range(30, 42),
				width: 0,
				bright: 0,
				seed: rng.next(),
			};
			const radius = rng.range(0.09, 0.17);
			addCable(spec, radius);
			const cap = new THREE.Mesh(capGeo, cm.blackPlastic);
			cap.scale.setScalar(radius);
			scene.add(cap);
			caps.push({spec, mesh: cap});
		}
		const cable = makeCableMaterial();
		const cableMesh = new THREE.Mesh(mergeGeometries(cableGeos), cable.mat);
		cableMesh.frustumCulled = false;
		scene.add(cableMesh);

		const post = createPostChain(renderer, scene, camera, width, height, {
			strength: 0.5,
			radius: 0.4,
			threshold: 0.25,
		}, {msaa: debug.msaa ?? 0, smaa: debug.smaa ?? true});
		if (debug.strands === false) {
			strands.mesh.visible = false;
			tipPts.points.visible = false;
		}
		if (debug.cables === false) cableMesh.visible = false;
		if (debug.bloom === false) post.bloom.enabled = false;
		post.grade.uniforms.uLift.value.set(...pal.lift);
		post.grade.uniforms.uGain.value.set(...pal.gain);
		post.grade.uniforms.uVignette.value = 0.5;
		post.grade.uniforms.uGrain.value = 0.018;
		post.grade.uniforms.uCA.value = 0.003;

		const tmpP = new THREE.Vector3();
		const tmpT = new THREE.Vector3();
		const projScale = height / (2 * Math.tan(THREE.MathUtils.degToRad(36 / 2)));

		const renderFrame = (t: number) => {
			const pose = poseAt(t);
			camera.fov = pose.fov;
			camera.updateProjectionMatrix();
			camera.position.copy(pose.pos);
			camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
			camera.lookAt(pose.target);
			camera.updateMatrixWorld();

			const focus = sampleScalar(
				[
					{t: 0, v: 30},
					{t: 150, v: 26},
					{t: 200, v: 9},
					{t: 214, v: 6.6},
					{t: 300, v: 6.2},
				],
				t,
			);
			const aperture = sampleScalar(
				[
					{t: 0, v: 0.05},
					{t: 150, v: 0.05},
					{t: 214, v: 0.05, hold: true},
					{t: 300, v: 0.05},
				],
				t,
			);
			const su = strands.material.uniforms;
			su.uTime.value = t;
			su.uIntensity.value = THREE.MathUtils.lerp(0.78, 0.45, smoothstep(180, 214, t));
			su.uStubAmt.value = 1 - smoothstep(170, 210, t) * 0.8;
			su.uFogDensity.value = THREE.MathUtils.lerp(0.012, 0.03, smoothstep(170, 214, t));
			su.uFocus.value = focus;
			su.uAperture.value = aperture;
			const tu = tipPts.material.uniforms;
			tu.uTime.value = t;
			tu.uFocus.value = focus;
			tu.uAperture.value = aperture;
			tu.uProj.value = (projScale * Math.tan(THREE.MathUtils.degToRad(36 / 2))) / Math.tan(THREE.MathUtils.degToRad(pose.fov / 2));
			cable.uniforms.uTime.value = t;
			cableMesh.visible = debug.cables !== false && t >= 131;

			for (const h of heroes) {
				const g = growth(t, h.spec.delay, h.spec.duration);
				h.obj.visible = g > 0.002;
				if (!h.obj.visible) continue;
				bezier(h.spec, g, tmpP);
				bezierTangent(h.spec, Math.max(g, 0.01), tmpT);
				h.obj.position.copy(tmpP).addScaledVector(tmpT, h.plugLen);
				h.obj.up.copy(h.up);
				h.obj.lookAt(tmpP.clone().addScaledVector(tmpT, h.plugLen + 1));
			}
			for (const c of caps) {
				const g = growth(t, c.spec.delay, c.spec.duration);
				c.mesh.visible = g > 0.002;
				if (c.mesh.visible) bezier(c.spec, g, c.mesh.position);
			}

			// background light: teal glow low-left early, softer light up-centre later
			const k = smoothstep(150, 214, t);
			bg.mat.uniforms.uGlowPos.value.set(THREE.MathUtils.lerp(-0.02, 0.15, k), THREE.MathUtils.lerp(0.28, 0.35, k));
			bg.mat.uniforms.uGlowAmt.value = THREE.MathUtils.lerp(0.75, 0.3, k) * (0.9 + 0.1 * Math.sin(t * 0.05));
			bg.mat.uniforms.uLightPos.value.set(THREE.MathUtils.lerp(0.42, 0.3, k), THREE.MathUtils.lerp(0.62, 0.7, k));

			post.render(t);
		};

		return {
			renderFrame,
			dispose: () => {
				renderer.dispose();
			},
		};
	};

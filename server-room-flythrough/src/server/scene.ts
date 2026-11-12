import * as THREE from 'three';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import type {SceneFactory} from '../engine/GLStage';
import {createPostChain, createRenderer} from '../engine/post';
import {cameraPose, type CameraMode} from './camera';
import type {ServerPalette} from './palette';
import {createRackMaterial, RACK_H, RACK_W} from './rackShader';

const AISLE_HALF = 1.2; // rack faces at x = ±1.2 m
const CEILING = 2.95;
const LEN = 110; // length of aisle geometry (m), camera travels ~32 m
const BAY = RACK_W * 4; // structural bay: pillar + ceiling light every 4 racks
const END_DIST = 6.2; // far end of the aisle, held at constant distance (seamless loop look)

const FloorShader = {
	name: 'GlossyFloor',
	uniforms: {
		color: {value: null as THREE.Color | null},
		tDiffuse: {value: null as THREE.Texture | null},
		textureMatrix: {value: null as THREE.Matrix4 | null},
		uTint: {value: new THREE.Color('#0a1418')},
	},
	vertexShader: /* glsl */ `
		uniform mat4 textureMatrix;
		varying vec4 vUv;
		varying vec3 vWorld;
		varying float vDepth;
		void main(){
			vUv = textureMatrix * vec4(position, 1.0);
			vec4 w = modelMatrix * vec4(position, 1.0);
			vWorld = w.xyz;
			vec4 mv = viewMatrix * w;
			vDepth = -mv.z;
			gl_Position = projectionMatrix * mv;
		}
	`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform vec3 uTint;
		varying vec4 vUv;
		varying vec3 vWorld;
		varying float vDepth;
		float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
		void main(){
			vec2 uv = vUv.xy / vUv.w;
			// streaky, slightly rough reflection: blur mostly along screen-vertical
			vec3 acc = vec3(0.0); float ws = 0.0;
			for (int i = -6; i <= 6; i++) {
				float fi = float(i);
				float w = exp(-fi * fi * 0.08);
				acc += texture2D(tDiffuse, uv + vec2(fi * 0.0005, fi * 0.009)).rgb * w;
				ws += w;
			}
			vec3 refl = acc / ws;
			vec2 tile = vWorld.xz / 0.6;
			vec2 g = abs(fract(tile) - 0.5);
			vec2 fw = fwidth(tile);
			float seam = 1.0 - clamp((0.5 - max(g.x, g.y)) / max(max(fw.x, fw.y) * 1.5, 1e-4), 0.0, 1.0);
			float tileVar = 0.9 + 0.2 * h2(floor(tile));
			vec3 col = uTint * 0.12 * tileVar + refl * 0.48 * tileVar * (1.0 - seam * 0.2);
			gl_FragColor = vec4(col, 1.0);
		}
	`,
};

const makeEnvironment = (renderer: THREE.WebGLRenderer, pal: ServerPalette) => {
	const env = new THREE.Scene();
	env.background = new THREE.Color('#020507');
	const lightMat = new THREE.MeshBasicMaterial({color: new THREE.Color(pal.ceilingLight).multiplyScalar(5)});
	for (let i = -3; i <= 3; i++) {
		const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 0.4), lightMat);
		bar.position.set(0, 3, i * 2.5);
		env.add(bar);
	}
	const cyan = new THREE.MeshBasicMaterial({color: new THREE.Color(pal.ledCyan).multiplyScalar(1.5)});
	for (const x of [-4, 4]) {
		const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 2), cyan);
		wall.position.set(x, 1, 0);
		wall.lookAt(0, 1, 0);
		env.add(wall);
	}
	const pmrem = new THREE.PMREMGenerator(renderer);
	const tex = pmrem.fromScene(env, 0.04).texture;
	pmrem.dispose();
	return tex;
};

export type ServerDebug = {bloom?: boolean; reflections?: boolean; msaa?: number; smaa?: boolean};

export const createServerScene =
	(pal: ServerPalette, mode: CameraMode, durationFrames: number, debug: ServerDebug = {}): SceneFactory =>
	({canvas, width, height}) => {
		const renderer = createRenderer(canvas, width, height);
		renderer.toneMappingExposure = 1.05;
		const scene = new THREE.Scene();
		scene.background = new THREE.Color(pal.fog);
		scene.fog = new THREE.FogExp2(new THREE.Color(pal.fog), 0.05);
		scene.environment = makeEnvironment(renderer, pal);
		const camera = new THREE.PerspectiveCamera(62, width / height, 0.03, 200);
		camera.rotation.order = 'YXZ';

		scene.add(new THREE.AmbientLight('#7fa6b8', 0.25));
		const zStart = 8;
		const zMid = zStart - LEN / 2;

		// ---------- rack faces (procedural shader planes)
		const rackMats: THREE.ShaderMaterial[] = [];
		for (const side of [-1, 1]) {
			const mat = createRackMaterial(pal, 'z', side);
			rackMats.push(mat);
			const plane = new THREE.Mesh(new THREE.PlaneGeometry(LEN, RACK_H), mat);
			plane.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
			plane.position.set(side * AISLE_HALF, RACK_H / 2, zMid);
			scene.add(plane);
		}

		const darkMetal = new THREE.MeshStandardMaterial({color: '#0b1216', metalness: 0.85, roughness: 0.35, envMapIntensity: 0.3});
		const blackMat = new THREE.MeshStandardMaterial({color: '#020304', metalness: 0.0, roughness: 0.8, envMapIntensity: 0.0});

		// space above the racks: dark bulkhead
		for (const side of [-1, 1]) {
			const top = new THREE.Mesh(new THREE.PlaneGeometry(LEN, CEILING - RACK_H), blackMat);
			top.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
			top.position.set(side * (AISLE_HALF + 0.08), RACK_H + (CEILING - RACK_H) / 2, zMid);
			scene.add(top);
		}

		// ---------- rack posts and structural pillars (instanced)
		const postGeo = new THREE.BoxGeometry(0.045, RACK_H, 0.035);
		const nPosts = Math.ceil(LEN / RACK_W) + 1;
		const posts = new THREE.InstancedMesh(postGeo, darkMetal, nPosts * 2);
		const pillarGeo = new THREE.BoxGeometry(0.14, CEILING, 0.2);
		const nPillars = Math.ceil(LEN / BAY) + 1;
		const pillars = new THREE.InstancedMesh(pillarGeo, darkMetal, nPillars * 2);
		const m4 = new THREE.Matrix4();
		let k = 0;
		for (let i = 0; i < nPosts; i++) {
			for (const side of [-1, 1]) {
				m4.makeTranslation(side * (AISLE_HALF - 0.02), RACK_H / 2, zStart - i * RACK_W);
				posts.setMatrixAt(k++, m4);
			}
		}
		k = 0;
		for (let i = 0; i < nPillars; i++) {
			for (const side of [-1, 1]) {
				m4.makeTranslation(side * (AISLE_HALF - 0.04), CEILING / 2, zStart - i * BAY);
				pillars.setMatrixAt(k++, m4);
			}
		}
		scene.add(posts, pillars);

		// cyan indicator strip along the top of each rack row
		const stripMat = new THREE.MeshBasicMaterial({color: new THREE.Color(pal.ledCyan).multiplyScalar(0.7)});
		for (const side of [-1, 1]) {
			const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, LEN), stripMat);
			strip.position.set(side * (AISLE_HALF - 0.03), RACK_H + 0.03, zMid);
			scene.add(strip);
		}

		// ---------- ceiling: dark slab, beams and bright light bars
		const ceil = new THREE.Mesh(new THREE.PlaneGeometry(AISLE_HALF * 2 + 0.4, LEN), blackMat);
		ceil.rotation.x = Math.PI / 2;
		ceil.position.set(0, CEILING, zMid);
		scene.add(ceil);
		const lightMat = new THREE.MeshBasicMaterial({color: new THREE.Color(pal.ceilingLight).multiplyScalar(1.9)});
		const nLights = nPillars * 2;
		const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.04, 0.2), lightMat, nLights);
		for (let i = 0; i < nLights; i++) {
			m4.makeTranslation(0, CEILING - 0.08, zStart - i * (BAY / 2) - BAY / 4);
			lights.setMatrixAt(i, m4);
		}
		const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(AISLE_HALF * 2, 0.12, 0.1), darkMetal, nPillars);
		for (let i = 0; i < nPillars; i++) {
			m4.makeTranslation(0, CEILING - 0.06, zStart - i * BAY);
			beams.setMatrixAt(i, m4);
		}
		scene.add(lights, beams);
		for (const side of [-1, 1]) {
			const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, LEN), darkMetal);
			rail.position.set(side * (AISLE_HALF - 0.1), CEILING - 0.05, zMid);
			scene.add(rail);
		}

		// ---------- far end: racks facing the camera across a cross-aisle
		const endGroup = new THREE.Group();
		const endMat = createRackMaterial(pal, 'x', 1);
		rackMats.push(endMat);
		const endWall = new THREE.Mesh(new THREE.PlaneGeometry(9.1, RACK_H), endMat);
		endWall.position.set(0.0, RACK_H / 2, -END_DIST);
		endGroup.add(endWall);
		const endTop = new THREE.Mesh(new THREE.PlaneGeometry(9.1, CEILING - RACK_H), blackMat);
		endTop.position.set(0, RACK_H + (CEILING - RACK_H) / 2, -END_DIST - 0.01);
		endGroup.add(endTop);
		const endStrip = new THREE.Mesh(new THREE.BoxGeometry(9.1, 0.02, 0.02), stripMat);
		endStrip.position.set(0, RACK_H + 0.03, -END_DIST + 0.02);
		endGroup.add(endStrip);
		const tubeMat = new THREE.MeshBasicMaterial({color: new THREE.Color(pal.ceilingLight).multiplyScalar(2.6)});
		for (const x of [-0.42, 0.42]) {
			const tube = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.8, 0.035), tubeMat);
			tube.position.set(x, 1.05, -END_DIST + 0.08);
			endGroup.add(tube);
		}
		for (const x of [-RACK_W * 2, -RACK_W, 0, RACK_W, RACK_W * 2].map((v) => v + RACK_W / 2)) {
			const p = new THREE.Mesh(postGeo, darkMetal);
			p.position.set(x, RACK_H / 2, -END_DIST + 0.02);
			endGroup.add(p);
		}
		scene.add(endGroup);

		// ---------- glossy floor
		const floorGeo = new THREE.PlaneGeometry(AISLE_HALF * 2 + 6, LEN);
		let floor: THREE.Mesh;
		if (debug.reflections === false) {
			floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({color: pal.floorTint, roughness: 0.3}));
		} else {
			FloorShader.uniforms.uTint.value = new THREE.Color(pal.floorTint);
			floor = new Reflector(floorGeo, {
				textureWidth: Math.round(width * 0.5),
				textureHeight: Math.round(height * 0.5),
				clipBias: 0.003,
				shader: FloorShader,
				multisample: 0,
			});
		}
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(0, 0, zMid);
		scene.add(floor);

		const post = createPostChain(renderer, scene, camera, width, height, {
			strength: 0.55,
			radius: 0.12,
			threshold: 0.85,
		}, {msaa: debug.msaa ?? 0, smaa: debug.smaa ?? true});
		if (debug.bloom === false) post.bloom.enabled = false;
		post.grade.uniforms.uLift.value.set(...pal.lift);
		post.grade.uniforms.uGain.value.set(...pal.gain);
		post.grade.uniforms.uVignette.value = 0.55;
		post.grade.uniforms.uGrain.value = 0.02;
		post.grade.uniforms.uCA.value = 0.0018;

		const renderFrame = (t: number) => {
			const pose = cameraPose(mode, t, durationFrames);
			camera.position.copy(pose.pos);
			camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
			camera.fov = pose.fov;
			camera.updateProjectionMatrix();
			camera.updateMatrixWorld();
			endGroup.position.z = pose.pos.z;
			for (const m of rackMats) {
				m.uniforms.uTime.value = t;
				m.uniforms.uCamZ.value = pose.pos.z;
				m.uniforms.uGapStart.value = pose.pos.z - END_DIST + 1.6;
			}
			post.render(t);
		};

		return {renderFrame, dispose: () => renderer.dispose()};
	};

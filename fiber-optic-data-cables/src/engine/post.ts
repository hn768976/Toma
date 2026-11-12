import * as THREE from 'three';
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/examples/jsm/postprocessing/ShaderPass.js';
import {SMAAPass} from 'three/examples/jsm/postprocessing/SMAAPass.js';

/** Final display-space grade: lift/gain, chromatic aberration, vignette, film grain. */
export const GradeShader = {
	uniforms: {
		tDiffuse: {value: null as THREE.Texture | null},
		uTime: {value: 0},
		uRes: {value: new THREE.Vector2(1920, 1080)},
		uVignette: {value: 0.45},
		uGrain: {value: 0.025},
		uCA: {value: 0.004},
		uLift: {value: new THREE.Vector3(0, 0, 0)},
		uGain: {value: new THREE.Vector3(1, 1, 1)},
	},
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
	`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA;
		uniform vec2 uRes; uniform vec3 uLift, uGain;
		varying vec2 vUv;
		float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
		void main(){
			vec2 c = vUv - 0.5;
			float r2 = dot(c,c);
			vec2 off = c * uCA * r2 * 4.0;
			vec3 col;
			col.r = texture2D(tDiffuse, vUv + off).r;
			col.g = texture2D(tDiffuse, vUv).g;
			col.b = texture2D(tDiffuse, vUv - off).b;
			col = col * uGain + uLift * (1.0 - col);
			float v = smoothstep(0.85, 0.15, length(c * vec2(1.0, 1.15)));
			col *= mix(1.0 - uVignette, 1.0, v);
			// grain sized relative to a 1080p raster so it looks the same at any scale
			vec2 gp = floor(vUv * vec2(1920.0, 1080.0));
			float n = hash(gp + fract(uTime * 0.6180339) * 917.0) - 0.5;
			col += n * uGrain;
			gl_FragColor = vec4(max(col, 0.0), 1.0);
		}
	`,
};

export type PostChain = {
	composer: EffectComposer;
	bloom: UnrealBloomPass;
	grade: ShaderPass;
	render: (t: number) => void;
};

export const createPostChain = (
	renderer: THREE.WebGLRenderer,
	scene: THREE.Scene,
	camera: THREE.Camera,
	width: number,
	height: number,
	bloom: {strength: number; radius: number; threshold: number},
	aa: {msaa: number; smaa: boolean} = {msaa: 0, smaa: true},
): PostChain => {
	const rt = new THREE.WebGLRenderTarget(width, height, {
		type: THREE.HalfFloatType,
		samples: aa.msaa,
	});
	const composer = new EffectComposer(renderer, rt);
	composer.setPixelRatio(1);
	composer.setSize(width, height);
	composer.addPass(new RenderPass(scene, camera));
	const bloomPass = new UnrealBloomPass(
		new THREE.Vector2(width, height),
		bloom.strength,
		bloom.radius,
		bloom.threshold,
	);
	composer.addPass(bloomPass);
	composer.addPass(new OutputPass());
	if (aa.smaa) composer.addPass(new SMAAPass());
	const grade = new ShaderPass(GradeShader);
	grade.uniforms.uRes.value.set(width, height);
	composer.addPass(grade);
	return {
		composer,
		bloom: bloomPass,
		grade,
		render: (t: number) => {
			grade.uniforms.uTime.value = t;
			composer.render();
		},
	};
};

export const createRenderer = (
	canvas: HTMLCanvasElement,
	width: number,
	height: number,
) => {
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		alpha: false,
		preserveDrawingBuffer: true,
		powerPreference: 'high-performance',
	});
	renderer.setPixelRatio(1);
	renderer.setSize(width, height, false);
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	return renderer;
};

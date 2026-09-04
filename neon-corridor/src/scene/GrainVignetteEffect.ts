import {BlendFunction, Effect} from 'postprocessing';
import {Uniform} from 'three';

const fragmentShader = /* glsl */ `
	uniform float uSeed;
	uniform float uGrain;
	uniform float uVignette;
	uniform float uVignetteRadius;

	float hash(vec2 p) {
		vec3 p3 = fract(vec3(p.xyx) * 0.1031);
		p3 += dot(p3, p3.yzx + 33.33);
		return fract((p3.x + p3.y) * p3.z);
	}

	void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
		vec3 c = inputColor.rgb;

		vec2 d = uv - 0.5;
		float r = length(d) * 1.4142;
		c *= 1.0 - uVignette * smoothstep(uVignetteRadius, 1.0, r);

		// Grain goes on in the display domain, which is where H.264 banding
		// lives. A flat linear-space dither would swamp the blacks and vanish
		// in the highlights; this stays even across the range.
		vec3 s = pow(max(c, 0.0), vec3(1.0 / 2.2));
		float n = hash(uv * 2048.0 + vec2(uSeed * 17.13, uSeed * 31.71));
		s += (n - 0.5) * uGrain;
		c = pow(max(s, 0.0), vec3(2.2));

		outputColor = vec4(c, inputColor.a);
	}
`;

export type GrainVignetteOptions = {
	seed?: number;
	grain?: number;
	vignette?: number;
	vignetteRadius?: number;
};

/**
 * Final-pass grain and vignette.
 *
 * The grain seed is driven from useCurrentFrame() rather than a clock, so a
 * given frame dithers identically no matter which thread renders it or in what
 * order.
 */
export class GrainVignetteEffect extends Effect {
	constructor({
		seed = 0,
		grain = 0.022,
		vignette = 0.55,
		vignetteRadius = 0.42,
	}: GrainVignetteOptions = {}) {
		super('GrainVignetteEffect', fragmentShader, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, Uniform<number>>([
				['uSeed', new Uniform(seed)],
				['uGrain', new Uniform(grain)],
				['uVignette', new Uniform(vignette)],
				['uVignetteRadius', new Uniform(vignetteRadius)],
			]),
		});
	}

	private setU(name: string, value: number) {
		const u = this.uniforms.get(name);
		if (u) u.value = value;
	}

	private getU(name: string) {
		return (this.uniforms.get(name)?.value as number) ?? 0;
	}

	get seed() {
		return this.getU('uSeed');
	}
	set seed(v: number) {
		this.setU('uSeed', v);
	}

	get grain() {
		return this.getU('uGrain');
	}
	set grain(v: number) {
		this.setU('uGrain', v);
	}

	get vignette() {
		return this.getU('uVignette');
	}
	set vignette(v: number) {
		this.setU('uVignette', v);
	}

	get vignetteRadius() {
		return this.getU('uVignetteRadius');
	}
	set vignetteRadius(v: number) {
		this.setU('uVignetteRadius', v);
	}
}

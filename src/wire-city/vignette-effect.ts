/**
 * vignette-effect.ts — a radial vignette that can DARKEN or LIGHTEN.
 *
 * Written as a real postprocessing `Effect` rather than a 2D overlay so it
 * lands inside the composer, in linear space, before the output transform.
 *
 * The colour it mixes toward comes from the variant palette, which is what
 * lets the blueprint version lighten its corners instead of darkening them —
 * a clean branch on data, not a special case in the shader.
 */

import {BlendFunction, Effect} from 'postprocessing';
import {Color, Uniform} from 'three';

const FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uOffset;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 d = uv - 0.5;
  // 1.0 exactly at the corners.
  float r = length(d) * 1.41421356;
  float f = smoothstep(uOffset, 1.0, r);
  outputColor = vec4(mix(inputColor.rgb, uColor, f * uStrength), inputColor.a);
}
`;

export type RadialVignetteOptions = {
	/** Colour the corners are pushed toward (dark for v1/v2, white for v3). */
	color: string;
	/** 0..1 mix amount at the extreme corner. */
	strength: number;
	/** Normalised radius at which the vignette starts. */
	offset: number;
};

export class RadialVignetteEffect extends Effect {
	constructor(options: RadialVignetteOptions) {
		super('RadialVignetteEffect', FRAGMENT, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, Uniform<unknown>>([
				['uColor', new Uniform(new Color(options.color))],
				['uStrength', new Uniform(options.strength)],
				['uOffset', new Uniform(options.offset)],
			]),
		});
	}

	/* Accessors so react-three-fiber's live prop application writes through to
	 * the uniforms instead of onto stray properties. */

	get color(): string {
		return `#${(this.uniforms.get('uColor')!.value as Color).getHexString()}`;
	}

	set color(value: string) {
		(this.uniforms.get('uColor')!.value as Color).set(value);
	}

	get strength(): number {
		return this.uniforms.get('uStrength')!.value as number;
	}

	set strength(value: number) {
		this.uniforms.get('uStrength')!.value = value;
	}

	get offset(): number {
		return this.uniforms.get('uOffset')!.value as number;
	}

	set offset(value: number) {
		this.uniforms.get('uOffset')!.value = value;
	}
}

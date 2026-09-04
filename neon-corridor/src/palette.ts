import {Color} from 'three';
import {RAMP_DEPTH, SPACING} from './config';

export type Palette = {
	readonly id: string;
	/** Nearest tubes. Pushed well past 1.0 so bloom clips them toward white. */
	readonly hot: string;
	/** Mid corridor. */
	readonly mid: string;
	/** Far end, before fog takes over. */
	readonly far: string;
	/** The alternate rung of the ramp — adjacent frames lean toward this. */
	readonly alt: string;
	/** Near-black field colour; also the fog colour. */
	readonly background: string;
	/** Haze at the vanishing point. */
	readonly haze: string;
	/** Faint tint of the wet floor itself, before reflections. */
	readonly floorTint: string;
	/** Walls and ceiling. */
	readonly shell: string;
};

export const MAGENTA: Palette = {
	id: 'magenta',
	hot: '#e026c0',
	mid: '#a62fe0',
	far: '#7a3ce8',
	alt: '#8c34e4',
	background: '#0a0210',
	haze: '#8f36d8',
	floorTint: '#150520',
	shell: '#1a0828',
};

export const CYAN: Palette = {
	id: 'cyan',
	hot: '#22d3ee',
	mid: '#25a8e6',
	far: '#1e6fd9',
	alt: '#2087dd',
	background: '#010c12',
	haze: '#2a8fdd',
	floorTint: '#03141d',
	shell: '#03192a',
};

const smoothstep = (x: number) => {
	const t = Math.min(1, Math.max(0, x));
	return t * t * (3 - 2 * t);
};

/** Cached linear-space Colors, keyed by hex. */
const cache = new Map<string, Color>();
const linear = (hex: string) => {
	let c = cache.get(hex);
	if (!c) {
		// ColorManagement is on, so this converts the sRGB hex to linear.
		c = new Color(hex);
		cache.set(hex, c);
	}
	return c;
};

/**
 * Brightness of a tube at a given depth.
 *
 * Deliberately above 1.0 across most of the corridor: the composer runs on
 * half-float buffers, so those values survive to the bloom pass and clip only
 * in the final 8-bit write. That clipping is where the white-pink tube cores
 * come from — sampling the reference shows its bars pegged at #ff9eff the
 * whole way down the tunnel, while the *glow* around them stays violet.
 */
export const intensityAt = (depth: number) =>
	0.4 + 3.8 / (1 + Math.pow(depth / 11, 1.5));

/**
 * Colour of a tube at a given depth.
 *
 * `depth` is the tube's distance in front of the camera, so this is a pure
 * function of camera-relative position — see the invariant in loop.ts.
 *
 * The `ripple` term has a spatial period of exactly 2 * SPACING, which is what
 * puts adjacent frames on slightly different rungs of the ramp. Because it is
 * spatial rather than per-tube, the alternation is fixed in the corridor and
 * survives the recycling untouched.
 */
export const neonColorAt = (depth: number, p: Palette, gain = 1): Color => {
	const u = smoothstep(depth / RAMP_DEPTH);

	const out = new Color();
	if (u < 0.18) {
		out.copy(linear(p.hot)).lerp(linear(p.mid), u / 0.18);
	} else {
		out.copy(linear(p.mid)).lerp(linear(p.far), (u - 0.18) / 0.82);
	}

	const ripple = 0.5 + 0.5 * Math.cos((Math.PI * depth) / SPACING);
	out.lerp(linear(p.alt), 0.16 * ripple);

	return out.multiplyScalar(intensityAt(depth) * gain);
};

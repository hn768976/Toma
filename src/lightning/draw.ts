import type {BoltStroke} from './geometry';

/** Below this a pass cannot register on an 8-bit frame, so it is skipped. */
const MIN_ALPHA = 0.015;

/** Which half of a pass to draw. The blurred halo of every pass is laid down on
 * the small companion canvas; only the crisp stroke is drawn at full size. */
export interface PassParts {
	halo: boolean;
	sharp: boolean;
}

export interface PassStyle {
	color: string;
	alpha: number;
	/** Stroke width at the origin, in 4K canvas pixels. */
	width: number;
	/** Width at the far tip as a fraction of the origin width. */
	tipWidth: number;
	/** shadowBlur in 4K canvas pixels. */
	blur: number;
}

/**
 * Strokes one channel with a width that tapers along its length: thickest at
 * the origin, thinnest at the tip. The polyline is split into bands so the taper
 * is continuous without paying for a separate path per segment.
 *
 * `scale` maps 4K coordinates onto whichever canvas is being drawn to, so the
 * same geometry can be rendered onto the smaller glow surface unchanged.
 */
export const strokeTapered = (
	ctx: CanvasRenderingContext2D,
	stroke: BoltStroke,
	style: PassStyle,
	bands: number,
	scale: number,
	parts: PassParts = {halo: true, sharp: true},
): void => {
	const {points, travel} = stroke;
	// Passes this faint are below the quantisation floor of an 8-bit frame; the
	// deepest branch generations of a dense bolt hit this and cost real time.
	if (points.length < 2 || style.alpha < MIN_ALPHA) {
		return;
	}

	const widthAt = (t: number) =>
		Math.max(0.4, style.width * (1 - t * (1 - style.tipWidth)) * scale);

	ctx.save();
	ctx.globalAlpha = Math.min(1, style.alpha);
	ctx.strokeStyle = style.color;
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	if (parts.halo && style.blur > 0) {
		// The halo is laid down once for the whole channel rather than once per
		// band: a blur this wide carries no width detail, and blurring each band
		// separately is what makes the pass expensive.
		//
		// The path is built far off the left edge and the shadow offset brings
		// only the blurred copy back into frame, so the halo is not accompanied
		// by a second, untapered copy of the stroke itself.
		const offset = ctx.canvas.width * 2;
		ctx.shadowColor = style.color;
		ctx.shadowBlur = style.blur * scale;
		ctx.shadowOffsetX = offset;
		ctx.lineWidth = widthAt(0.5);
		ctx.beginPath();
		ctx.moveTo(points[0].x * scale - offset, points[0].y * scale);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x * scale - offset, points[i].y * scale);
		}
		ctx.stroke();
		ctx.shadowColor = 'rgba(0, 0, 0, 0)';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetX = 0;
	}

	if (!parts.sharp) {
		ctx.restore();
		return;
	}

	// Narrow strokes need fewer bands to read as tapered.
	const bandCount = Math.max(2, Math.round(bands * Math.min(1, style.width / 12)));
	const perBand = Math.max(1, Math.ceil((points.length - 1) / bandCount));
	for (let start = 0; start < points.length - 1; start += perBand) {
		const end = Math.min(points.length - 1, start + perBand);
		ctx.lineWidth = widthAt((travel[start] + travel[end]) / 2);
		ctx.beginPath();
		ctx.moveTo(points[start].x * scale, points[start].y * scale);
		for (let i = start + 1; i <= end; i++) {
			ctx.lineTo(points[i].x * scale, points[i].y * scale);
		}
		ctx.stroke();
	}
	ctx.restore();
};

/** Soft round wash used for the atmospheric glow and the haze. */
export const radialWash = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
	edge: string,
	scaleX = 1,
	scaleY = 1,
): void => {
	if (radius <= 0) {
		return;
	}
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(scaleX, scaleY);
	const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, edge);
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(0, 0, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
};

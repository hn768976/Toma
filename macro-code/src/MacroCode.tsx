import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {CodePlane, type PlaneGeometry} from './CodePlane';
import {CORPORA} from './code/sources';
import {loadMonoFont} from './fonts';
import type {Palette} from './palettes';

/* ------------------------------------------------------------------ *
 * Geometry, expressed as fractions of the composition so a 1080p
 * preview and a 4K render describe exactly the same picture.
 * ------------------------------------------------------------------ */

const ROT_Y = 27; // right edge swings away: lines converge to the right
const ROT_X = 4; // bottom edge tips toward the lens

const MAIN = {
	perspective: 0.574, // of width; short enough to give a ~2.6x near/far ratio
	planeW: 2.7,
	planeH: 2.5,
	shiftX: 0.17,
	shiftY: 0.0,
	fontSize: 0.0132,
	lineHeightRatio: 1.72,
	columnPitch: 0.72,
	columns: 3,
};

const BACK = {
	perspective: 0.62,
	planeW: 2.2,
	planeH: 2.6,
	shiftX: -0.12,
	shiftY: -0.06,
	fontSize: 0.0086,
	lineHeightRatio: 1.72,
	rotateY: 36,
	rotateX: -3,
	columnPitch: 0.5,
	columns: 5,
	blur: 0.0115,
	opacity: 1,
};

const DEEP = {
	perspective: 0.7,
	planeW: 2.6,
	planeH: 3.0,
	shiftX: -0.3,
	shiftY: 0.1,
	fontSize: 0.0068,
	lineHeightRatio: 1.74,
	rotateY: 44,
	rotateX: 6,
	columnPitch: 0.32,
	columns: 8,
	blur: 0.024,
	opacity: 0.7,
};

/**
 * Depth-of-field, cut as discrete slices rather than a gradient blur: a smooth
 * ramp reads as a Photoshop filter, whereas hard bands that cross-fade into one
 * another read as optics. `to` is the right-hand edge of each band as a
 * fraction of frame width; `blur` is the radius as a fraction of frame width.
 *
 * The near (left) end of the wedge defocuses fast, the far (right) end more
 * gently, and the sharp band sits across the middle third.
 */
const SLICES = [
	{to: 0.13, blur: 0.0115},
	{to: 0.24, blur: 0.0055},
	{to: 0.32, blur: 0.0019},
	{to: 0.56, blur: 0.00022},
	{to: 0.68, blur: 0.0014},
	{to: 0.84, blur: 0.0033},
	{to: 1.0, blur: 0.006},
];

/** Half-width of the cross-fade between neighbouring slices. */
const FEATHER = 0.022;


export const MacroCode: React.FC<{palette: Palette}> = ({palette}) => {
	loadMonoFont();

	const frame = useCurrentFrame();
	const {width, height, durationInFrames} = useVideoConfig();

	// Everything periodic is driven off this single 0..1 phase.
	const phase = frame / durationInFrames;
	const tau = Math.PI * 2;

	/* The background surfaces cover far more lines of their own than the focal
	 * one does, so they get the whole listing (rotated, to break the alignment
	 * between surfaces) rather than a short excerpt that would tile visibly. */
	const corpus = CORPORA[palette.corpus];
	const backCorpus = useMemo(
		() => [...corpus.slice(11), ...corpus.slice(0, 11)],
		[corpus],
	);
	const deepCorpus = useMemo(
		() => [...corpus.slice(29), ...corpus.slice(0, 29)],
		[corpus],
	);

	/* Scroll. Each plane advances by a whole number of its own lines over the
	 * loop, and the content tiles with that same period, so frame
	 * `durationInFrames` is pixel-identical to frame 0. */
	const mainScroll = phase * corpus.length;
	const backScroll = phase * backCorpus.length;
	const deepScroll = phase * deepCorpus.length;

	const mainGeometry: PlaneGeometry = {
		planeWidth: width * MAIN.planeW,
		planeHeight: height * MAIN.planeH,
		rotateY: ROT_Y,
		rotateX: ROT_X,
		shiftX: width * MAIN.shiftX,
		shiftY: height * MAIN.shiftY,
		perspective: width * MAIN.perspective,
		fontSize: width * MAIN.fontSize,
		lineHeight: Math.round(width * MAIN.fontSize * MAIN.lineHeightRatio),
		columnPitch: width * MAIN.columnPitch,
		columns: MAIN.columns,
	};

	const backGeometry: PlaneGeometry = {
		planeWidth: width * BACK.planeW,
		planeHeight: height * BACK.planeH,
		rotateY: BACK.rotateY,
		rotateX: BACK.rotateX,
		shiftX: width * BACK.shiftX,
		shiftY: height * BACK.shiftY,
		perspective: width * BACK.perspective,
		fontSize: width * BACK.fontSize,
		lineHeight: Math.round(width * BACK.fontSize * BACK.lineHeightRatio),
		columnPitch: width * BACK.columnPitch,
		columns: BACK.columns,
	};

	const deepGeometry: PlaneGeometry = {
		planeWidth: width * DEEP.planeW,
		planeHeight: height * DEEP.planeH,
		rotateY: DEEP.rotateY,
		rotateX: DEEP.rotateX,
		shiftX: width * DEEP.shiftX,
		shiftY: height * DEEP.shiftY,
		perspective: width * DEEP.perspective,
		fontSize: width * DEEP.fontSize,
		lineHeight: Math.round(width * DEEP.fontSize * DEEP.lineHeightRatio),
		columnPitch: width * DEEP.columnPitch,
		columns: DEEP.columns,
	};

	/* Camera float: a hair under 1% of frame, on a closed loop. */
	const driftX = Math.sin(tau * phase) * width * 0.0075;
	const driftY = Math.cos(tau * phase + 1.1) * height * 0.006;
	const driftScale = 1 + Math.sin(tau * phase + 2.3) * 0.0035;

	/* The flare breathes on its own beat -- two cycles per loop, offset from
	 * everything else so nothing appears to pulse in time. */
	const flarePulse = 0.72 + 0.28 * Math.sin(tau * 2 * phase + 0.9);
	const veilPulse = 0.6 + 0.4 * Math.sin(tau * phase - 2.0);

	return (
		<AbsoluteFill style={{backgroundColor: palette.background, overflow: 'hidden'}}>
			<AbsoluteFill
				style={{
					transform: `translate(${driftX}px, ${driftY}px) scale(${driftScale})`,
				}}
			>
				{/* Deepest surface: far enough back to read only as colour blocks. */}
				<AbsoluteFill style={{filter: `blur(${width * DEEP.blur}px) brightness(1.25)`}}>
					<CodePlane
						lines={deepCorpus}
						colors={palette.token}
						geometry={deepGeometry}
						scrollLines={deepScroll}
						opacity={DEEP.opacity}
						glow={palette.glow * 0.6}
					/>
				</AbsoluteFill>

				{/* Second surface, behind and to the left at a steeper angle. */}
				<AbsoluteFill style={{filter: `blur(${width * BACK.blur}px) brightness(1.2)`}}>
					<CodePlane
						lines={backCorpus}
						colors={palette.token}
						geometry={backGeometry}
						scrollLines={backScroll}
						opacity={BACK.opacity}
						glow={palette.glow * 0.8}
					/>
				</AbsoluteFill>

				{/* The focal surface, cut into depth slices. Painted far-to-near so
				    each nearer slice simply covers the one behind it; only the right
				    edge of each needs to fade, which keeps the cross-fades at full
				    opacity instead of stacking two half-transparent copies. */}
				{SLICES.map((slice, i) => {
					const radius = width * slice.blur;
					const edge = slice.to * width;
					const fade = width * FEATHER;
					const margin = radius * 3 + fade;
					const bandWidth = edge + margin * 2;

					const maskStops =
						i === SLICES.length - 1
							? undefined
							: `linear-gradient(to right, #000 0px, #000 ${edge - fade}px, rgba(0,0,0,0) ${edge + fade}px)`;

					return (
						<AbsoluteFill
							key={slice.to}
							style={{
								zIndex: SLICES.length - i,
								...(maskStops
									? {
											WebkitMaskImage: maskStops,
											maskImage: maskStops,
										}
									: {}),
							}}
						>
							{/* Clip the blur's source to the band (plus enough margin that
							    the transparent edge never bleeds into the visible part),
							    so seven blurred copies cost barely more than one. */}
							<div
								style={{
									position: 'absolute',
									left: -margin,
									top: 0,
									width: bandWidth,
									height: '100%',
									overflow: 'hidden',
								}}
							>
								<div
									style={{
										position: 'absolute',
										left: margin,
										top: 0,
										width,
										height: '100%',
										filter: radius > 0.5 ? `blur(${radius}px)` : undefined,
									}}
								>
									<CodePlane
										lines={corpus}
										colors={palette.token}
										geometry={mainGeometry}
										scrollLines={mainScroll}
										glow={palette.glow}
										fontWeight={500}
									/>
								</div>
							</div>
						</AbsoluteFill>
					);
				})}
			</AbsoluteFill>

			{/* Soft flare bleeding across the top-right corner, plus one thin streak. */}
			<AbsoluteFill style={{mixBlendMode: 'screen', pointerEvents: 'none'}}>
				<div
					style={{
						position: 'absolute',
						right: '-12%',
						top: '-26%',
						width: '70%',
						height: '82%',
						opacity: 1.05 * flarePulse,
						background: `radial-gradient(closest-side ellipse at 50% 50%, ${palette.flare.replace(', 1)', ', 0.62)')} 0%, ${palette.flare.replace(', 1)', ', 0.26)')} 38%, ${palette.flare.replace(', 1)', ', 0.06)')} 66%, rgba(0,0,0,0) 100%)`,
						filter: `blur(${width * 0.022}px)`,
					}}
				/>
				<div
					style={{
						position: 'absolute',
						right: '2%',
						top: '10.5%',
						width: '44%',
						height: `${Math.max(2, height * 0.007)}px`,
						opacity: 0.6 * flarePulse,
						background: `linear-gradient(to right, rgba(0,0,0,0) 0%, ${palette.flareStreak.replace(', 1)', ', 0.75)')} 46%, ${palette.flareStreak.replace(', 1)', ', 0.9)')} 72%, rgba(0,0,0,0) 100%)`,
						filter: `blur(${width * 0.006}px)`,
					}}
				/>
				{/* A wide, very low veil across the lower left -- the same light
				    spilling round the other side of the element group. */}
				<div
					style={{
						position: 'absolute',
						left: '-18%',
						bottom: '-26%',
						width: '62%',
						height: '66%',
						opacity: 0.22 * veilPulse,
						background: `radial-gradient(closest-side ellipse at 50% 50%, ${palette.flare.replace(', 1)', ', 0.34)')} 0%, rgba(0,0,0,0) 100%)`,
						filter: `blur(${width * 0.03}px)`,
					}}
				/>
			</AbsoluteFill>

			{/* Global cast. */}
			<AbsoluteFill
				style={{
					backgroundColor: palette.cast,
					opacity: palette.castOpacity,
					mixBlendMode: 'color',
					pointerEvents: 'none',
				}}
			/>
			<AbsoluteFill
				style={{
					backgroundColor: palette.cast,
					opacity: palette.castOpacity * 0.45,
					mixBlendMode: 'soft-light',
					pointerEvents: 'none',
				}}
			/>

			{/* Corner falloff, heavier on the defocused near edge. */}
			<AbsoluteFill
				style={{
					background: `radial-gradient(130% 118% at 46% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.34) 100%)`,
					pointerEvents: 'none',
				}}
			/>

			<Scanlines height={height} />
			<Grain width={width} />
		</AbsoluteFill>
	);
};

const Scanlines: React.FC<{height: number}> = ({height}) => {
	const pitch = Math.max(2, Math.round(height * 0.0019));
	return (
		<AbsoluteFill
			style={{
				pointerEvents: 'none',
				opacity: 0.03,
				backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${pitch}px, rgba(0,0,0,1) ${pitch}px, rgba(0,0,0,1) ${pitch * 2}px)`,
			}}
		/>
	);
};

/**
 * Static sensor grain. A fixed tile is correct for a locked-off camera and
 * costs nothing per frame; at 2% it is far below the point where the tile
 * repeat could be seen.
 */
const GRAIN_TILE = 220;
const grainDataUri = (() => {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${GRAIN_TILE}" height="${GRAIN_TILE}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
	return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

const Grain: React.FC<{width: number}> = ({width}) => (
	<AbsoluteFill
		style={{
			pointerEvents: 'none',
			opacity: 0.02,
			mixBlendMode: 'overlay',
			backgroundImage: grainDataUri,
			backgroundSize: `${Math.round(width * 0.057)}px ${Math.round(width * 0.057)}px`,
		}}
	/>
);


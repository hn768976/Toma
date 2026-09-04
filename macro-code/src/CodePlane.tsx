import React from 'react';
import type {Line, TokenKind} from './code/tokenize';
import {MONO_FAMILY} from './fonts';

export type PlaneGeometry = {
	/** Plane size in local (un-rotated) pixels. */
	planeWidth: number;
	planeHeight: number;
	/** Degrees. */
	rotateY: number;
	rotateX: number;
	/** Local-space shift applied before the rotations, in px. */
	shiftX: number;
	shiftY: number;
	/** Distance from the camera to the plane, in px. */
	perspective: number;
	fontSize: number;
	lineHeight: number;
	/** Horizontal pitch between the surface's code columns, in local px. */
	columnPitch: number;
	/** How many columns of code the surface carries. */
	columns: number;
};

type Props = {
	lines: Line[];
	colors: Record<TokenKind, string>;
	geometry: PlaneGeometry;
	/** How far the content has scrolled, measured in whole lines (may be fractional). */
	scrollLines: number;
	opacity?: number;
	/** Text-shadow spread as a multiple of the font size. */
	glow?: number;
	fontWeight?: number;
};

/** Lines skipped between one column and the next, so no two show the same code. */
const COLUMN_STRIDE = 17;

/**
 * One flat code surface, rotated in 3D by a CSS transform. The glyphs stay real
 * DOM text all the way to the compositor, which is what keeps the in-focus band
 * looking photographic instead of like a resampled texture.
 *
 * Scrolling is an infinite tiling of `lines`: row `r` shows
 * `lines[(floor(scrollLines) + r) % lines.length]`, so `scrollLines` advancing
 * by exactly `lines.length` returns the surface to its starting state.
 */
export const CodePlane: React.FC<Props> = ({
	lines,
	colors,
	geometry,
	scrollLines,
	opacity = 1,
	glow = 0,
	fontWeight = 400,
}) => {
	const {
		planeWidth,
		planeHeight,
		rotateY,
		rotateX,
		shiftX,
		shiftY,
		perspective,
		fontSize,
		lineHeight,
		columnPitch,
		columns,
	} = geometry;

	// Two spare rows so the fractional offset never uncovers the bottom edge.
	const rows = Math.ceil(planeHeight / lineHeight) + 2;
	const wrapped = ((scrollLines % lines.length) + lines.length) % lines.length;
	const firstRow = Math.floor(wrapped);
	const fraction = wrapped - firstRow;

	const shadow =
		glow > 0
			? `0 0 ${(fontSize * glow * 0.34).toFixed(2)}px currentColor`
			: undefined;

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				perspective: `${perspective}px`,
				perspectiveOrigin: '50% 50%',
			}}
		>
			<div
				style={{
					position: 'absolute',
					left: '50%',
					top: '50%',
					width: planeWidth,
					height: planeHeight,
					marginLeft: -planeWidth / 2,
					marginTop: -planeHeight / 2,
					overflow: 'hidden',
					transformOrigin: '50% 50%',
					transform: `rotateY(${rotateY}deg) rotateX(${rotateX}deg) translate(${shiftX}px, ${shiftY}px)`,
					opacity,
					fontFamily: `'${MONO_FAMILY}', monospace`,
					fontSize,
					lineHeight: `${lineHeight}px`,
					fontWeight,
					letterSpacing: 0,
					whiteSpace: 'pre',
					textShadow: shadow,
					willChange: 'transform',
				}}
			>
				{/* Split-pane rules. The surface is one editor showing several
				    panes, and the seam between them is a real part of the look. */}
				{new Array(Math.max(0, columns - 1)).fill(0).map((_, c) => (
					<div
						// eslint-disable-next-line react/no-array-index-key
						key={`rule-${c}`}
						style={{
							position: 'absolute',
							left: (c + 1) * columnPitch - fontSize * 0.9,
							top: 0,
							width: Math.max(1, fontSize * 0.06),
							height: '100%',
							backgroundColor: colors.punct,
							opacity: 0.22,
						}}
					/>
				))}
				{new Array(columns).fill(0).map((_, c) => (
					<div
						// eslint-disable-next-line react/no-array-index-key
						key={c}
						style={{
							position: 'absolute',
							left: c * columnPitch,
							top: 0,
							transform: `translateY(${-fraction * lineHeight}px)`,
						}}
					>
						{new Array(rows).fill(0).map((_, r) => {
							const line =
								lines[(firstRow + r + c * COLUMN_STRIDE) % lines.length];
							return (
								// eslint-disable-next-line react/no-array-index-key
								<div key={r} style={{height: lineHeight}}>
									{line.map((token, t) => (
										// eslint-disable-next-line react/no-array-index-key
										<span key={t} style={{color: colors[token.kind]}}>
											{token.text}
										</span>
									))}
								</div>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
};

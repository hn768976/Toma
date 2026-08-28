import React, {useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {bufferMargin, getConfig} from './config';
import {exposureGainForBlur, focusBlurAtFrame} from './animation';
import {buildFlashSchedule, buildSpotField, buildSpotSprites} from './spots';
import {DEFAULT_VARIANT, getTheme} from './theme';
import type {VariantName} from './theme';
import {SpotGrid} from './SpotGrid';
import {FocusPass} from './FocusPass';
import {GrainPass} from './GrainPass';

export type MicroarrayProps = {
	readonly variant: VariantName;
};

/**
 * A DNA microarray under a rack focus. Every value below is a pure function of
 * the frame number: no Date.now(), no requestAnimationFrame, no state, no CSS
 * animation, so `npx remotion render` is deterministic and the loop closes.
 */
export const Microarray: React.FC<MicroarrayProps> = ({variant = DEFAULT_VARIANT}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();

	const config = useMemo(() => getConfig(variant), [variant]);
	const theme = useMemo(() => getTheme(variant), [variant]);

	// Generated once and reused for every frame. Regenerating the field per
	// frame would make the whole array boil and destroy the effect.
	const field = useMemo(() => buildSpotField(config, theme), [config, theme]);
	const sprites = useMemo(() => buildSpotSprites(config, theme), [config, theme]);
	const flashes = useMemo(() => buildFlashSchedule(config, field), [config, field]);

	const margin = useMemo(() => bufferMargin(config), [config]);
	const bufferWidth = width + margin * 2;
	const bufferHeight = height + margin * 2;

	const bufferRef = useRef<HTMLCanvasElement>(null);
	const mainRef = useRef<HTMLCanvasElement>(null);
	const bloomRef = useRef<HTMLCanvasElement>(null);

	const blurPx = focusBlurAtFrame(frame, config);
	const exposureGain = exposureGainForBlur(blurPx, config);
	// Heavily defocused frames are drawn into a half-size buffer: at this much
	// blur the loss is invisible and the filter is four times cheaper. The sharp
	// section is always drawn at full resolution.
	const scale = blurPx >= config.render.halfResBlurThresholdPx ? config.render.halfResScale : 1;

	return (
		<AbsoluteFill style={{backgroundColor: theme.background}}>
			<SpotGrid
				canvasRef={bufferRef}
				field={field}
				sprites={sprites}
				flashes={flashes}
				frame={frame}
				config={config}
				margin={margin}
				scale={scale}
				bufferWidth={bufferWidth}
				bufferHeight={bufferHeight}
			/>
			<FocusPass
				canvasRef={mainRef}
				sourceRef={bufferRef}
				bloomRef={bloomRef}
				config={config}
				theme={theme}
				blurPx={blurPx}
				exposureGain={exposureGain}
				margin={margin}
				scale={scale}
				bufferWidth={bufferWidth}
				bufferHeight={bufferHeight}
				width={width}
				height={height}
			/>
			<GrainPass config={config} theme={theme} frame={frame} width={width} height={height} />
		</AbsoluteFill>
	);
};

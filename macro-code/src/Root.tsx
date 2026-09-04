import React from 'react';
import {Composition} from 'remotion';
import {MacroCode} from './MacroCode';
import {PALETTES} from './palettes';

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
/** 12 seconds. Every animated value is periodic over exactly this many frames. */
export const DURATION = 360;

export const RemotionRoot: React.FC = () => (
	<>
		{Object.values(PALETTES).map((palette) => (
			<Composition
				key={palette.id}
				id={palette.id}
				component={MacroCode}
				durationInFrames={DURATION}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette}}
			/>
		))}
	</>
);

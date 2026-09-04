import React from 'react';
import {Composition} from 'remotion';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './config';
import {CYAN, MAGENTA} from './palette';
import {NeonCorridor} from './NeonCorridor';

/**
 * Both compositions are defined at 3840x2160 so they can be rendered at 4K.
 * Render previews with --scale=0.5 for 1920x1080.
 */
export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="V1-NeonCorridorMagenta"
				component={NeonCorridor}
				durationInFrames={DURATION_IN_FRAMES}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette: MAGENTA}}
			/>
			<Composition
				id="V2-NeonCorridorCyan"
				component={NeonCorridor}
				durationInFrames={DURATION_IN_FRAMES}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette: CYAN}}
			/>
		</>
	);
};

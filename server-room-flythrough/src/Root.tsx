import React from 'react';
import {Composition} from 'remotion';
import {DATA_CENTER_STEEL} from './server/palette';
import {ServerRoom} from './server/ServerRoom';

// Reference clip: 401 frames @ 30 fps = 13.3667 s. Compositions are authored in 4K UHD.
const DURATION = 401;
const FPS = 30;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="ServerRoom-V1-Reference"
				component={ServerRoom}
				durationInFrames={DURATION}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette: DATA_CENTER_STEEL, camera: 'reference-dolly' as const}}
			/>
			<Composition
				id="ServerRoom-V2-LowAngleCrane"
				component={ServerRoom}
				durationInFrames={DURATION}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette: DATA_CENTER_STEEL, camera: 'low-angle-crane' as const}}
			/>
		</>
	);
};

import React from 'react';
import {Composition} from 'remotion';
import {FiberOpticCables} from './fiber/FiberOpticCables';
import {AMBER_PLUM, REFERENCE_BLUE} from './fiber/palette';

// Reference clip: 301 frames @ 30 fps = 10.0333 s. Compositions are authored in 4K UHD.
const DURATION = 301;
const FPS = 30;
const WIDTH = 3840;
const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="FiberOpticCables-V1-Reference"
				component={FiberOpticCables}
				durationInFrames={DURATION}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette: REFERENCE_BLUE}}
			/>
			<Composition
				id="FiberOpticCables-V2-AmberPalette"
				component={FiberOpticCables}
				durationInFrames={DURATION}
				fps={FPS}
				width={WIDTH}
				height={HEIGHT}
				defaultProps={{palette: AMBER_PLUM}}
			/>
		</>
	);
};

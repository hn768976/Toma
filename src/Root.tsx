import React from 'react';
import {Composition} from 'remotion';
import {WireCity, type WireCityProps} from './wire-city/WireCity';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="WireCityMint"
				component={WireCity}
				durationInFrames={450}
				fps={30}
				width={3840}
				height={2160}
				defaultProps={{variant: 'mint'}}
			/>
		</>
	);
};

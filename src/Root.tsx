import React from 'react';
import {Composition} from 'remotion';
import {HalftoneDash} from './HalftoneDash';
import {COMP_H, COMP_W, DURATION} from './lib/layout';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="HalftoneDashBlue"
				component={HalftoneDash}
				durationInFrames={DURATION}
				fps={30}
				width={COMP_W}
				height={COMP_H}
				defaultProps={{variant: 'blue' as const}}
			/>
		</>
	);
};

import React from 'react';
import {Composition} from 'remotion';
import {Microarray} from './Microarray';

export const RemotionRoot: React.FC = () => {
	return (
		<>
			<Composition
				id="MicroarrayRackFocus"
				component={Microarray}
				durationInFrames={360}
				fps={30}
				width={3840}
				height={2160}
				defaultProps={{variant: 'standard' as const}}
			/>
		</>
	);
};

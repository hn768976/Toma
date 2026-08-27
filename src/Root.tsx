import React from 'react';
import {Composition} from 'remotion';
import {Lightning} from './Lightning';
import {VARIANTS} from './variants';

export const RemotionRoot: React.FC = () => {
	const blue = VARIANTS.blue.timing;
	const violet = VARIANTS.violet.timing;

	return (
		<>
			<Composition
				id="LightningBlue"
				component={Lightning}
				durationInFrames={blue.durationInFrames}
				fps={blue.fps}
				width={blue.width}
				height={blue.height}
				defaultProps={{variant: 'blue' as const}}
			/>
			<Composition
				id="LightningViolet"
				component={Lightning}
				durationInFrames={violet.durationInFrames}
				fps={violet.fps}
				width={violet.width}
				height={violet.height}
				defaultProps={{variant: 'violet' as const}}
			/>
		</>
	);
};

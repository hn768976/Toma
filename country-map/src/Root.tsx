import { Composition } from 'remotion';
import { CountryMap } from './CountryMap';
import { COUNTRY_ROWS } from './rows';
import { DURATION, FPS } from './scene/cameraPath';

export const RemotionRoot: React.FC = () => (
	<>
		{COUNTRY_ROWS.map((row) => (
			<Composition
				key={row.id}
				id={`CountryMap-${row.id}`}
				component={CountryMap}
				durationInFrames={DURATION}
				fps={FPS}
				width={3840}
				height={2160}
				defaultProps={{ row }}
			/>
		))}
	</>
);

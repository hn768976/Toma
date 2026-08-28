/**
 * WireCity.tsx — the composition.
 *
 * Determinism checklist, all satisfied here:
 *   - <ThreeCanvas> from @remotion/three (NOT r3f's <Canvas>): it sets
 *     frameloop="never" while rendering and calls advance() once per Remotion
 *     frame, so the three.js render loop is driven by Remotion's clock.
 *   - Every animated value is derived from useCurrentFrame(). There is not a
 *     single useFrame(delta) or THREE.Clock in the project.
 *   - All randomness comes from Remotion's random() inside a useMemo keyed on
 *     a constant seed, so the layout is generated once and is identical on
 *     every render.
 *   - A delayRender()/continueRender() pair holds the first frame until the
 *     scene has been built and committed.
 */

import {ThreeCanvas} from '@remotion/three';
import React, {useEffect, useMemo, useState} from 'react';
import {
	AbsoluteFill,
	continueRender,
	delayRender,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';
import {Buildings} from './Buildings';
import {CanvasWarmup} from './CanvasWarmup';
import {CameraRig, useSceneCamera} from './CameraRig';
import {CAMERA_PATHS, LENS, sampleAllGroundTracks} from './camera-paths';
import {generateCity} from './city-layout';
import {Grain} from './Grain';
import {Ground} from './Ground';
import {Haze} from './Haze';
import {Post} from './Post';
import {Windows} from './Windows';
import {VARIANTS, type VariantName} from './variants';

/** One seed for the whole project: all three versions show the same city. */
export const CITY_SEED = 'wire-city-01';

export type WireCityProps = {
	variant: VariantName;
};

const Scene: React.FC<{variant: VariantName}> = ({variant}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const config = VARIANTS[variant];

	const city = useMemo(
		() => generateCity(CITY_SEED, sampleAllGroundTracks(durationInFrames)),
		[durationInFrames],
	);

	const cameraState = useMemo(
		() => CAMERA_PATHS[config.cameraPath]({frame, durationInFrames}),
		[config.cameraPath, frame, durationInFrames],
	);

	const camera = useSceneCamera(LENS);

	return (
		<>
			<color attach="background" args={[config.palette.background]} />
			<fog
				attach="fog"
				args={[config.palette.haze, config.fog.near, config.fog.far]}
			/>
			<CameraRig makeDefault camera={camera} lens={LENS} state={cameraState} />
			<Ground config={config} />
			<Buildings city={city} config={config} />
			{config.windows.enabled ? (
				<Windows city={city} config={config} frame={frame} seed={CITY_SEED} />
			) : null}
			<Haze config={config} camera={cameraState} />
			<Post config={config} camera={camera} />
			<CanvasWarmup />
		</>
	);
};

export const WireCity: React.FC<WireCityProps> = ({variant}) => {
	const {width, height} = useVideoConfig();
	const config = VARIANTS[variant];

	// Hold the first frame until the scene tree has mounted. There are no
	// external assets to load, but this is the hook any texture/model loading
	// would go through.
	const [handle] = useState(() => delayRender('Building the wireframe city'));
	useEffect(() => {
		continueRender(handle);
	}, [handle]);

	return (
		<AbsoluteFill style={{backgroundColor: config.palette.background}}>
			<ThreeCanvas
				width={width}
				height={height}
				flat
				gl={{antialias: true, alpha: false}}
			>
				<Scene variant={variant} />
			</ThreeCanvas>
			<Grain opacity={config.grainOpacity} />
		</AbsoluteFill>
	);
};

import React, {useMemo} from 'react';
import {useVideoConfig} from 'remotion';
import {GLStage} from '../engine/GLStage';
import type {CameraMode} from './camera';
import type {ServerPalette} from './palette';
import {createServerScene, type ServerDebug} from './scene';

export const ServerRoom: React.FC<{
	palette: ServerPalette;
	camera: CameraMode;
	motionBlurSamples?: number;
	debug?: ServerDebug;
}> = ({palette, camera, motionBlurSamples = 1, debug}) => {
	const {durationInFrames} = useVideoConfig();
	const key = JSON.stringify(debug ?? {});
	const factory = useMemo(
		() => createServerScene(palette, camera, durationInFrames, debug),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[palette, camera, durationInFrames, key],
	);
	const samples = useMemo(() => () => motionBlurSamples, [motionBlurSamples]);
	return <GLStage factory={factory} motionBlurSamples={samples} shutter={0.5} />;
};

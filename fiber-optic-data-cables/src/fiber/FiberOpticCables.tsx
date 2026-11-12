import React, {useMemo} from 'react';
import {GLStage} from '../engine/GLStage';
import type {FiberPalette} from './palette';
import {createFiberScene, fiberMotionBlur, type DebugLayers} from './scene';

export const FiberOpticCables: React.FC<{palette: FiberPalette; debug?: DebugLayers}> = ({
	palette,
	debug,
}) => {
	const key = JSON.stringify(debug ?? {});
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const factory = useMemo(() => createFiberScene(palette, 7, debug), [palette, key]);
	return <GLStage factory={factory} motionBlurSamples={fiberMotionBlur} shutter={0.5} />;
};

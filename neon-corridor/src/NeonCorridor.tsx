import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {NoToneMapping} from 'three';
import {
	CAMERA_FAR,
	CAMERA_FOV,
	CAMERA_NEAR,
	CAMERA_Y,
	FLOAT_X,
	FLOAT_Y,
	FOG_DENSITY,
} from './config';
import {loopT} from './loop';
import type {Palette} from './palette';
import {Corridor} from './scene/Corridor';
import {ReflectiveFloor} from './scene/ReflectiveFloor';
import {Effects} from './scene/Effects';

/**
 * Camera rig.
 *
 * Constant forward travel is modelled by sliding the corridor past a camera
 * pinned at the origin (see loop.ts), so all this does is the slight float —
 * a couple of hundredths of a unit, well under 1% of frame, with whole numbers
 * of cycles per loop so it returns exactly to its start. No rotation, no roll.
 */
const CameraRig: React.FC = () => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const t = loopT(frame, durationInFrames);
	const camera = useThree((s) => s.camera);

	camera.position.set(
		FLOAT_X * Math.sin(2 * Math.PI * t),
		CAMERA_Y + FLOAT_Y * Math.sin(4 * Math.PI * t + 1.1),
		0,
	);
	camera.rotation.set(0, 0, 0);
	camera.updateMatrixWorld(true);

	return null;
};

const Scene: React.FC<{palette: Palette}> = ({palette}) => {
	return (
		<>
			<color attach="background" args={[palette.background]} />
			<fogExp2 attach="fog" args={[palette.background, FOG_DENSITY]} />
			<CameraRig />
			<Corridor palette={palette} />
			<ReflectiveFloor palette={palette} />
			<Effects />
		</>
	);
};

export const NeonCorridor: React.FC<{palette: Palette}> = ({palette}) => {
	const {width, height} = useVideoConfig();

	return (
		<AbsoluteFill style={{backgroundColor: palette.background}}>
			<ThreeCanvas
				width={width}
				height={height}
				// Let the real device pixel ratio through so Remotion's --scale
				// renders 1:1 instead of supersampling. r3f's default [1, 2] would
				// clamp a 0.5 scale back up to a full 4K buffer.
				dpr={[0.25, 2]}
				gl={{
					antialias: false, // the composer does 4x MSAA instead
					alpha: false,
					toneMapping: NoToneMapping,
					powerPreference: 'high-performance',
				}}
				camera={{
					fov: CAMERA_FOV,
					near: CAMERA_NEAR,
					far: CAMERA_FAR,
					position: [0, CAMERA_Y, 0],
				}}
			>
				<Scene palette={palette} />
			</ThreeCanvas>
		</AbsoluteFill>
	);
};

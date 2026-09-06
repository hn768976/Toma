import React, {useMemo} from 'react';
import {DoubleSide} from 'three';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {FRAME_COUNT, HALF_WIDTH} from '../config';
import {depthOfSlot, loopT, slotOf, zOfSlot} from '../loop';
import {flickerAt} from '../flicker';
import {neonColorAt, type Palette} from '../palette';
import {makeFrameArchGeometry, makeFrameBaseGeometry, makeStripGeometry} from './geometry';
import {Shell} from './Shell';

/**
 * Bottom-bar brightness, as a fraction of the rest of the rectangle.
 *
 * Down the corridor these read as the faint ladder the reference has along the
 * floor. Close to the camera the same bar is seen almost edge-on and covers a
 * 30px stripe right across the lower third — which the reference plainly does
 * not have — so it fades out over the last few metres. Being a function of
 * depth alone, this costs the loop nothing (see loop.ts).
 */
const baseBarGain = (depth: number) => {
	const t = Math.min(1, Math.max(0, (depth - 8) / 14));
	return 0.18 * t * t * (3 - 2 * t);
};

/**
 * The corridor: neon rectangles receding down -z, with wall strips interleaved
 * between them so the tunnel reads as an enclosed space rather than a stack of
 * floating rectangles.
 *
 * Every tube's colour and brightness is looked up by its *depth*, never by its
 * index — that is what makes the recycling seamless. See loop.ts.
 */
export const Corridor: React.FC<{palette: Palette}> = ({palette}) => {
	const frame = useCurrentFrame();
	const {durationInFrames} = useVideoConfig();
	const t = loopT(frame, durationInFrames);

	const archGeo = useMemo(makeFrameArchGeometry, []);
	const baseGeo = useMemo(makeFrameBaseGeometry, []);
	const stripGeo = useMemo(makeStripGeometry, []);

	const rectangles = useMemo(() => {
		return Array.from({length: FRAME_COUNT}, (_, k) => {
			const slot = slotOf(k, t);
			const depth = depthOfSlot(slot);
			const gain = flickerAt(k, frame, durationInFrames);
			const barGain = baseBarGain(depth);
			return {
				key: k,
				z: zOfSlot(slot),
				color: neonColorAt(depth, palette, gain),
				// Dropped entirely rather than merely dimmed once it fades out:
				// left in the scene it still writes depth and cuts a dark stripe
				// across the reflection.
				baseColor: barGain > 0.001 ? neonColorAt(depth, palette, gain * barGain) : null,
			};
		});
	}, [t, frame, durationInFrames, palette]);

	// Offset by half a spacing so the strips fall between the rectangles.
	const strips = useMemo(() => {
		return Array.from({length: FRAME_COUNT}, (_, k) => {
			const slot = slotOf(k, t, 0.5);
			const depth = depthOfSlot(slot);
			return {key: k, z: zOfSlot(slot), color: neonColorAt(depth, palette, 1.15)};
		});
	}, [t, palette]);

	return (
		<group>
			{rectangles.map((r) => (
				<React.Fragment key={`f${r.key}`}>
					<mesh geometry={archGeo} position={[0, 0, r.z]}>
						<meshBasicMaterial color={r.color} toneMapped={false} fog side={DoubleSide} />
					</mesh>
					{r.baseColor ? (
						<mesh geometry={baseGeo} position={[0, 0, r.z]}>
							<meshBasicMaterial
								color={r.baseColor}
								toneMapped={false}
								fog
								side={DoubleSide}
							/>
						</mesh>
					) : null}
				</React.Fragment>
			))}

			{strips.map((s) => (
				<React.Fragment key={`s${s.key}`}>
					<mesh geometry={stripGeo} position={[-HALF_WIDTH, 0, s.z]}>
						<meshBasicMaterial color={s.color} toneMapped={false} fog side={DoubleSide} />
					</mesh>
					<mesh geometry={stripGeo} position={[HALF_WIDTH, 0, s.z]}>
						<meshBasicMaterial color={s.color} toneMapped={false} fog side={DoubleSide} />
					</mesh>
				</React.Fragment>
			))}

			<Shell palette={palette} />
		</group>
	);
};

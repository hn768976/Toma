import React, {useMemo} from 'react';
import {AdditiveBlending, Color, DoubleSide} from 'three';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
	CORRIDOR_DEPTH,
	FRAME_COUNT,
	HALF_WIDTH,
	HEIGHT_UNITS,
	SPACING,
	TUBE_THICKNESS,
	Z_SLOT0,
} from '../config';
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
	const t = Math.min(1, Math.max(0, (depth - 5) / 9));
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
			const gain = flickerAt(slot, frame, durationInFrames);
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

	const shellZ = Z_SLOT0 - CORRIDOR_DEPTH / 2;
	const shellLen = CORRIDOR_DEPTH + 8;

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

			<Haze palette={palette} />
		</group>
	);
};

/**
 * Soft bright haze past the last rectangle, so the corridor fades into a glow
 * instead of terminating. Fog is off for this one — it *is* the far end.
 */
const Haze: React.FC<{palette: Palette}> = ({palette}) => {
	const uniforms = useMemo(
		() => ({
			uColor: {value: new Color(palette.haze).multiplyScalar(2.6)},
		}),
		[palette],
	);

	return (
		<mesh position={[0, HEIGHT_UNITS * 0.42, Z_SLOT0 - (FRAME_COUNT - 3) * SPACING]}>
			<planeGeometry args={[HALF_WIDTH * 2.4, HEIGHT_UNITS * 1.8]} />
			<shaderMaterial
				uniforms={uniforms}
				transparent
				depthWrite={false}
				blending={AdditiveBlending}
				toneMapped={false}
				side={DoubleSide}
				vertexShader={`
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`}
				fragmentShader={`
					uniform vec3 uColor;
					varying vec2 vUv;
					void main() {
						vec2 d = (vUv - 0.5) * vec2(1.0, 1.35);
						float r = length(d) * 2.0;
						float a = exp(-r * r * 3.2);
						gl_FragColor = vec4(uColor * a, a);
					}
				`}
			/>
		</mesh>
	);
};

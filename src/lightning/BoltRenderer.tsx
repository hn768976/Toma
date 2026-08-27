import React from 'react';
import {useCurrentFrame} from 'remotion';
import type {VariantConfig, VariantName} from '../variants';
import {BoltPath} from './BoltPath';
import {getBolt} from './geometry';
import {getSchedule, litAmount} from './schedule';

/**
 * Picks the return strokes that are lit on this frame and hands each one to a
 * <BoltPath>. Paths are generated once per flash and cached by seed, so a flash
 * keeps the same channel for the frames it is lit — regenerating the recursion
 * every frame would both cost time and make the bolt jitter inside one flash.
 */
export const BoltRenderer: React.FC<{cfg: VariantConfig; variant: VariantName}> = ({
	cfg,
	variant,
}) => {
	const frame = useCurrentFrame() % cfg.timing.durationInFrames;
	const schedule = getSchedule(variant, cfg);

	return (
		<>
			{schedule.lightings.map((lighting) => {
				const amount = litAmount(lighting, frame);
				if (amount <= 0) {
					return null;
				}
				const bolt = getBolt({
					seed: lighting.seed,
					cfg: cfg.bolt,
					origin: {x: lighting.originX, y: lighting.originY},
					travel: lighting.travel,
					drift: lighting.drift,
				});
				return (
					<BoltPath
						key={lighting.seed}
						bolt={bolt}
						cfg={cfg.bolt}
						palette={cfg.palette}
						amount={amount}
					/>
				);
			})}
		</>
	);
};

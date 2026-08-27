import React from 'react';
import {AbsoluteFill} from 'remotion';
import {AmbientGlow} from './lightning/AmbientGlow';
import {BackdropPass} from './lightning/BackdropPass';
import {BoltRenderer} from './lightning/BoltRenderer';
import {FrameFlash} from './lightning/FrameFlash';
import {GrainPass} from './lightning/GrainPass';
import {SurfaceProvider} from './lightning/surface';
import {VARIANTS, type VariantName} from './variants';

/**
 * Every pass below is a pure function of the current frame — no Date.now, no
 * requestAnimationFrame, no CSS animation, no component state — so a render is
 * deterministic and reproducible frame by frame.
 *
 * The passes are siblings and draw in the order they appear: React runs sibling
 * layout effects in tree order, and that order is the compositing order.
 */
export const Lightning: React.FC<{variant: VariantName}> = ({variant}) => {
	const cfg = VARIANTS[variant];

	return (
		<AbsoluteFill style={{backgroundColor: cfg.palette.background}}>
			<SurfaceProvider width={cfg.timing.width} height={cfg.timing.height}>
				<BackdropPass cfg={cfg} />
				<AmbientGlow cfg={cfg} variant={variant} />
				<BoltRenderer cfg={cfg} variant={variant} />
				<FrameFlash cfg={cfg} variant={variant} />
				<GrainPass cfg={cfg} />
			</SurfaceProvider>
		</AbsoluteFill>
	);
};

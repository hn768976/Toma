/**
 * Post.tsx — the post-processing stack, driven entirely by
 * `VARIANTS[variant].post`.
 *
 * Bloom is mounted only when `post.bloom` is non-null. The blueprint variant
 * sets it to `null`, so the pass does not exist at all — deliberately not
 * "Bloom with intensity 0", because additive glow on a light background is
 * always wrong and a near-zero intensity still costs the mip chain and still
 * lifts the midtones.
 *
 * The vignette is always mounted; its colour and strength decide whether the
 * corners go dark (v1/v2) or pale (v3).
 *
 * Both passes are pure functions of the input buffer — no time uniforms —
 * so they do not threaten determinism.
 */

import {Bloom, EffectComposer, wrapEffect} from '@react-three/postprocessing';
import React from 'react';
import type * as THREE from 'three';
import {RadialVignetteEffect} from './vignette-effect';
import type {VariantConfig} from './variants';

const RadialVignette = wrapEffect(RadialVignetteEffect);

export const Post: React.FC<{
	config: VariantConfig;
	/**
	 * Passed explicitly rather than read from the r3f store: the composer
	 * captures its camera at render time, which under Remotion's once-per-frame
	 * loop is one commit before `set({camera})` reaches subscribers.
	 */
	camera: THREE.Camera;
}> = ({config, camera}) => {
	const {bloom, vignette} = config.post;

	return (
		<EffectComposer camera={camera} multisampling={8}>
			{bloom ? (
				<Bloom
					intensity={bloom.intensity}
					luminanceThreshold={bloom.luminanceThreshold}
					luminanceSmoothing={bloom.luminanceSmoothing}
					mipmapBlur={bloom.mipmapBlur}
					radius={bloom.radius}
				/>
			) : (
				<></>
			)}
			<RadialVignette
				color={config.palette.vignette}
				strength={vignette.strength}
				offset={vignette.offset}
			/>
		</EffectComposer>
	);
};

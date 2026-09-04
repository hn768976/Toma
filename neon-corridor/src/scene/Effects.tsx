import React, {useEffect, useMemo, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
	BloomEffect,
	DepthOfFieldEffect,
	EffectComposer,
	EffectPass,
	RenderPass,
} from 'postprocessing';
import {HalfFloatType, Vector2} from 'three';
import {GrainVignetteEffect} from './GrainVignetteEffect';

/**
 * Post chain, driven directly rather than through <EffectComposer> from
 * @react-three/postprocessing.
 *
 * That wrapper builds its composer inside a passive effect, so on the very
 * first `advance()` there is no composer yet and nothing reaches the canvas —
 * which, with Remotion, is exactly the frame each render thread starts on.
 * Building it in useMemo means it exists before any render runs, whichever
 * frame this thread happens to begin at.
 *
 * Half-float buffers the whole way through, so neon above 1.0 survives to the
 * bloom and only clips in the final 8-bit write. That is what makes the near
 * tubes go white-hot instead of merely saturated.
 */
export const Effects: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const gl = useThree((s) => s.gl);
	const scene = useThree((s) => s.scene);
	const camera = useThree((s) => s.camera);

	const {composer, grain} = useMemo(() => {
		const c = new EffectComposer(gl, {
			frameBufferType: HalfFloatType,
			multisampling: 4, // thin neon bars alias badly without it
		});
		c.addPass(new RenderPass(scene, camera));

		// Near frames slightly soft, mid corridor sharp, far end softening into
		// the haze.
		const dof = new DepthOfFieldEffect(camera, {
			worldFocusDistance: 13,
			worldFocusRange: 20,
			bokehScale: 2.2,
			resolutionScale: 0.5,
		});

		// Generously bloomed, per the brief.
		const bloom = new BloomEffect({
			intensity: 0.95,
			luminanceThreshold: 0.85,
			luminanceSmoothing: 0.4,
			mipmapBlur: true,
			radius: 0.78,
		});

		const g = new GrainVignetteEffect();

		// One convolution effect per pass — postprocessing refuses to merge them.
		c.addPass(new EffectPass(camera, dof));
		c.addPass(new EffectPass(camera, bloom));
		c.addPass(new EffectPass(camera, g));

		return {composer: c, grain: g};
	}, [gl, scene, camera]);

	useEffect(() => () => composer.dispose(), [composer]);

	grain.seed = frame;

	const sized = useRef({width: -1, height: -1});
	const bufferSize = useMemo(() => new Vector2(), []);

	useFrame(() => {
		// The renderer is only the right size once <ThreeCanvas> has applied the
		// composition dimensions, which happens after useMemo runs. Check it
		// here, where it is guaranteed to be current.
		//
		// This must be the renderer size, not the drawing-buffer size:
		// EffectComposer.setSize() forwards to renderer.setSize(), so feeding it
		// the drawing buffer would shrink the canvas by the device pixel ratio
		// on every frame.
		gl.getSize(bufferSize);
		const {x: width, y: height} = bufferSize;
		if (width !== sized.current.width || height !== sized.current.height) {
			composer.setSize(width, height);
			sized.current = {width, height};
		}

		const prevAutoClear = gl.autoClear;
		gl.autoClear = true;
		composer.render(1 / fps);
		gl.autoClear = prevAutoClear;
	}, 1);

	return null;
};

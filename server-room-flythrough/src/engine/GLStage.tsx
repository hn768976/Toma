import React, {useLayoutEffect, useRef, useState} from 'react';
import {
	AbsoluteFill,
	cancelRender,
	continueRender,
	delayRender,
	useCurrentFrame,
	useVideoConfig,
} from 'remotion';

/**
 * A scene built by a factory renders one image for an arbitrary (fractional)
 * frame time `t`. Everything must be derived from `t` only so that frames can
 * be rendered out of order / in parallel by Remotion.
 */
export type SceneHandle = {
	renderFrame: (t: number) => void;
	dispose: () => void;
};

export type SceneFactory = (opts: {
	canvas: HTMLCanvasElement;
	width: number;
	height: number;
}) => SceneHandle;

type Props = {
	factory: SceneFactory;
	/** Number of temporal sub-samples for a given frame (1 = no motion blur). */
	motionBlurSamples?: (frame: number) => number;
	/** Shutter length in frames (0.5 = 180° shutter). */
	shutter?: number;
};

/**
 * Renders a Three.js scene into an offscreen WebGL canvas at
 * composition size × devicePixelRatio (so `--scale 0.5` on a 4K composition
 * renders natively at 1080p) and copies the result into a visible 2D canvas.
 * Optional temporal accumulation gives true camera motion blur.
 */
export const GLStage: React.FC<Props> = ({
	factory,
	motionBlurSamples,
	shutter = 0.5,
}) => {
	const frame = useCurrentFrame();
	const {width, height} = useVideoConfig();
	const displayRef = useRef<HTMLCanvasElement>(null);
	const sceneRef = useRef<{handle: SceneHandle; gl: HTMLCanvasElement} | null>(
		null,
	);
	const [initHandle] = useState(() => delayRender('Initialising WebGL scene'));

	// Pixel ratio: follows Remotion's --scale (deviceScaleFactor), capped at 1
	// so Studio previews on HiDPI screens do not render at 8K.
	const pixelRatio =
		typeof window === 'undefined'
			? 1
			: Math.min(1, Math.max(0.125, window.devicePixelRatio || 1));
	const bw = Math.round(width * pixelRatio);
	const bh = Math.round(height * pixelRatio);

	useLayoutEffect(() => {
		try {
			const gl = document.createElement('canvas');
			gl.width = bw;
			gl.height = bh;
			const handle = factory({canvas: gl, width: bw, height: bh});
			sceneRef.current = {handle, gl};
		} catch (e) {
			cancelRender(e as Error);
		}
		continueRender(initHandle);
		return () => {
			sceneRef.current?.handle.dispose();
			sceneRef.current = null;
		};
	}, [factory, bw, bh, initHandle]);

	useLayoutEffect(() => {
		const s = sceneRef.current;
		const display = displayRef.current;
		if (!s || !display) return;
		const handle = delayRender(`Rendering frame ${frame}`);
		try {
			const ctx = display.getContext('2d');
			if (!ctx) throw new Error('2D context unavailable');
			const samples = Math.max(1, Math.round(motionBlurSamples?.(frame) ?? 1));
			ctx.globalCompositeOperation = 'source-over';
			for (let i = 0; i < samples; i++) {
				const t =
					samples === 1 ? frame : frame + ((i + 0.5) / samples - 0.5) * shutter;
				s.handle.renderFrame(t);
				// Running average: sample i contributes 1/(i+1).
				ctx.globalAlpha = 1 / (i + 1);
				ctx.drawImage(s.gl, 0, 0, bw, bh);
			}
			ctx.globalAlpha = 1;
		} catch (e) {
			cancelRender(e as Error);
		}
		continueRender(handle);
	}, [frame, bw, bh, motionBlurSamples, shutter]);

	return (
		<AbsoluteFill style={{backgroundColor: 'black'}}>
			<canvas
				ref={displayRef}
				width={bw}
				height={bh}
				style={{width: '100%', height: '100%', display: 'block'}}
			/>
		</AbsoluteFill>
	);
};

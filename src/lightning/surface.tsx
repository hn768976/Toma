import React, {createContext, useContext, useLayoutEffect, useMemo, useRef} from 'react';

/**
 * The scene draws into a single canvas whose backing store is the full 4K
 * composition size. Passes 1 and 2 of the bolt (the wide, heavily blurred glows)
 * are drawn on a quarter-size companion canvas and composited up: a soft glow
 * carries no detail, and blurring at quarter size costs a sixteenth as much.
 */
export interface Surfaces {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	glowCanvas: HTMLCanvasElement;
	glowCtx: CanvasRenderingContext2D;
	/** Scale of the glow canvas relative to the main one. */
	glowScale: number;
	width: number;
	height: number;
}

const GLOW_SCALE = 0.25;

const SurfaceContext = createContext<Surfaces | null>(null);

export const useSurfaces = (): Surfaces => {
	const value = useContext(SurfaceContext);
	if (!value) {
		throw new Error('A drawing pass was rendered outside <SurfaceProvider>');
	}
	return value;
};

const createSurfaces = (width: number, height: number): Surfaces => {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.display = 'block';

	const glowCanvas = document.createElement('canvas');
	glowCanvas.width = Math.round(width * GLOW_SCALE);
	glowCanvas.height = Math.round(height * GLOW_SCALE);

	return {
		canvas,
		ctx: canvas.getContext('2d') as CanvasRenderingContext2D,
		glowCanvas,
		glowCtx: glowCanvas.getContext('2d') as CanvasRenderingContext2D,
		glowScale: GLOW_SCALE,
		width,
		height,
	};
};

/**
 * Holds the canvas and mounts it into the tree. Passes are siblings below this
 * provider: React runs sibling layout effects in order, so the passes composite
 * in the order they appear in the scene.
 */
export const SurfaceProvider: React.FC<{
	width: number;
	height: number;
	children: React.ReactNode;
}> = ({width, height, children}) => {
	const surfaces = useMemo(() => createSurfaces(width, height), [width, height]);
	const hostRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (host && surfaces.canvas.parentElement !== host) {
			host.appendChild(surfaces.canvas);
		}
	});

	return (
		<SurfaceContext.Provider value={surfaces}>
			<div
				ref={hostRef}
				style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
			/>
			{children}
		</SurfaceContext.Provider>
	);
};

/**
 * Runs `draw` on the quarter-size companion canvas, then composites the result
 * up onto the main canvas additively and leaves the companion clean. Every pass
 * that needs a heavy blur borrows it this way, so ownership never crosses
 * component boundaries.
 */
export const paintGlow = (
	surfaces: Surfaces,
	draw: (ctx: CanvasRenderingContext2D, scale: number) => void,
): void => {
	const {glowCtx, glowCanvas, ctx, glowScale, width, height} = surfaces;
	glowCtx.setTransform(1, 0, 0, 1, 0, 0);
	glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
	glowCtx.globalCompositeOperation = 'lighter';
	glowCtx.lineCap = 'round';
	glowCtx.lineJoin = 'round';
	draw(glowCtx, glowScale);

	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.globalAlpha = 1;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(glowCanvas, 0, 0, width, height);
	ctx.restore();

	glowCtx.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
};

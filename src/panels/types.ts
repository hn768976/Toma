import {PanelSlot} from '../lib/layout';
import {Variant} from '../variants';

export type PanelDrawArgs = {
	/** Depth-bucket buffer this panel belongs to. */
	ctx: CanvasRenderingContext2D;
	/** Quarter-resolution buffer collecting everything that should bloom. */
	bloom: CanvasRenderingContext2D;
	panel: PanelSlot;
	variant: Variant;
	frame: number;
	/** Content box, already inset from the panel chrome. */
	x: number;
	y: number;
	w: number;
	h: number;
};

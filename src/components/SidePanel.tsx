import React, {useLayoutEffect} from 'react';
import {useDash} from '../context';
import {roundRect} from '../lib/canvas';
import {ORB, PANEL_ARRIVE_DURATION, PanelSlot} from '../lib/layout';
import {easeOutCubic, ramp} from '../lib/motion';
import {DEPTH_LAYER, resetScene, shouldDraw} from '../lib/scene';
import {drawChartsPanel} from '../panels/charts';
import {drawCodePanel} from '../panels/code';
import {contentBox, drawPanelChrome} from '../panels/chrome';
import {PanelDrawArgs} from '../panels/types';

/**
 * One panel. The chrome is identical everywhere; the body is chosen by a
 * single switch on the variant's panel kind, so all three versions share this
 * component.
 */
export const SidePanel: React.FC<{panel: PanelSlot}> = ({panel}) => {
	const {scene, variant, frame, fontsReady} = useDash();

	useLayoutEffect(() => {
		resetScene(scene, frame);
		if (!shouldDraw(scene, `panel-${panel.id}`, frame)) return;

		const t = easeOutCubic(ramp(frame, panel.start, panel.start + PANEL_ARRIVE_DURATION));
		if (t <= 0) return;

		const ctx = scene.layers[DEPTH_LAYER[panel.depth]].ctx;
		const bloom = scene.layers.bloom.ctx;

		// Slide in ~40px along the vector pointing away from the orb.
		const cx = panel.x + panel.w / 2;
		const cy = panel.y + panel.h / 2;
		const len = Math.max(1, Math.hypot(cx - ORB.cx, cy - ORB.cy));
		const ox = ((cx - ORB.cx) / len) * 40 * (1 - t);
		const oy = ((cy - ORB.cy) / len) * 40 * (1 - t);

		ctx.save();
		bloom.save();
		ctx.globalAlpha = t;
		bloom.globalAlpha = t;
		ctx.translate(ox, oy);
		bloom.translate(ox, oy);

		drawPanelChrome(ctx, bloom, panel, variant, frame);

		const box = contentBox(panel);
		ctx.save();
		roundRect(ctx, panel.x + 2, panel.y + 2, panel.w - 4, panel.h - 4, 11);
		ctx.clip();

		const args: PanelDrawArgs = {
			ctx,
			bloom,
			panel,
			variant,
			frame,
			x: box.x,
			y: box.y,
			w: box.w,
			h: box.h,
		};

		switch (variant.panelKind) {
			case 'charts':
				drawChartsPanel(args);
				break;
			case 'code':
				drawCodePanel(args);
				break;
			default:
				break;
		}

		ctx.restore();
		ctx.restore();
		bloom.restore();
	}, [scene, variant, frame, fontsReady, panel]);

	return null;
};

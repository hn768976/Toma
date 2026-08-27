import React, {useMemo, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {BokehField} from './components/BokehField';
import {CentreOrb} from './components/CentreOrb';
import {HalftoneLayer} from './components/HalftoneLayer';
import {NetworkWeb} from './components/NetworkWeb';
import {SidePanel} from './components/SidePanel';
import {DashContext, DashValue} from './context';
import {useFontsReady} from './lib/fonts';
import {buildPanels} from './lib/layout';
import {createScene, Scene} from './lib/scene';
import {DOT_PITCH, getVariant, VariantName} from './variants';

export type HalftoneDashProps = {
	variant: VariantName;
};

/**
 * One composition, three versions.
 *
 * Every child paints into a shared set of offscreen buffers from its own layout
 * effect. React flushes layout effects in tree order, so the order below is the
 * paint order: background elements first, <HalftoneLayer> last, where the
 * buffers are flattened, screened into dots and handed to the visible canvas.
 * Each child also calls `resetScene`, which is frame-guarded, so the wipe
 * happens exactly once no matter which child runs first.
 */
export const HalftoneDash: React.FC<HalftoneDashProps> = ({variant}) => {
	const frame = useCurrentFrame();
	const {width, height, durationInFrames} = useVideoConfig();
	const fontsReady = useFontsReady();

	const v = getVariant(variant);

	const sceneRef = useRef<Scene | null>(null);
	if (sceneRef.current === null) {
		sceneRef.current = createScene(width, height, DOT_PITCH);
	}
	const scene = sceneRef.current;

	const panels = useMemo(
		() => buildPanels(v.panelKind, v.panelArrival),
		[v.panelKind, v.panelArrival]
	);

	const value = useMemo<DashValue>(
		() => ({
			scene,
			variant: v,
			frame,
			duration: durationInFrames,
			width,
			height,
			fontsReady,
			panels,
		}),
		[scene, v, frame, durationInFrames, width, height, fontsReady, panels]
	);

	return (
		<DashContext.Provider value={value}>
			<AbsoluteFill style={{backgroundColor: 'black'}}>
				<BokehField />
				<NetworkWeb />
				<CentreOrb />
				{panels.map((panel) => (
					<SidePanel key={panel.id} panel={panel} />
				))}
				<HalftoneLayer />
			</AbsoluteFill>
		</DashContext.Provider>
	);
};

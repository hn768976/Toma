import { ThreeCanvas } from '@remotion/three';
import { useEffect, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, getRemotionEnvironment, staticFile, useVideoConfig } from 'remotion';
import { loadFonts } from './fonts';
import { drawMap, type MapTextures } from './map/drawMap';
import type { MapData } from './map/types';
import type { CountryRow } from './rows';
import { AtlasScene } from './scene/AtlasScene';

// One map per composition per tab, drawn once and reused for every frame.
const cache = new Map<string, Promise<MapTextures>>();
const loadMap = (row: CountryRow) => {
	let p = cache.get(row.id);
	if (!p) {
		p = (async () => {
			const t0 = performance.now();
			const [data] = await Promise.all([
				fetch(staticFile(`data/${row.id}.json`)).then((r) => r.json() as Promise<MapData>),
				loadFonts(),
			]);
			const t1 = performance.now();
			const maps = drawMap(row, data);
			console.log(`[map] ${row.id}: data+fonts ${(t1 - t0).toFixed(0)} ms, draw ${maps.stats.drawMs.toFixed(0)} ms, ${maps.stats.cities} cities, ${maps.stats.labels} labels, ${maps.stats.conflicts} colour conflicts`);
			return maps;
		})();
		cache.set(row.id, p);
	}
	return p;
};

export const CountryMap: React.FC<{ row: CountryRow }> = ({ row }) => {
	const { width, height } = useVideoConfig();
	const [handle] = useState(() => delayRender(`Drawing map for ${row.id}`, { timeoutInMilliseconds: 600000 }));
	const [maps, setMaps] = useState<MapTextures | null>(null);

	useEffect(() => {
		loadMap(row)
			.then((m) => {
				setMaps(m);
				continueRender(handle);
			})
			.catch((e) => cancelRender(e));
	}, [row, handle]);

	// Render at the output pixel density (Remotion's --scale), never above 1x
	// of the 3840x2160 composition. In the Studio keep it light.
	const dpr = getRemotionEnvironment().isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);

	return (
		<AbsoluteFill style={{ backgroundColor: '#E4EEF4' }}>
			{maps ? (
				<ThreeCanvas
					width={width}
					height={height}
					dpr={dpr}
					flat
					linear
					gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' }}
				>
					<AtlasScene row={row} maps={maps} />
				</ThreeCanvas>
			) : null}
		</AbsoluteFill>
	);
};

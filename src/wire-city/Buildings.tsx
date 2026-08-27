/**
 * Buildings.tsx — the whole city in two draw calls.
 *
 *  1. `fills`  — one InstancedMesh of unit boxes, scaled per instance. The
 *     material is meshBasicMaterial in `palette.buildingFill` (a colour a
 *     hair above the background), so the boxes read as empty but still write
 *     depth. That is what makes near wireframes correctly occlude far ones —
 *     classic hidden-line removal. `polygonOffset` pushes the fills a touch
 *     away from the camera so the edges never z-fight with their own faces.
 *
 *  2. `edges`  — EdgesGeometry-equivalent data for all ~180 buildings merged
 *     into ONE LineSegmentsGeometry / LineSegments2 / LineMaterial. Plain
 *     THREE.Line ignores `linewidth` on virtually every platform, hence
 *     Line2. LineSegmentsGeometry is itself an InstancedBufferGeometry (one
 *     instance per segment), so the entire wireframe is a single draw call.
 *
 * There are no lights in this scene and none are wanted: every material is
 * basic/emissive and the Bloom pass supplies the glow. Dropping a
 * meshStandardMaterial in here without lights is the classic way to end up
 * with an all-black render.
 */

import React, {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {
	buildEdgeColors,
	buildEdgePositions,
	type CityLayout,
} from './city-layout';
import {
	getDrawingBufferSize,
	mixRGB,
	REFERENCE_HEIGHT,
	toLinearRGB,
} from './three-helpers';
import type {VariantConfig} from './variants';

export const Buildings: React.FC<{
	city: CityLayout;
	config: VariantConfig;
}> = ({city, config}) => {
	const {palette} = config;

	const fills = useMemo(() => {
		const geometry = new THREE.BoxGeometry(1, 1, 1);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(palette.buildingFill),
			toneMapped: false,
			polygonOffset: true,
			polygonOffsetFactor: 4,
			polygonOffsetUnits: 4,
			// The fills exist purely to hide what is behind them; letting the
			// scene fog lift them toward the haze colour would turn distant
			// buildings into solid blocks.
			fog: false,
		});
		const mesh = new THREE.InstancedMesh(
			geometry,
			material,
			city.buildings.length,
		);
		const m = new THREE.Matrix4();
		const q = new THREE.Quaternion();
		const p = new THREE.Vector3();
		const s = new THREE.Vector3();
		city.buildings.forEach((b, index) => {
			p.set(b.x, b.h / 2, b.z);
			s.set(b.w, b.h, b.d);
			m.compose(p, q, s);
			mesh.setMatrixAt(index, m);
		});
		mesh.instanceMatrix.needsUpdate = true;
		// InstancedMesh derives its bounds from the source geometry only, which
		// is a 1x1x1 box at the origin here — frustum culling would wrongly
		// discard the whole city.
		mesh.frustumCulled = false;
		return mesh;
	}, [city, palette.buildingFill]);

	const edges = useMemo(() => {
		const geometry = new LineSegmentsGeometry();
		geometry.setPositions(buildEdgePositions(city.buildings));

		const base = toLinearRGB(palette.buildingLine);
		const glow = toLinearRGB(palette.buildingGlow);
		const k = config.lineOpacity;

		geometry.setColors(
			buildEdgeColors(city.buildings, (heightNorm) => {
				const c = config.heightRamp
					? mixRGB(base, glow, Math.pow(heightNorm, 1.35))
					: base;
				// Opacity is baked into the colour rather than set on the
				// material: the material stays opaque so `alphaToCoverage` can
				// anti-alias the sub-pixel-thin lines against the MSAA buffer.
				return [c[0] * k, c[1] * k, c[2] * k];
			}),
		);

		const material = new LineMaterial({
			vertexColors: true,
			worldUnits: false,
			dashed: false,
			alphaToCoverage: true,
			transparent: false,
		});
		material.toneMapped = false;
		// Distant wireframes fade into palette.haze.
		material.fog = true;

		const line = new LineSegments2(geometry, material);
		line.frustumCulled = false;
		// LineMaterial turns `linewidth` (px) into an NDC offset using
		// `resolution`, so both have to track the real drawing buffer. Set at
		// draw time — see the note on getDrawingBufferSize().
		line.onBeforeRender = (renderer) => {
			const size = getDrawingBufferSize(renderer);
			material.resolution.set(size.x, size.y);
			// `lineWidth` in the config is authored in pixels at 4K.
			material.linewidth = Math.max(
				0.55,
				config.lineWidth * (size.y / REFERENCE_HEIGHT),
			);
		};
		return line;
	}, [
		city,
		palette.buildingLine,
		palette.buildingGlow,
		config.heightRamp,
		config.lineOpacity,
		config.lineWidth,
	]);

	useEffect(() => {
		return () => {
			fills.geometry.dispose();
			(fills.material as THREE.Material).dispose();
			fills.dispose();
			edges.geometry.dispose();
			(edges.material as THREE.Material).dispose();
		};
	}, [fills, edges]);

	return (
		<group>
			<primitive object={fills} />
			<primitive object={edges} />
		</group>
	);
};

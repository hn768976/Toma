import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {cameraPose} from './cameraPath';
import {CONFIG} from './config';
import {contourLevels, marchContours, type HeightField} from './terrain';
import type {Theme} from './theme';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The contour landscape. Per frame:
 *   1. Sample the (animating) noise field on a camera-following grid window,
 *      quantized to the cell size so sample points are world-stable.
 *   2. Marching squares → iso-line segment soup for all 14 levels.
 *   3. Upload to a LineSegmentsGeometry rendered by LineSegments2 +
 *      LineMaterial (worldUnits) — plain THREE.Line ignores linewidth.
 *
 * Brightness is per-vertex: near lines use the bright contour colour, distant
 * ones fade into the horizon haze. Width attenuation comes free from
 * worldUnits. The terrain surface itself is never drawn.
 */
export const Contours: React.FC<{
  theme: Theme;
  heightField: HeightField;
}> = ({theme, heightField}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const size = useThree((s) => s.size);

  const levels = useMemo(() => contourLevels(), []);

  const {line, material} = useMemo(() => {
    const material = new LineMaterial({
      vertexColors: true,
      worldUnits: true,
      linewidth: CONFIG.contours.lineWidth,
    });
    const line = new LineSegments2(new LineSegmentsGeometry(), material);
    line.frustumCulled = false;
    return {line, material};
  }, []);

  const palette = useMemo(
    () => ({
      base: new THREE.Color(theme.contour),
      bright: new THREE.Color(theme.contourBright),
      haze: new THREE.Color(theme.bgHaze),
    }),
    [theme],
  );

  useLayoutEffect(() => {
    const {cell, xHalf, back, depth} = CONFIG.terrain;
    const {fadeStart, fadeEnd, nearBrightDist, farDimDist} = CONFIG.contours;

    const pose = cameraPose(frame / durationInFrames);
    const [camX, camY, camZ] = pose.position;
    const tNoise = (frame / fps) * CONFIG.terrain.breatheSpeed;

    // Grid window slides with the camera but is quantized to whole cells so
    // the sampled world positions — and therefore the contours — stay stable.
    const originX = -xHalf;
    const originZ = Math.floor((camZ - back) / cell) * cell;
    const nx = Math.floor((2 * xHalf) / cell) + 1;
    const nz = Math.floor(depth / cell) + 1;

    const heights = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      const z = originZ + j * cell;
      for (let i = 0; i < nx; i++) {
        heights[j * nx + i] = heightField(originX + i * cell, z, tNoise);
      }
    }

    const positions: number[] = [];
    const colors: number[] = [];

    const pushColor = (d: number) => {
      const bright = clamp01((d - nearBrightDist) / (farDimDist - nearBrightDist));
      const fog = smoothstep(fadeStart, fadeEnd, d);
      let r = palette.bright.r + (palette.base.r - palette.bright.r) * bright;
      let g = palette.bright.g + (palette.base.g - palette.bright.g) * bright;
      let b = palette.bright.b + (palette.base.b - palette.bright.b) * bright;
      r += (palette.haze.r * 0.9 - r) * fog;
      g += (palette.haze.g * 0.9 - g) * fog;
      b += (palette.haze.b * 0.9 - b) * fog;
      colors.push(r, g, b);
    };

    marchContours(
      heights,
      nx,
      nz,
      originX,
      originZ,
      cell,
      levels,
      (x1, y1, z1, x2, y2, z2) => {
        // Cull segments fully behind the camera or beyond the fade horizon.
        if (z1 < camZ - 1.5 && z2 < camZ - 1.5) return;
        const d1 = Math.hypot(x1 - camX, y1 - camY, z1 - camZ);
        const d2 = Math.hypot(x2 - camX, y2 - camY, z2 - camZ);
        if (Math.min(d1, d2) > fadeEnd) return;
        positions.push(x1, y1, z1, x2, y2, z2);
        pushColor(d1);
        pushColor(d2);
      },
    );

    // Fresh geometry per frame; disposing the old one frees its GPU buffers
    // (setPositions on a live geometry leaks the previous attribute buffers).
    const old = line.geometry as LineSegmentsGeometry;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors);
    line.geometry = geometry;
    old.dispose();

    material.resolution.set(size.width, size.height);
  }, [frame, durationInFrames, fps, heightField, levels, line, material, palette, size]);

  return <primitive object={line} />;
};

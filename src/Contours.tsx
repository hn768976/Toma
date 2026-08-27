import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import {random, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import {cameraPose} from './cameraPath';
import {CONFIG} from './config';
import {extractContours, windowLevels, type HeightField} from './terrain';
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

  const {line, material} = useMemo(() => {
    const material = new LineMaterial({
      vertexColors: true,
      worldUnits: false,
    });
    const line = new LineSegments2(new LineSegmentsGeometry(), material);
    line.frustumCulled = false;
    return {line, material};
  }, []);

  // The terrain floor: the same height grid drawn as a dark surface below the
  // lines — the "dark neon red" ground the ropes sit on. Geometry is
  // allocated once (the grid size never changes) and rewritten per frame.
  const floor = useMemo(() => {
    const {cell, xHalf, depth} = CONFIG.terrain;
    const nx = Math.floor((2 * xHalf) / cell) + 1;
    const nz = Math.floor(depth / cell) + 1;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(nx * nz * 3), 3),
    );
    const index: number[] = [];
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(
      geometry,
      // polygonOffset pushes the floor back in depth so the thin line quads
      // never z-fight it at grazing angles.
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
    );
    mesh.frustumCulled = false;
    return mesh;
  }, []);

  const palette = useMemo(
    () => ({
      base: new THREE.Color(theme.contour),
      bright: new THREE.Color(theme.contourBright),
      haze: new THREE.Color(theme.bgHaze),
      floorDeep: new THREE.Color(theme.floorDeep),
      floorHigh: new THREE.Color(theme.floorHigh),
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

    // Rewrite the floor surface from the same grid: dark red ground, tinted
    // by height for relief, fading into the horizon haze. Sits slightly
    // below the lines so they never z-fight.
    {
      const posAttr = floor.geometry.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = floor.geometry.getAttribute('color') as THREE.BufferAttribute;
      const {amp} = CONFIG.terrain;
      for (let j = 0; j < nz; j++) {
        const z = originZ + j * cell;
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i;
          const x = originX + i * cell;
          const h = heights[k];
          posAttr.setXYZ(k, x, h - 0.07, z);
          const relief = clamp01((h / amp + 1) / 2);
          const d = Math.hypot(x - camX, h - camY, z - camZ);
          // The floor stays dark far longer than the lines so the midfield
          // reads near-black red, only melting into haze at the horizon.
          const fog = smoothstep(fadeStart + 35, fadeEnd + 25, d);
          let r = palette.floorDeep.r + (palette.floorHigh.r - palette.floorDeep.r) * relief;
          let g = palette.floorDeep.g + (palette.floorHigh.g - palette.floorDeep.g) * relief;
          let b = palette.floorDeep.b + (palette.floorHigh.b - palette.floorDeep.b) * relief;
          r += (palette.haze.r * 0.85 - r) * fog;
          g += (palette.haze.g * 0.85 - g) * fog;
          b += (palette.haze.b * 0.85 - b) * fog;
          colAttr.setXYZ(k, r, g, b);
        }
      }
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
    }

    // The CONTOUR field: terrain noise plus the constant z-tilt. The tilt
    // makes it monotone-ish in z, so its iso-lines are evenly spaced open
    // ropes flowing across the frame — no loops, no plateau voids.
    const {tiltZ} = CONFIG.terrain;
    const contourHeights = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      const lift = tiltZ * (originZ + j * cell);
      for (let i = 0; i < nx; i++) {
        contourHeights[j * nx + i] = heights[j * nx + i] + lift;
      }
    }
    const levels = windowLevels(originZ, originZ + depth);

    // Bilinear sample of the TERRAIN height — ropes drape on the floor.
    const sampleH = (x: number, z: number) => {
      const fx = Math.min(nx - 1.001, Math.max(0, (x - originX) / cell));
      const fz = Math.min(nz - 1.001, Math.max(0, (z - originZ) / cell));
      const i = Math.floor(fx);
      const j = Math.floor(fz);
      const tx = fx - i;
      const tz = fz - j;
      const h0 = heights[j * nx + i] * (1 - tx) + heights[j * nx + i + 1] * tx;
      const h1 = heights[(j + 1) * nx + i] * (1 - tx) + heights[(j + 1) * nx + i + 1] * tx;
      return h0 * (1 - tz) + h1 * tz;
    };

    const positions: number[] = [];
    const colors: number[] = [];

    const pushColor = (d: number, shade: number) => {
      const bright = clamp01((d - nearBrightDist) / (farDimDist - nearBrightDist));
      const fog = smoothstep(fadeStart, fadeEnd, d);
      // HDR boost on near lines pushes them over the bloom threshold → neon.
      const glow = (CONFIG.contours.nearGlow - (CONFIG.contours.nearGlow - 1) * bright) * shade;
      let r = (palette.bright.r + (palette.base.r - palette.bright.r) * bright) * glow;
      let g = (palette.bright.g + (palette.base.g - palette.bright.g) * bright) * glow;
      let b = (palette.bright.b + (palette.base.b - palette.bright.b) * bright) * glow;
      // Fade toward a dimmed haze, not the full haze colour: at full haze the
      // packed far ropes merge into a solid wall instead of a soft horizon.
      r += (palette.haze.r * 0.5 * shade - r) * fog;
      g += (palette.haze.g * 0.5 * shade - g) * fog;
      b += (palette.haze.b * 0.5 * shade - b) * fog;
      colors.push(r, g, b);
    };

    const pushSegment = (shade: number, x1: number, z1: number, x2: number, z2: number) => {
      // Cull segments fully behind the camera or beyond the fade horizon.
      if (z1 < camZ - 1.5 && z2 < camZ - 1.5) return;
      // Lift well clear of the floor triangles: the floor renders as planar
      // triangles while this bilinear sample bends smoothly, and where the
      // two disagree a low-lifted rope dips underneath and reads as dashes.
      // The margin grows with distance — grazing angles amplify the error.
      const y1 = sampleH(x1, z1) + 0.13 + Math.max(0, z1 - camZ) * 0.002;
      const y2 = sampleH(x2, z2) + 0.13 + Math.max(0, z2 - camZ) * 0.002;
      const d1 = Math.hypot(x1 - camX, y1 - camY, z1 - camZ);
      const d2 = Math.hypot(x2 - camX, y2 - camY, z2 - camZ);
      if (Math.min(d1, d2) > fadeEnd) return;
      positions.push(x1, y1, z1, x2, y2, z2);
      pushColor(d1, shade);
      pushColor(d2, shade);
    };

    const perLevel = extractContours(
      contourHeights,
      nx,
      nz,
      originX,
      originZ,
      cell,
      levels,
      CONFIG.contours.smoothingPasses,
    );
    perLevel.forEach((polys, li) => {
      const L = levels[li];
      // Neighbouring ropes alternate between the full colour and darker
      // shades of it — the bright/dark mix reads as depth. Keyed to the
      // world-stable level index so a rope keeps its shade as the window slides.
      const {shadeMin, levelStep} = CONFIG.contours;
      const cycle = [1, 0.5, 0.85, shadeMin, 0.95, 0.62];
      const worldIdx = Math.round(L / levelStep);
      const shade = cycle[((worldIdx % cycle.length) + cycle.length) % cycle.length];
      for (const poly of polys) {
        const n = poly.pts.length / 2;
        // Only long, open flowing ropes: no closed shapes, no tiny stubs.
        if (CONFIG.contours.openRopesOnly && poly.closed) continue;
        if (n < CONFIG.contours.minPoints) continue;
        for (let i = 0; i < n - 1; i++) {
          pushSegment(shade, poly.pts[i * 2], poly.pts[i * 2 + 1], poly.pts[i * 2 + 2], poly.pts[i * 2 + 3]);
        }
        if (poly.closed && n > 2) {
          pushSegment(shade, poly.pts[(n - 1) * 2], poly.pts[(n - 1) * 2 + 1], poly.pts[0], poly.pts[1]);
        }
      }
    });

    // Fresh geometry per frame; disposing the old one frees its GPU buffers
    // (setPositions on a live geometry leaks the previous attribute buffers).
    const old = line.geometry as LineSegmentsGeometry;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(positions);
    geometry.setColors(colors);
    line.geometry = geometry;
    old.dispose();

    material.resolution.set(size.width, size.height);
    material.linewidth = Math.max(1, CONFIG.contours.lineWidthPx * (size.height / 2160));
  }, [frame, durationInFrames, fps, heightField, line, floor, material, palette, size]);

  return (
    <group>
      <primitive object={floor} />
      <primitive object={line} />
    </group>
  );
};

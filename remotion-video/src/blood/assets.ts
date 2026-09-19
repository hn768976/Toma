import * as THREE from "three";
import { smoothstep } from "./flow";
import { mulberry32 } from "./rng";

/**
 * Procedural geometry and textures for the bloodstream scenes.
 *
 * Everything here is cached at module level: the render page stays alive across
 * all frames of a Remotion render, so building a geometry or painting a canvas
 * texture happens once per browser tab rather than once per frame.
 */

const cache = new Map<string, unknown>();
const memo = <T>(key: string, create: () => T): T => {
  const hit = cache.get(key);
  if (hit) {
    return hit as T;
  }
  const value = create();
  cache.set(key, value);
  return value;
};

/**
 * Biconcave red blood cell profile (Evans & Fung, 1972).
 *
 * z(r) = ±0.5·sqrt(1-r²)·(c0 + c2·r² + c4·r⁴) for a unit radius, which gives the
 * dimpled doughnut-without-a-hole silhouette that reads instantly as an RBC.
 */
const EVANS_FUNG = { c0: 0.2072, c2: 2.0026, c4: -1.1228 };

const halfThickness = (r: number) => {
  const r2 = Math.min(r * r, 1);
  const { c0, c2, c4 } = EVANS_FUNG;
  return 0.5 * Math.sqrt(Math.max(0, 1 - r2)) * (c0 + c2 * r2 + c4 * r2 * r2);
};

/**
 * Lathes the RBC profile into a closed solid.
 *
 * `radialSegments` controls the silhouette smoothness (the expensive axis) and
 * `profileSegments` the dimple smoothness, so the background swarm can run a
 * much cheaper mesh than the foreground without changing shape.
 */
export const createRbcGeometry = (radialSegments: number, profileSegments: number) =>
  memo(`rbc-${radialSegments}-${profileSegments}`, () => {
    const points: THREE.Vector2[] = [];
    // Top surface, centre out to the rim.
    for (let i = 0; i <= profileSegments; i++) {
      const r = (i / profileSegments) * 0.985;
      points.push(new THREE.Vector2(r, halfThickness(r)));
    }
    // Rounded rim: a quarter turn from top to bottom so the edge catches light.
    const rimSegments = Math.max(3, Math.round(profileSegments / 3));
    const rimR = 0.985;
    const rimZ = halfThickness(rimR);
    for (let i = 1; i < rimSegments; i++) {
      const a = (i / rimSegments) * Math.PI;
      points.push(
        new THREE.Vector2(rimR + Math.sin(a) * 0.015, Math.cos(a) * rimZ),
      );
    }
    // Bottom surface, rim back in to the centre (mirror of the top).
    for (let i = profileSegments; i >= 0; i--) {
      const r = (i / profileSegments) * 0.985;
      points.push(new THREE.Vector2(r, -halfThickness(r)));
    }

    const geometry = new THREE.LatheGeometry(points, radialSegments);
    // Lathe spins around +Y; rotate so the disc face points down +Z (at camera).
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  });

const paint = (
  size: number,
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // No mip chain: three r186's WebGPU backend builds mipmaps with a texture
  // view descriptor that current Chromium rejects, and these are soft, organic
  // patterns where the chain buys little. Linear minification keeps the two
  // backends producing the same image.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 4;
  return texture;
};

/**
 * Soft radial falloff used for the core glow and for motes.
 *
 * Two profiles blended by `softness`: a steep power-law falloff that reads as a
 * point of light, and a flat disc with a soft edge that reads as an
 * out-of-focus highlight. A plain linear gradient — the obvious approach —
 * leaves ~20% brightness halfway out and paints a visible grey disc rather than
 * a glow.
 */
export const createGlowTexture = (softness: number) =>
  memo(`glow-${softness.toFixed(2)}`, () =>
    paint(256, (ctx, size) => {
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const point = Math.pow(Math.max(0, 1 - t), 4.5);
        const bokeh = 1 - smoothstep(0.58, 1, t);
        const alpha = point * (1 - softness) + bokeh * softness * 0.85;
        gradient.addColorStop(t, `rgba(255,255,255,${alpha.toFixed(4)})`);
      }
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }),
  );

/**
 * Emissive map for the cells: an even base glow plus optional gold speckles,
 * matching the granular cells in reference 3.
 */
export const createCellEmissiveTexture = (
  base: string,
  speckleColor: string,
  speckle: number,
) =>
  memo(`cell-emissive-${base}-${speckleColor}-${speckle.toFixed(2)}`, () =>
    paint(512, (ctx, size) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, size, size);
      if (speckle <= 0) {
        return;
      }
      // Seeded, never Math.random: Remotion renders frames across several
      // browser tabs in parallel, and an unseeded texture would differ per tab
      // and flicker in the finished file.
      const rng = mulberry32(0x5eed1);
      const count = Math.round(speckle * 9000);
      ctx.fillStyle = speckleColor;
      for (let i = 0; i < count; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = 0.45 + rng() * (0.7 + speckle * 0.9);
        ctx.globalAlpha = 0.12 + rng() * 0.45;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }),
  );

/** Mottled vessel wall: layered blotches plus fine capillary streaks. */
export const createVesselTexture = (
  color: string,
  mottle: number,
  seedKey: string,
) =>
  memo(`vessel-${color}-${mottle.toFixed(2)}-${seedKey}`, () =>
    paint(1024, (ctx, size) => {
      const rng = mulberry32(0x5eed2);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);

      // Large soft blotches give the wall its organic uneven tone.
      for (let i = 0; i < 260; i++) {
        const x = rng() * size;
        const y = rng() * size;
        const r = size * (0.02 + rng() * 0.12);
        const dark = rng() > 0.5;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        const a = mottle * (0.1 + rng() * 0.3);
        gradient.addColorStop(0, dark ? `rgba(0,0,0,${a})` : `rgba(255,190,170,${a * 0.7})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      // Capillary streaks running along the tube.
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 90; i++) {
        const x = rng() * size;
        ctx.strokeStyle = `rgba(255,150,140,${mottle * (0.04 + rng() * 0.1)})`;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        for (let y = 0; y <= size; y += size / 8) {
          ctx.lineTo(x + (rng() - 0.5) * size * 0.06, y);
        }
        ctx.stroke();
      }
    }),
  );

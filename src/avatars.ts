import * as THREE from 'three';
import {CONFIG} from './config';
import type {Theme} from './theme';

/**
 * Procedural avatar textures: a coloured circular background with a simple
 * head-and-shoulders silhouette. No photos, no faces — just the universal
 * "user" glyph. Drawn once to a canvas per variant and shared by every pin
 * using that variant (see Pins.tsx: one InstancedMesh per variant).
 *
 * Variant fills are derived from the theme's warm/cool avatar colours by
 * small lightness/hue nudges, so the palette stays a THEMES-only concern.
 */
const shade = (hex: string, lighten: number, hueShiftDeg: number): string => {
  const c = new THREE.Color(hex);
  const hsl = {h: 0, s: 0, l: 0};
  c.getHSL(hsl);
  c.setHSL(
    (hsl.h + hueShiftDeg / 360 + 1) % 1,
    hsl.s,
    Math.min(1, Math.max(0, hsl.l + lighten)),
  );
  return `#${c.getHexString()}`;
};

export type AvatarVariant = {
  texture: THREE.CanvasTexture;
  cool: boolean;
};

export const makeAvatarVariants = (theme: Theme): AvatarVariant[] => {
  const n = CONFIG.pins.avatarVariants;
  const coolCount = Math.max(1, Math.round(n * CONFIG.pins.coolFraction));
  const variants: AvatarVariant[] = [];

  for (let v = 0; v < n; v++) {
    const cool = v >= n - coolCount;
    const base = cool ? theme.avatarCool : theme.avatarWarm;
    // Deterministic per-variant nudge — pure function of the variant index.
    const fill = shade(base, ((v % 3) - 1) * 0.06, (v * 9) % 27 - 13);
    const silhouette = shade(theme.bgDeep, 0.08, 0);

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2;

    // Circular fill (the disc geometry is a circle, but keep the texture
    // clean-edged anyway).
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(cx, cx, cx, 0, Math.PI * 2);
    ctx.fill();

    // Head.
    ctx.fillStyle = silhouette;
    ctx.beginPath();
    ctx.arc(cx, size * 0.4, size * 0.17, 0, Math.PI * 2);
    ctx.fill();

    // Shoulders — a wide lozenge clipped by the disc bottom.
    ctx.beginPath();
    ctx.ellipse(cx, size * 0.85, size * 0.29, size * 0.21, 0, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    variants.push({texture, cool});
  }

  return variants;
};

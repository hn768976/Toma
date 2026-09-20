import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useCurrentFrame } from 'remotion';
import { NEON, type NeonKey } from '../lib/palette';
import { getTypeState } from '../lib/timing';
import { FONT_FAMILY, FONT_WEIGHT } from '../lib/useNeonFont';

/**
 * Placement of the word.
 *
 * The word runs along the board's +X grid axis, which is the axis that
 * projects down-and-to-the-right under this camera. Because the plane is
 * upright and only yawed onto that axis, the letters stay vertical while the
 * baseline follows the board -- exactly the reference behaviour.
 */
export const TEXT_TRANSFORM = {
  /** World position of the LEFT edge of the word, at its cap centre. */
  anchor: [-3.9, 5.85, 1.4] as [number, number, number],
  rotationY: 0,
  /** World height of a capital letter. */
  capHeight: 0.92,
};

/** The word is drawn into this canvas each frame, then mapped onto a plane. */
const TEX_H = 512;
const TEX_W = 4096;
/** Share of the texture height taken by the cap height of the glyphs. */
const CAP_RATIO = 0.4;
const PAD_X = 48;
/** Poppins cap height is ~0.70 em, so this converts cap height -> font size. */
const EM_PER_CAP = 1 / 0.7;

type Props = {
  word: string;
  variant: NeonKey;
};

export const NeonText: React.FC<Props> = ({ word, variant }) => {
  const frame = useCurrentFrame();
  const colours = NEON[variant];

  const { ctx, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TEX_W;
    c.height = TEX_H;
    const context = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { ctx: context, texture: tex };
  }, []);

  const fontPx = TEX_H * CAP_RATIO * EM_PER_CAP;
  const font = `${FONT_WEIGHT} ${fontPx}px ${FONT_FAMILY}`;

  const { visibleChars, caretVisible } = getTypeState(frame, word.length);
  const shown = word.slice(0, visibleChars);

  // The font is guaranteed loaded before this component mounts, so measuring
  // and drawing are both synchronous and identical on every render of a frame.
  let fullWidth = 0;
  if (ctx) {
    ctx.font = font;
    fullWidth = ctx.measureText(word).width;

    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const baseline = TEX_H * 0.5;
    const caretX = PAD_X + (shown.length ? ctx.measureText(shown).width : 0) + fontPx * 0.05;

    if (shown.length > 0) {
      // Build the halo first, then lay the crisp fill over the top.
      ctx.save();
      ctx.shadowColor = colours.glow;
      ctx.fillStyle = colours.fill;
      ctx.shadowBlur = 24;
      ctx.fillText(shown, PAD_X, baseline);
      ctx.shadowBlur = 10;
      ctx.fillText(shown, PAD_X, baseline);
      ctx.restore();

      ctx.fillStyle = colours.fill;
      ctx.fillText(shown, PAD_X, baseline);
    }

    if (caretVisible) {
      ctx.save();
      ctx.shadowColor = colours.glow;
      ctx.shadowBlur = 22;
      ctx.fillStyle = colours.fill;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(caretX, baseline - fontPx * 0.35, fontPx * 0.065, fontPx * 0.7);
      ctx.restore();
    }

    texture.needsUpdate = true;
  }

  // Crop the plane (and the texture sample) to just the part of the canvas the
  // word occupies, so the mesh is not a 4096px-wide mostly-empty slab.
  const usedPx = PAD_X * 2 + fullWidth + fontPx * 0.25;
  const fraction = Math.min(1, usedPx / TEX_W);
  texture.repeat.set(fraction, 1);
  texture.offset.set(0, 0);

  const worldH = TEXT_TRANSFORM.capHeight / CAP_RATIO;
  const fullPlaneW = worldH * (TEX_W / TEX_H);
  const planeW = fullPlaneW * fraction;
  /** Shift so the word's left edge -- not the padding -- sits on the anchor. */
  const leftPad = (PAD_X / TEX_W) * fullPlaneW;

  return (
    <group position={TEXT_TRANSFORM.anchor} rotation={[0, TEXT_TRANSFORM.rotationY, 0]}>
      <mesh position={[planeW / 2 - leftPad, 0, 0]}>
        <planeGeometry args={[planeW, worldH]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

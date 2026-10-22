import React, { useMemo } from "react";
import {
  AdditiveBlending,
  CanvasTexture,
  LinearMipmapLinearFilter,
  NormalBlending,
  SRGBColorSpace,
} from "three";

type Props = {
  /** Centre on the floor. */
  u: number;
  v: number;
  z: number;
  /** Physical size in floor units. */
  width: number;
  height: number;
  /** Texture density. */
  ppu: number;
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number) => void;
  /** Redraw only when this changes. */
  drawKey: string | number;
  opacity?: number;
  scale?: number;
  renderOrder?: number;
  additive?: boolean;
};

/**
 * A flat floor-aligned quad whose texture is painted with Canvas 2D.
 * Painting happens synchronously during render so the texture is ready
 * before @remotion/three advances the R3F frame.
 */
export const CanvasPlane: React.FC<Props> = ({
  u,
  v,
  z,
  width,
  height,
  ppu,
  draw,
  drawKey,
  opacity = 1,
  scale = 1,
  renderOrder = 0,
  additive = false,
}) => {
  const W = Math.min(4096, Math.ceil(width * ppu));
  const H = Math.min(4096, Math.ceil(height * ppu));
  const { canvas, texture } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    t.minFilter = LinearMipmapLinearFilter;
    return { canvas: c, texture: t };
  }, [W, H]);

  useMemo(() => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    draw(ctx, W, H);
    texture.needsUpdate = true;
    // `draw` is a fresh closure every render; drawKey captures what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, texture, W, H, drawKey]);

  if (opacity <= 0.001 || scale <= 0.001) return null;

  return (
    <mesh position={[u, -v, z]} scale={[scale, scale, 1]} renderOrder={renderOrder}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        fog={!additive}
        blending={additive ? AdditiveBlending : NormalBlending}
      />
    </mesh>
  );
};

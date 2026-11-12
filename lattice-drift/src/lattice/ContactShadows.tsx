import React, { useMemo } from "react";
import * as THREE from "three";
import { FIELD_RADIUS, POST_HEIGHT } from "./constants";
import { Piece } from "./pieces";

// The occlusion map is very soft, so a low-resolution bake is plenty.
const PX_PER_UNIT = 20;

// Separable box blur (3 passes ~ Gaussian) on a single-channel float image.
// Done in JS rather than with CanvasRenderingContext2D.filter, which is
// extremely slow on software-rendered headless Chrome.
const blur = (src: Float32Array, w: number, h: number, radius: number) => {
  const r = Math.max(1, Math.round(radius));
  const tmp = new Float32Array(w * h);
  let a = src;
  for (let pass = 0; pass < 3; pass++) {
    // Horizontal
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++)
        acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = acc / (2 * r + 1);
        const add = a[row + Math.min(w - 1, x + r + 1)];
        const sub = a[row + Math.max(0, x - r)];
        acc += add - sub;
      }
    }
    // Vertical
    const out = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++)
        acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / (2 * r + 1);
        const add = tmp[Math.min(h - 1, y + r + 1) * w + x];
        const sub = tmp[Math.max(0, y - r) * w + x];
        acc += add - sub;
      }
    }
    a = out;
  }
  return a;
};

// Baked ambient occlusion for the floor. Every static bar darkens the floor
// beneath it: post feet get soft round contact spots, floor rails a soft
// contact line, and raised beams a wide faint band (they block part of the
// sky). The field is periodic, so the baked map is too and the loop stays
// seamless. Built once into a canvas texture and laid over the floor.
export const ContactShadows: React.FC<{
  pieces: Piece[];
  tint: string;
  strength: number;
}> = ({ pieces, tint, strength }) => {
  const extent = FIELD_RADIUS + 4;
  const size = extent * 2;

  const texture = useMemo(() => {
    const W = size * PX_PER_UNIT;
    const scratch = document.createElement("canvas");
    scratch.width = W;
    scratch.height = W;
    const sctx = scratch.getContext("2d", { willReadFrequently: true })!;
    const toPx = (v: number) => (v + extent) * PX_PER_UNIT;
    const statics = pieces.filter((p) => !p.pulse); // no ghost shadows

    // Rasterise one layer as an opaque mask, blur it, return alpha * weight.
    const layer = (
      blurUnits: number,
      weight: number,
      draw: (ctx: CanvasRenderingContext2D, p: Piece) => void,
    ) => {
      sctx.clearRect(0, 0, W, W);
      sctx.fillStyle = "#000";
      sctx.strokeStyle = "#000";
      sctx.lineCap = "round";
      for (const p of statics) draw(sctx, p);
      const data = sctx.getImageData(0, 0, W, W).data;
      const mask = new Float32Array(W * W);
      for (let i = 0; i < W * W; i++) mask[i] = data[i * 4 + 3] / 255;
      const b = blur(mask, W, W, blurUnits * PX_PER_UNIT);
      for (let i = 0; i < b.length; i++) b[i] *= weight;
      return b;
    };

    const seg = (
      ctx: CanvasRenderingContext2D,
      p: Piece,
      s: Piece["segments"][number],
    ) => {
      ctx.beginPath();
      ctx.moveTo(toPx(p.origin[0] + s.from[0]), toPx(p.origin[2] + s.from[2]));
      ctx.lineTo(toPx(p.origin[0] + s.to[0]), toPx(p.origin[2] + s.to[2]));
      ctx.stroke();
    };

    const layers = [
      // Raised beams: broad, faint sky occlusion.
      layer(0.4, 0.17, (ctx, p) => {
        ctx.lineWidth = 0.75 * PX_PER_UNIT;
        for (const s of p.segments) {
          const raised = s.from[1] === s.to[1] && s.from[1] > POST_HEIGHT * 0.4;
          if (raised) seg(ctx, p, s);
        }
      }),
      // Floor rails: soft contact line.
      layer(0.14, 0.34, (ctx, p) => {
        ctx.lineWidth = 0.38 * PX_PER_UNIT;
        for (const s of p.segments) {
          if (s.from[1] === 0 && s.to[1] === 0) seg(ctx, p, s);
        }
      }),
      // Post feet: soft round contact spots.
      layer(0.12, 0.45, (ctx, p) => {
        for (const s of p.segments) {
          const vertical = s.from[0] === s.to[0] && s.from[2] === s.to[2];
          if (!vertical || Math.min(s.from[1], s.to[1]) > 0) continue;
          ctx.beginPath();
          ctx.arc(
            toPx(p.origin[0] + s.from[0]),
            toPx(p.origin[2] + s.from[2]),
            0.26 * PX_PER_UNIT,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }),
    ];

    // Combine layers like stacked translucent paint: 1 - prod(1 - a).
    const out = sctx.createImageData(W, W);
    const c = new THREE.Color(tint);
    const rgb = [c.r * 255, c.g * 255, c.b * 255].map((v) => Math.round(v));
    for (let i = 0; i < W * W; i++) {
      let keep = 1;
      for (const l of layers) keep *= 1 - Math.min(1, l[i]);
      out.data[i * 4] = rgb[0];
      out.data[i * 4 + 1] = rgb[1];
      out.data[i * 4 + 2] = rgb[2];
      out.data[i * 4 + 3] = Math.round((1 - keep) * 255);
    }
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = W;
    canvas.getContext("2d")!.putImageData(out, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }, [pieces, tint, extent, size]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.003, 0]}
      renderOrder={1}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={strength}
        depthWrite={false}
        toneMapped={false}
        fog
      />
    </mesh>
  );
};

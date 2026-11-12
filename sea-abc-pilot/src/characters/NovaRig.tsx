import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cancelRender, continueRender, delayRender } from 'remotion';
import { Application, CanvasSource, Container, Matrix, MeshRope, Point, Texture } from 'pixi.js';
import { chain, Mat, R, S, svgMat, T } from '../lib/motion';
import { FACE_ANCHOR, novaBodySvg, TEX_H, TEX_W } from './novaArt';
import { FaceState, NovaBackParts, NovaFrontParts } from './NovaFace';

export const ROPE_POINTS = 20;
const HALF = TEX_W / 2;
const ANCHOR_X = FACE_ANCHOR.x - HALF; // 268 in local coords
const WAVE_K = Math.PI * 2 * 0.85; // ~0.85 wavelengths along the body

export type NovaPose = {
  x: number;
  y: number;
  rot: number; // deg
  size: number;
  sq: number; // screen-space vertical stretch (sx = 1/sq) — volume preserving
  pivot: number; // squash pivot, px below body centre (screen space)
  amp: number; // swim wave amplitude at the tail (texture px)
  phase: number; // radians
  bend: number; // extra lag bend at the tail (texture px), for secondary motion
  face: FaceState;
  clipY?: number; // hide everything below this world y (emerging from the clam)
  visible?: boolean;
};

/** Centre-line displacement at texture-local x (head=+280, tail=-280). */
const ropeY = (x: number, p: NovaPose) => {
  const s = (HALF - x) / TEX_W; // 0 at head, 1 at tail
  const env = s * s; // amplitude grows from 0 at the head to max at the tail
  return p.amp * env * Math.sin(p.phase - WAVE_K * s) + p.bend * env;
};

export const novaMatrix = (p: NovaPose): Mat =>
  chain(T(p.x, p.y), T(0, p.pivot), S(1 / p.sq, p.sq), T(0, -p.pivot), R(p.rot), S(p.size));

/** Head frame: face layer is locked to it so the face never bends. */
export const headMatrix = (p: NovaPose): Mat => {
  const y0 = ropeY(ANCHOR_X, p);
  const y1 = ropeY(ANCHOR_X - 40, p);
  const ang = (Math.atan2(y0 - y1, 40) * 180) / Math.PI;
  return chain(novaMatrix(p), T(ANCHOR_X, y0), R(ang));
};

const rasterise = async (svg: string, scale: number) => {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(TEX_W * scale);
  canvas.height = Math.round(TEX_H * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const source = new CanvasSource({ resource: canvas, resolution: scale, autoGenerateMipmaps: true, scaleMode: 'linear' });
  return new Texture({ source });
};

type PixiState = { app: Application; holder: Container; rope: MeshRope; points: Point[] };

/**
 * World-space Nova (side view). Three stacked layers:
 *   back SVG (far fin) -> Pixi WebGL canvas (MeshRope body) -> front SVG (face/horn/near fin)
 * Pixi is created once, its ticker is stopped, and every Remotion frame we set
 * the rope from the pose and call app.render() synchronously.
 */
export const NovaRig: React.FC<{ pose: NovaPose; width: number; height: number; id: string }> = ({
  pose,
  width,
  height,
  id,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixi = useRef<PixiState | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender('Init PixiJS MeshRope'));

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    (async () => {
      await app.init({
        canvas: canvasRef.current!,
        width,
        height,
        resolution: 1.25,
        autoDensity: false,
        backgroundAlpha: 0,
        antialias: true,
        preference: 'webgl', // WebGL2; WebGPU is unreliable headless
        preserveDrawingBuffer: true,
        autoStart: false,
        sharedTicker: false,
      });
      app.ticker.stop();
      if (cancelled) return;
      const texture = await rasterise(novaBodySvg(), 1.5);
      const points: Point[] = [];
      for (let i = 0; i < ROPE_POINTS; i++) points.push(new Point(-HALF + (TEX_W * i) / (ROPE_POINTS - 1), 0));
      const rope = new MeshRope({ texture, points, textureScale: 0 });
      const holder = new Container();
      holder.addChild(rope);
      app.stage.addChild(holder);
      pixi.current = { app, holder, rope, points };
      setReady(true);
      continueRender(handle);
    })().catch((e) => cancelRender(e));
    return () => {
      cancelled = true;
      pixi.current = null;
      try {
        app.destroy({ removeView: false }, { children: true, texture: true, textureSource: true });
      } catch {
        // init may not have finished
      }
    };
  }, [handle, width, height]);

  const visible = pose.visible !== false;
  const m = novaMatrix(pose);
  const h = headMatrix(pose);

  useLayoutEffect(() => {
    const st = pixi.current;
    if (!ready || !st) return;
    st.holder.visible = visible;
    st.points.forEach((pt) => {
      pt.y = ropeY(pt.x, pose);
    });
    st.holder.setFromMatrix(new Matrix(m[0], m[1], m[2], m[3], m[4], m[5]));
    st.app.render();
  });

  const clip = pose.clipY !== undefined ? `inset(0px 0px ${height - pose.clipY}px 0px)` : undefined;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width, height, clipPath: clip, WebkitClipPath: clip }}>
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {visible ? (
          <g transform={svgMat(h)}>
            <NovaBackParts s={pose.face} />
          </g>
        ) : null}
      </svg>
      <canvas ref={canvasRef} style={{ position: 'absolute', left: 0, top: 0, width, height }} />
      <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {visible ? (
          <g transform={svgMat(h)}>
            <NovaFrontParts s={pose.face} idPrefix={id} />
          </g>
        ) : null}
      </svg>
    </div>
  );
};

export { ropeY, svgMat };

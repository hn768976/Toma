import {
  BlurFilter,
  CanvasSource,
  ColorMatrixFilter,
  Container,
  RenderTexture,
  Sprite,
  Texture,
  type Renderer,
} from "pixi.js";
import { mulberry32 } from "../gfx/random";

/**
 * Screen-space finishing pass, run in Pixi over the three.js output.
 *
 * Three things the references share that a raw PBR render will not give you:
 *
 *  1. Threshold bloom. The glowing traces only read as light sources, rather
 *     than as bright paint, once they bleed into their surroundings.
 *  2. Macro depth of field. These are shot like product photography: a narrow
 *     sharp band through the chip with the board falling off fast both ways.
 *     We approximate it with a focus band in screen space rather than a true
 *     circle-of-confusion pass — far cheaper, and visually equivalent here
 *     because the camera holds the chip at a near-constant screen height.
 *  3. A little vignette and grain, so the frame does not look synthetic.
 *
 * Every canvas-backed texture below is created once and refreshed with
 * `source.update()`. Re-running `Texture.from()` on the same canvas hands back
 * a cached texture, so destroying and recreating it per frame tears the live
 * texture out from under the renderer.
 */
export type OverlayOpts = {
  frame: number;
  focusY: number;
  bloomStrength: number;
  bloomThreshold: number;
  vignette: number;
  grain: number;
  dofStrength: number;
  focusTightness: number;
};

export type Overlay = {
  draw: (opts: OverlayOpts) => void;
  destroy: () => void;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export const createOverlay = (
  renderer: Renderer,
  source: HTMLCanvasElement,
  width: number,
  height: number,
): Overlay => {
  const W = width;
  const H = height;

  // The three.js canvas, re-uploaded every frame. CanvasSource (not the
  // abstract TextureSource) is what knows how to read an HTMLCanvasElement,
  // and the three renderer sets preserveDrawingBuffer so the pixels survive.
  const srcSource = new CanvasSource({ resource: source });
  const srcTex = new Texture({ source: srcSource });

  const stage = new Container();

  const base = new Sprite(srcTex);
  base.setSize(W, H);
  stage.addChild(base);

  // Blur passes run at reduced resolution and are upscaled afterwards.
  // Filtering a sprite that has already been scaled up makes every pass cost
  // full-resolution pixels, which on a software rasteriser dominates the whole
  // frame; doing the work small and stretching the result is both far cheaper
  // and gives a smoother falloff.
  const DOF_DOWN = 2;
  const BLOOM_DOWN = 4;

  // --- depth of field ---------------------------------------------------
  const maskCanvas = makeCanvas(4, 256);
  const maskSource = new CanvasSource({ resource: maskCanvas });
  const maskTex = new Texture({ source: maskSource });

  const dofRt = RenderTexture.create({
    width: Math.max(1, Math.ceil(W / DOF_DOWN)),
    height: Math.max(1, Math.ceil(H / DOF_DOWN)),
    antialias: false,
  });
  const dofBlur = new BlurFilter({ strength: 5, quality: 4 });
  const dofSmall = new Sprite(srcTex);
  dofSmall.setSize(W / DOF_DOWN, H / DOF_DOWN);
  dofSmall.filters = [dofBlur];
  const dofSmallHolder = new Container();
  dofSmallHolder.addChild(dofSmall);

  const dofSprite = new Sprite(dofRt);
  dofSprite.setSize(W, H);
  const dofMask = new Sprite(maskTex);
  dofMask.setSize(W, H);
  const dofContainer = new Container();
  dofContainer.addChild(dofSprite, dofMask);
  dofSprite.mask = dofMask;
  stage.addChild(dofContainer);

  let lastFocus = -999;
  let lastTight = -999;
  const updateMask = (focusY: number, tightness: number) => {
    if (
      Math.abs(focusY - lastFocus) < 0.002 &&
      Math.abs(tightness - lastTight) < 0.002
    ) {
      return;
    }
    lastFocus = focusY;
    lastTight = tightness;
    const ctx = maskCanvas.getContext("2d")!;
    const band = Math.max(0.04, tightness);
    ctx.clearRect(0, 0, 4, 256);
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      // 0 at the focus plane (fully sharp), ramping to 1 away from it.
      const a = Math.min(1, Math.pow(Math.abs(t - focusY) / band, 1.5));
      grad.addColorStop(t, `rgba(255,255,255,${a.toFixed(4)})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    maskSource.update();
  };

  // --- bloom ------------------------------------------------------------
  const bw = Math.max(1, Math.ceil(W / BLOOM_DOWN));
  const bh = Math.max(1, Math.ceil(H / BLOOM_DOWN));
  const bright = new ColorMatrixFilter();
  const brightRt = RenderTexture.create({ width: bw, height: bh, antialias: false });
  const nearRt = RenderTexture.create({ width: bw, height: bh, antialias: false });
  const farRt = RenderTexture.create({
    width: Math.max(1, bw >> 1),
    height: Math.max(1, bh >> 1),
    antialias: false,
  });

  const brightSprite = new Sprite(srcTex);
  brightSprite.setSize(bw, bh);
  brightSprite.filters = [bright];
  const brightHolder = new Container();
  brightHolder.addChild(brightSprite);

  // Two radii, both blurred small: a tight core glow plus a wide halo.
  const nearSmall = new Sprite(brightRt);
  nearSmall.setSize(bw, bh);
  nearSmall.filters = [new BlurFilter({ strength: 3, quality: 3 })];
  const nearHolder = new Container();
  nearHolder.addChild(nearSmall);

  const farSmall = new Sprite(brightRt);
  farSmall.setSize(bw >> 1, bh >> 1);
  farSmall.filters = [new BlurFilter({ strength: 5, quality: 3 })];
  const farHolder = new Container();
  farHolder.addChild(farSmall);

  const bloomNear = new Sprite(nearRt);
  bloomNear.setSize(W, H);
  bloomNear.blendMode = "add";
  const bloomFar = new Sprite(farRt);
  bloomFar.setSize(W, H);
  bloomFar.blendMode = "add";
  stage.addChild(bloomFar, bloomNear);

  // --- vignette ---------------------------------------------------------
  const vigCanvas = makeCanvas(512, 512);
  const vigSource = new CanvasSource({ resource: vigCanvas });
  const vigTex = new Texture({ source: vigSource });
  const vig = new Sprite(vigTex);
  vig.blendMode = "multiply";
  vig.setSize(W, H);
  stage.addChild(vig);

  let vigBakedFor = -1;
  const updateVignette = (amount: number) => {
    if (amount === vigBakedFor) return;
    vigBakedFor = amount;
    const ctx = vigCanvas.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 256, 60, 256, 256, 330);
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      // Late, accelerating falloff keeps the centre of frame untouched.
      const v = Math.max(0, Math.round(255 * (1 - Math.pow(t, 2.6) * amount)));
      g.addColorStop(t, `rgb(${v},${v},${v})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    vigSource.update();
  };

  // --- grain ------------------------------------------------------------
  const grainTex = (() => {
    const N = 256;
    const c = makeCanvas(N, N);
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(N, N);
    const rng = mulberry32(20240917);
    for (let i = 0; i < N * N; i++) {
      // Centre the noise on mid-grey so "add" does not just brighten.
      const v = Math.floor(120 + (rng() - 0.5) * 220);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return Texture.from(c);
  })();
  const grain = new Sprite(grainTex);
  grain.blendMode = "overlay";
  grain.setSize(W + 96, H + 96);
  stage.addChild(grain);

  return {
    draw: (o) => {
      srcSource.update();

      // Bright pass: subtract the threshold and clamp at zero, with no gain.
      // Renormalising by 1/(1-threshold) here multiplies highlights by ~4x,
      // which the old full-resolution blur happened to dilute; blurring at a
      // quarter resolution preserves that energy and washes out the frame.
      const off = -o.bloomThreshold;
      bright.matrix = [
        1, 0, 0, 0, off,
        0, 1, 0, 0, off,
        0, 0, 1, 0, off,
        0, 0, 0, 1, 0,
      ];
      renderer.render({ container: brightHolder, target: brightRt, clear: true });
      renderer.render({ container: nearHolder, target: nearRt, clear: true });
      renderer.render({ container: farHolder, target: farRt, clear: true });
      bloomNear.alpha = Math.min(1, o.bloomStrength * 0.95);
      bloomFar.alpha = Math.min(1, o.bloomStrength * 0.75);

      updateMask(o.focusY, o.focusTightness);
      dofBlur.strength = (4.5 * o.dofStrength) / DOF_DOWN;
      renderer.render({ container: dofSmallHolder, target: dofRt, clear: true });
      dofContainer.alpha = Math.min(1, o.dofStrength);

      updateVignette(o.vignette);
      vig.visible = o.vignette > 0.001;

      grain.alpha = o.grain;
      grain.position.set(-((o.frame * 137) % 96), -((o.frame * 79) % 96));

      renderer.render({ container: stage, clear: true });
    },
    destroy: () => {
      brightRt.destroy(true);
      nearRt.destroy(true);
      farRt.destroy(true);
      dofRt.destroy(true);
      stage.destroy({ children: true });
      srcTex.destroy(true);
      maskTex.destroy(true);
      vigTex.destroy(true);
    },
  };
};

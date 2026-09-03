import {
  flapCorners,
  makeCurl,
  pageDistance,
  type Curl,
} from "./curl";
import type {PageBitmap} from "./monthPage";

export type Rect = {x: number; y: number; width: number; height: number};

type RenderArgs = {
  ctx: CanvasRenderingContext2D;
  card: Rect;
  /** The page being peeled away. */
  top: PageBitmap;
  /** The page revealed underneath — fully drawn from the first flip frame. */
  next: PageBitmap;
  /** 0 = flat page, 1 = fully peeled. */
  progress: number;
};

/** Direction the key light comes from, in page space (z points at the viewer). */
const LIGHT = (() => {
  const [x, y, z] = [-0.3, -0.45, 0.84];
  const len = Math.hypot(x, y, z);
  return {x: x / len, y: y / len, z: z / len};
})();

/** How far a shadow slides per unit of occluder height. */
const SHADOW_SLIDE_X = -LIGHT.x / LIGHT.z;
const SHADOW_SLIDE_Y = -LIGHT.y / LIGHT.z;

/** Cast-shadow strength away from the curl line, and the extra bite at it. */
const SHADOW_AMBIENT = 0.09;
const SHADOW_CONTACT = 0.32;

/** Flap greys (#9a9a9a to #ffffff), as linear multipliers of white. */
const FLAP_DARK = 0x9a / 0xff;
const FLAP_LIGHT = 1;
/** Length of the contact gradient, as a multiple of the local roll radius. */
const FLAP_GRADIENT_SPAN = 0.6;
/** How dark the printed side gets as it turns away from the light. */
const FRONT_SHADE_FLOOR = 0.46;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Smooth 0..1 coverage from a signed distance (negative = inside). */
const coverageOf = (distance: number, feather: number) => {
  const e = clamp01(0.5 - distance / (2 * feather));
  return e * e * (3 - 2 * e);
};

/** Bilinear sample from a page raster, in page-space coordinates. */
const samplePage = (
  page: PageBitmap,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
  out: {r: number; g: number; b: number},
) => {
  const px = x * scaleX - 0.5;
  const py = y * scaleY - 0.5;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;
  const maxX = page.width - 1;
  const maxY = page.height - 1;

  const cx0 = x0 < 0 ? 0 : x0 > maxX ? maxX : x0;
  const cy0 = y0 < 0 ? 0 : y0 > maxY ? maxY : y0;
  const cx1 = x0 + 1 < 0 ? 0 : x0 + 1 > maxX ? maxX : x0 + 1;
  const cy1 = y0 + 1 < 0 ? 0 : y0 + 1 > maxY ? maxY : y0 + 1;

  const d = page.data;
  const w = page.width;
  const i00 = (cy0 * w + cx0) * 4;
  const i10 = (cy0 * w + cx1) * 4;
  const i01 = (cy1 * w + cx0) * 4;
  const i11 = (cy1 * w + cx1) * 4;

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  out.r = d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11;
  out.g = d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11;
  out.b = d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11;
};

/** Source-over composite of a straight-alpha colour into an RGBA buffer. */
const compositeOver = (
  data: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number,
) => {
  const dstA = data[i + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) {
    data[i + 3] = 0;
    return;
  }
  const k = (dstA * (1 - a)) / outA;
  data[i] = (r * a) / outA + data[i] * k;
  data[i + 1] = (g * a) / outA + data[i + 1] * k;
  data[i + 2] = (b * a) / outA + data[i + 2] * k;
  data[i + 3] = outA * 255;
};

/**
 * The reverse of the sheet, as a single gradient keyed on how far the surface
 * has pulled away from the fold. The roll and the flat flap beyond it share
 * it, so they meet without a seam, and it darkens into the contact crease the
 * way the reference does rather than following the key light.
 */
const flapGrey = (distanceFromFold: number, radius: number) => {
  const occlusion = Math.exp(
    -Math.abs(distanceFromFold) / (FLAP_GRADIENT_SPAN * radius),
  );
  return FLAP_LIGHT - (FLAP_LIGHT - FLAP_DARK) * occlusion;
};

/** Clips to the half of the card that has not been peeled yet (s >= t). */
const clipToFlatSide = (ctx: CanvasRenderingContext2D, card: Rect, curl: Curl) => {
  const far = (card.width + card.height) * 2;
  const ox = card.x + curl.t * curl.dx;
  const oy = card.y + curl.t * curl.dy;
  ctx.beginPath();
  ctx.moveTo(ox + curl.nx * far, oy + curl.ny * far);
  ctx.lineTo(ox - curl.nx * far, oy - curl.ny * far);
  ctx.lineTo(ox - curl.nx * far + curl.dx * far, oy - curl.ny * far + curl.dy * far);
  ctx.lineTo(ox + curl.nx * far + curl.dx * far, oy + curl.ny * far + curl.dy * far);
  ctx.closePath();
  ctx.clip();
};

export const renderCard = ({ctx, card, top, next, progress}: RenderArgs) => {
  const {width: cw, height: ch} = ctx.canvas;
  ctx.clearRect(0, 0, cw, ch);

  // The revealed month is there in full from the first frame of the flip; it
  // is uncovered, never faded in.
  ctx.drawImage(next.canvas, card.x, card.y, card.width, card.height);

  if (progress <= 0) {
    ctx.drawImage(top.canvas, card.x, card.y, card.width, card.height);
    return;
  }

  const curl = makeCurl(card.width, card.height, progress);

  if (progress < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(card.x, card.y, card.width, card.height);
    ctx.clip();
    clipToFlatSide(ctx, card, curl);
    ctx.drawImage(top.canvas, card.x, card.y, card.width, card.height);
    ctx.restore();
  }

  // --- Dirty region: the card, plus wherever the flap and its shadow reach --
  const maxRadius = curl.radiusAt(-curl.width * curl.dy);
  const pad = maxRadius * 2 * Math.max(SHADOW_SLIDE_X, SHADOW_SLIDE_Y) + maxRadius + 8;
  let minX = card.x;
  let minY = card.y;
  let maxX = card.x + card.width;
  let maxY = card.y + card.height;
  for (const corner of flapCorners(curl)) {
    minX = Math.min(minX, card.x + corner.x);
    minY = Math.min(minY, card.y + corner.y);
    maxX = Math.max(maxX, card.x + corner.x);
    maxY = Math.max(maxY, card.y + corner.y);
  }
  const x0 = Math.max(0, Math.floor(minX - pad));
  const y0 = Math.max(0, Math.floor(minY - pad));
  const x1 = Math.min(cw, Math.ceil(maxX + pad));
  const y1 = Math.min(ch, Math.ceil(maxY + pad));
  if (x1 <= x0 || y1 <= y0) {
    return;
  }

  const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
  const data = region.data;
  const regionWidth = x1 - x0;

  const {dx, dy, nx, ny, t, width: pw, height: phh} = curl;
  const scaleX = top.width / pw;
  const scaleY = top.height / phh;
  const sample = {r: 0, g: 0, b: 0};
  const feather = 0.7;

  for (let py = y0; py < y1; py++) {
    const qyBase = py + 0.5 - card.y;
    const rowOffset = (py - y0) * regionWidth;

    for (let px = x0; px < x1; px++) {
      const qx = px + 0.5 - card.x;
      const qy = qyBase;

      const s = qx * dx + qy * dy;
      const v = qx * nx + qy * ny;
      const radius = curl.radiusAt(v);
      const i = (rowOffset + (px - x0)) * 4;

      // ---- Shadow cast by the raised flap ------------------------------
      const height = 2 * radius;
      const shadowV = v - (SHADOW_SLIDE_X * height * nx + SHADOW_SLIDE_Y * height * ny);
      const shadowS = s - (SHADOW_SLIDE_X * height * dx + SHADOW_SLIDE_Y * height * dy);
      const shadowRadius = curl.radiusAt(shadowV);
      const shadowSrcS = 2 * t - Math.PI * shadowRadius - shadowS;
      const shadowX = shadowSrcS * dx + shadowV * nx;
      const shadowY = shadowSrcS * dy + shadowV * ny;
      // The flap only exists ahead of the fold line. Without that gate the
      // mirrored source lands back on the page for points behind the corner
      // and casts a shadow from paper that is not there.
      const onFlapSide = coverageOf(t - shadowS, Math.max(feather, 0.06 * radius));
      // The penumbra widens with the flap's height, but only so far: an
      // unbounded feather smears a flat haze across the whole card.
      const shadowCover =
        onFlapSide *
        coverageOf(
          pageDistance(shadowX, shadowY, pw, phh),
          Math.max(feather, Math.min(0.35 * height, 0.13 * pw)),
        );

      // The roll touches down along the fold line, so there is a tight dark
      // line there even where the raised flap does not reach.
      const foldCover = coverageOf(
        pageDistance(t * dx + v * nx, t * dy + v * ny, pw, phh),
        Math.max(feather, 0.3 * radius),
      );
      // Two-sided falloff. Without one, the fold term — which depends only on
      // v — would flood the entire half-plane behind the curl line.
      const gap = s - t;
      const contact =
        gap >= 0
          ? Math.exp(-gap / Math.max(1, 0.75 * radius))
          : Math.exp(gap / Math.max(1, 0.3 * radius));
      const amount = Math.max(
        shadowCover * (SHADOW_AMBIENT + 0.5 * SHADOW_CONTACT * contact),
        foldCover * SHADOW_CONTACT * contact,
      );
      if (amount > 0.002) {
        compositeOver(data, i, 0, 0, 0, Math.min(0.92, amount));
      }

      // ---- The curl itself, painted back to front ----------------------
      if (s <= t && s >= t - radius) {
        const sinAlpha = (t - s) / radius;
        const alpha = Math.asin(sinAlpha > 1 ? 1 : sinAlpha);

        // Printed side, still facing up: alpha in [0, pi/2].
        const srcFront = t - radius * alpha;
        const fx = srcFront * dx + v * nx;
        const fy = srcFront * dy + v * ny;
        const frontCover = coverageOf(pageDistance(fx, fy, pw, phh), feather);
        if (frontCover > 0.002) {
          const nz = Math.cos(alpha);
          const nxy = Math.sin(alpha);
          const lambert =
            (nxy * dx * LIGHT.x + nxy * dy * LIGHT.y + nz * LIGHT.z) / LIGHT.z;
          const shade =
            FRONT_SHADE_FLOOR + (1 - FRONT_SHADE_FLOOR) * clamp01(lambert);
          samplePage(top, fx, fy, scaleX, scaleY, sample);
          compositeOver(
            data,
            i,
            sample.r * shade,
            sample.g * shade,
            sample.b * shade,
            frontCover,
          );
        }

        // Reverse side, over the top of the roll: alpha in [pi/2, pi].
        const beta = Math.PI - alpha;
        const srcBack = t - radius * beta;
        const bx = srcBack * dx + v * nx;
        const by = srcBack * dy + v * ny;
        const backCover = coverageOf(pageDistance(bx, by, pw, phh), feather);
        if (backCover > 0.002) {
          const grey = 255 * flapGrey(t - s, radius);
          compositeOver(data, i, grey, grey, grey, backCover);
        }
      } else if (s >= t) {
        // Past the half turn the sheet lies flat at 2R, reverse side up.
        const srcFlap = 2 * t - Math.PI * radius - s;
        const lx = srcFlap * dx + v * nx;
        const ly = srcFlap * dy + v * ny;
        const distance = pageDistance(lx, ly, pw, phh);
        const cover = coverageOf(distance, feather);
        if (cover > 0.002) {
          const grey = 255 * flapGrey(s - t, radius);
          compositeOver(data, i, grey, grey, grey, cover);
        }
      }
    }
  }

  ctx.putImageData(region, x0, y0);
};

import { hash01 } from "./hash";
import { MassField } from "./mass-field";
import { Streaks } from "./streaks";
import { REFERENCE_WIDTH } from "./constants";

export type StaticVariant = "mono" | "colour";

const TAU = Math.PI * 2;

/* ---- levels -------------------------------------------------------------
 * Speckle spans #0a0a0c .. #f2f2f4. Nothing in the frame ever reaches pure
 * black or pure white; it is a noisy mid-tone field throughout. Blue sits two
 * points higher at both ends, which is where the field's faint coolness comes
 * from — the fringing supplies the rest of the colour.
 * ---------------------------------------------------------------------- */
const LO = [10, 10, 12];
const SPAN = [232, 232, 232];

/**
 * Speckle contrast. Uniform noise stretched past the ends of the range, so a
 * good fraction of pixels land on the floor or the ceiling. That crunch is
 * what separates analogue snow from a flat grey fizz — but the floor and
 * ceiling are #0a0a0c and #f2f2f4, never pure black or white.
 */
const SPECKLE_CONTRAST = 2.0;
/** Extra crunch inside a smear, where dashes read as hard dark and light. */
const SPECKLE_CONTRAST_STREAK = 0.45;
/**
 * Tonal masses bias the speckle *before* the contrast stretch, so they
 * modulate the density of dark and light pixels rather than washing a flat
 * level over them. Tuned so the local mean swings by about +/-25%.
 */
const MASS_GAIN = 0.28;
const MASS_GAIN_COLOUR = 0.3;

const SCANLINE_COUNT = 540;
const SCANLINE_DEPTH = 0.06;

const ROLL_WRAPS = 2;
const ROLL_HALF_WIDTH = 0.17;
/** Biases the speckle like a tonal mass rather than multiplying the output,
 *  so the band lifts the density instead of clipping the highlights flat. */
const ROLL_GAIN = 0.05;

const FRINGE_BASE = 0.16;
const FRINGE_STREAK = 0.34;
const TINT_GAIN = 1.1;

/** Pink #e8b0b8 and cyan #a8d8e0, divided through by their own luma so the
 *  tint shifts hue without lifting or dropping brightness. */
const PINK = [1.199, 0.909, 0.951];
const CYAN = [0.83, 1.067, 1.106];

/**
 * V2 keeps V1's luminance exactly — same speckle, same masses, same crunch —
 * and adds a colour-difference layer on top. Fully saturated random RGB reads
 * as digital confetti, so the chroma is cut to 60%.
 */
const COLOUR_SATURATION = 0.6;
const CHROMA_AMP = 0.9;
/**
 * Analogue colour carries far less bandwidth than luminance, so the chroma is
 * sampled in short horizontal blocks rather than per pixel. That is both
 * truer to a detuned colour set and the reason the colour survives being
 * viewed small — per-pixel RGB averages back to grey at any distance.
 */
const CHROMA_BLOCK_X = 6;
const CHROMA_BLOCK_Y = 2;

const CHANNEL_SEED = [0, 104729, 224737];
const CHROMA_SEED = [316993, 452279, 611953];

export class StaticRenderer {
  private readonly mass: MassField;
  private readonly streaks: Streaks;
  private readonly massRow: Float32Array;
  private readonly rowR: Float32Array;
  private readonly rowG: Float32Array;
  private readonly rowB: Float32Array;
  private readonly scan: Float32Array;
  private readonly roll: Float32Array;
  private readonly fringe: Float32Array;
  private readonly pad: number;
  private readonly padded: number;
  private readonly fringeBasePx: number;
  private readonly fringeStreakPx: number;
  private readonly chromaBlockX: number;
  private readonly chromaBlockY: number;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly loopLength: number,
    private readonly variant: StaticVariant,
  ) {
    this.mass = new MassField(width, height);
    this.streaks = new Streaks(width, height, loopLength);

    const scale = Math.max(1, Math.round(width / REFERENCE_WIDTH));
    this.fringeBasePx = scale;
    this.fringeStreakPx = scale * 2;
    this.chromaBlockX = CHROMA_BLOCK_X * scale;
    this.chromaBlockY = CHROMA_BLOCK_Y * scale;
    this.pad = this.fringeStreakPx;
    this.padded = width + this.pad * 2;

    this.massRow = new Float32Array(width);
    this.rowG = new Float32Array(this.padded);
    this.rowR =
      variant === "colour" ? new Float32Array(this.padded) : this.rowG;
    this.rowB =
      variant === "colour" ? new Float32Array(this.padded) : this.rowG;

    this.scan = new Float32Array(height);
    this.roll = new Float32Array(height);
    this.fringe = new Float32Array(height);

    const period = Math.max(2, Math.round(height / SCANLINE_COUNT));
    for (let y = 0; y < height; y++) {
      const s = 0.5 - 0.5 * Math.cos((TAU * y) / period);
      this.scan[y] = 1 - SCANLINE_DEPTH * s;
    }
  }

  /**
   * Fills one padded scanline of a single channel with base speckle, the
   * drifting mass offset, and the streak smear where a band covers this row.
   */
  private fillRow(
    out: Float32Array,
    y: number,
    frame: number,
    seed: number,
    bias: number,
  ): void {
    const { pad, padded, width, massRow } = this;
    const gain = this.streaks.rows.gain[y];
    const run = this.streaks.rows.run[y];
    const offset = this.streaks.rows.offset[y];
    const z1 = frame + seed;

    const smearing = gain > 0 && run > 1;
    const invRun = 1 / run;
    const invSeg = 1 / (run * 2.5);
    const segZ = frame + 5501;
    // A band never smears its whole width — leaving segments intact is what
    // turns a solid smear into the broken dashes the reference shows.
    const segThreshold = 0.55 * gain;
    const streakContrast = SPECKLE_CONTRAST * (1 + SPECKLE_CONTRAST_STREAK * gain);

    for (let i = 0; i < padded; i++) {
      const x = i - pad;
      let sx = x;
      let contrast = SPECKLE_CONTRAST;

      if (smearing) {
        const shifted = x + offset;
        const seg = Math.floor(shifted * invSeg);
        const h = hash01(seg, y, segZ);
        if (h < segThreshold) {
          // Each smeared segment slips by a different amount, so neighbouring
          // segments break rather than joining into one ruled line.
          const slip = (h / segThreshold - 0.5) * run * 7;
          sx = Math.floor((shifted + slip) * invRun) * run;
          contrast = streakContrast;
        }
      }

      const n = hash01(sx, y, z1);
      const m = massRow[x < 0 ? 0 : x >= width ? width - 1 : x] + bias;
      const v = (n - 0.5 + m) * contrast + 0.5;
      out[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }

  /**
   * Splits the luminance row already in `rowG` into three channels by adding
   * a zero-mean colour difference, so the chroma tints the pixel without
   * moving its brightness.
   */
  private applyChroma(y: number, frame: number): void {
    const { rowR, rowG, rowB, padded, pad, chromaBlockX, chromaBlockY } = this;
    const by = Math.floor(y / chromaBlockY);
    const amp = CHROMA_AMP * COLOUR_SATURATION;
    const z0 = frame + CHROMA_SEED[0];
    const z1 = frame + CHROMA_SEED[1];
    const z2 = frame + CHROMA_SEED[2];

    for (let i = 0; i < padded; i++) {
      const bx = Math.floor((i - pad) / chromaBlockX);
      const d0 = hash01(bx, by, z0);
      const d1 = hash01(bx, by, z1);
      const d2 = hash01(bx, by, z2);
      const mean = (d0 + d1 + d2) / 3;
      const l = rowG[i];

      const r = l + (d0 - mean) * amp;
      const g = l + (d1 - mean) * amp;
      const b = l + (d2 - mean) * amp;
      rowR[i] = r < 0 ? 0 : r > 1 ? 1 : r;
      rowG[i] = g < 0 ? 0 : g > 1 ? 1 : g;
      rowB[i] = b < 0 ? 0 : b > 1 ? 1 : b;
    }
  }

  /**
   * @param frame absolute frame; reduced modulo the loop length here so the
   * last frame of the loop is bit-identical to the first.
   */
  render(frame: number, data: Uint8ClampedArray): void {
    const {
      width,
      height,
      loopLength,
      variant,
      mass,
      streaks,
      massRow,
      rowR,
      rowG,
      rowB,
      scan,
      roll,
      fringe,
      pad,
    } = this;

    const f = ((frame % loopLength) + loopLength) % loopLength;
    const t = f / loopLength;

    mass.build(t, variant === "colour" ? MASS_GAIN_COLOUR : MASS_GAIN);
    streaks.build(f);

    // Roll bar: a wide band of slightly raised brightness drifting down the
    // frame, wrapping a whole number of times over the loop.
    const centre = (t * ROLL_WRAPS) % 1;
    for (let y = 0; y < height; y++) {
      let d = (y + 0.5) / height - centre;
      if (d > 0.5) d -= 1;
      else if (d < -0.5) d += 1;
      const a = Math.abs(d);
      const w =
        a < ROLL_HALF_WIDTH
          ? 0.5 * (1 + Math.cos((Math.PI * a) / ROLL_HALF_WIDTH))
          : 0;
      roll[y] = ROLL_GAIN * w;

      const g = streaks.rows.gain[y];
      const fr =
        FRINGE_BASE * (0.25 + 1.5 * hash01(y, 77, f)) + g * FRINGE_STREAK;
      fringe[y] = fr > 1 ? 1 : fr;
    }

    const colour = variant === "colour";
    let p = 0;

    for (let y = 0; y < height; y++) {
      mass.expandRow(y, massRow);

      const bias = roll[y];
      this.fillRow(rowG, y, f, CHANNEL_SEED[0], bias);
      if (colour) {
        this.applyChroma(y, f);
      }

      const fr = fringe[y];
      const dx =
        streaks.rows.gain[y] > 0 ? this.fringeStreakPx : this.fringeBasePx;
      const k = scan[y];

      for (let x = 0; x < width; x++) {
        const i = x + pad;
        const g0 = rowG[i];
        const r0 = rowR[i];
        const b0 = rowB[i];

        // Chromatic fringing: a 1-2px channel offset, felt rather than seen,
        // strongest where a streak band is smearing the line.
        const rs = rowR[i + dx];
        const bs = rowB[i - dx];
        let r = r0 + fr * (rs - r0);
        let g = g0;
        let b = b0 + fr * (bs - b0);

        // Hue: the offset's own sign decides pink or cyan.
        const d = (rowG[i + dx] - rowG[i - dx]) * fr;
        let a = Math.abs(d) * TINT_GAIN;
        if (a > 1) a = 1;
        if (a > 0) {
          const tint = d > 0 ? PINK : CYAN;
          r *= 1 + (tint[0] - 1) * a;
          g *= 1 + (tint[1] - 1) * a;
          b *= 1 + (tint[2] - 1) * a;
        }

        // The tint and the offsets can both overshoot; clamping here is what
        // keeps the frame inside #0a0a0c .. #f2f2f4 at every pixel.
        r *= k;
        g *= k;
        b *= k;
        data[p] = LO[0] + (r < 0 ? 0 : r > 1 ? 1 : r) * SPAN[0];
        data[p + 1] = LO[1] + (g < 0 ? 0 : g > 1 ? 1 : g) * SPAN[1];
        data[p + 2] = LO[2] + (b < 0 ? 0 : b > 1 ? 1 : b) * SPAN[2];
        data[p + 3] = 255;
        p += 4;
      }
    }
  }
}

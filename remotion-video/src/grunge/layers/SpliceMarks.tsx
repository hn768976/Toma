import React, { useLayoutEffect, useMemo } from "react";
import { rgba } from "../lib/color";
import type { FlickerEvent } from "../lib/flickerSchedule";
import { scheduleFlickerEvents } from "../lib/flickerSchedule";
import { rndRange, rndSign } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings } from "../variants";

/**
 * The join between two pieces of film passing the gate.
 *
 * A splice is two things at once: the tape or cement joint flares bright as it
 * crosses the lamp, and the overlap of the two strips reads as a dark band
 * immediately beside it. One without the other looks like a lighting glitch;
 * together they are unmistakably a splice.
 *
 * They last two or three frames and sweep vertically across them, because the
 * film is moving while the shutter is open. Scheduling with maxConcurrent 1
 * and long gaps gives exactly the "one every 150-260 frames" cadence, with no
 * event straddling the loop point.
 */

type Splice = {
  event: FlickerEvent;
  /** Where the bar starts, in fractions of frame height. */
  from: number;
  /**
   * How far it sweeps over the event's life. Chosen so the bar stays inside
   * the frame for every frame of the event rather than exiting after the
   * first one.
   */
  travel: number;
  barHeight: number;
  bandHeight: number;
  /** Whether the dark band sits below the bright bar or above it. */
  bandSide: number;
  brightness: number;
  /** Slight brightness gradient along the bar's length. */
  tiltX: number;
};

const buildSplices = (events: FlickerEvent[]): Splice[] => {
  return events.map((event) => {
    const s = event.id;
    // Start and travel have to be chosen together, not independently: a high
    // start with downward travel puts the bar off the frame after its first
    // frame. Pick a direction, then enter from the edge it implies so the bar
    // actually crosses the frame over the event's two or three frames.
    const downward = rndSign(s + "|dir") > 0;
    const near = rndRange(s + "|from", 0.05, 0.4);
    const far = rndRange(s + "|to", 0.6, 0.95);
    const from = downward ? near : far;
    const travel = downward ? far - near : near - far;
    return {
      event,
      from,
      travel,
      barHeight: rndRange(s + "|bar", 16, 52),
      bandHeight: rndRange(s + "|band", 45, 130),
      bandSide: rndSign(s + "|side"),
      brightness: rndRange(s + "|bright", 0.55, 0.95),
      tiltX: rndRange(s + "|tilt", -0.35, 0.35),
    };
  });
};

type SpliceMarksProps = LayerBaseProps & {
  settings: LayerSettings["splice"];
  loopFrames: number;
};

export const SpliceMarks: React.FC<SpliceMarksProps> = (props) => {
  const { frame, width, height, palette, intensity, settings, loopFrames, mode } = props;
  const barColor = palette.scratchPale ?? palette.dustPale;

  const events = useMemo(
    () =>
      settings.intensity > 0
        ? scheduleFlickerEvents({
            seed: "splice",
            duration: loopFrames,
            minConcurrent: 0,
            maxConcurrent: 1,
            minLife: settings.minLife,
            maxLife: settings.maxLife,
            minGap: settings.minGap,
            maxGap: settings.maxGap,
          })
        : [],
    [loopFrames, settings],
  );

  const splices = useMemo(() => buildSplices(events), [events]);

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx) return;

    for (let i = 0; i < splices.length; i++) {
      const splice = splices[i];
      const since = frame - splice.event.start;
      if (since < 0 || since >= splice.event.life) continue;

      const progress = splice.event.life > 1 ? since / (splice.event.life - 1) : 0;
      const y = (splice.from + splice.travel * progress) * height;
      const alpha = splice.brightness * intensity;

      // The dark side of the joint, laid down first.
      const bandY = splice.bandSide > 0 ? y + splice.barHeight : y - splice.bandHeight;
      ctx.save();
      ctx.globalCompositeOperation = mode === "alpha" ? "destination-out" : "multiply";
      const bandGradient = ctx.createLinearGradient(0, bandY, 0, bandY + splice.bandHeight);
      bandGradient.addColorStop(0, rgba(palette.blotchDark, splice.bandSide > 0 ? 0.85 : 0));
      bandGradient.addColorStop(0.5, rgba(palette.blotchDark, 0.85));
      bandGradient.addColorStop(1, rgba(palette.blotchDark, splice.bandSide > 0 ? 0 : 0.85));
      ctx.fillStyle = bandGradient;
      ctx.globalAlpha = intensity;
      ctx.fillRect(0, bandY, width, splice.bandHeight);
      ctx.restore();

      // The joint itself flaring as it crosses the lamp.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const barGradient = ctx.createLinearGradient(0, y, 0, y + splice.barHeight);
      barGradient.addColorStop(0, rgba(barColor, 0));
      barGradient.addColorStop(0.45, rgba(barColor, alpha));
      barGradient.addColorStop(0.6, rgba(barColor, alpha));
      barGradient.addColorStop(1, rgba(barColor, 0));
      ctx.fillStyle = barGradient;
      ctx.fillRect(0, y, width, splice.barHeight);
      // A faint left-to-right unevenness, so the bar is not a perfect rule.
      const sweep = ctx.createLinearGradient(0, 0, width, 0);
      sweep.addColorStop(0, rgba(barColor, alpha * 0.3 * (1 + splice.tiltX)));
      sweep.addColorStop(1, rgba(barColor, alpha * 0.3 * (1 - splice.tiltX)));
      ctx.fillStyle = sweep;
      ctx.fillRect(0, y + splice.barHeight * 0.3, width, splice.barHeight * 0.4);
      ctx.restore();
    }
  });

  return null;
};

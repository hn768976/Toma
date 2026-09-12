import React, { useMemo } from "react";
import {
  OVERSCAN,
  PALETTE,
  PX_PER_SECOND,
  TRACK_X0,
  UI_HEIGHT,
  UI_WIDTH,
} from "./constants";
import {
  ClipState,
  MarqueeState,
  Track,
  TooltipState,
  waveformAmplitude,
} from "./model";
import { seeded } from "./random";

// Headless-Chrome-safe stacks. Labels in this shot are 10-14 UI px and
// always partly defocused, so the exact face matters far less than it
// being present on the render machine - a webfont fetch would just be a
// render-time failure mode for text nobody can read.
const UI_FONT = '"DejaVu Sans", "Liberation Sans", system-ui, sans-serif';
const MONO_FONT = '"DejaVu Sans Mono", "Liberation Mono", monospace';

const clipFill = (color: ClipState["color"]) => {
  switch (color) {
    case "violet":
      return {
        body: `linear-gradient(180deg, ${PALETTE.clipVioletTop} 0%, ${PALETTE.clipViolet} 26%, #7f6fae 100%)`,
        bar: "rgba(255, 255, 255, 0.22)",
      };
    case "teal":
      return {
        body: `linear-gradient(180deg, #57d2e4 0%, ${PALETTE.clipTeal} 30%, #166f80 100%)`,
        bar: "rgba(255, 255, 255, 0.16)",
      };
    case "steel":
      return {
        body: "linear-gradient(180deg, #6f8496 0%, #47596a 34%, #2c3b47 100%)",
        bar: "rgba(255, 255, 255, 0.14)",
      };
    default:
      return {
        body: `linear-gradient(180deg, ${PALETTE.clipCyanTop} 0%, ${PALETTE.clipCyan} 22%, ${PALETTE.clipCyanDeep} 100%)`,
        bar: "rgba(255, 255, 255, 0.2)",
      };
  }
};

const BADGE_COLORS = [PALETTE.badgeRed, PALETTE.badgeAmber, PALETTE.badgeBlue];

const ClipBlock: React.FC<{ clip: ClipState; track: Track; scroll: number }> = ({
  clip,
  track,
  scroll,
}) => {
  const x = TRACK_X0 + (clip.start - scroll) * PX_PER_SECOND;
  const width = clip.duration * PX_PER_SECOND;
  if (x > UI_WIDTH + 200 || x + width < -200) return null;

  const fill = clipFill(clip.color);
  const labelBar = Math.min(18, track.height * 0.2);
  const showLabel = width > 46;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: track.y + 3,
        width: Math.max(3, width - 6),
        height: track.height - 6,
        borderRadius: 3,
        background: fill.body,
        boxShadow: `inset 0 0 0 1px rgba(3, 12, 18, 0.5), 0 1px 2px rgba(0, 0, 0, 0.55)`,
        overflow: "hidden",
        opacity: clip.dragging ? 0.82 : 1,
        outline: clip.selected
          ? `2px solid rgba(255, 255, 255, ${0.95 * clip.selected})`
          : clip.trimming
            ? `2px solid rgba(255, 90, 72, ${0.95 * clip.trimming})`
            : undefined,
        outlineOffset: -1,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: `0 0 auto 0`,
          height: labelBar,
          background: fill.bar,
          display: "flex",
          alignItems: "center",
          gap: 3,
          paddingLeft: 3,
        }}
      >
        {Array.from({ length: clip.badges }).map((_, i) => (
          <div
            key={i}
            style={{
              width: labelBar - 7,
              height: labelBar - 7,
              borderRadius: 1,
              background: BADGE_COLORS[i % BADGE_COLORS.length],
              flexShrink: 0,
            }}
          />
        ))}
        {showLabel ? (
          <span
            style={{
              fontFamily: UI_FONT,
              fontSize: labelBar - 7,
              lineHeight: 1,
              color: "rgba(8, 22, 30, 0.85)",
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {clip.label}
          </span>
        ) : null}
      </div>
      {/* Thumbnail band: real NLEs show head/tail frames of the source. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: labelBar,
          bottom: 0,
          background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.028) 0 ${Math.max(
            8,
            track.height * 0.62,
          )}px, rgba(0,0,0,0.035) ${Math.max(8, track.height * 0.62)}px ${
            Math.max(8, track.height * 0.62) * 2
          }px)`,
        }}
      />
    </div>
  );
};

/**
 * One audio track: a flat coloured bed with a symmetric waveform drawn
 * over it. The waveform path is built once in "timeline pixels" (a fixed
 * seconds -> px mapping) and then translated for scroll, so scrolling
 * never re-triangulates thousands of path points per frame.
 */
const AudioTrack: React.FC<{
  track: Track;
  scroll: number;
  seed: number;
  hotRange: [number, number] | null;
  cuts: number[];
  spanSeconds: number;
  amplitudeScale: number;
  waveFraction: number;
}> = ({
  track,
  scroll,
  seed,
  hotRange,
  cuts,
  spanSeconds,
  amplitudeScale,
  waveFraction,
}) => {
  const totalWidth = spanSeconds * PX_PER_SECOND;
  // The hero bed is deliberately much taller than its waveform: in the
  // reference most of that band is flat colour, and it is the flat area
  // - not the waveform - that carries the shot's big teal mass.
  const waveHeight = track.height * waveFraction;

  const path = useMemo(() => {
    // Sample spacing. Tighter than this buys nothing - at the focal
    // plane one UI px is about one frame px - and every extra point is
    // paid for six times over, once per defocus layer.
    const step = 2;
    const mid = waveHeight / 2;
    const top: string[] = [];
    const bottom: string[] = [];
    for (let px = 0; px <= totalWidth; px += step) {
      const seconds = px / PX_PER_SECOND;
      const a = waveformAmplitude(seconds, seed) * amplitudeScale;
      top.push(`${px.toFixed(1)} ${(mid - a * mid).toFixed(1)}`);
      bottom.push(`${px.toFixed(1)} ${(mid + a * mid).toFixed(1)}`);
    }
    bottom.reverse();
    return `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`;
  }, [totalWidth, waveHeight, seed, amplitudeScale]);

  const offsetX = TRACK_X0 - scroll * PX_PER_SECOND;

  const wave = (color: string) => (
    <svg
      width={totalWidth}
      height={waveHeight}
      viewBox={`0 0 ${totalWidth} ${waveHeight}`}
      style={{ position: "absolute", left: 0, top: 0, display: "block" }}
    >
      <path d={path} fill={color} />
    </svg>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: TRACK_X0,
        top: track.y,
        width: UI_WIDTH - TRACK_X0,
        height: track.height,
        overflow: "hidden",
      }}
    >
      {/* bed */}
      <div
        style={{
          position: "absolute",
          left: offsetX - TRACK_X0,
          top: 0,
          width: totalWidth,
          height: track.height,
          background: `linear-gradient(180deg, ${PALETTE.audioBedTop} 0%, ${PALETTE.audioBed} 38%, #1a6c7d 100%)`,
          // Bright rules top and bottom: on the real panel these are the
          // track separators, and defocused they become the long pale
          // streaks running the width of the reference shot.
          boxShadow:
            "inset 0 2px 0 rgba(206, 246, 255, 0.55), inset 0 -3px 0 rgba(186, 238, 250, 0.42)",
        }}
      />
      {/* waveform */}
      <div
        style={{
          position: "absolute",
          left: offsetX - TRACK_X0,
          top: (track.height - waveHeight) * 0.38,
          width: totalWidth,
          height: waveHeight,
        }}
      >
        {wave(PALETTE.waveform)}
        {hotRange ? (
          <div
            style={{
              position: "absolute",
              left: hotRange[0] * PX_PER_SECOND,
              top: 0,
              width: (hotRange[1] - hotRange[0]) * PX_PER_SECOND,
              height: waveHeight,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -hotRange[0] * PX_PER_SECOND,
                top: 0,
                width: totalWidth,
                height: waveHeight,
                background: "rgba(236, 252, 255, 0.16)",
              }}
            >
              {wave(PALETTE.waveformHot)}
            </div>
          </div>
        ) : null}
      </div>
      {/* cut lines inherited from the video edit above */}
      {cuts.map((seconds, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: offsetX - TRACK_X0 + seconds * PX_PER_SECOND,
            top: 0,
            width: 1,
            height: track.height,
            background: "rgba(4, 20, 26, 0.55)",
          }}
        />
      ))}
    </div>
  );
};

const Ruler: React.FC<{ scroll: number }> = ({ scroll }) => {
  const ticks = useMemo(() => {
    const out: { x: number; label: string; major: boolean }[] = [];
    for (let s = 0; s <= 110; s += 1) {
      const major = s % 5 === 0;
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      out.push({ x: s * PX_PER_SECOND, label: `00:${mm}:${ss}:00`, major });
    }
    return out;
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        left: TRACK_X0,
        top: 0,
        width: UI_WIDTH - TRACK_X0,
        height: 74,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -scroll * PX_PER_SECOND,
          top: 0,
          width: 110 * PX_PER_SECOND,
          height: 74,
        }}
      >
        {ticks.map((tick) => (
          <React.Fragment key={tick.x}>
            <div
              style={{
                position: "absolute",
                left: tick.x,
                top: tick.major ? 44 : 56,
                width: 1,
                height: tick.major ? 22 : 10,
                background: "rgba(150, 180, 198, 0.35)",
              }}
            />
            {tick.major ? (
              <span
                style={{
                  position: "absolute",
                  left: tick.x + 5,
                  top: 26,
                  fontFamily: MONO_FONT,
                  fontSize: 15,
                  color: PALETTE.ruler,
                  whiteSpace: "nowrap",
                }}
              >
                {tick.label}
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

/**
 * Left control column. It is the nearest thing to the lens and reads as
 * pure bokeh once defocused, so it is built out of the round, bright,
 * well-separated elements that make attractive discs: record dots, mute
 * / solo pills, the track-height slider knob.
 */
const TrackHeaders: React.FC<{ tracks: Track[] }> = ({ tracks }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      width: TRACK_X0,
      height: UI_HEIGHT,
      background: `linear-gradient(90deg, ${PALETTE.panel} 0%, ${PALETTE.panelAlt} 70%, ${PALETTE.trackBed} 100%)`,
      borderRight: "1px solid rgba(120, 150, 175, 0.14)",
    }}
  >
    {tracks.map((track, i) => (
      <div
        key={track.id}
        style={{
          position: "absolute",
          left: 0,
          top: track.y,
          width: TRACK_X0,
          height: track.height,
          borderTop: "1px solid rgba(130, 160, 185, 0.1)",
          display: "flex",
          alignItems: "center",
          gap: 14,
          paddingLeft: 22,
        }}
      >
        <span
          style={{
            fontFamily: UI_FONT,
            fontSize: 17,
            color: "rgba(196, 218, 232, 0.62)",
          }}
        >
          {track.name}
        </span>
        {[0, 1, 2].map((b) => {
          const lit = seeded(i * 5 + b, 31) > 0.62;
          const warm = seeded(i * 5 + b, 77) > 0.7;
          return (
            <div
              key={b}
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                background: lit
                  ? warm
                    ? "rgba(255, 206, 130, 0.95)"
                    : "rgba(214, 238, 250, 0.9)"
                  : "rgba(92, 116, 134, 0.35)",
                boxShadow: lit
                  ? `0 0 10px ${warm ? "rgba(255, 190, 110, 0.8)" : "rgba(190, 230, 250, 0.7)"}`
                  : undefined,
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>
    ))}
  </div>
);

/**
 * The rest of the application, drawn well past the timeline panel on
 * every side: neighbouring panel walls, a tool strip, the bottom of the
 * program monitor. None of it is ever in focus - it exists so the frame
 * always lands on interface rather than on the edge of the plane.
 */
const Backdrop: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: -OVERSCAN,
      top: -OVERSCAN,
      width: UI_WIDTH + OVERSCAN * 2,
      height: UI_HEIGHT + OVERSCAN * 2,
      background: `
        linear-gradient(180deg, #070a10 0%, #04060a 55%, #020407 100%)`,
      overflow: "hidden",
    }}
  >
    {/* panel gutters above and below the timeline */}
    <div
      style={{
        position: "absolute",
        left: 0,
        top: OVERSCAN - 118,
        width: "100%",
        height: 118,
        background: `linear-gradient(180deg, ${PALETTE.panel} 0%, ${PALETTE.panelAlt} 100%)`,
        borderBottom: "1px solid rgba(120, 150, 175, 0.16)",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        top: OVERSCAN + UI_HEIGHT,
        width: "100%",
        height: 260,
        background: `linear-gradient(180deg, ${PALETTE.panelAlt} 0%, #06090e 100%)`,
        borderTop: "1px solid rgba(120, 150, 175, 0.12)",
      }}
    />
    {/* tool strip above the panel: small buttons that go to bokeh */}
    {Array.from({ length: 9 }).map((_, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: OVERSCAN + 90 + i * 58,
          top: OVERSCAN - 84,
          width: 26,
          height: 26,
          borderRadius: 5,
          background:
            seeded(i, 41) > 0.66
              ? "rgba(196, 224, 240, 0.55)"
              : "rgba(88, 110, 128, 0.3)",
        }}
      />
    ))}
    {/* stray status LEDs deep in the panel: the couple of warm specks
        the reference shows floating in the dark top corner */}
    {[
      { x: 2600, y: 300, c: "rgba(224, 88, 64, 0.85)" },
      { x: 2720, y: 250, c: "rgba(240, 150, 60, 0.7)" },
      { x: 3050, y: 356, c: "rgba(90, 150, 240, 0.6)" },
      { x: 2180, y: 214, c: "rgba(224, 88, 64, 0.5)" },
    ].map((led, i) => (
      <div
        key={`led-${i}`}
        style={{
          position: "absolute",
          left: OVERSCAN + led.x,
          top: OVERSCAN - 420 + led.y,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: led.c,
        }}
      />
    ))}
    {/* faint bin rows far off to the right, behind the edit */}
    {Array.from({ length: 14 }).map((_, i) => (
      <div
        key={`bin-${i}`}
        style={{
          position: "absolute",
          left: OVERSCAN + UI_WIDTH + 120,
          top: OVERSCAN + 80 + i * 96,
          width: 900,
          height: 58,
          background: "rgba(92, 120, 142, 0.07)",
          borderRadius: 3,
        }}
      />
    ))}
  </div>
);

export type ScreenProps = {
  tracks: Track[];
  clips: ClipState[];
  audioTracks: {
    track: Track;
    seed: number;
    amplitudeScale: number;
    waveFraction: number;
    cuts: number[];
  }[];
  scroll: number;
  playheadSeconds: number;
  hotRange: [number, number] | null;
  tooltip: TooltipState;
  marquee: MarqueeState;
  /** Seconds span of the rubber-band (opacity/keyframe) line overlay. */
  rubberBand: { track: string; level: number }[];
  spanSeconds: number;
};

/** The flat editor interface, in UI space. No 3D, no lens - just the UI. */
export const Screen: React.FC<ScreenProps> = ({
  tracks,
  clips,
  audioTracks,
  scroll,
  playheadSeconds,
  hotRange,
  tooltip,
  marquee,
  rubberBand,
  spanSeconds,
}) => {
  const trackById = useMemo(
    () => new Map(tracks.map((t) => [t.id, t])),
    [tracks],
  );
  const playheadX = TRACK_X0 + (playheadSeconds - scroll) * PX_PER_SECOND;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: UI_WIDTH,
        height: UI_HEIGHT,
        background: PALETTE.screenBase,
      }}
    >
      <Backdrop />

      {/* track beds */}
      {tracks.map((track, i) => (
        <div
          key={track.id}
          style={{
            position: "absolute",
            left: TRACK_X0,
            top: track.y,
            width: UI_WIDTH - TRACK_X0,
            height: track.height,
            background: i % 2 === 0 ? PALETTE.trackBed : PALETTE.trackBedAlt,
            borderTop: `1px solid ${PALETTE.gridLine}`,
          }}
        />
      ))}

      <Ruler scroll={scroll} />

      {/* Render bar: the warm rule sitting just under the ruler on a
          real panel, and the one warm diagonal in the reference frame. */}
      <div
        style={{
          position: "absolute",
          left: TRACK_X0 - scroll * PX_PER_SECOND + 6 * PX_PER_SECOND,
          top: 78,
          width: 26 * PX_PER_SECOND,
          height: 3,
          background: PALETTE.rubberBand,
          opacity: 0.6,
        }}
      />

      {audioTracks.map((audio) => (
        <AudioTrack
          key={audio.track.id}
          track={audio.track}
          scroll={scroll}
          seed={audio.seed}
          hotRange={hotRange}
          cuts={audio.cuts}
          spanSeconds={spanSeconds}
          amplitudeScale={audio.amplitudeScale}
          waveFraction={audio.waveFraction}
        />
      ))}

      {clips.map((clip) => {
        const track = trackById.get(clip.track);
        if (!track) return null;
        return (
          <ClipBlock key={clip.id} clip={clip} track={track} scroll={scroll} />
        );
      })}

      {/* keyframe / rubber-band lines: thin warm strokes across a track */}
      {rubberBand.map((band) => {
        const track = trackById.get(band.track);
        if (!track) return null;
        return (
          <div
            key={band.track}
            style={{
              position: "absolute",
              left: TRACK_X0,
              top: track.y + track.height * (1 - band.level),
              width: UI_WIDTH - TRACK_X0,
              height: 2,
              background: PALETTE.rubberBand,
              opacity: 0.78,
            }}
          />
        );
      })}

      <TrackHeaders tracks={tracks} />

      {/* playhead */}
      <div
        style={{
          position: "absolute",
          left: playheadX,
          top: 18,
          width: 2,
          height: UI_HEIGHT - 18,
          background: PALETTE.playhead,
          boxShadow: `0 0 6px ${PALETTE.playhead}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: playheadX - 9,
          top: 8,
          width: 20,
          height: 16,
          background: PALETTE.playheadCore,
          clipPath: "polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)",
        }}
      />

      {marquee ? (
        <div
          style={{
            position: "absolute",
            left: marquee.x,
            top: marquee.y,
            width: marquee.width,
            height: marquee.height,
            border: "1px solid rgba(232, 246, 255, 0.9)",
            background: "rgba(150, 210, 240, 0.14)",
            opacity: marquee.opacity,
          }}
        />
      ) : null}

      {tooltip ? (
        <div
          style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y,
            padding: "3px 7px",
            background: "rgba(8, 12, 17, 0.94)",
            border: "1px solid rgba(150, 180, 200, 0.35)",
            fontFamily: MONO_FONT,
            fontSize: 15,
            color: PALETTE.label,
            whiteSpace: "nowrap",
            opacity: tooltip.opacity,
          }}
        >
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
};

import React from "react";
import { tierBlur, tierOpacity } from "../lib/constants";
import { driftOffset, loopRange, wrap01 } from "../lib/loop";
import type { Arrival, NodeSpec } from "../lib/scene";
import type { Theme } from "../lib/theme";
import { FONT_FAMILY } from "../load-fonts";
import { CodeMark } from "./CodeMark";
import { Glyph } from "./Glyph";

/**
 * How brightly a node is lit by dots arriving along its connectors.
 *
 * Each arrival contributes a bump centred on the moment the dot lands.
 * The distance is measured cyclically (`min(t, 1 - t)`), which keeps the
 * bump continuous across the loop point instead of snapping on at frame 0.
 */
const arrivalGlow = (progress: number, arrivals: Arrival[] | undefined) => {
  if (!arrivals?.length) return 0;
  let best = 0;
  for (const a of arrivals) {
    const t = wrap01(a.trips * progress + a.phase);
    const toArrival = Math.min(t, 1 - t);
    best = Math.max(best, Math.exp(-((toArrival / 0.075) ** 2)));
  }
  return best;
};

/**
 * Capsule width for a label, from its character count.
 *
 * Rajdhani is embedded and fixed, so the advance width per character is
 * known and this stays in step with the text -- which is exactly why the
 * font is self-hosted: a fallback face would change every width here and
 * pull the whole layout apart.
 */
const blobWidth = (text: string, size: number) => size * (0.72 + 0.08 * text.length);

export const Node: React.FC<{
  node: NodeSpec;
  theme: Theme;
  progress: number;
  arrivals?: Arrival[];
}> = ({ node, theme, progress, arrivals }) => {
  const blur = tierBlur(node.tier);
  const drift = driftOffset(
    progress,
    node.driftCycles,
    node.driftPhase,
    node.driftRadius,
    // Flatter vertically than horizontally, so nodes slide along the
    // plane rather than bobbing on it.
    node.driftRadius * 0.62,
  );

  const lit = arrivalGlow(progress, arrivals);
  const isHero = node.kind === "hero";

  // The hero pulses gently on its own; everything else just breathes with
  // its drift and jumps very slightly as a dot lands on it. A node that is
  // already out of focus gains nothing from the jump, so it is skipped.
  const scale = isHero
    ? loopRange(progress, 2, 0, 0.985, 1.03)
    : loopRange(progress, node.driftCycles, node.driftPhase * 0.6, 0.98, 1.02) +
      (blur > 0 ? 0 : lit * 0.045);

  const width = node.shape === "blob" ? blobWidth(node.text ?? "", node.size) : node.size;
  const height = node.size;

  const glowStrength = (node.glow ?? 0) + lit * 0.55;

  return (
    <div
      style={{
        position: "absolute",
        left: node.x + drift.x,
        top: node.y + drift.y,
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: tierOpacity(node.tier) * (node.fade ?? 1),
        transform: `scale(${scale})`,
        ...(blur > 0 ? { filter: `blur(${blur}px)` } : null),
      }}
    >
      {/* Bloom, behind everything the node draws. */}
      {glowStrength > 0.01 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: width * 2.6,
            height: height * 2.6,
            marginLeft: -width * 1.3,
            marginTop: -height * 1.3,
            borderRadius: "50%",
            backgroundImage: `radial-gradient(circle, ${
              isHero ? theme.heroGlow : hexToRgba(node.color, 0.55)
            } 0%, rgba(0,0,0,0) 62%)`,
            opacity: Math.min(1, glowStrength),
          }}
        />
      ) : null}

      {node.shape === "blob" ? (
        <BlobLabel node={node} theme={theme} lit={lit} width={width} height={height} />
      ) : null}

      {node.shape === "bare" ? <BareLabel node={node} theme={theme} lit={lit} /> : null}

      {node.shape === "ring" && !isHero ? <RingIcon node={node} theme={theme} lit={lit} /> : null}

      {isHero && node.shape !== "blob" ? (
        <HeroMark node={node} theme={theme} progress={progress} />
      ) : null}
    </div>
  );
};

/** V1: a filled capsule with the bracketed label inside it. */
const BlobLabel: React.FC<{
  node: NodeSpec;
  theme: Theme;
  lit: number;
  width: number;
  height: number;
}> = ({ node, theme, lit, width, height }) => (
  <div
    style={{
      position: "relative",
      width,
      height,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundImage: `linear-gradient(152deg, ${shade(node.color, 1.07)} 0%, ${node.color} 52%, ${shade(
        node.color,
        0.93,
      )} 100%)`,
      filter: lit > 0.02 ? `brightness(${1 + lit * 0.32})` : undefined,
    }}
  >
    {node.kind === "hero" ? (
      <CodeMark size={height * 0.58} color={theme.labelText} weight={9} />
    ) : (
      <span
        style={{
          fontFamily: FONT_FAMILY,
          fontWeight: 700,
          fontSize: height * 0.22,
          letterSpacing: "0.04em",
          color: theme.labelText,
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {node.text}
      </span>
    )}
  </div>
);

/** V2: bracketed text on its own, no plate behind it. */
const BareLabel: React.FC<{ node: NodeSpec; theme: Theme; lit: number }> = ({
  node,
  theme,
  lit,
}) => (
  <span
    style={{
      fontFamily: FONT_FAMILY,
      fontWeight: 700,
      fontSize: node.size,
      letterSpacing: "0.02em",
      color: node.color || theme.labelText,
      whiteSpace: "nowrap",
      lineHeight: 1,
      textShadow: lit > 0.02 ? `0 0 ${node.size * 0.55 * lit}px ${theme.dash}` : undefined,
    }}
  >
    {node.text}
  </span>
);

/** Stroked ring with a line glyph inside it. */
const RingIcon: React.FC<{ node: NodeSpec; theme: Theme; lit: number }> = ({
  node,
  theme,
  lit,
}) => (
  <div
    style={{
      position: "relative",
      width: node.size,
      height: node.size,
      borderRadius: "50%",
      border: `${node.size * 0.028}px solid ${node.color}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      filter: lit > 0.02 ? `brightness(${1 + lit * 0.4})` : undefined,
    }}
  >
    <Glyph
      name={node.glyph ?? "globe"}
      size={node.size * 0.58}
      color={node.color}
      strokeWidth={5.5}
      opacity={0.95}
    />
    {/* A faint second ring, echoing the concentric badges in the refs. */}
    <div
      style={{
        position: "absolute",
        inset: -node.size * 0.11,
        borderRadius: "50%",
        border: `${node.size * 0.012}px solid ${hexToRgba(theme.iconGlyph, 0.22)}`,
      }}
    />
  </div>
);

/** V2 hero: the code mark inside a slowly rotating dashed circle. */
const HeroMark: React.FC<{ node: NodeSpec; theme: Theme; progress: number }> = ({
  node,
  theme,
  progress,
}) => {
  const r = node.size * 0.42;
  const circumference = 2 * Math.PI * r;
  // 34 dashes round the circle, so the pattern meets itself exactly.
  const period = circumference / 34;

  return (
    <div
      style={{
        position: "relative",
        width: node.size,
        height: node.size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width={node.size}
        height={node.size}
        viewBox={`0 0 ${node.size} ${node.size}`}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "visible",
          // Exactly one turn over the composition: seamless at the loop.
          transform: `rotate(${progress * 360}deg)`,
        }}
      >
        <circle
          cx={node.size / 2}
          cy={node.size / 2}
          r={r}
          fill="none"
          stroke={theme.hero}
          strokeWidth={node.size * 0.022}
          strokeLinecap="butt"
          strokeDasharray={`${period * 0.55} ${period * 0.45}`}
        />
      </svg>
      {/* A wide, static echo of the circle, well out of focus. */}
      <div
        style={{
          position: "absolute",
          inset: -node.size * 0.34,
          borderRadius: "50%",
          border: `${node.size * 0.014}px solid ${hexToRgba(theme.hero, 0.16)}`,
          filter: `blur(${node.size * 0.02}px)`,
        }}
      />
      <CodeMark
        size={node.size * 0.58}
        color={theme.hero}
        weight={9.5}
        // Opens and closes twice over the loop; returns to the resting pose.
        spread={loopRange(progress, 2, 0, -1.6, 1.6)}
      />
    </div>
  );
};

/** #rrggbb -> rgba(), for glows tinted by the node's own colour. */
function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Multiplies a hex colour's channels, for the capsule's soft shading. */
function shade(hex: string, factor: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

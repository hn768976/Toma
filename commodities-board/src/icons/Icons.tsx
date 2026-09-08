import React from "react";

/**
 * Every glyph below is drawn here, by hand, on a 24x24 grid. Nothing comes from
 * an icon library: library marks carry licences and attribution requirements
 * that cannot travel inside a stock clip.
 */
export type IconKind =
  | "barrel"
  | "droplet"
  | "flame"
  | "burner"
  | "canister"
  | "lump"
  | "bolt"
  | "tank"
  | "disc"
  | "ingot"
  | "wheat"
  | "corn"
  | "bean"
  | "boll"
  | "cube"
  | "coffee"
  | "hexagon"
  | "diamond";

const S = {
  fill: "currentColor",
} as const;

const stroke = (width: number) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const WheatGrain: React.FC<{ y: number }> = ({ y }) => (
  <>
    <path {...S} d={`M12 ${y}c-2.1-.4-3.4-1.9-3.4-3.9 2.2 0 3.4 1.4 3.4 3.9z`} />
    <path {...S} d={`M12 ${y}c2.1-.4 3.4-1.9 3.4-3.9-2.2 0-3.4 1.4-3.4 3.9z`} />
  </>
);

const GLYPHS: Record<IconKind, React.ReactNode> = {
  barrel: (
    <>
      <path
        {...S}
        d="M7.4 3h9.2c.8 0 1.4.6 1.4 1.4v15.2c0 .8-.6 1.4-1.4 1.4H7.4c-.8 0-1.4-.6-1.4-1.4V4.4C6 3.6 6.6 3 7.4 3z"
      />
      <path {...stroke(1.5)} d="M4.6 8.3h14.8M4.6 15.7h14.8" opacity={0.55} />
    </>
  ),
  droplet: (
    <path {...S} d="M12 2.6c4.3 5.4 6.4 8.3 6.4 11.3a6.4 6.4 0 0 1-12.8 0c0-3 2.1-5.9 6.4-11.3z" />
  ),
  flame: (
    <path
      {...S}
      d="M12 2.2c3.6 3.8 5.6 6.5 5.6 10a5.6 5.6 0 0 1-11.2 0c0-1.7.6-3.2 1.7-4.5.2 1.3.9 2.1 1.9 2.1 1.4 0 2.1-1.2 1.7-2.9-.4-1.6-.2-3.3.3-4.7z"
    />
  ),
  burner: (
    <>
      <path {...S} d="M12 6.4c3.1 3.9 4.6 6 4.6 8.1a4.6 4.6 0 0 1-9.2 0c0-2.1 1.5-4.2 4.6-8.1z" />
      <path {...stroke(1.6)} d="M6.2 4.6c.9-.8.9-1.9 0-2.7M12 3.6c.9-.8.9-1.9 0-2.7M17.8 4.6c.9-.8.9-1.9 0-2.7" opacity={0.7} />
    </>
  ),
  canister: (
    <>
      <path {...S} d="M4.6 6.6h9.2c.7 0 1.2.5 1.2 1.2v12.4c0 .7-.5 1.2-1.2 1.2H4.6c-.7 0-1.2-.5-1.2-1.2V7.8c0-.7.5-1.2 1.2-1.2z" />
      <path {...S} d="M6.4 3.2h5.6c.6 0 1 .4 1 1v1.2H5.4V4.2c0-.6.4-1 1-1z" />
      <path {...S} d="M16.2 9.4h2.2c1 0 1.8.8 1.8 1.8v9.2h-2.2V11.6h-1.8z" />
    </>
  ),
  lump: (
    <path {...S} d="m6.1 9.1 4.6-5.2 6.7 2 2.5 6.4-3.8 6.5-7.1.6-4.8-4.5z" />
  ),
  bolt: <path {...S} d="M13.9 1.8 5.2 13.6h5.3L9.6 22.2l9-12.4h-5.8z" />,
  tank: (
    <>
      <path {...S} d="M4.2 7.8h15.6c.9 0 1.6.7 1.6 1.6v5.2c0 .9-.7 1.6-1.6 1.6H4.2c-.9 0-1.6-.7-1.6-1.6V9.4c0-.9.7-1.6 1.6-1.6z" />
      <path {...stroke(1.6)} d="M12 7.8v8.4M6.4 16.8v3.4M17.6 16.8v3.4" opacity={0.75} />
    </>
  ),
  disc: (
    <>
      <circle {...stroke(2.2)} cx={12} cy={12} r={8.9} />
      <circle {...S} cx={12} cy={12} r={4.2} />
    </>
  ),
  ingot: (
    <>
      <path {...S} d="M7.2 10.6h9.6l3.8 6.6H3.4z" />
      <path {...S} d="M8.6 6.4h6.8l1.4 2.8H7.2z" opacity={0.75} />
    </>
  ),
  wheat: (
    <>
      <path {...stroke(1.7)} d="M12 22V8.6" />
      <WheatGrain y={8.6} />
      <WheatGrain y={13.1} />
      <WheatGrain y={17.6} />
      <path {...S} d="M12 5.4c1.2-1 1.8-2.3 1.8-3.9-1.6.5-2.4 1.8-1.8 3.9z" />
      <path {...S} d="M12 5.4c-1.2-1-1.8-2.3-1.8-3.9 1.6.5 2.4 1.8 1.8 3.9z" />
    </>
  ),
  corn: (
    <>
      <path {...S} d="M12 2.4c3 2 4.4 5.1 4.4 8.8 0 4.5-1.9 8.7-4.4 10.6-2.5-1.9-4.4-6.1-4.4-10.6 0-3.7 1.4-6.8 4.4-8.8z" />
      <path {...stroke(1.3)} d="M9.8 6.6c1.5 3.4 1.5 8.9 0 12.3M14.2 6.6c-1.5 3.4-1.5 8.9 0 12.3" opacity={0.45} />
    </>
  ),
  bean: (
    <>
      <path {...S} d="M4 12.4c0-2.9 2.4-4.8 5.4-4.8h5.2c3 0 5.4 1.9 5.4 4.8s-2.4 4.8-5.4 4.8H9.4C6.4 17.2 4 15.3 4 12.4z" />
      <circle cx={8.6} cy={12.4} r={2.1} fill="rgba(0,0,0,0.32)" />
      <circle cx={15.4} cy={12.4} r={2.1} fill="rgba(0,0,0,0.32)" />
    </>
  ),
  boll: (
    <>
      <circle {...S} cx={7.4} cy={8.6} r={4.6} />
      <circle {...S} cx={16.6} cy={8.6} r={4.6} />
      <circle {...S} cx={12} cy={13.4} r={5.2} />
      <path {...stroke(2)} d="M12 18v4.4" />
    </>
  ),
  cube: (
    <>
      <path {...S} d="M12 2.4 20.6 7 12 11.6 3.4 7z" />
      <path {...S} d="M2.8 8.3 11.1 12.8v8.8L2.8 17.1z" opacity={0.72} />
      <path {...S} d="M21.2 8.3 12.9 12.8v8.8l8.3-4.5z" opacity={0.85} />
    </>
  ),
  coffee: (
    <g transform="rotate(-28 12 12)">
      <ellipse {...S} cx={12} cy={12} rx={5.4} ry={8.6} />
      <path
        {...stroke(1.5)}
        d="M12 3.8c-2.6 2.6-2.6 13.8 0 16.4"
        stroke="rgba(0,0,0,0.38)"
      />
    </g>
  ),
  hexagon: (
    <>
      <path {...S} d="M12 2 20.7 7v10L12 22 3.3 17V7z" />
      <path {...stroke(1.5)} d="M12 6.4 17.2 9.4v5.2L12 17.6 6.8 14.6V9.4z" opacity={0.45} />
    </>
  ),
  diamond: (
    <>
      <path {...S} d="M12 1.8 19.6 12 12 22.2 4.4 12z" />
      <path {...stroke(1.4)} d="M12 1.8V22.2M4.4 12h15.2" opacity={0.4} />
    </>
  ),
};

/** Metals read better as coins; everything else sits in a rounded square. */
const CIRCLE_KINDS = new Set<IconKind>(["disc", "lump", "coffee", "hexagon"]);

export const InstrumentIcon: React.FC<{
  kind: IconKind;
  color: string;
  size: number;
  glyphColor: string;
}> = ({ kind, color, size, glyphColor }) => {
  const round = CIRCLE_KINDS.has(kind);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: round ? "50%" : size * 0.26,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: `inset 0 ${size * 0.02}px 0 rgba(255,255,255,0.35)`,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.7}
        height={size * 0.7}
        style={{ color: glyphColor, display: "block" }}
      >
        {GLYPHS[kind]}
      </svg>
    </div>
  );
};

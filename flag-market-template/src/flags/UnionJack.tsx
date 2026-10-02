import React from "react";

// The Union Flag on its official 60 x 30 construction grid:
// white saltire 6 wide, red saltire 2 wide counterchanged (offset so that
// in the upper hoist quarter the red lies BELOW the diagonal — the
// "pinwheel" turns clockwise), white cross 10 wide, red cross 6 wide.
export const UNION_BLUE = "#012169";
export const UNION_RED = "#C8102E";

export const UnionJack: React.FC<{ uid: string; red?: string }> = ({
  uid,
  red = UNION_RED,
}) => {
  const field = `uj-field-${uid}`;
  const pin = `uj-pin-${uid}`;
  return (
    <>
      <defs>
        <clipPath id={field}>
          <rect width={60} height={30} />
        </clipPath>
        {/* One triangle per quarter, on the side of each half-diagonal
            the red band sits on. */}
        <clipPath id={pin}>
          <path d="M30,15 H60 V30 Z V30 H0 Z H0 V0 Z V0 H60 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${field})`}>
        <rect width={60} height={30} fill={UNION_BLUE} />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth={6} />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#${pin})`}
          stroke={red}
          strokeWidth={4}
        />
        <path d="M30,0 V30 M0,15 H60" stroke="#FFFFFF" strokeWidth={10} />
        <path d="M30,0 V30 M0,15 H60" stroke={red} strokeWidth={6} />
      </g>
    </>
  );
};

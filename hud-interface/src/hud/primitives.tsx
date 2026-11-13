import React from "react";
import { HUD_FONT } from "../lib/font";

export const Txt: React.FC<
  React.SVGProps<SVGTextElement> & { size?: number; children: React.ReactNode }
> = ({ size = 10, children, ...rest }) => (
  <text fontFamily={HUD_FONT} fontSize={size} letterSpacing={0.6} {...rest}>
    {children}
  </text>
);

// Group whose opacity is driven by the boot/glitch helpers
export const G: React.FC<{ o: number; children: React.ReactNode; transform?: string }> = ({
  o,
  children,
  transform,
}) => (o <= 0.001 ? null : <g opacity={o} transform={transform}>{children}</g>);

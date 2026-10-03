import React, { useCallback } from "react";
import { GlassColorway, HorizonColorway, ServerColorway } from "./colorways";
import { GLLoop } from "./common/GLLoop";
import { GlassBlockRenderer } from "./glass/GlassBlockRenderer";
import { HorizonStreaksRenderer } from "./horizon/HorizonStreaksRenderer";
import { ServerBokehRenderer } from "./server/ServerBokehRenderer";

export const GlassBlock: React.FC<{ colorway: GlassColorway }> = ({ colorway }) => {
  const create = useCallback(() => new GlassBlockRenderer(colorway), [colorway]);
  return <GLLoop create={create} />;
};

export const HorizonStreaks: React.FC<{ colorway: HorizonColorway }> = ({ colorway }) => {
  const create = useCallback(() => new HorizonStreaksRenderer(colorway), [colorway]);
  return <GLLoop create={create} />;
};

export const ServerBokeh: React.FC<{ colorway: ServerColorway }> = ({ colorway }) => {
  const create = useCallback(() => new ServerBokehRenderer(colorway), [colorway]);
  return <GLLoop create={create} />;
};

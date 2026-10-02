import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { useMonoFont } from "../lib/font";
import { PADLOCK_SVG } from "./cyberBadges";
import type { CyberColors } from "./cyberNetwork";
import { createCyberNetwork } from "./cyberNetwork";
import { GLStage } from "../gl/Stage";
import type { CityColors } from "./dataCity";
import { createDataCity } from "./dataCity";
import type { SphereColors } from "./particleSphere";
import { createParticleSphere } from "./particleSphere";
import type { WavesColors } from "./particleWaves";
import { createParticleWaves } from "./particleWaves";

export const ParticleSphere: React.FC<{ colors: SphereColors }> = ({ colors }) => {
  const create = useMemo(() => createParticleSphere(colors), [colors]);
  return <GLStage create={create} />;
};

export const ParticleWaves: React.FC<{ colors: WavesColors }> = ({ colors }) => {
  const create = useMemo(() => createParticleWaves(colors), [colors]);
  return <GLStage create={create} />;
};

export const DataCity: React.FC<{ colors: CityColors }> = ({ colors }) => {
  const create = useMemo(() => createDataCity(colors), [colors]);
  return <GLStage create={create} />;
};

/** Rasterise the self-drawn padlock SVG once (delayRender until decoded). */
const usePadlock = (color: string) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [handle] = useState(() => delayRender("Decoding padlock SVG"));
  useEffect(() => {
    const im = new Image();
    im.onload = () => {
      setImg(im);
      continueRender(handle);
    };
    im.onerror = (e) => {
      console.error(e);
      continueRender(handle);
    };
    im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PADLOCK_SVG(color))}`;
  }, [color, handle]);
  return img;
};

const CyberInner: React.FC<{ colors: CyberColors; padlock: HTMLImageElement }> = ({ colors, padlock }) => {
  const create = useMemo(() => createCyberNetwork(colors, padlock), [colors, padlock]);
  return <GLStage create={create} />;
};

export const CyberNetwork: React.FC<{ colors: CyberColors }> = ({ colors }) => {
  const fontReady = useMonoFont();
  const padlock = usePadlock(colors.badge);
  if (!fontReady || !padlock) return null;
  return <CyberInner colors={colors} padlock={padlock} />;
};

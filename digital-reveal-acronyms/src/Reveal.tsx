import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame } from "remotion";
import { Background, Vignette } from "./Background";
import { T } from "./config";
import { loadFont } from "./font";
import { Grain } from "./Grain";
import { ParticleLayer } from "./ParticleLayer";
import { sampleWord, type WordData } from "./sampling";
import { Streaks } from "./Streaks";
import { WordLayer } from "./WordLayer";

export type RevealProps = { word: string };

// Loads the font, then samples the word's target points exactly once.
// The render is held (delayRender) until both are done, so no frame is ever
// captured with a fallback font or an empty particle layer.
const useWordData = (word: string) => {
  const [handle] = useState(() => delayRender(`Loading font and sampling "${word}"`));
  const [data, setData] = useState<WordData | null>(null);
  useEffect(() => {
    let alive = true;
    loadFont()
      .then(() => {
        if (!alive) return;
        setData(sampleWord(word));
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
    return () => {
      alive = false;
    };
  }, [word, handle]);
  return data;
};

export const Reveal: React.FC<RevealProps> = ({ word }) => {
  const frame = useCurrentFrame();
  const data = useWordData(word);
  // The 3D layer only exists while particles can be on screen.
  const particlesLive = frame >= T.stormStart - 2 && frame < T.burstStart + 6;

  return (
    <AbsoluteFill style={{ backgroundColor: "#001a2c" }}>
      <Background />
      {data && particlesLive && <ParticleLayer data={data} />}
      {data && <Streaks data={data} />}
      {data && <WordLayer data={data} />}
      <Vignette />
      <Grain />
    </AbsoluteFill>
  );
};

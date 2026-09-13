import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import "./fonts";
import { BACKGROUND_COLOR, BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { RansomLetter } from "./RansomLetter";
import { WORDS } from "./words";

export const ransomNoteSchema = z.object({
  word: z.enum(["mentalHealth", "psychology"]),
  // 1 = 1080p, 2 = 4K. The layout is authored once at 1920x1080 and scaled,
  // so every resolution is the same animation, not a re-tuned copy.
  resolutionScale: z.number().min(1).max(4),
});

export const ransomNoteDefaults: z.infer<typeof ransomNoteSchema> = {
  word: "mentalHealth",
  resolutionScale: 1,
};

export const RansomNote: React.FC<z.infer<typeof ransomNoteSchema>> = ({
  word,
  resolutionScale,
}) => {
  const frame = useCurrentFrame();
  const letters = WORDS[word];
  // Offsetting the seed per word means the two versions crumple and jitter
  // differently instead of looking like the same take with the text swapped.
  const seedBase = word === "psychology" ? 400 : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR }}>
      <AbsoluteFill
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${resolutionScale})`,
          transformOrigin: "top left",
        }}
      >
        {letters.map((spec, i) => (
          <RansomLetter
            key={`${word}-${i}`}
            spec={spec}
            seed={seedBase + i * 13 + 7}
            frame={frame}
          />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

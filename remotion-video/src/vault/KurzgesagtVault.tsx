// "The vault" — a 29s Kurzgesagt-style explainer, 870 frames at 30fps.
//
// The whole video is one continuous scene. There are no cuts and no
// <Sequence> boundaries: every element fades and scales itself in and out
// inside a single 3840x2160 container, and the camera (camera.ts) carries you
// between beats by never stopping.

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ease, easeOut, reveal, type Reveal } from "./anim";
import { AmbientDots } from "./AmbientDots";
import { cameraAt } from "./camera";
import {
  CUE,
  PALETTE,
  POS,
  SCENE_CX,
  SCENE_CY,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  lead,
} from "./constants";
import { registerVaultFont } from "./font";
import { SceneItem } from "./SceneItem";
import { Barrier } from "./props/Barrier";
import { Blob } from "./props/Blob";
import { Calendars } from "./props/Calendars";
import { ClockRing } from "./props/ClockRing";
import { CushionCrown } from "./props/CushionCrown";
import { Figure } from "./props/Figure";
import { Gauge } from "./props/Gauge";
import { Guard } from "./props/Guard";
import { Label } from "./props/Label";
import { PunchCards } from "./props/PunchCards";
import { QuestionMark } from "./props/QuestionMark";
import { RadialBurst } from "./props/RadialBurst";
import { Sandwich } from "./props/Sandwich";
import { Thermometer } from "./props/Thermometer";
import { Vault, VAULT_BLOB_COUNT } from "./props/Vault";

registerVaultFont();

/** Elements that were "always there" skip the entrance entirely. */
const ALWAYS: Reveal = { opacity: 1, scale: 1, rendered: true };

/** The four builders of cue 2, placed clear of the vault's 700px body. */
const BUILDERS = [
  { x: 1290, y: 1230 },
  { x: 1330, y: 780 },
  { x: 2270, y: 760 },
  { x: 2280, y: 1400 },
];

const staggered = (
  frame: number,
  count: number,
  start: number,
  gap: number,
  duration = 12,
) =>
  new Array(count)
    .fill(0)
    .map((_, i) => easeOut(frame, [start + i * gap, start + i * gap + duration], [0, 1]));

export const KurzgesagtVault: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const camera = cameraAt(frame);
  const seconds = frame / fps;

  // Cue 8 cools the background by ~8% and leaves it there.
  const background = interpolate(frame, [CUE.c8 + 30, CUE.c9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ---- cue 1-8: the vault ------------------------------------------------
  const vaultReveal = reveal(frame, 0, lead(CUE.c9));
  const doorOpen = ease(frame, [lead(CUE.c3), lead(CUE.c3) + 30], [0, 1]);
  const blobScales = staggered(frame, VAULT_BLOB_COUNT, CUE.c3, 3);
  const vaultGlow = Math.max(
    ease(frame, [CUE.c3, CUE.c3 + 30], [0.12, 0.75]),
    0,
  );

  // ---- cue 2: the builders ----------------------------------------------
  const builderReveal = reveal(frame, lead(CUE.c2), lead(CUE.c5));

  // ---- cue 4: the guard and his clock ------------------------------------
  const guardReveal = reveal(frame, lead(CUE.c4));
  const armCross = ease(frame, [CUE.c4, CUE.c4 + 30], [0, 1]);
  // The hand starts the frame he arrives and never stops, in any cue.
  const clockAngle = Math.max(frame - lead(CUE.c4), 0) * 4.5;

  // ---- cue 5-6: the punch cards -----------------------------------------
  const cardsReveal = reveal(frame, lead(CUE.c5), CUE.c6 + 6);
  const cardScales = staggered(frame, 5, lead(CUE.c5), 4);

  // ---- cue 7: the escape attempt ----------------------------------------
  const escapeReveal = reveal(frame, lead(CUE.c7), CUE.c8);
  const escapeOut = easeOut(frame, [lead(CUE.c7), 288], [0, 1]);
  const escapeBack = ease(frame, [288, 300], [0, 1]);
  const escapeT = escapeOut * (1 - escapeBack);
  const barrierFlash =
    frame >= 288 && frame < 300 ? Math.sin(((frame - 288) / 12) * Math.PI) : 0;

  // ---- cue 8: the thermometer -------------------------------------------
  const thermoReveal = reveal(frame, lead(CUE.c8), lead(CUE.c9));
  const thermoLevel = ease(frame, [CUE.c8 + 30, CUE.c9 - 8], [1, 0.16]);

  // ---- cue 9: the religious event ---------------------------------------
  const sandwichReveal = reveal(frame, lead(CUE.c9), lead(CUE.c10));
  const sandwichScale = ease(frame, [405, 425], [1, 1.4]);
  const burstAmount =
    ease(frame, [399, 420], [0, 1]) * ease(frame, [lead(CUE.c10), 458], [1, 0]);
  const burstAngle = Math.max(frame - 405, 0) * 0.35;

  // ---- cue 10: the years -------------------------------------------------
  const calendarReveal = reveal(frame, lead(CUE.c10), 519);
  const calendarScales = staggered(frame, 7, lead(CUE.c10), 3);
  const calendarTick = Math.max(Math.floor((frame - lead(CUE.c10)) / 5), 0);

  // ---- cue 11: the crown jewels -----------------------------------------
  const cushionReveal = reveal(frame, lead(CUE.c11), lead(CUE.c13));
  // The one and only bounce in the video.
  const crownDrop = interpolate(frame, [540, 562, 575, 588], [340, 0, -24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const crownOpacity = ease(frame, [lead(CUE.c11), CUE.c11], [0, 1]);
  const cushionGlow = ease(frame, [586, 615], [0.3, 1]);

  // ---- cue 12: the question ----------------------------------------------
  const questionReveal = reveal(frame, lead(CUE.c12), CUE.c15 + 3);

  // ---- cue 13-15: the gauge ----------------------------------------------
  const lateVaultReveal = reveal(frame, lead(CUE.c13));
  const gaugeReveal = reveal(frame, 744);
  const gaugeLevel = ease(frame, [750, 800], [0.06, 0.94]);
  const gaugePulse =
    frame >= CUE.c14 && frame < CUE.c14 + 8
      ? Math.sin(((frame - CUE.c14) / 8) * Math.PI)
      : 0;
  const leptinReveal = reveal(frame, lead(CUE.c15));

  // ---- cue 16: the infant ------------------------------------------------
  // No entrance: it is revealed by the camera pulling out, not by animating
  // in. It only mounts once it is safely below the tight cue-13 framing.
  const infantVisible = frame >= 795;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background > 0 ? PALETTE.navyCool : PALETTE.navy,
        overflow: "hidden",
      }}
    >
      {/* Cross-fade the cooler navy in rather than switching it */}
      <AbsoluteFill
        style={{ backgroundColor: PALETTE.navy, opacity: 1 - background }}
      />

      {/* The camera: scale about the viewport centre, then pan. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 0,
          height: 0,
          transform: `scale(${camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`,
        }}
      >
        {/* The oversized scene container everything is positioned inside. */}
        <div
          style={{
            position: "absolute",
            left: -SCENE_CX,
            top: -SCENE_CY,
            width: SCENE_WIDTH,
            height: SCENE_HEIGHT,
          }}
        >
          <AmbientDots />

          {/* Cue 2 — the four builders */}
          {BUILDERS.map((spot, i) => (
            <SceneItem key={i} x={spot.x} y={spot.y} reveal={builderReveal} seed={11 + i * 7}>
              <Figure
                height={116}
                armAngle={18 + Math.sin(seconds * 5.2 + i * 1.7) * 26}
              />
            </SceneItem>
          ))}

          {/* Cue 1-8 — the vault */}
          <SceneItem x={POS.vault.x} y={POS.vault.y} reveal={vaultReveal} seed={3} floatAmplitude={5}>
            <Vault
              idSuffix="early"
              doorOpen={doorOpen}
              blobScales={blobScales}
              glow={vaultGlow}
              wobble={seconds * 1.6}
            />
          </SceneItem>

          {/* Cue 7 — one globule tries to leave, and does not */}
          <SceneItem
            x={POS.vault.x - 30 + escapeT * 420}
            y={POS.vault.y - escapeT * 40}
            reveal={escapeReveal}
            seed={19}
            floatAmplitude={4}
          >
            <Blob radius={62} wobble={seconds * 2.2} />
          </SceneItem>
          <SceneItem x={POS.vault.x} y={POS.vault.y} reveal={ALWAYS} seed={5} floatAmplitude={5}>
            <Barrier flash={barrierFlash} />
          </SceneItem>

          {/* Cue 4 — the guard, and the clock that never stops */}
          <SceneItem x={POS.guard.x} y={POS.guard.y} reveal={guardReveal} seed={23} floatAmplitude={5}>
            <Guard cross={armCross} idle={seconds * 1.1} />
          </SceneItem>
          <SceneItem x={POS.clock.x} y={POS.clock.y} reveal={guardReveal} seed={31} floatAmplitude={7}>
            <ClockRing angle={clockAngle} />
          </SceneItem>

          {/* Cue 5 — blank punch cards */}
          <SceneItem x={POS.punchCards.x} y={POS.punchCards.y} reveal={cardsReveal} seed={13}>
            <PunchCards slotScales={cardScales} />
          </SceneItem>

          {/* Cue 8 — body temperature, dropped without telling you */}
          <SceneItem x={POS.thermometer.x} y={POS.thermometer.y} reveal={thermoReveal} seed={29}>
            <Thermometer level={thermoLevel} />
          </SceneItem>

          {/* Cue 9 — the cheese sandwich as a religious event */}
          <SceneItem x={POS.sandwich.x} y={POS.sandwich.y} reveal={sandwichReveal} seed={17} floatAmplitude={5}>
            <RadialBurst amount={burstAmount} angle={burstAngle} />
          </SceneItem>
          <SceneItem
            x={POS.sandwich.x}
            y={POS.sandwich.y}
            reveal={sandwichReveal}
            seed={7}
            scale={sandwichScale}
            floatAmplitude={5}
          >
            <Sandwich glow={ease(frame, [399, 425], [0.15, 1])} />
          </SceneItem>

          {/* Cue 10 — the years going by */}
          <SceneItem x={POS.calendars.x} y={POS.calendars.y} reveal={calendarReveal} seed={37}>
            <Calendars
              squareScales={calendarScales}
              active={calendarTick % 7}
              tick={calendarTick}
            />
          </SceneItem>

          {/* Cue 11 — the crown jewels */}
          <SceneItem x={POS.cushion.x} y={POS.cushion.y} reveal={cushionReveal} seed={41} floatAmplitude={5}>
            <CushionCrown
              crownDrop={crownDrop}
              crownOpacity={crownOpacity}
              glow={cushionGlow}
              wobble={seconds * 1.4}
            />
          </SceneItem>

          {/* Cue 12 — how would it even know? */}
          <SceneItem x={POS.question.x} y={POS.question.y} reveal={questionReveal} seed={43} floatAmplitude={8}>
            <QuestionMark pulse={(Math.sin(seconds * 2.1) + 1) / 2} />
          </SceneItem>

          {/* Cue 13 — the vault comes back, centre-left, with its gauge */}
          <SceneItem x={POS.vaultLate.x} y={POS.vaultLate.y} reveal={lateVaultReveal} seed={3} floatAmplitude={5}>
            <Vault
              idSuffix="late"
              doorOpen={1}
              blobScales={new Array(VAULT_BLOB_COUNT).fill(1)}
              glow={0.4}
              wobble={seconds * 1.6}
            />
          </SceneItem>
          <SceneItem x={POS.gauge.x} y={POS.gauge.y} reveal={gaugeReveal} seed={47} floatAmplitude={4}>
            <Gauge level={gaugeLevel} pulse={gaugePulse} />
          </SceneItem>

          {/* Cue 16 — it was always standing there */}
          {infantVisible ? (
            <SceneItem x={POS.infant.x} y={POS.infant.y} reveal={ALWAYS} seed={53} floatAmplitude={4}>
              <Figure height={150} infant armAngle={26} />
            </SceneItem>
          ) : null}

          {/* Type — cream, lowercase, never more than three words */}
          <SceneItem x={POS.label.x} y={POS.label.y} reveal={reveal(frame, 0, lead(CUE.c3))} seed={2}>
            <Label text="a vault" />
          </SceneItem>
          <SceneItem x={POS.label.x} y={POS.label.y} reveal={reveal(frame, lead(CUE.c5), lead(CUE.c7))} seed={4}>
            <Label text="never off" />
          </SceneItem>
          <SceneItem x={1800} y={1450} reveal={reveal(frame, lead(CUE.c11), lead(CUE.c12))} seed={6}>
            <Label text="crown jewels" />
          </SceneItem>
          <SceneItem x={POS.gauge.x + 90} y={POS.gauge.y + 250} reveal={leptinReveal} seed={8}>
            <Label text="leptin" size={64} />
          </SceneItem>
        </div>
      </div>

      {/* Vignette, fixed to the frame rather than the scene */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 52%, rgba(0,0,0,0.13) 78%, rgba(0,0,0,0.3) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

import React from "react";
import {Composition} from "remotion";
import {CalendarFlip, type CalendarFlipProps} from "./CalendarFlip";
import {DURATION} from "./timing";

/**
 * Four listings, one codebase. The year and the week-start convention are the
 * only things that differ — buyers search by year, and by whether the week
 * starts on Sunday (US) or Monday (ISO).
 */
const VERSIONS: {id: string; props: CalendarFlipProps}[] = [
  {id: "V1-Calendar2026-SunStart", props: {year: 2026, weekStart: 0}},
  {id: "V2-Calendar2026-MonStart", props: {year: 2026, weekStart: 1}},
  {id: "V3-Calendar2027-SunStart", props: {year: 2027, weekStart: 0}},
  {id: "V4-Calendar2027-MonStart", props: {year: 2027, weekStart: 1}},
];

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map(({id, props}) => (
      <Composition
        key={id}
        id={id}
        component={CalendarFlip}
        durationInFrames={DURATION}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={props}
      />
    ))}
  </>
);

import React from 'react';
import {
  SPHERE_CX,
  SPHERE_CY,
  SPHERE_R,
  SPHERE_TILT,
  SPHERE_TURNS,
  SW,
} from '../constants';
import { loopPhase, loopSin } from '../motion';
import { LAT_STEPS, LON_COUNT, latitude, longitude, makeProjector } from '../sphere';
import type { Theme } from '../theme';

const TILT = (SPHERE_TILT * Math.PI) / 180;

/** Bracket marks at the sphere's cardinal points. */
const CARDINALS = [0, 90, 180, 270];

export const Sphere: React.FC<{ theme: Theme; frame: number; bloom?: boolean }> = ({
  theme,
  frame,
  bloom = false,
}) => {
  const spin = 2 * Math.PI * loopPhase(frame, SPHERE_TURNS);
  const project = makeProjector(SPHERE_CX, SPHERE_CY, SPHERE_R, TILT, spin);

  const lats = LAT_STEPS.map((phi) => latitude(project, phi));
  const lons = Array.from({ length: LON_COUNT }, (_, i) =>
    longitude(project, (i / LON_COUNT) * Math.PI),
  );

  const nearW = bloom ? SW.wire * 1.5 : SW.wire;
  const nearO = bloom ? 1 : 0.85;
  const farO = bloom ? 0.28 : 0.3;

  // The dashed ring turns two full dash cycles across the loop.
  const dash = 46;
  const ringR = SPHERE_R * 1.2;
  const dashOffset = -(loopPhase(frame, 2) % 1) * dash * 2;

  const breathe = 1 + 0.006 * loopSin(frame, 1);

  return (
    <g>
      {!bloom ? (
        <circle
          cx={SPHERE_CX}
          cy={SPHERE_CY}
          r={SPHERE_R}
          fill={theme.bgCentre}
          opacity={0.55}
        />
      ) : null}

      {/* Far half of the wireframe, sitting behind the near half. */}
      <g fill="none" stroke={theme.wireBack} strokeWidth={SW.wire * 0.85} opacity={farO}>
        {lats.map((l, i) => <path key={`lf${i}`} d={l.far} />)}
        {lons.map((l, i) => <path key={`nf${i}`} d={l.far} />)}
      </g>

      <g fill="none" stroke={theme.wire} strokeWidth={nearW} opacity={nearO}>
        {lats.map((l, i) => (
          <path key={`ln${i}`} d={l.near} opacity={LAT_STEPS[i] === 0 ? 1 : 0.66} />
        ))}
        {lons.map((l, i) => <path key={`nn${i}`} d={l.near} opacity={0.6} />)}
      </g>

      {/* Silhouette, dashed ring and cardinal brackets. */}
      <g transform={`translate(${SPHERE_CX} ${SPHERE_CY}) scale(${breathe}) translate(${-SPHERE_CX} ${-SPHERE_CY})`}>
        <circle
          cx={SPHERE_CX}
          cy={SPHERE_CY}
          r={SPHERE_R}
          fill="none"
          stroke={theme.wire}
          strokeWidth={SW.wire}
          opacity={bloom ? 0.9 : 0.55}
        />
        <circle
          cx={SPHERE_CX}
          cy={SPHERE_CY}
          r={ringR}
          fill="none"
          stroke={theme.accent}
          strokeWidth={SW.frame}
          strokeDasharray={`${dash * 0.42} ${dash * 0.58}`}
          strokeDashoffset={dashOffset}
          opacity={bloom ? 0.85 : 0.6}
        />
        {CARDINALS.map((deg) => (
          <g key={deg} transform={`rotate(${deg} ${SPHERE_CX} ${SPHERE_CY})`}>
            <path
              d={`M${SPHERE_CX - 46} ${SPHERE_CY - ringR - 34}h-16v${34}h16`}
              fill="none"
              stroke={theme.accent}
              strokeWidth={SW.accent}
              opacity={bloom ? 1 : 0.8}
            />
            <path
              d={`M${SPHERE_CX + 46} ${SPHERE_CY - ringR - 34}h16v${34}h-16`}
              fill="none"
              stroke={theme.accent}
              strokeWidth={SW.accent}
              opacity={bloom ? 1 : 0.8}
            />
          </g>
        ))}
      </g>

      {/* Poles. */}
      {[-1, 1].map((s) => {
        const p = project((s * Math.PI) / 2, 0);
        return (
          <circle key={s} cx={p.x} cy={p.y} r={7} fill={theme.accent} opacity={bloom ? 1 : 0.85} />
        );
      })}
    </g>
  );
};

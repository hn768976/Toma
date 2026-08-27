import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {
  BOTTOM_SLOTS,
  DURATION,
  H,
  LEFT_SLOTS,
  RIGHT_SLOTS,
  T_ASSEMBLE_END,
  T_ASSEMBLE_START,
  TOP,
  VIEWPORT,
  W,
} from './lib/layout';
import {VARIANTS} from './variants';
import type {VariantKey} from './variants';
import {HudFrame} from './components/HudFrame';
import {Overlay} from './components/Overlay';
import {ScanSweep, sweepFlash} from './components/ScanSweep';
import {SidePanel} from './components/SidePanel';
import type {PanelEntry} from './components/SidePanel';
import {SubjectParticles, useSubject} from './components/SubjectParticles';
import {buildPropagation, evalPulses} from './lib/propagate';
import {clamp01, easeOut, rnd} from './lib/rand';

/** ±8px ambient drift on a closed figure-of-eight, period 600. */
export const drift = (f: number): [number, number] => [
  8 * Math.sin((f / DURATION) * Math.PI * 2),
  8 * Math.sin((f / DURATION) * Math.PI * 4),
];

export const ScanHud: React.FC<{variant: VariantKey}> = ({variant}) => {
  const frame = useCurrentFrame();
  const f = ((frame % DURATION) + DURATION) % DURATION;
  const v = VARIANTS[variant];
  const r = v.readouts;
  const subject = useSubject(v, variant);
  const d = drift(f);
  const asm = easeOut((f - T_ASSEMBLE_START) / (T_ASSEMBLE_END - T_ASSEMBLE_START));

  // "propagate" variants replace the sweep entirely with signal propagation
  // along the subject's folds. Built once, evaluated per frame.
  const propagation = useMemo(
    () => buildPropagation(v.silhouette, v.motion, subject.particles, variant),
    [v, subject, variant],
  );
  const {boost, activity} = useMemo(() => {
    if (!propagation) return {boost: null, activity: 0};
    const out = new Float32Array(subject.particles.n);
    return {boost: out, activity: evalPulses(propagation, subject.particles, f, out)};
  }, [propagation, subject, f]);

  const entries = useMemo<PanelEntry[]>(() => {
    const [wave, table, numA, numB, grid] = LEFT_SLOTS;
    const [meters, radar, scroll, strips] = RIGHT_SLOTS;
    const [hist, numerals, status] = BOTTOM_SLOTS;
    return [
      {key: 'top', delay: 10, rect: TOP, block: {kind: 'toprow', spec: r.top}},
      {key: 'wave', delay: 11, rect: wave, block: {kind: 'wave', spec: r.wave}},
      {key: 'meters', delay: 11.5, rect: meters, block: {kind: 'meters', spec: r.meters}},
      {key: 'table', delay: 12.5, rect: table, block: {kind: 'table', spec: r.table}},
      {key: 'radar', delay: 13, rect: radar, block: {kind: 'radar', spec: r.radar}},
      {key: 'numA', delay: 14, rect: numA, block: {kind: 'numeric', spec: r.numA}},
      {key: 'scroll', delay: 14.5, rect: scroll, block: {kind: 'scroll', spec: r.scroll}},
      {key: 'numB', delay: 15, rect: numB, block: {kind: 'numeric', spec: r.numB}},
      {key: 'strips', delay: 15.5, rect: strips, block: {kind: 'strips', spec: r.strips}},
      {key: 'grid', delay: 16, rect: grid, block: {kind: 'grid', spec: r.grid}},
      {key: 'hist', delay: 16.5, rect: hist, block: {kind: 'hist', spec: r.hist}},
      {key: 'numerals', delay: 17, rect: numerals, block: {kind: 'numerals', spec: r.numerals}},
      {key: 'status', delay: 17.5, rect: status, block: {kind: 'status', spec: r.status}},
    ];
  }, [r]);

  // The sweep drives the panels: on each pass, three readouts flash and
  // re-roll. Which three is seeded from the pass index, so the loop closes.
  const period = v.motion.mode === 'sweep' ? v.motion.period : 60;
  const cycle = Math.floor(f / period);
  const flash =
    (v.motion.mode === 'sweep' ? sweepFlash(f, v.motion) : activity) *
    clamp01(asm);
  const flashSet = useMemo(() => {
    const keys = entries.map((e) => e.key);
    const out = new Set<string>();
    for (let i = 0; i < 3; i++) {
      out.add(keys[Math.floor(rnd(`flash${variant}:${cycle}:${i}`) * keys.length)]);
    }
    return out;
  }, [entries, cycle, variant]);

  return (
    <AbsoluteFill style={{backgroundColor: v.palette.bg}}>
      <SubjectParticles
        frame={f}
        variant={v}
        subject={subject}
        boost={boost}
        width={W}
        height={H}
        drift={d}
        clip={VIEWPORT}
      />
      <ScanSweep
        frame={f}
        motion={v.motion}
        palette={v.palette}
        bounds={subject.bounds}
        width={W}
        height={H}
        drift={d}
        reveal={clamp01(asm)}
        clip={VIEWPORT}
      />
      <HudFrame frame={f} palette={v.palette} />
      <SidePanel
        entries={entries}
        palette={v.palette}
        frame={f}
        seed={variant}
        flashSet={flashSet}
        flash={flash}
        reroll={cycle}
        activity={activity}
      />
      <Overlay frame={f} />
    </AbsoluteFill>
  );
};

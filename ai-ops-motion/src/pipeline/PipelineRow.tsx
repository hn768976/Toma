import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACCENT, alpha, DISPLAY_FONT, MONO_FONT, PIPE } from "../shared/theme";
import { formatInt, Readout } from "../shared/ui";
import { wander } from "../shared/rand";
import { FORK, JOB_IDS, PIPE_LAYOUT, STAGES, type Stage } from "./data";
import { StageIcon } from "./StageIcon";
import {
  APPROVE_SEGS,
  DIAMOND_H,
  DIAMOND_W,
  ESCALATE_SEGS,
  RAIL_Y,
  ROUTES,
  routeAt,
  segsToPath,
} from "./rail";

const { cardW, cardH, cardY, labelY, metricY } = PIPE_LAYOUT;

/** Frames one stage holds the focus ring before it moves on. */
const FOCUS_PER_STAGE = 46;
/** Frames between two jobs entering the pipeline, and how long a job takes. */
const SPAWN_EVERY = 44;
const TRAVEL = 186;
/** Nothing enters the rail until the cards have settled. */
const JOBS_START = 70;

const stageValue = (id: string, frame: number): string => {
  switch (id) {
    case "input":
      return formatInt(wander("v-input", frame / 48, 980, 1330, 2));
    case "validation":
      return wander("v-val", frame / 52, 96.9, 99.4, 2).toFixed(1);
    case "ai":
      return String(Math.round(wander("v-ai", frame / 44, 188, 312, 3)));
    case "decision":
      return wander("v-dec", frame / 56, 0.9, 0.98, 2).toFixed(2);
    case "execution":
      return formatInt(wander("v-exec", frame / 50, 740, 940, 2));
    case "review":
      return wander("v-rev", frame / 54, 98.2, 99.6, 2).toFixed(1);
    default:
      return formatInt(wander("v-out", frame / 46, 1120, 1340, 2));
  }
};

const StageCard: React.FC<{ stage: Stage; index: number; focus: number }> = ({
  stage,
  index,
  focus,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entry = spring({
    frame,
    fps,
    delay: 24 + index * 5,
    config: { damping: 200, mass: 0.6 },
  });
  const isDecision = stage.id === "decision";
  const w = isDecision ? DIAMOND_W : cardW;
  const h = isDecision ? DIAMOND_H : cardH;
  const scale = interpolate(entry, [0, 1], [0.86, 1]) * (1 + focus * 0.035);

  return (
    <div
      style={{
        position: "absolute",
        left: stage.cx - w / 2,
        top: RAIL_Y - h / 2,
        width: w,
        height: h,
        opacity: entry,
        transform: `scale(${scale})`,
      }}
    >
      {isDecision ? (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <polygon
            points={`${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}`}
            fill={alpha(stage.color, 0.07 + focus * 0.06)}
            stroke={alpha(stage.color, 0.45 + focus * 0.5)}
            strokeWidth={1.4}
            style={{
              filter: focus > 0.05 ? `drop-shadow(0 0 ${8 + focus * 16}px ${alpha(stage.color, 0.55)})` : undefined,
            }}
          />
        </svg>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 10,
            background: PIPE.card,
            border: `1px solid ${alpha(stage.color, 0.3 + focus * 0.55)}`,
            boxShadow:
              focus > 0.05
                ? `0 0 ${10 + focus * 26}px ${alpha(stage.color, 0.18 + focus * 0.3)}, inset 0 0 ${focus * 26}px ${alpha(stage.color, focus * 0.1)}`
                : undefined,
          }}
        />
      )}

      {!isDecision ? (
        <>
          {/* Top rule, index and status dot — the chrome on every card. */}
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 9,
              height: 3,
              borderRadius: 2,
              background: stage.color,
              opacity: 0.55 + focus * 0.45,
              boxShadow: `0 0 ${6 + focus * 10}px ${alpha(stage.color, 0.8)}`,
              transform: `scaleX(${entry})`,
              transformOrigin: "left",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 12,
              top: 18,
              fontFamily: MONO_FONT,
              fontSize: 8.5,
              color: PIPE.textFaint,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 20,
              width: 5,
              height: 5,
              borderRadius: 3,
              background: stage.color,
              opacity: 0.4 + focus * 0.6,
              boxShadow: `0 0 7px ${alpha(stage.color, 0.9)}`,
            }}
          />
        </>
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.75 + focus * 0.25,
        }}
      >
        <StageIcon kind={stage.icon} color={stage.color} size={isDecision ? 30 : 34} />
      </div>
    </div>
  );
};

const Chevrons: React.FC<{ from: number; to: number; color: string; delay: number }> = ({
  from,
  to,
  color,
  delay,
}) => {
  const frame = useCurrentFrame();
  const count = 4;
  const span = to - from;
  const appear = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        // A brightness pulse runs left to right through the arrow row.
        const phase = ((frame / 26 - i / count) % 1 + 1) % 1;
        const lit = Math.max(0, 1 - Math.abs(phase - 0.2) * 3.2);
        return (
          <svg
            key={i}
            width={9}
            height={9}
            viewBox="0 0 9 9"
            style={{
              position: "absolute",
              left: from + (span / count) * (i + 0.5) - 4.5,
              top: RAIL_Y - 4.5,
              opacity: (0.22 + lit * 0.78) * appear,
            }}
          >
            <path
              d="M2.5 1.5L6 4.5L2.5 7.5"
              fill="none"
              stroke={color}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      })}
    </>
  );
};

const ForkPill: React.FC<{
  label: string;
  y: number;
  color: string;
  active: number;
  delay: number;
}> = ({ label, y, color, active, delay }) => {
  const frame = useCurrentFrame();
  const appear = interpolate(frame, [delay, delay + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: FORK.cx - FORK.width / 2,
        top: y - FORK.height / 2,
        width: FORK.width,
        height: FORK.height,
        borderRadius: FORK.height / 2,
        border: `1.4px solid ${alpha(color, 0.5 + active * 0.5)}`,
        background: alpha(color, 0.05 + active * 0.1),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: DISPLAY_FONT,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1.8,
        color: alpha(color, 0.75 + active * 0.25),
        opacity: appear,
        boxShadow: active > 0.05 ? `0 0 ${active * 22}px ${alpha(color, 0.45)}` : undefined,
      }}
    >
      {label}
    </div>
  );
};

/** Jobs currently in flight, as a pure function of the frame. */
const useJobs = (frame: number) => {
  const jobs: { id: string; u: number; branch: "approve" | "escalate"; key: number }[] = [];
  const t = frame - JOBS_START;
  if (t < 0) return jobs;
  const newest = Math.floor(t / SPAWN_EVERY);
  for (let n = newest; n >= newest - 6; n--) {
    if (n < 0) continue;
    const age = t - n * SPAWN_EVERY;
    const u = age / TRAVEL;
    if (u < 0 || u > 1) continue;
    jobs.push({
      id: JOB_IDS[n % JOB_IDS.length],
      u,
      // Every fourth job takes the escalation branch.
      branch: n % 4 === 2 ? "escalate" : "approve",
      key: n,
    });
  }
  return jobs;
};

export const PipelineRow: React.FC = () => {
  const frame = useCurrentFrame();
  const jobs = useJobs(frame);

  // Focus ring walks the stages; `focusAt` is a soft falloff around it.
  const cursor = (frame / FOCUS_PER_STAGE) % STAGES.length;
  const focusAt = (i: number) => {
    const d = Math.min(
      Math.abs(cursor - i),
      Math.abs(cursor - i - STAGES.length),
      Math.abs(cursor - i + STAGES.length),
    );
    return Math.max(0, 1 - d / 0.85);
  };

  const guideDraw = interpolate(frame, [34, 66], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const escalating = jobs.some((j) => j.branch === "escalate" && j.u > 0.42 && j.u < 0.66);
  const approving = jobs.some((j) => j.branch === "approve" && j.u > 0.42 && j.u < 0.66);

  return (
    <>
      <svg
        width={1920}
        height={1080}
        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
      >
        {[
          { segs: APPROVE_SEGS, color: ACCENT.emerald },
          { segs: ESCALATE_SEGS, color: ACCENT.amber },
        ].map((b, i) => (
          <path
            key={i}
            d={segsToPath(b.segs)}
            fill="none"
            stroke={alpha(b.color, 0.3)}
            strokeWidth={1.2}
            strokeDasharray={1}
            pathLength={1}
            strokeDashoffset={1 - guideDraw}
          />
        ))}
      </svg>

      {[
        [STAGES[0], STAGES[1]],
        [STAGES[1], STAGES[2]],
        [STAGES[2], STAGES[3]],
        [STAGES[4], STAGES[5]],
        [STAGES[5], STAGES[6]],
      ].map(([a, b], i) => {
        const aHalf = a.id === "decision" ? DIAMOND_W / 2 : cardW / 2;
        const bHalf = b.id === "decision" ? DIAMOND_W / 2 : cardW / 2;
        return (
          <Chevrons
            key={a.id}
            from={a.cx + aHalf + 6}
            to={b.cx - bHalf - 6}
            color={a.color}
            delay={30 + i * 4}
          />
        );
      })}

      <ForkPill
        label="APPROVE"
        y={FORK.approveY}
        color={ACCENT.emerald}
        active={approving ? 1 : 0.15}
        delay={40}
      />
      <ForkPill
        label="ESCALATE"
        y={FORK.escalateY}
        color={ACCENT.amber}
        active={escalating ? 1 : 0.15}
        delay={44}
      />

      {STAGES.map((s, i) => (
        <StageCard key={s.id} stage={s} index={i} focus={focusAt(i)} />
      ))}

      {STAGES.map((s, i) => {
        const entry = interpolate(frame, [28 + i * 5, 52 + i * 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={`${s.id}-label`}
            style={{
              position: "absolute",
              left: s.cx - 120,
              top: labelY,
              width: 240,
              textAlign: "center",
              opacity: entry,
            }}
          >
            <div
              style={{
                fontFamily: DISPLAY_FONT,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 1.4,
                color: PIPE.text,
              }}
            >
              {s.label}
            </div>
            <div style={{ marginTop: 6 }}>
              <Readout size={11} color={alpha(s.color, 0.9)}>
                {stageValue(s.id, frame)} {s.metric}
              </Readout>
            </div>
          </div>
        );
      })}

      {jobs.map((job) => {
        const pos = routeAt(ROUTES[job.branch], job.u);
        const fade = Math.min(1, job.u / 0.06, (1 - job.u) / 0.08);
        return (
          <div
            key={job.key}
            style={{
              position: "absolute",
              left: pos.x - 46,
              top: pos.y - 12,
              width: 92,
              height: 24,
              borderRadius: 12,
              background: "#f2f6fb",
              display: "flex",
              alignItems: "center",
              gap: 7,
              paddingLeft: 9,
              opacity: fade,
              boxShadow: `0 0 16px ${alpha("#ffffff", 0.28)}`,
            }}
          >
            <span
              style={{ width: 7, height: 7, borderRadius: 4, background: "#0b1120", flexShrink: 0 }}
            />
            <span
              style={{
                fontFamily: MONO_FONT,
                fontSize: 9,
                fontWeight: 700,
                color: "#0b1120",
                letterSpacing: 0.3,
              }}
            >
              {job.id}
            </span>
          </div>
        );
      })}
    </>
  );
};

export { FOCUS_PER_STAGE };

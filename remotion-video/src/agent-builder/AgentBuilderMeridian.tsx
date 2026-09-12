import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { z } from "zod";
import { Stage } from "./Stage";
import { Mono, Panel, PanelHeader, StatusDot } from "./primitives";
import { FONT_SANS, MERIDIAN } from "./theme";
import { BottomBar } from "./parts/Chrome";
import { BuildButton, IntentChips, PromptBox } from "./parts/Composer";
import { CanvasMeta, HorizontalCanvas } from "./parts/Canvas";
import { ExecutionList, PropertyRows } from "./parts/Inspector";
import {
  ActivityBars,
  LogStream,
  Sparkline,
  ThroughputValue,
} from "./parts/Telemetry";
import { agentBuilderSchema } from "./AgentBuilderSignal";
import { T } from "./timeline";

export const meridianDefaultProps: z.infer<typeof agentBuilderSchema> = {
  productName: "MERIDIAN",
  breadcrumb: "workspace / agents / untitled-01",
  headline: "Compose an agent",
  subhead: "Describe the agent in plain language.",
};

const theme = MERIDIAN;

/** Icon rail down the left edge, standing in for the reference's top bar. */
const Rail: React.FC<{ productName: string }> = ({ productName }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: 78,
        flexShrink: 0,
        opacity,
        background: theme.panelAlt,
        borderRight: `1px solid ${theme.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "22px 0 20px",
        gap: 26,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 4,
          background: theme.accentDim,
          border: `1px solid ${theme.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 18px ${theme.accentGlow}`,
        }}
      >
        <Mono color={theme.accentSoft} size={13} weight={500}>
          M
        </Mono>
      </div>

      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            width: 22,
            height: 22,
            borderRadius: 3,
            border: `1px solid ${i === 0 ? theme.borderStrong : theme.border}`,
            background: i === 0 ? theme.card : "transparent",
          }}
        />
      ))}

      <div style={{ flex: 1 }} />

      <div
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
        }}
      >
        <Mono color={theme.textFaint} size={9}>
          {productName}
        </Mono>
      </div>
    </div>
  );
};

/**
 * Version B -- same 15s script, restructured. A vertical icon rail replaces
 * the top bar, the composer spans the full width as a header band, the
 * workflow runs left-to-right instead of top-to-bottom, and the inspector is
 * docked along the bottom as a telemetry strip.
 */
export const AgentBuilderMeridian: React.FC<
  z.infer<typeof agentBuilderSchema>
> = ({ productName, breadcrumb, headline, subhead }) => {
  const frame = useCurrentFrame();
  const headlineIn = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage theme={theme}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "row" }}>
        <Rail productName={productName} />

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              padding: "20px 26px",
              minHeight: 0,
            }}
          >
            {/* ---- Composer band, full width -------------------------- */}
            <Panel
              theme={theme}
              delay={T.panelsIn}
              style={{
                height: 262,
                flexShrink: 0,
                display: "flex",
                padding: "24px 28px",
                gap: 34,
              }}
            >
              <div
                style={{
                  width: 330,
                  flexShrink: 0,
                  opacity: headlineIn,
                  transform: `translateY(${(1 - headlineIn) * 8}px)`,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Mono color={theme.accent} size={10}>
                  NEW WORKFLOW
                </Mono>
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 38,
                    fontWeight: 600,
                    letterSpacing: -0.8,
                    marginTop: 12,
                    lineHeight: 1.1,
                    color: theme.text,
                  }}
                >
                  {headline}
                </div>
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 13.5,
                    color: theme.textDim,
                    marginTop: 10,
                    lineHeight: 1.5,
                  }}
                >
                  {subhead}
                </div>
                <div style={{ marginTop: 20 }}>
                  <Mono color={theme.textFaint} size={10}>
                    {breadcrumb}
                  </Mono>
                </div>
                <div style={{ flex: 1 }} />
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  minWidth: 0,
                }}
              >
                <PromptBox theme={theme} height={112} fontSize={22} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Mono color={theme.textFaint} size={10}>
                    DETECTED INTENTS
                  </Mono>
                  <div style={{ flex: 1 }}>
                    <IntentChips theme={theme} columns={4} />
                  </div>
                </div>
              </div>

              <div
                style={{
                  width: 224,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 16,
                  borderLeft: `1px solid ${theme.border}`,
                  paddingLeft: 28,
                }}
              >
                <BuildButton theme={theme} width={196} />
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                    color: theme.textDim,
                  }}
                >
                  Auto-generates nodes, tools and approval gates
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <StatusDot theme={theme} on={frame >= T.buildPress} />
                  <Mono color={theme.textFaint} size={9}>
                    RUN NUM #001
                  </Mono>
                </div>
              </div>
            </Panel>

            {/* ---- Horizontal pipeline -------------------------------- */}
            <Panel
              theme={theme}
              delay={T.panelsIn + 3}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                background: theme.bg,
                minHeight: 0,
              }}
            >
              <PanelHeader
                theme={theme}
                left="PIPELINE"
                right={<CanvasMeta theme={theme} />}
              />
              <HorizontalCanvas
                theme={theme}
                cardWidth={246}
                cardHeight={186}
              />
            </Panel>

            {/* ---- Docked telemetry strip ----------------------------- */}
            <div
              style={{ display: "flex", gap: 18, height: 272, flexShrink: 0 }}
            >
              <Panel
                theme={theme}
                delay={T.panelsIn + 6}
                style={{
                  width: 430,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <PanelHeader
                  theme={theme}
                  left="AGENT PROPERTIES"
                  right={
                    <Mono color={theme.accent} size={10}>
                      AUTO
                    </Mono>
                  }
                />
                <div style={{ flex: 1, padding: "0 22px 10px" }}>
                  <PropertyRows theme={theme} compact />
                </div>
              </Panel>

              <Panel
                theme={theme}
                delay={T.panelsIn + 7}
                style={{ flex: 1, display: "flex", flexDirection: "column" }}
              >
                <PanelHeader
                  theme={theme}
                  left="EXECUTION"
                  right={
                    <Mono color={theme.textFaint} size={10}>
                      6 STEPS
                    </Mono>
                  }
                />
                <div
                  style={{
                    flex: 1,
                    padding: "0 22px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <div style={{ width: "100%" }}>
                    <ExecutionList theme={theme} compact columns={2} />
                  </div>
                </div>
              </Panel>

              <Panel
                theme={theme}
                delay={T.panelsIn + 8}
                style={{
                  width: 480,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <PanelHeader
                  theme={theme}
                  left="MODEL ACTIVITY"
                  right={<ThroughputValue theme={theme} />}
                />
                <div
                  style={{
                    flex: 1,
                    padding: "14px 20px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <ActivityBars theme={theme} height={44} bars={28} />
                  <Sparkline theme={theme} width={438} height={42} />
                  <LogStream theme={theme} rows={2} />
                </div>
              </Panel>
            </div>
          </div>

          <BottomBar theme={theme} />
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

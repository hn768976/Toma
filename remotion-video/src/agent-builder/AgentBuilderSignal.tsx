import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { z } from "zod";
import { Stage } from "./Stage";
import { Mono, Panel, PanelHeader } from "./primitives";
import { FONT_SANS, SIGNAL } from "./theme";
import { BottomBar, TopBar } from "./parts/Chrome";
import { BuildButton, IntentChips, PromptBox } from "./parts/Composer";
import { CanvasMeta, VerticalCanvas } from "./parts/Canvas";
import { ExecutionList, PropertyRows } from "./parts/Inspector";
import {
  ActivityBars,
  LogStream,
  Sparkline,
  ThroughputValue,
} from "./parts/Telemetry";
import { T } from "./timeline";

export const agentBuilderSchema = z.object({
  productName: z.string(),
  breadcrumb: z.string(),
  headline: z.string(),
  subhead: z.string(),
});

export const signalDefaultProps: z.infer<typeof agentBuilderSchema> = {
  productName: "AGENT BUILDER",
  breadcrumb: "workspace / agents / untitled-01",
  headline: "Create AI Agent",
  subhead: "Describe the agent in plain language.",
};

const theme = SIGNAL;

/**
 * Version A -- the reference cut. Three columns: a composer rail on the left,
 * the workflow canvas in the middle, an inspector on the right.
 */
export const AgentBuilderSignal: React.FC<
  z.infer<typeof agentBuilderSchema>
> = ({ productName, breadcrumb, headline, subhead }) => {
  const frame = useCurrentFrame();
  const headlineIn = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Stage theme={theme}>
      <AbsoluteFill style={{ display: "flex", flexDirection: "column" }}>
        <TopBar theme={theme} title={productName} breadcrumb={breadcrumb} />

        <div
          style={{
            flex: 1,
            display: "flex",
            gap: 22,
            padding: "22px 26px",
            minHeight: 0,
          }}
        >
          {/* ---- Left: composer ---------------------------------------- */}
          <div
            style={{
              width: 612,
              display: "flex",
              flexDirection: "column",
              gap: 22,
              minHeight: 0,
            }}
          >
            <Panel
              theme={theme}
              delay={T.panelsIn}
              style={{
                flexShrink: 0,
                padding: "26px 30px 30px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div
                style={{
                  opacity: headlineIn,
                  transform: `translateY(${(1 - headlineIn) * 8}px)`,
                }}
              >
                <Mono color={theme.accent} size={10}>
                  NEW WORKFLOW
                </Mono>
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 42,
                    fontWeight: 600,
                    letterSpacing: -0.9,
                    marginTop: 12,
                    color: theme.text,
                  }}
                >
                  {headline}
                </div>
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 14,
                    color: theme.textDim,
                    marginTop: 8,
                  }}
                >
                  {subhead}
                </div>
              </div>

              <PromptBox theme={theme} height={172} fontSize={21} />

              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <BuildButton theme={theme} width={212} />
                <div
                  style={{
                    fontFamily: FONT_SANS,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: theme.textDim,
                  }}
                >
                  Auto-generates nodes, tools
                  <br />
                  and approval gates
                </div>
              </div>
            </Panel>

            {/* Intents sit on the page ground between the two panels. */}
            <div style={{ padding: "0 4px" }}>
              <Mono color={theme.textFaint} size={10}>
                DETECTED INTENTS
              </Mono>
              <div style={{ marginTop: 14 }}>
                <IntentChips theme={theme} columns={2} />
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }} />

            <Panel
              theme={theme}
              delay={T.panelsIn + 4}
              style={{
                height: 214,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <PanelHeader
                theme={theme}
                left="MODEL ACTIVITY"
                right={
                  <Mono color={theme.textFaint} size={10}>
                    LIVE
                  </Mono>
                }
              />
              <div
                style={{
                  flex: 1,
                  padding: "18px 20px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <ActivityBars theme={theme} height={56} />
                <LogStream theme={theme} rows={3} />
              </div>
            </Panel>
          </div>

          {/* ---- Middle: workflow canvas ------------------------------- */}
          <Panel
            theme={theme}
            delay={T.panelsIn + 3}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: theme.bg,
              minWidth: 0,
            }}
          >
            <PanelHeader
              theme={theme}
              left="WORKFLOW CANVAS"
              right={<CanvasMeta theme={theme} />}
            />
            <VerticalCanvas
              theme={theme}
              cardWidth={558}
              cardHeight={79}
              gap={68}
            />
          </Panel>

          {/* ---- Right: inspector -------------------------------------- */}
          <Panel
            theme={theme}
            delay={T.panelsIn + 6}
            style={{
              width: 380,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
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
            <div
              style={{
                flex: 1,
                padding: "8px 22px 22px",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
              }}
            >
              <PropertyRows theme={theme} />

              <div style={{ marginTop: 26 }}>
                <Mono color={theme.textFaint} size={10}>
                  EXECUTION
                </Mono>
                <div style={{ marginTop: 12 }}>
                  <ExecutionList theme={theme} />
                </div>
              </div>

              <div style={{ flex: 1 }} />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <Mono color={theme.textFaint} size={10}>
                  THROUGHPUT
                </Mono>
                <ThroughputValue theme={theme} />
              </div>
              <Sparkline theme={theme} width={330} height={62} />
            </div>
          </Panel>
        </div>

        <BottomBar theme={theme} />
      </AbsoluteFill>
    </Stage>
  );
};

import React, { useMemo } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { DepthOfField, Grain, Vignette } from "./components/Atmosphere";
import { Graticule } from "./components/Graticule";
import { Markers, type MarkerInstance } from "./components/Markers";
import { PinBodies, PinGradients, PinPulses, PinShadows, placePins } from "./components/Pushpins";
import { dashSpec, EndpointDots, Routes, type PreparedRoute } from "./components/Routes";
import { DRIFT_AMPLITUDE, mapGeometry } from "./lib/geo";
import { PALETTES } from "./lib/palettes";
import { routePathData } from "./lib/paths";
import { makeRng, rngRange } from "./lib/prng";
import type { RouteMapProps } from "./lib/types";
import { regionById } from "./data/regions";
import "./load-fonts";

/** Markers on screen at once when a composition does not say otherwise. */
const DEFAULT_MARKER_COUNT = 26;

export const RouteMap: React.FC<RouteMapProps> = ({
  regionId,
  palette: paletteProp,
  routeType: routeTypeProp,
  markers: markerCount,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const region = useMemo(() => regionById(regionId), [regionId]);
  const palette = paletteProp ?? region.palette;
  const routeType = routeTypeProp ?? region.routeType;
  const pal = PALETTES[palette];
  const u = width / 1920;

  const g = useMemo(() => mapGeometry(region, width, height), [region, width, height]);

  // Every frame is a pure function of this. No state, no Math.random().
  const progress = frame / durationInFrames;

  const routes = useMemo<PreparedRoute[]>(
    () =>
      region.routes.map((def, i) => {
        const spec = dashSpec(def.style, u);
        const d = routePathData(def, g);
        return {
          def,
          d,
          color: pal.route[def.color],
          dashArray: spec.array,
          dashPeriod: spec.period,
          width: (def.weight ?? 1) * u * 1.55,
          // Whole dash periods per loop, so the march closes exactly. Derived
          // from a target travel distance so dotted and dashed lines march at
          // a similar rate rather than by their very different periods.
          marchPeriods: spec.period
            ? Math.max(1, Math.round((u * (620 + (i % 5) * 90)) / spec.period))
            : 0,
        };
      }),
    [region, g, pal, u],
  );

  const markers = useMemo<MarkerInstance[]>(() => {
    const weights = routes.map((r) => r.def.markers ?? 0);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const target = markerCount ?? DEFAULT_MARKER_COUNT;
    const counts = weights.map((w) => (w > 0 ? Math.max(1, Math.round((w / total) * target)) : 0));
    // trim from the busiest routes until we land on the requested total
    let over = counts.reduce((a, b) => a + b, 0) - target;
    while (over > 0) {
      const i = counts.indexOf(Math.max(...counts));
      if (counts[i] <= 1) break;
      counts[i] -= 1;
      over -= 1;
    }

    const out: MarkerInstance[] = [];
    routes.forEach((route, ri) => {
      const rng = makeRng(`${region.id}:${route.def.id}:markers`);
      const kind =
        route.def.mode ??
        (routeType === "air" ? "air" : routeType === "shipping" ? "sea" : ri % 2 ? "air" : "sea");
      for (let k = 0; k < counts[ri]; k++) {
        out.push({
          id: `${route.def.id}-${k}`,
          route,
          trips: route.def.trips ?? 1,
          phase: (k / Math.max(1, counts[ri]) + rng() * 0.4) % 1,
          kind,
          scale: rngRange(rng, 0.82, 1.24),
          wobble: rngRange(rng, -0.14, 0.14),
        });
      }
    });
    return out;
  }, [routes, region, routeType, markerCount]);

  const pins = useMemo(() => placePins(region.pins, g, u), [region, g, u]);

  const driftAmp = DRIFT_AMPLITUDE * Math.min(width, height);
  const drift = {
    x: Math.sin(progress * Math.PI * 2) * driftAmp,
    y: Math.sin(progress * Math.PI * 2 + 1.9) * driftAmp * 0.6,
  };

  const planeStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: g.planeW,
    height: g.planeH,
    marginLeft: -g.planeW / 2,
    marginTop: -g.planeH / 2,
    transform: `rotateZ(${g.tilt.rollZDeg}deg) rotateX(${g.tilt.tiltXDeg}deg) translate(${drift.x}px, ${drift.y}px)`,
  };

  const viewBox = `${-g.planeW / 2} ${-g.planeH / 2} ${g.planeW} ${g.planeH}`;

  return (
    <AbsoluteFill style={{ backgroundColor: pal.backdrop, overflow: "hidden" }}>
      <AbsoluteFill style={{ perspective: g.tilt.perspective, perspectiveOrigin: "50% 50%" }}>
        <div style={planeStyle}>
          <Img
            src={staticFile(`basemaps/${region.id}-${palette}.jpg`)}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              filter: pal.baseFilter,
            }}
          />
          <svg
            viewBox={viewBox}
            width={g.planeW}
            height={g.planeH}
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
          >
            <Graticule
              region={region}
              g={g}
              pal={pal}
              u={u}
              frame={frame}
              duration={durationInFrames}
            />
            <PinShadows pins={pins} progress={progress} />
            <Routes routes={routes} pal={pal} progress={progress} />
            <EndpointDots routes={routes} pal={pal} u={u} />
            <PinPulses pins={pins} progress={progress} color={pal.route.cyan} u={u} />
            <Markers markers={markers} progress={progress} color={pal.marker} u={u} />
          </svg>
        </div>
      </AbsoluteFill>

      <svg
        viewBox={`${-width / 2} ${-height / 2} ${width} ${height}`}
        width={width}
        height={height}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <PinGradients />
        <PinBodies pins={pins} g={g} progress={progress} drift={drift} />
      </svg>

      <DepthOfField width={width} height={height} />
      <Vignette pal={pal} />
      <Grain frame={frame} width={width} />
    </AbsoluteFill>
  );
};

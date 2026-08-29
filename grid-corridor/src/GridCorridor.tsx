import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DURATION_IN_FRAMES, HEIGHT, WIDTH } from "./constants";
import { buildPlanes, vanishPoint } from "./geometry";
import { useMonoFont } from "./fonts";
import { buildLayout } from "./layout";
import {
  createBuffer,
  paintOps,
  SceneProvider,
  type DrawOp,
  type SceneApi,
  type SceneBuffer,
} from "./scene";
import { buildGrainTiles, buildHaloSprite, withAlpha } from "./sprites";
import { makeCodeLine } from "./content";
import { rndRange } from "./seed";
import { VARIANTS, type VariantName } from "./variants";
import { GridPlane } from "./components/GridPlane";
import { CodeBlock, overridesForBlock } from "./components/CodeBlock";
import { DiagramGlyph } from "./components/DiagramGlyph";
import { NodeDot } from "./components/NodeDot";
import { TextWall } from "./components/TextWall";
import { Connector } from "./components/Connectors";
import { Flare } from "./components/Flare";

export type GridCorridorProps = {
  variant: VariantName;
};

const GRAIN_TILE = 1024;
const GRAIN_TILES = 6;
/** Slight over-scale so the roll never swings an empty corner into frame. */
const ROLL_ZOOM = 1.07;

export const GridCorridor: React.FC<GridCorridorProps> = ({ variant }) => {
  // Everything downstream reads the frame's position inside the loop, so
  // frame 0 and frame 360 are the same picture by construction rather than by
  // floating-point luck.
  const frame = useCurrentFrame() % DURATION_IN_FRAMES;
  const config = VARIANTS[variant];
  const { palette, camera } = config;
  const fontFamily = useMonoFont();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const planes = useMemo(
    () => buildPlanes(config.structure, config.planes, config.planeMirror),
    [config],
  );
  const layout = useMemo(() => buildLayout(variant, config, planes), [variant, config, planes]);

  const buffers = useMemo(() => {
    const map = new Map<string, SceneBuffer>();
    for (const bucket of config.buckets) {
      map.set(bucket.key, createBuffer(bucket, WIDTH, HEIGHT));
    }
    map.set(config.glow.key, createBuffer(config.glow, WIDTH, HEIGHT));
    return map;
  }, [config]);

  const halos = useMemo(
    () => ({
      white: buildHaloSprite(palette.nodeWhite),
      accent: buildHaloSprite(palette.nodeAccent),
      contrast: buildHaloSprite(palette.accent),
    }),
    [palette],
  );

  const grain = useMemo(() => buildGrainTiles(GRAIN_TILES, GRAIN_TILE), []);

  // Reset before children render; each child re-registers by a stable id.
  const registry = useRef<Map<string, DrawOp[]>>(new Map());
  registry.current = new Map();
  const api = useMemo<SceneApi>(
    () => ({
      register: (id, ops) => {
        registry.current.set(id, ops);
      },
    }),
    [],
  );

  const focusBucket = config.buckets[config.structure === "wall" ? 0 : 1];

  // Children have all registered by the time a layout effect runs.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    buffers.forEach((buffer) => {
      buffer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      buffer.ctx.clearRect(0, 0, buffer.canvas.width, buffer.canvas.height);
    });
    paintOps(registry.current, buffers);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";

    // Background wash, brightest around the vanishing anchor.
    const anchor =
      config.structure === "wall"
        ? { x: WIDTH / 2, y: HEIGHT / 2 }
        : vanishPoint(config.planeMirror);
    const bg = ctx.createRadialGradient(
      anchor.x,
      anchor.y,
      0,
      anchor.x,
      anchor.y,
      Math.hypot(WIDTH, HEIGHT) * 0.62,
    );
    bg.addColorStop(0, palette.bgWash);
    bg.addColorStop(1, palette.bgDeep);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The whole scene rolls, on a sine whose period is the loop itself.
    const phase = (Math.PI * 2 * frame) / DURATION_IN_FRAMES;
    const roll =
      ((camera.rollDegrees * Math.PI) / 180) * Math.sin(phase) * camera.rollDirection;
    const wanderX = camera.wanderPx * Math.sin(phase);
    const wanderY = camera.wanderPx * Math.sin(phase * 2);

    ctx.save();
    ctx.translate(WIDTH / 2 + wanderX, HEIGHT / 2 + wanderY);
    ctx.rotate(roll);
    ctx.scale(ROLL_ZOOM, ROLL_ZOOM);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);

    // Three buffer blurs, never per element.
    for (const bucket of config.buckets) {
      const buffer = buffers.get(bucket.key);
      if (!buffer) continue;
      ctx.filter = bucket.blur > 0.6 ? `blur(${bucket.blur}px)` : "none";
      ctx.drawImage(buffer.canvas, 0, 0, WIDTH, HEIGHT);
    }
    ctx.filter = "none";

    // Soft creases where the planes meet, so the seams read as corners.
    // Each crease fades out toward the vanishing anchor: the corners of the
    // space should converge, not meet in a hard star.
    if (config.structure === "corridor") {
      ctx.save();
      ctx.lineCap = "round";
      for (const plane of planes) {
        const [a, , v] = plane.poly;
        const crease = (colour: string, peak: number) => {
          const g = ctx.createLinearGradient(v.x, v.y, a.x, a.y);
          g.addColorStop(0, withAlpha(colour, 0));
          g.addColorStop(0.16, withAlpha(colour, peak * 0.4));
          g.addColorStop(0.55, withAlpha(colour, peak));
          g.addColorStop(1, withAlpha(colour, peak * 0.8));
          return g;
        };
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(a.x, a.y);
        ctx.filter = "blur(34px)";
        ctx.strokeStyle = crease(palette.bgDeep, 0.72);
        ctx.lineWidth = 62;
        ctx.stroke();
        ctx.filter = "blur(4px)";
        ctx.strokeStyle = crease(palette.structureDim, 0.4);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();
      ctx.filter = "none";
    }

    // Moderate bloom, from the buffer only the bright elements drew into.
    const glow = buffers.get(config.glow.key);
    if (glow) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.62;
      ctx.filter = `blur(${config.glow.blur}px)`;
      ctx.drawImage(glow.canvas, 0, 0, WIDTH, HEIGHT);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Vignette.
    const vig = ctx.createRadialGradient(
      WIDTH / 2,
      HEIGHT / 2,
      Math.hypot(WIDTH, HEIGHT) * 0.18,
      WIDTH / 2,
      HEIGHT / 2,
      Math.hypot(WIDTH, HEIGHT) * 0.56,
    );
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(0.62, "rgba(0,0,0,0.05)");
    vig.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Fine grain, seeded on the frame's position in the loop.
    const tile = grain[frame % grain.length];
    const ox = rndRange(`grain-x:${frame}`, -GRAIN_TILE, 0);
    const oy = rndRange(`grain-y:${frame}`, -GRAIN_TILE, 0);
    ctx.globalAlpha = 0.04;
    ctx.globalCompositeOperation = "overlay";
    for (let x = ox; x < WIDTH; x += GRAIN_TILE) {
      for (let y = oy; y < HEIGHT; y += GRAIN_TILE) {
        ctx.drawImage(tile, x, y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  });

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgDeep }}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <SceneProvider value={api}>
        {config.structure === "wall" ? (
          <TextWall
            seed={`wall:${variant}`}
            palette={palette}
            bucket={config.buckets[0]}
            frame={frame}
            fontFamily={fontFamily}
          />
        ) : (
          planes.map((plane) => (
            <GridPlane
              key={plane.key}
              plane={plane}
              palette={palette}
              buckets={config.buckets}
              glow={config.glow}
              frame={frame}
              rollDirection={camera.rollDirection}
            />
          ))
        )}

        {layout.connectors.map((spec) => (
          <Connector
            key={spec.id}
            spec={spec}
            plane={planes[spec.plane]}
            palette={palette}
            buckets={config.buckets}
            frame={frame}
            rollDirection={camera.rollDirection}
          />
        ))}

        {layout.blocks.map((spec) => (
          <CodeBlock
            key={spec.id}
            spec={spec}
            plane={planes[spec.plane]}
            palette={palette}
            buckets={config.buckets}
            frame={frame}
            rollDirection={camera.rollDirection}
            fontFamily={fontFamily}
            overrides={overridesForBlock(layout.codeEvents, spec.id, frame, (event) =>
              makeCodeLine(event.seed, 1),
            )}
          />
        ))}

        {layout.glyphs.map((spec) => (
          <DiagramGlyph
            key={spec.id}
            spec={spec}
            plane={planes[spec.plane]}
            palette={palette}
            buckets={config.buckets}
            glow={config.glow}
            diagrams={config.diagrams}
            frame={frame}
            rollDirection={camera.rollDirection}
          />
        ))}

        {layout.dots.map((spec) => (
          <NodeDot
            key={spec.id}
            spec={spec}
            plane={planes[spec.plane]}
            palette={palette}
            buckets={config.buckets}
            glow={config.glow}
            frame={frame}
            rollDirection={camera.rollDirection}
            halos={halos}
          />
        ))}

        {layout.flares.map((spec) => (
          <Flare
            key={spec.id}
            spec={spec}
            plane={planes[spec.plane]}
            palette={palette}
            focusBucket={focusBucket}
            glow={config.glow}
            frame={frame}
            rollDirection={camera.rollDirection}
            halo={halos.white}
          />
        ))}
      </SceneProvider>
    </AbsoluteFill>
  );
};

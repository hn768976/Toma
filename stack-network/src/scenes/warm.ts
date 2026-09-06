import { between, makeRandom } from "../lib/random";
import { resolveScene, type ConnectorSpec, type NodeSpec } from "../lib/scene";

/**
 * V1 -- warm: curved sweeps between filled capsule nodes.
 *
 * Laid out by hand in board units (5600 x 3400, origin top left) rather
 * than scattered randomly: the reference's balance comes from where the
 * in-focus nodes sit against the defocused ones, and that does not
 * survive being generated. The seeded generator is used only for the
 * drift phases, so no two nodes breathe in step.
 */
const rng = makeRandom(0xc0de01);

/** Fills in a small looping drift; whole cycles, so it returns to start. */
const drift = (tier: number) => ({
  // One or two whole cycles per loop, so the drift closes seamlessly.
  driftCycles: 1 + Math.round(between(rng, 0, 1)),
  driftPhase: rng(),
  driftRadius: between(rng, 8, 18) * (1 + (4 - tier) * 0.14),
});

const label = (
  id: string,
  text: string,
  x: number,
  y: number,
  size: number,
  tier: number,
  color: string,
  extra: Partial<NodeSpec> = {},
): NodeSpec => ({
  id,
  kind: "label",
  shape: "blob",
  x,
  y,
  size,
  tier,
  color,
  text,
  ...drift(tier),
  ...extra,
});

const icon = (
  id: string,
  glyph: NodeSpec["glyph"],
  x: number,
  y: number,
  size: number,
  tier: number,
  color: string,
  extra: Partial<NodeSpec> = {},
): NodeSpec => ({
  id,
  kind: "icon",
  shape: "ring",
  x,
  y,
  size,
  tier,
  color,
  glyph,
  ...drift(tier),
  ...extra,
});

const nodes: NodeSpec[] = [
  // --- Sharp tier: the hero and the labels the eye is meant to read.
  {
    id: "hero",
    kind: "hero",
    shape: "blob",
    x: 2787,
    y: 899,
    size: 750,
    tier: 0,
    color: "#3f9ff2",
    text: "</>",
    glow: 0.5,
    layer: 6,
    ...drift(0),
  },
  label("php", "{PHP}", 234, -344, 630, 0, "#2f8f9e", { layer: 4 }),
  label("html", "[HTML]", 734, 1411, 770, 0, "#c8523f", { layer: 5 }),
  label("css", "[CSS]", 3071, 2592, 560, 0, "#2f37a8", { layer: 5 }),
  label("seo", "[SEO]", 4336, 2149, 510, 0, "#7b3fae", { layer: 4 }),

  // --- Tier 1: still legible, sitting a step behind.
  label("web", "[WEB]", 3865, 775, 470, 1, "#a8452a", { layer: 3 }),
  label("json", "[JSON]", 4496, 1517, 470, 1, "#2f8f9e", { layer: 3, fade: 0.9 }),
  icon("globe", "globe", 3618, 1186, 380, 0, "#cf8f6d", { layer: 2 }),
  icon("bulb", "bulb", 3565, 2372, 340, 1, "#bd8267", { layer: 2 }),
  icon("check", "check", 2093, 1030, 330, 1, "#b07a5e", { layer: 2, fade: 0.85 }),

  // --- Tier 2: reading as texture more than as content.
  icon("chart", "chart", 2450, 1950, 330, 2, "#b07a5e", { layer: 1 }),
  icon("database", "database", 1560, 2320, 430, 2, "#a06d55", { layer: 1 }),
  icon("gear", "gears", 4210, 3123, 350, 2, "#a06d55", { layer: 1 }),
  icon("cloud", "cloud", 1595, 51, 410, 2, "#a06d55", { layer: 1, fade: 0.8 }),
  icon("doc", "document", 1145, 2571, 350, 2, "#a06d55", { layer: 1, fade: 0.8 }),

  // --- Tier 3-4: out of focus. Some sit behind the network, some in
  // front of the lens -- which is what `layer` decides, since a blur
  // radius on its own cannot say which side of the network a shape is on.
  label("api", "[API]", -913, 968, 1280, 3, "#8c2417", { layer: 9, fade: 0.85 }),
  label("http", "[HTTP]", 5320, 3320, 700, 3, "#2f8f9e", { layer: -5, fade: 0.8 }),
  icon("refresh", "refresh", 1780, 3420, 1080, 4, "#8a3f6e", { layer: 9, fade: 0.75 }),
  label("xml", "[XML]", -7, 2702, 1000, 4, "#3a2b6a", { layer: -5, fade: 0.7 }),
  icon("lock", "lock", 5786, 888, 880, 4, "#c2703f", { layer: 8, fade: 0.5 }),
  label("sql", "[SQL]", 2557, -162, 750, 3, "#2f37a8", { layer: -4, fade: 0.6 }),
];

/**
 * Curved routing. `bow` is how far the sweep bulges off the straight
 * line, `march` the whole number of dash periods travelled over the
 * loop -- an integer on every path, which is what makes the dash motion
 * seamless, and a different integer on each so they do not pulse in unison.
 */
const connectors: ConnectorSpec[] = [
  {
    from: "php",
    to: "html",
    tier: 0,
    bow: -260,
    width: 13,
    dash: 74,
    march: 26,
    caps: true,
    dots: { count: 1, trips: 2, phase: 0.1 },
    layer: 5.5,
  },
  {
    from: "php",
    to: "hero",
    tier: 0,
    bow: 300,
    sway: 0.04,
    width: 13,
    dash: 74,
    march: 31,
    caps: true,
    dots: { count: 2, trips: 2, phase: 0.45 },
    layer: 5.5,
  },
  {
    from: "html",
    to: "css",
    tier: 0,
    bow: 130,
    width: 13,
    dash: 74,
    march: 29,
    caps: true,
    dots: { count: 1, trips: 1, phase: 0.7 },
    layer: 5.5,
  },
  {
    from: "hero",
    to: "css",
    tier: 0,
    bow: -300,
    sway: -0.05,
    width: 13,
    dash: 74,
    march: 24,
    caps: true,
    layer: 5.5,
  },
  {
    from: "hero",
    to: "seo",
    tier: 0,
    bow: 380,
    width: 13,
    dash: 74,
    march: 33,
    caps: true,
    dots: { count: 2, trips: 2, phase: 0.25 },
    layer: 5.5,
  },
  {
    from: "seo",
    to: "web",
    tier: 0,
    bow: -240,
    width: 12,
    dash: 72,
    march: 21,
    caps: true,
    dots: { count: 1, trips: 1, phase: 0.55 },
    layer: 5.5,
  },
  {
    from: "hero",
    to: "web",
    tier: 1,
    bow: -300,
    width: 11,
    dash: 70,
    march: -27,
    caps: true,
    layer: 3.5,
  },
  {
    from: "css",
    to: "json",
    tier: 1,
    bow: -430,
    width: 11,
    dash: 70,
    march: 23,
    caps: true,
    dots: { count: 1, trips: 1, phase: 0.05 },
    layer: 3.5,
  },
  {
    from: "html",
    to: "database",
    tier: 2,
    bow: -200,
    width: 10,
    dash: 66,
    march: 17,
    fade: 0.7,
    layer: 1.5,
  },
  {
    from: "web",
    to: "json",
    tier: 3,
    bow: 220,
    width: 14,
    dash: 88,
    march: 13,
    fade: 0.55,
    layer: -2.5,
  },
  {
    from: "html",
    to: "doc",
    tier: 3,
    bow: -240,
    width: 14,
    dash: 88,
    march: -11,
    fade: 0.5,
    layer: -2.5,
  },
  {
    from: "database",
    to: "hero",
    tier: 1,
    bow: 210,
    width: 10,
    dash: 66,
    march: -22,
    caps: true,
    fade: 0.8,
    layer: 2.5,
  },
  {
    from: "doc",
    to: "css",
    tier: 2,
    bow: 210,
    width: 10,
    dash: 64,
    march: 15,
    caps: true,
    fade: 0.7,
    layer: 1.5,
  },
  {
    from: "cloud",
    to: "php",
    tier: 2,
    bow: 200,
    width: 10,
    dash: 64,
    march: 14,
    caps: true,
    fade: 0.7,
    layer: 1.5,
  },
];

export const warmScene = resolveScene({ nodes, connectors, routing: "curved" });

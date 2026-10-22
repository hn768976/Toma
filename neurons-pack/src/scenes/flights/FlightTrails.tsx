import { Container, Graphics, Mesh, RenderTexture } from "pixi.js";
import colors from "../../../data/colors.json";
import { glslLinear } from "../../lib/color";
import { PixiContext, PixiScene, PixiStage } from "../../lib/pixi/PixiStage";
import { RIBBON_FRAG_HEAD, RIBBON_VERT_HEAD, buildRibbons, RibbonLine } from "../../lib/pixi/ribbon";
import { glShader } from "../../lib/pixi/shader";
import { buildRoutes } from "./routes";
import { landPolygons, project } from "./worldMap";

const C = colors.flights;

const TRAIL_VERT = /* glsl */ `
${RIBBON_VERT_HEAD}
uniform float uFrame;
uniform float uPx;
out float vS;
out float vHead;
out float vTail;
out float vOpacity;
void main() {
  // aLineA: phase, period, duration, tail. aLineB: opacity, width.
  float u = mod(uFrame - aLineA.x, aLineA.y) / aLineA.z;
  vHead = u * (1.0 + aLineA.w);
  vTail = aLineA.w;
  vS = aS.x;
  vOpacity = u < 1.0 ? aLineB.x : 0.0;
  gl_Position = extrude(aPosition, aLineB.y, uPx);
}
`;

const TRAIL_FRAG = /* glsl */ `
${RIBBON_FRAG_HEAD}
in float vS;
in float vHead;
in float vTail;
in float vOpacity;
out vec4 finalColor;
void main() {
  float d = vHead - vS;
  float a = 0.0;
  if (d >= 0.0 && d <= vTail) {
    float f = 1.0 - d / vTail;
    a = f * f;
    a += 0.5 * exp(-d / 0.006); // head
  } else if (d > vTail) {
    a = 0.34 * (1.0 - 0.5 * vHead / (1.0 + vTail)); // faint wake: the web over the oceans
  }
  float v = a * vOpacity * ribbonCoverage();
  finalColor = vec4(v, v, v, v);
}
`;

const build = (ctx: PixiContext): PixiScene => {
  const { app, width: W, height: H, px } = ctx;

  // --- Static map: r = land, g = coastline, b = coastal glow --------------
  const mapRoot = new Container();
  const fill = new Graphics();
  const line = new Graphics();
  const glow = new Graphics();
  for (const poly of landPolygons()) {
    // Unwrap rings that cross the antimeridian, then draw the copies that
    // land on screen.
    const unwrapped = poly.map((ring) => {
      let off = 0;
      const out = ring.map(([lon, lat], i) => {
        if (i > 0) {
          const d = lon - ring[i - 1][0];
          if (d > 180) off -= 360;
          else if (d < -180) off += 360;
        }
        return [lon + off, lat] as [number, number];
      });
      // Bring the ring's centre back into [-180, 180).
      const mid = out.reduce((a, p) => a + p[0], 0) / out.length;
      const k = Math.round(mid / 360) * 360;
      return out.map(([lon, lat]) => [lon - k, lat] as [number, number]);
    });
    const lons = unwrapped[0].map((p) => p[0]);
    const shifts = [0];
    if (Math.min(...lons) < -172) shifts.push(360);
    if (Math.max(...lons) > 180) shifts.push(-360);
    for (const sh of shifts) {
    const rings = unwrapped.map((ring) => ring.flatMap(([lon, lat]) => project(lon + sh, lat, W, H)));
    fill.poly(rings[0]).fill({ color: 0xff0000 });
    for (const hole of rings.slice(1)) fill.poly(hole).cut();
    for (const r of rings) {
      line.poly(r, true).stroke({ width: 2.4, color: 0x00ff00, join: "round" });
      glow.poly(r, true).stroke({ width: 70, color: 0x0000ff, alpha: 0.12, join: "round" });
      glow.poly(r, true).stroke({ width: 34, color: 0x0000ff, alpha: 0.22, join: "round" });
      glow.poly(r, true).stroke({ width: 14, color: 0x0000ff, alpha: 0.35, join: "round" });
    }
    }
  }
  line.blendMode = "add";
  glow.blendMode = "add";
  mapRoot.addChild(fill, glow, line);
  const mapTex = RenderTexture.create({ width: W, height: H, resolution: px, antialias: true });
  app.renderer.render({ container: mapRoot, target: mapTex, clear: true, clearColor: [0, 0, 0, 0] });

  // --- Trails ---------------------------------------------------------------
  const routes = buildRoutes(W, H);
  const lines: RibbonLine[] = [];
  for (const r of routes) {
    const xs = r.pts.filter((_, i) => i % 2 === 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const shifts = [0];
    if (minX < 0) shifts.push(W);
    if (maxX > W) shifts.push(-W);
    for (const s of shifts) {
      lines.push({
        pts: r.pts.map((v, i) => (i % 2 === 0 ? v + s : v)),
        a: [r.phase, r.period, r.dur, r.tail],
        b: [r.opacity, r.width, 0, 0],
      });
    }
  }
  const trailShader = glShader("trails", TRAIL_VERT, TRAIL_FRAG, {
    u: { uFrame: { value: 0, type: "f32" }, uPx: { value: px, type: "f32" } },
  });
  const trails = new Mesh({ geometry: buildRibbons(lines), shader: trailShader });
  trails.blendMode = "add";
  const root = new Container();
  root.addChild(trails);

  return {
    root,
    update: (frame) => {
      trailShader.resources.u.uniforms.uFrame = frame % 600; // loop: frame 600 == frame 0
    },
    compositeTextures: { uMap: mapTex },
    composite: /* glsl */ `
uniform sampler2D uMap;
vec3 composite(vec4 c, vec2 uv, out bool allow) {
  vec3 m = texture(uMap, uv).rgb;
  float land = m.r;
  float coast = m.g;
  float glow = clamp(m.b, 0.0, 1.0);
  vec2 lp = uv * uSize;
  // Fine dot texture inside the land, denser towards the coast.
  float cellSize = 7.0;
  vec2 cell = floor(lp / cellSize);
  uvec2 ci = uvec2(cell + 8192.0);
  float h1 = hash2(ci);
  float h2 = hash2(ci + uvec2(7919u, 104729u));
  float h3 = hash2(ci + uvec2(15485863u, 32452843u));
  float inland = clamp(land, 0.0, 1.0);
  float shore = glow * inland;
  // Halftone land fill: #7E8CB8 dots at 60%, denser and brighter on the
  // coast (the "city lights" band), sparse inland.
  float dens = inland * (0.14 + 0.86 * smoothstep(0.12, 0.7, shore));
  vec2 centre = (cell + 0.2 + 0.6 * vec2(h1, h2)) * cellSize;
  float aa = max(fwidth(lp.x), 0.6);
  float r = length(lp - centre);
  float rad = 1.5 + 0.9 * h2;
  float dotA = h3 < dens ? clamp((rad + 0.5 * aa - r) / aa, 0.0, 1.0) * min(1.0, 2.0 * rad * rad / (aa * aa)) : 0.0;
  float bright = 0.45 + 0.55 * fract(h1 * 17.0 + h2 * 5.0);
  vec3 col = ${glslLinear(C.background)};
  col = mix(col, ${glslLinear(C.land)}, 0.05 * inland);
  col = mix(col, ${glslLinear(C.land)}, ${C.landOpacity.toFixed(3)} * dotA * bright);
  col += ${glslLinear(C.coast)} * dotA * smoothstep(0.25, 0.85, shore) * 0.9;
  // Soft glowing coast band (inland side), the "lit coast" bloom.
  col += ${glslLinear(C.coast)} * (0.22 * shore * shore + 0.012 * glow);
  col += ${glslLinear(C.coast)} * coast * 0.07;
  col += ${glslLinear(C.trail)} * c.r;
  allow = c.r > 0.0 || land > 0.0 || glow > 0.0 || coast > 0.0;
  return col;
}`,
  };
};

export const FlightTrails_FlatNavy: React.FC = () => <PixiStage build={build} background={C.background} />;

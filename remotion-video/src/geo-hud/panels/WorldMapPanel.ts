import type { PanelSpec, Rect } from "../layout";
import type { ProjectedMap } from "../map/geo";
import { NODE_MARKERS, SONAR_MARKERS } from "../map/markers";
import { alpha, both, sans, tracked, type DrawArgs } from "../paint";
import { cycle, envelope, rInt, rPick } from "../rand";
import { panelBody } from "./PanelChrome";
import { drawTargetRing } from "./TargetRing";

/**
 * The dashboard's centrepiece: Natural Earth 110m country polygons projected
 * once with d3-geo (see map/geo.ts - never re-projected per frame), drawn as
 * filled continents with a thin brighter outline over a faint 15-degree
 * graticule.
 *
 * A rotating subset of countries fills in the highlight colour. Each country
 * has its own activation period - all divisors of 900 - and its own phase, so
 * roughly a dozen are lit at any moment and they turn over gradually rather
 * than switching as a block.
 */

const ACTIVATION_PERIODS = [180, 225, 300, 450];
const DUTY = 0.24;
const FADE = 18;

/** The rectangle the projection is fitted into, inset inside the panel body. */
export const mapExtent = (spec: PanelSpec): Rect => {
  const body = panelBody(spec);
  const inset = 26;
  return {
    x: body.x + inset,
    y: body.y + inset + 40,
    w: body.w - inset * 2,
    h: body.h - inset * 2 - 40,
  };
};

export type ActiveCountry = { index: number; k: number };

/** Which countries are lit this frame, and how far into their fade they are. */
export const activeCountries = (a: DrawArgs, map: ProjectedMap): ActiveCountry[] => {
  const out: ActiveCountry[] = [];
  for (const index of map.highlightPool) {
    const seed = `hl/${map.countries[index].name}`;
    const period = rPick(`${seed}/p`, ACTIVATION_PERIODS);
    const phase = rInt(`${seed}/ph`, 0, period);
    const on = Math.round(period * DUTY);
    const cy = cycle(a.frame, period, phase);
    if (cy.local >= on) continue;
    const k = envelope(cy.local, on, FADE, FADE);
    if (k > 0.001) out.push({ index, k });
  }
  return out;
};

export const drawWorldMapStatic = (
  a: DrawArgs,
  spec: PanelSpec,
  map: ProjectedMap,
) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  const body = panelBody(spec);

  c.save();
  c.beginPath();
  c.rect(body.x, body.y, body.w, body.h);
  c.clip();

  // Faint graticule behind the land, ~15 degree spacing.
  c.strokeStyle = alpha(pal.mapGraticule, 1);
  c.lineWidth = 1.4;
  c.stroke(map.graticule);

  // Filled continents with a thin brighter outline.
  for (const country of map.countries) {
    c.fillStyle = alpha(pal.mapLand, 0.52);
    c.fill(country.path);
  }
  c.strokeStyle = alpha(pal.mapOutline, 0.5);
  c.lineWidth = 1.2;
  for (const country of map.countries) {
    c.stroke(country.path);
  }

  c.restore();

  // Corner brackets framing the projected extent.
  const ext = mapExtent(spec);
  c.strokeStyle = alpha(pal.panelBorder, 0.75);
  c.lineWidth = 2;
  const b = 34;
  const corners: [number, number, number, number][] = [
    [ext.x, ext.y, 1, 1],
    [ext.x + ext.w, ext.y, -1, 1],
    [ext.x, ext.y + ext.h, 1, -1],
    [ext.x + ext.w, ext.y + ext.h, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    c.beginPath();
    c.moveTo(x + dx * b, y);
    c.lineTo(x, y);
    c.lineTo(x, y + dy * b);
    c.stroke();
  }

  // Longitude / latitude rulers around the projected extent - they carry the
  // scale and fill the space an equirectangular world leaves in a tall panel.
  c.strokeStyle = alpha(pal.panelBorder, 0.55);
  c.fillStyle = alpha(pal.textDim, 1);
  c.font = sans(a.fonts, 18, 500);
  c.lineWidth = 1.5;
  c.textAlign = "center";
  c.textBaseline = "top";
  const ruleY = ext.y + ext.h + 18;
  c.beginPath();
  c.moveTo(ext.x, ruleY);
  c.lineTo(ext.x + ext.w, ruleY);
  c.stroke();
  for (let lon = -180; lon <= 180; lon += 30) {
    const projected = map.project([lon, 0]);
    if (!projected) continue;
    const major = lon % 90 === 0;
    c.beginPath();
    c.moveTo(projected[0], ruleY);
    c.lineTo(projected[0], ruleY + (major ? 14 : 8));
    c.stroke();
    if (major) c.fillText(`${Math.abs(lon)}`, projected[0], ruleY + 18);
  }

  const ruleX = ext.x - 20;
  c.beginPath();
  c.moveTo(ruleX, ext.y);
  c.lineTo(ruleX, ext.y + ext.h);
  c.stroke();
  c.textAlign = "right";
  c.textBaseline = "middle";
  for (let lat = -60; lat <= 75; lat += 15) {
    const projected = map.project([0, lat]);
    if (!projected) continue;
    const major = lat % 30 === 0;
    c.beginPath();
    c.moveTo(ruleX, projected[1]);
    c.lineTo(ruleX - (major ? 14 : 8), projected[1]);
    c.stroke();
    if (major) c.fillText(`${Math.abs(lat)}`, ruleX - 18, projected[1]);
  }

  // Subtitle set into the lower-left of the map.
  c.font = sans(a.fonts, 46, 600);
  c.fillStyle = alpha(pal.textPale, 0.55);
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  tracked(c, a.v.subtitle, body.x + 30, body.y + body.h - 26, 6);
};

export const drawWorldMap = (a: DrawArgs, spec: PanelSpec, map: ProjectedMap) => {
  const c = a.p.ctx;
  const pal = a.v.palette;
  const body = panelBody(spec);
  const active = activeCountries(a, map);

  c.save();
  c.beginPath();
  c.rect(body.x, body.y, body.w, body.h);
  c.clip();
  a.p.glow.save();
  a.p.glow.beginPath();
  a.p.glow.rect(body.x, body.y, body.w, body.h);
  a.p.glow.clip();

  for (const { index, k } of active) {
    const country = map.countries[index];
    both(
      a.p,
      (g) => {
        g.fillStyle = alpha(pal.highlight, 0.82 * k);
        g.fill(country.path);
      },
      // Lit countries are large areas; only a little of them may reach the
      // bloom pass or the map turns into a white blob.
      0.22,
    );
    c.strokeStyle = alpha(pal.mapOutline, 0.85 * k);
    c.lineWidth = 1.6;
    c.stroke(country.path);
  }

  // v2 only: a connector mesh between the lit nodes. Each node links to its
  // nearest two lit neighbours inside a radius, which reads as a network
  // rather than as an arbitrary polyline.
  if (a.v.connectors && active.length > 1) {
    const maxLink = Math.min(body.w, body.h) * 0.42;
    both(
      a.p,
      (g) => {
        g.strokeStyle = alpha(pal.accent, 0.55);
        g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i < active.length; i++) {
          const from = map.countries[active[i].index];
          const neighbours = active
            .map((other, j) => ({
              j,
              d: Math.hypot(
                map.countries[other.index].cx - from.cx,
                map.countries[other.index].cy - from.cy,
              ),
            }))
            .filter((n) => n.j !== i && n.d < maxLink)
            .sort((x, y) => x.d - y.d)
            .slice(0, 2);
          for (const n of neighbours) {
            if (n.j < i) continue; // draw each edge once
            const to = map.countries[active[n.j].index];
            g.moveTo(from.cx, from.cy);
            g.lineTo(to.cx, to.cy);
          }
        }
        g.stroke();
      },
      0.5,
    );
  }

  // Fixed map markers.
  const positions = a.v.markers.mode === "sonar" ? SONAR_MARKERS : NODE_MARKERS;
  const count = Math.min(a.v.markers.count, positions.length);
  for (let i = 0; i < count; i++) {
    const projected = map.project(positions[i]);
    if (!projected) continue;
    drawTargetRing(
      a,
      projected[0],
      projected[1],
      a.v.markers.radius,
      a.v.markers.mode,
      `marker${i}`,
    );
  }

  a.p.glow.restore();
  c.restore();
};

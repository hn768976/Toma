import { WorldData } from "../common/assets";
import { MapPalette } from "../common/palettes";

/** Equirectangular world map drawn once into a canvas (static texture). */
export const drawMapCanvas = (world: WorldData, p: MapPalette, width: number) => {
  const height = width / 2;
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  const X = (lon: number) => ((lon + 180) / 360) * width;
  const Y = (lat: number) => ((90 - lat) / 180) * height;
  const s = width / 8192; // line widths are designed for an 8192 px map

  ctx.fillStyle = p.ocean;
  ctx.fillRect(0, 0, width, height);

  // graticule every 15°
  ctx.strokeStyle = p.graticule;
  ctx.lineWidth = Math.max(1, 2.2 * s);
  for (let lon = -180; lon <= 180; lon += 15) {
    ctx.beginPath();
    ctx.moveTo(X(lon), 0);
    ctx.lineTo(X(lon), height);
    ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 15) {
    ctx.beginPath();
    ctx.moveTo(0, Y(lat));
    ctx.lineTo(width, Y(lat));
    ctx.stroke();
  }

  const landPath = new Path2D();
  for (const poly of world.land) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        if (i === 0) landPath.moveTo(X(lon), Y(lat));
        else landPath.lineTo(X(lon), Y(lat));
      });
      landPath.closePath();
    }
  }

  // soft outer glow of the coasts
  ctx.save();
  ctx.filter = `blur(${Math.max(1, 14 * s)}px)`;
  ctx.fillStyle = "rgba(40,100,190,0.22)";
  ctx.fill(landPath, "evenodd");
  ctx.restore();

  // land: vertical gradient for a little depth
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, p.land);
  g.addColorStop(0.5, "#173562");
  g.addColorStop(1, p.land);
  ctx.fillStyle = g;
  ctx.fill(landPath, "evenodd");

  // graticule faintly visible over land too
  ctx.save();
  ctx.clip(landPath, "evenodd");
  ctx.strokeStyle = "rgba(100,160,240,0.2)";
  ctx.lineWidth = Math.max(1, 2 * s);
  for (let lon = -180; lon <= 180; lon += 15) {
    ctx.beginPath();
    ctx.moveTo(X(lon), 0);
    ctx.lineTo(X(lon), height);
    ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 15) {
    ctx.beginPath();
    ctx.moveTo(0, Y(lat));
    ctx.lineTo(width, Y(lat));
    ctx.stroke();
  }
  // inner shading near the coast (lighter rim)
  ctx.filter = `blur(${Math.max(1, 10 * s)}px)`;
  ctx.strokeStyle = "rgba(70,130,210,0.22)";
  ctx.lineWidth = 14 * s;
  ctx.stroke(landPath);
  ctx.restore();

  // borders
  ctx.strokeStyle = p.border;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(0.8, 1.8 * s);
  ctx.beginPath();
  for (const line of world.borders) {
    line.forEach(([lon, lat], i) => {
      if (i === 0) ctx.moveTo(X(lon), Y(lat));
      else ctx.lineTo(X(lon), Y(lat));
    });
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // coastline
  ctx.strokeStyle = p.coast;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(1, 2.4 * s);
  ctx.stroke(landPath);
  ctx.globalAlpha = 1;
  return c;
};

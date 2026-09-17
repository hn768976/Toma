import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
} from "three/webgpu";
import { AIRPORT_NAME, AIRPORT_SUBTITLE } from "../config";
import { createRng } from "./rng";

/**
 * Small decal atlases painted with Canvas2D at scene-build time.
 *
 * Stencilled container codes and the airport sign are lettering, and lettering
 * is the one thing procedural shading cannot fake — so it is drawn once into a
 * texture rather than approximated. Baking also keeps the render deterministic:
 * the same seed paints the same codes on the same boxes every time.
 */

const SIGNAGE_FONT = '"Liberation Sans", "DejaVu Sans", Helvetica, Arial, sans-serif';

const finish = (canvas: HTMLCanvasElement, anisotropy: number): Texture => {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Sample in canvas coordinates: v = 0 is the top row, as drawn. Without this
  // three flips the upload and every decal comes out upside down.
  texture.flipY = false;
  texture.anisotropy = anisotropy;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
};

/** ISO 6346 owner prefixes, invented rather than borrowed from real operators. */
const OWNER_PREFIXES = ["TRNU", "VLDU", "ASEU", "MRKU", "HLXU", "NPTU", "CRVU", "OSLU"];
const SIZE_CODES = ["22G1", "22G1", "45G1", "22R1", "22G1", "42G1", "22G1", "45G1"];

export const CONTAINER_ATLAS_COLUMNS = 4;
export const CONTAINER_ATLAS_ROWS = 2;

/**
 * Side-wall markings for eight container variants, laid out in a 4x2 grid.
 *
 * Each cell matches the 2.34:1 aspect of a 20ft side wall, so the shader can
 * map local (z, y) straight into a cell with no correction.
 */
export const bakeContainerMarkings = (anisotropy: number): Texture => {
  const cellW = 600;
  const cellH = 256;
  const canvas = document.createElement("canvas");
  canvas.width = cellW * CONTAINER_ATLAS_COLUMNS;
  canvas.height = cellH * CONTAINER_ATLAS_ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return finish(canvas, anisotropy);

  // Transparent black everywhere the decal should leave the paint alone.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rng = createRng(0x5eed01);

  for (let i = 0; i < CONTAINER_ATLAS_COLUMNS * CONTAINER_ATLAS_ROWS; i++) {
    const col = i % CONTAINER_ATLAS_COLUMNS;
    const row = Math.floor(i / CONTAINER_ATLAS_COLUMNS);
    const x0 = col * cellW;
    const y0 = row * cellH;
    ctx.save();
    ctx.translate(x0, y0);
    // Clip to the cell. A long wordmark would otherwise spill into the next
    // cell of the atlas and turn up as a stray letter on an unrelated box.
    ctx.beginPath();
    ctx.rect(2, 2, cellW - 4, cellH - 4);
    ctx.clip();

    const serial = String(rng.int(100000, 999999));
    const check = rng.int(0, 9);
    const owner = OWNER_PREFIXES[i];

    // Owner code and serial, upper left — the big stencil you actually read.
    ctx.fillStyle = "rgba(255,255,255,0.93)";
    ctx.font = `600 34px ${SIGNAGE_FONT}`;
    ctx.textBaseline = "top";
    ctx.letterSpacing = "2px";
    ctx.fillText(owner, 26, 26);
    ctx.font = `500 30px ${SIGNAGE_FONT}`;
    ctx.fillText(`${serial}  ${check}`, 26, 64);

    // Size/type code in its outlined box, to the right of the serial.
    ctx.font = `600 26px ${SIGNAGE_FONT}`;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.strokeRect(210, 60, 84, 34);
    ctx.fillText(SIZE_CODES[i], 220, 64);

    // Weight stencil block, lower left. Small and low contrast at distance,
    // which is exactly how it reads on a real box.
    ctx.font = `400 16px ${SIGNAGE_FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    const maxKg = rng.int(30000, 32500);
    const tareKg = rng.int(2100, 2400);
    ctx.fillText(`MAX GROSS  ${maxKg} KG`, 26, 176);
    ctx.fillText(`TARE  ${tareKg} KG`, 26, 198);
    ctx.fillText(`NET  ${maxKg - tareKg} KG`, 26, 220);

    // A plain wordmark block on the far end of the wall. Deliberately generic:
    // a bar and an abstract mark, not anyone's real livery.
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(cellW - 232, 96, 150, 6);
    ctx.font = `700 36px ${SIGNAGE_FONT}`;
    ctx.letterSpacing = "4px";
    ctx.fillText(
      ["LINEA", "NORDKAP", "ATLAS", "MERIDIAN", "KESTREL", "ORBIS", "SALTIRE", "VECTOR"][i],
      cellW - 232,
      110,
    );
    ctx.globalAlpha = 1;

    // Consolidated data plate near the doors end.
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cellW - 120, 190, 92, 44);

    ctx.restore();
  }
  ctx.letterSpacing = "0px";
  return finish(canvas, anisotropy);
};

/**
 * The shot 6 direction sign: white-on-blue, European motorway style, with the
 * aircraft pictogram that marks an airport exit.
 */
export const bakeAirportSign = (anisotropy: number): Texture => {
  const w = 1536;
  const h = 448;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return finish(canvas, anisotropy);

  // Sign face. Real enamel is a deep, slightly green-shifted blue.
  ctx.fillStyle = "#12448c";
  ctx.fillRect(0, 0, w, h);

  // Retroreflective sheeting is not perfectly flat; a faint vertical gradient
  // keeps the face from reading like a flat fill under a hard sun.
  const sheen = ctx.createLinearGradient(0, 0, 0, h);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.45, "rgba(255,255,255,0.02)");
  sheen.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  const inset = 26;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 9;
  const r = 22;
  ctx.beginPath();
  ctx.roundRect(inset, inset, w - inset * 2, h - inset * 2, r);
  ctx.stroke();

  // Aircraft pictogram, climbing to the right as on real airport signage.
  ctx.save();
  ctx.translate(150, h / 2);
  ctx.rotate(-0.35);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  // Fuselage
  ctx.ellipse(0, 0, 96, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Main wing
  ctx.beginPath();
  ctx.moveTo(14, -6);
  ctx.lineTo(-22, -84);
  ctx.lineTo(4, -84);
  ctx.lineTo(44, -6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.lineTo(-22, 84);
  ctx.lineTo(4, 84);
  ctx.lineTo(44, 6);
  ctx.closePath();
  ctx.fill();
  // Tailplane
  ctx.beginPath();
  ctx.moveTo(-74, -5);
  ctx.lineTo(-96, -38);
  ctx.lineTo(-84, -38);
  ctx.lineTo(-58, -5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-74, 5);
  ctx.lineTo(-96, 38);
  ctx.lineTo(-84, 38);
  ctx.lineTo(-58, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `500 132px ${SIGNAGE_FONT}`;
  ctx.fillText(AIRPORT_NAME, 300, 232);
  ctx.font = `400 62px ${SIGNAGE_FONT}`;
  ctx.fillText(AIRPORT_SUBTITLE, 304, 312);

  // Small terminal glyph in the lower right corner, as on the reference.
  ctx.save();
  ctx.translate(w - 108, h - 96);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillRect(-26, 6, 52, 10);
  ctx.beginPath();
  ctx.moveTo(-26, 6);
  ctx.lineTo(0, -22);
  ctx.lineTo(26, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  return finish(canvas, anisotropy);
};

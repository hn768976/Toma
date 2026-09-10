#!/usr/bin/env node
// Build-time subject preparation.
//
// Reads src/subjects/subjects.json, loads every referenced SVG from
// assets/subjects/, validates it against the template's input rules,
// flattens all shapes (rect/circle/ellipse/line/polyline/polygon/path,
// with any nested group transforms baked in) into plain path data,
// computes the artwork's real bounding box (not the viewBox) and a set of
// high-curvature "anchor" points for sparkle placement, and writes the
// result to src/subjects/manifest.generated.json for the composition.
//
// Run automatically by `npm run dev`, `npm run build` and `npm run render`.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import svgpath from "svgpath";
import { svgPathBbox } from "svg-path-bbox";
import { svgPathProperties } from "svg-path-properties";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SUBJECTS_FILE = join(ROOT, "src", "subjects", "subjects.json");
const ASSETS_DIR = join(ROOT, "assets", "subjects");
const OUT_FILE = join(ROOT, "src", "subjects", "manifest.generated.json");

// Batch rules from the brief.
const MAX_STILLS = 30;
const MAX_COLOURWAYS_PER_SUBJECT = 2;
const KNOWN_COLOURWAYS = ["blue", "violet"];
// Aspect ratios beyond which the default auto-fit is refused.
const MAX_WIDE_ASPECT = 3; // wider than 3:1
const MAX_TALL_ASPECT = 2; // taller than 2:1

const SHAPE_TAGS = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon"]);
const CONTAINER_TAGS = new Set(["g", "svg", "a", "switch"]);
const IGNORED_TAGS = new Set(["defs", "title", "desc", "metadata", "style", "symbol", "marker", "linearGradient", "radialGradient", "pattern", "clipPath", "mask", "filter", "script"]);
const FORBIDDEN_TAGS = new Set(["image", "text", "tspan", "textPath", "foreignObject", "video", "audio", "iframe"]);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const num = (v, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};
const round = (n, p = 3) => Math.round(n * 10 ** p) / 10 ** p;

// 2x3 affine matrix helpers: [a, b, c, d, e, f] as in SVG matrix(a b c d e f)
const IDENTITY = [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const parseTransform = (str) => {
  let m = IDENTITY;
  if (!str) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match;
  while ((match = re.exec(str))) {
    const args = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const [t] = [match[1]];
    let n = IDENTITY;
    if (t === "matrix" && args.length === 6) n = args;
    else if (t === "translate") n = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
    else if (t === "scale") n = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0];
    else if (t === "rotate") {
      const a = ((args[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      const r = [cos, sin, -sin, cos, 0, 0];
      if (args.length >= 3) {
        const [, cx, cy] = args;
        n = multiply(multiply([1, 0, 0, 1, cx, cy], r), [1, 0, 0, 1, -cx, -cy]);
      } else n = r;
    } else if (t === "skewX") n = [1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (t === "skewY") n = [1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    m = multiply(m, n);
  }
  return m;
};
const matrixScale = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
const matrixString = (m) => `matrix(${m.map((v) => round(v, 6)).join(" ")})`;

// Presentation attributes may come from attributes or an inline style="".
const parseStyle = (style) => {
  const out = {};
  if (!style) return out;
  for (const decl of style.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    out[decl.slice(0, idx).trim()] = decl.slice(idx + 1).trim();
  }
  return out;
};
const presentation = (el, inherited) => {
  const style = parseStyle(el.getAttribute("style"));
  const get = (name) => style[name] ?? (el.hasAttribute(name) ? el.getAttribute(name) : undefined);
  const next = { ...inherited };
  for (const key of ["fill", "stroke", "stroke-width", "fill-rule", "stroke-linecap", "stroke-linejoin", "display", "visibility", "opacity"]) {
    const v = get(key);
    if (v !== undefined && v !== null && String(v).trim() !== "") next[key] = String(v).trim();
  }
  return next;
};

// Convert basic shapes to path data.
const shapeToPath = (el, tag) => {
  const a = (n, fb = 0) => num(el.getAttribute(n), fb);
  switch (tag) {
    case "path":
      return el.getAttribute("d") ?? "";
    case "rect": {
      const x = a("x"), y = a("y"), w = a("width"), h = a("height");
      let rx = el.hasAttribute("rx") ? a("rx") : null;
      let ry = el.hasAttribute("ry") ? a("ry") : null;
      if (rx === null && ry === null) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      if (rx === null) rx = ry;
      if (ry === null) ry = rx;
      rx = Math.min(rx, w / 2);
      ry = Math.min(ry, h / 2);
      return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`;
    }
    case "circle":
    case "ellipse": {
      const cx = a("cx"), cy = a("cy");
      const rx = tag === "circle" ? a("r") : a("rx");
      const ry = tag === "circle" ? a("r") : a("ry");
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    case "line":
      return `M${a("x1")} ${a("y1")}L${a("x2")} ${a("y2")}`;
    case "polyline":
    case "polygon": {
      const pts = (el.getAttribute("points") ?? "").trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (pts.length < 4) return "";
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return tag === "polygon" ? d + "Z" : d;
    }
    default:
      return "";
  }
};

const normaliseColour = (c) => {
  let v = (c ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (v === "black") v = "#000000";
  if (v === "white") v = "#ffffff";
  if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return v;
};

// ---------------------------------------------------------------------------
// SVG -> flattened paths
// ---------------------------------------------------------------------------
const flattenSvg = (svgText, fileName) => {
  const errors = [];
  const warnings = [];
  const colours = new Set();
  const paths = [];

  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level === "fatalError" || level === "error") errors.push(`XML ${level}: ${msg}`);
    },
  }).parseFromString(svgText, "image/svg+xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "svg") {
    errors.push("root element is not <svg>");
    return { errors, warnings, paths, viewBox: null };
  }

  // viewBox is mandatory.
  const vb = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  let viewBox = null;
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    viewBox = { x: vb[0], y: vb[1], w: vb[2], h: vb[3] };
  } else {
    errors.push(`missing or invalid viewBox (got "${root.getAttribute("viewBox")}")`);
  }

  // External / embedded references anywhere in the document.
  const hrefRe = /(xlink:href|href)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = hrefRe.exec(svgText))) {
    const v = m[2].trim();
    if (/^data:/i.test(v)) errors.push(`embedded data: URI reference (${v.slice(0, 30)}...)`);
    else if (/^(https?:|file:|\/\/)/i.test(v)) errors.push(`external reference "${v}"`);
  }
  if (/url\(\s*['"]?\s*(https?:|\/\/)/i.test(svgText)) errors.push("external url() reference");
  if (/<!ENTITY/i.test(svgText)) errors.push("XML entities are not allowed");

  const walk = (el, inherited, matrix, depth) => {
    const tag = el.localName;
    if (!tag) return;
    if (FORBIDDEN_TAGS.has(tag)) {
      errors.push(`<${tag}> elements are not allowed (line ${el.lineNumber ?? "?"})`);
      return;
    }
    if (IGNORED_TAGS.has(tag)) {
      if (tag === "style") warnings.push("<style> block ignored (the template recolours the artwork anyway)");
      return;
    }
    if (tag === "use") {
      warnings.push("<use> element skipped: expand it to real shapes before supplying the SVG");
      return;
    }
    if (tag === "svg" && depth > 0) {
      errors.push("nested <svg> elements are not allowed; supply a single <svg>");
      return;
    }
    const pres = presentation(el, inherited);
    if (pres.display === "none" || pres.visibility === "hidden") return;
    if (el.hasAttribute("clip-path") || el.hasAttribute("mask") || el.hasAttribute("filter")) {
      warnings.push(`clip-path/mask/filter on <${tag}> ignored (line ${el.lineNumber ?? "?"})`);
    }
    const own = tag === "svg" && depth === 0 ? IDENTITY : parseTransform(el.getAttribute("transform"));
    const ctm = multiply(matrix, own);

    if (CONTAINER_TAGS.has(tag)) {
      for (let c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 1) walk(c, pres, ctm, depth + 1);
      }
      return;
    }
    if (!SHAPE_TAGS.has(tag)) {
      warnings.push(`unsupported <${tag}> skipped (line ${el.lineNumber ?? "?"})`);
      return;
    }

    const rawD = shapeToPath(el, tag);
    if (!rawD.trim()) return;

    const fill = normaliseColour(pres.fill ?? "black"); // SVG default fill is black
    const stroke = normaliseColour(pres.stroke ?? "none");
    const hasFill = fill !== "none" && fill !== "transparent" && !fill.startsWith("url(");
    const hasStroke = stroke !== "none" && stroke !== "transparent" && !stroke.startsWith("url(");
    if (fill.startsWith("url(") || stroke.startsWith("url(")) {
      warnings.push(`paint server (gradient/pattern) on <${tag}> treated as flat paint`);
    }
    if (hasFill) colours.add(fill);
    if (hasStroke) colours.add(stroke);

    let mode;
    if (hasFill || fill.startsWith("url(")) mode = "fill";
    else if (hasStroke || stroke.startsWith("url(")) mode = "stroke";
    else return; // invisible

    let d;
    try {
      d = svgpath(rawD).transform(matrixString(ctm)).unarc().abs().round(3).toString();
    } catch (e) {
      errors.push(`could not parse path data on <${tag}> (line ${el.lineNumber ?? "?"}): ${e.message}`);
      return;
    }
    if (!d.trim()) return;

    const strokeWidth = round(num(pres["stroke-width"], 1) * matrixScale(ctm), 3);
    paths.push({
      d,
      mode,
      strokeWidth: mode === "stroke" ? strokeWidth : 0,
      fillRule: pres["fill-rule"] === "evenodd" ? "evenodd" : "nonzero",
      linecap: pres["stroke-linecap"] ?? "butt",
      linejoin: pres["stroke-linejoin"] ?? "miter",
    });
  };
  walk(root, {}, IDENTITY, 0);

  if (colours.size > 1) {
    warnings.push(`artwork uses ${colours.size} colours (${[...colours].join(", ")}); expected monochrome. The template discards them all.`);
  }
  if (paths.length === 0) errors.push("no drawable shapes found");
  return { errors, warnings, paths, viewBox };
};

// ---------------------------------------------------------------------------
// Bounding box + curvature anchors
// ---------------------------------------------------------------------------
const computeBbox = (paths) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    const [x0, y0, x1, y1] = svgPathBbox(p.d);
    const pad = p.mode === "stroke" ? p.strokeWidth / 2 : 0;
    minX = Math.min(minX, x0 - pad);
    minY = Math.min(minY, y0 - pad);
    maxX = Math.max(maxX, x1 + pad);
    maxY = Math.max(maxY, y1 + pad);
  }
  return { x: round(minX), y: round(minY), w: round(maxX - minX), h: round(maxY - minY) };
};

// Sample every path at a fixed arc-length step and score each sample by
// how sharply the direction changes across a window around it. Corners
// and tight bends score high; straight runs score ~0. Open path ends get
// a fixed medium score so line-art terminals can also host a sparkle.
const computeAnchors = (paths, bbox) => {
  const diag = Math.hypot(bbox.w, bbox.h) || 1;
  const window = diag * 0.012;
  const step = diag * 0.004;
  const candidates = [];
  for (const p of paths) {
    let props;
    try {
      props = new svgPathProperties(p.d);
    } catch {
      continue;
    }
    const total = props.getTotalLength();
    if (!Number.isFinite(total) || total < window * 3) continue;
    const start = props.getPointAtLength(0);
    const end = props.getPointAtLength(total);
    const closed = /z\s*$/i.test(p.d) || Math.hypot(end.x - start.x, end.y - start.y) < step;
    const n = Math.max(8, Math.floor(total / step));
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * total;
      let sa = s - window, sb = s + window;
      if (closed) {
        sa = ((sa % total) + total) % total;
        sb = ((sb % total) + total) % total;
      } else {
        if (sa < 0 || sb > total) continue;
      }
      const a = props.getPointAtLength(sa);
      const c = props.getPointAtLength(s);
      const b = props.getPointAtLength(sb);
      const v1 = [c.x - a.x, c.y - a.y];
      const v2 = [b.x - c.x, b.y - c.y];
      const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
      if (l1 < 1e-6 || l2 < 1e-6) continue;
      const cos = Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)));
      candidates.push({ x: c.x, y: c.y, score: Math.acos(cos) });
    }
    if (!closed) {
      candidates.push({ x: start.x, y: start.y, score: Math.PI / 2 });
      candidates.push({ x: end.x, y: end.y, score: Math.PI / 2 });
    }
  }
  // Non-maximum suppression so anchors spread around the shape.
  candidates.sort((a, b) => b.score - a.score);
  const minDist = diag * 0.06;
  const kept = [];
  for (const c of candidates) {
    if (c.score < 0.15) break;
    if (kept.every((k) => Math.hypot(k.x - c.x, k.y - c.y) >= minDist)) {
      kept.push({ x: round(c.x, 2), y: round(c.y, 2), score: round(c.score, 4) });
      if (kept.length >= 48) break;
    }
  }
  return kept;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = () => {
  if (!existsSync(SUBJECTS_FILE)) {
    console.error(`✖ ${SUBJECTS_FILE} not found`);
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(SUBJECTS_FILE, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("✖ subjects.json must be an array of subject rows");
    process.exit(1);
  }

  let hardErrors = 0;
  const subjects = [];
  const seenIds = new Set();
  let stillCount = 0;

  for (const row of rows) {
    const label = row?.id ?? "(missing id)";
    const problems = [];
    if (!row || typeof row.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(row.id)) {
      problems.push("id must be a lowercase slug (a-z, 0-9, hyphens)");
    } else if (seenIds.has(row.id)) {
      problems.push("duplicate id");
    }
    if (typeof row?.name !== "string" || !row.name.trim()) problems.push("name is required");
    if (typeof row?.svg !== "string" || !row.svg.trim()) problems.push("svg file name is required");
    const colourways = Array.isArray(row?.colourways) ? row.colourways : [];
    if (colourways.length === 0) problems.push("colourways must list at least one of " + KNOWN_COLOURWAYS.join("/"));
    if (colourways.length > MAX_COLOURWAYS_PER_SUBJECT) problems.push(`at most ${MAX_COLOURWAYS_PER_SUBJECT} colourways per subject`);
    for (const c of colourways) if (!KNOWN_COLOURWAYS.includes(c)) problems.push(`unknown colourway "${c}"`);
    if (new Set(colourways).size !== colourways.length) problems.push("duplicate colourway");
    const scaleOverride = row?.scaleOverride ?? null;
    if (scaleOverride !== null && !(typeof scaleOverride === "number" && scaleOverride > 0 && scaleOverride <= 1.2)) {
      problems.push("scaleOverride must be null or a number in (0, 1.2]: fraction of frame height for the artwork's longest side");
    }
    if (problems.length) {
      hardErrors++;
      console.error(`✖ ${label}: ${problems.join("; ")}`);
      continue;
    }
    seenIds.add(row.id);

    const svgPath = join(ASSETS_DIR, row.svg);
    if (!existsSync(svgPath)) {
      hardErrors++;
      console.error(`✖ ${row.id}: SVG not found at assets/subjects/${row.svg}`);
      continue;
    }
    const { errors, warnings, paths, viewBox } = flattenSvg(readFileSync(svgPath, "utf8"), row.svg);
    if (errors.length) {
      hardErrors++;
      console.error(`✖ ${row.id} (${row.svg}):\n    ${errors.join("\n    ")}`);
      continue;
    }
    const bbox = computeBbox(paths);
    const aspect = bbox.w / bbox.h;
    const extreme = aspect > MAX_WIDE_ASPECT || 1 / aspect > MAX_TALL_ASPECT;
    if (extreme && scaleOverride === null) {
      console.warn(
        `⚠ ${row.id}: artwork aspect ratio is ${round(aspect, 2)}:1 (bbox ${bbox.w}×${bbox.h}), beyond the auto-fit limits ` +
          `(wider than ${MAX_WIDE_ASPECT}:1 or taller than 1:${MAX_TALL_ASPECT}). ` +
          `Set "scaleOverride" in subjects.json (fraction of frame height for its longest side, e.g. 0.7) — SKIPPED until then.`,
      );
      continue;
    }
    const anchors = computeAnchors(paths, bbox);
    for (const w of warnings) console.warn(`⚠ ${row.id}: ${w}`);
    stillCount += colourways.length;
    subjects.push({
      id: row.id,
      name: row.name,
      svg: row.svg,
      colourways,
      scaleOverride,
      viewBox,
      bbox,
      aspect: round(aspect, 4),
      extremeAspect: extreme,
      paths,
      anchors,
      warnings,
    });
    const modes = paths.reduce((acc, p) => ((acc[p.mode] = (acc[p.mode] ?? 0) + 1), acc), {});
    console.log(
      `✔ ${row.id}: ${paths.length} path(s) [${Object.entries(modes).map(([k, v]) => `${v} ${k}`).join(", ")}], ` +
        `bbox ${bbox.w}×${bbox.h} @ (${bbox.x}, ${bbox.y}), aspect ${round(aspect, 2)}:1, ${anchors.length} anchors` +
        (scaleOverride !== null ? `, scaleOverride ${scaleOverride}` : ""),
    );
  }

  if (stillCount > MAX_STILLS) {
    hardErrors++;
    console.error(`✖ batch would produce ${stillCount} stills; the project limit is ${MAX_STILLS}. Remove subjects or colourways.`);
  }

  const manifest = { generatedAt: new Date().toISOString(), subjects };
  writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`→ wrote ${subjects.length} subject(s), ${stillCount} still(s) to src/subjects/manifest.generated.json`);
  if (hardErrors) {
    console.error(`✖ ${hardErrors} subject(s) failed validation`);
    process.exit(1);
  }
};

main();

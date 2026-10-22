import React from "react";
import { FONT_LABEL, FONT_MONO } from "../common/constants";
import { easeOut, flickerIn, hash, ramp, rng, typed } from "../common/math";
import { WorldPalette } from "./palette";
import { MapCamera, projectPoint } from "./projection";
import { regionAt, W } from "./timeline";
import { DataRows, fakeRow, Label, Panel, ProgressLine } from "./ui";

const DW = 1920;
const DH = 1080;
export const FOCUS = { x: 345, y: 186, w: 1230, h: 708 };

/** Persistent dashboard chrome: header, file list, side panels. */
export const Chrome: React.FC<{ frame: number; pal: WorldPalette }> = ({ frame, pal }) => {
  const top = ramp(frame, 4, 14);
  const p = flickerIn(frame, W.panelsIn, 1);
  const p2 = flickerIn(frame, W.decodeIn, 2);
  const sat = flickerIn(frame, W.panelsIn + 3, 3) * (1 - ramp(frame, W.objLabel, W.objLabel + 8));
  const scanLabel = typed("SCANNING", frame, W.panelsIn, 30);
  const posLabel = typed("POSITION ANALISIS", frame, W.decodeIn, 40);
  const searchLabel = typed("SEARCHING PROGRESS", frame, W.panelsIn + 4, 40);
  const trackP = (frame % 140) / 140;
  return (
    <>
      {/* Top menu strip */}
      <div style={{ position: "absolute", left: 0, top: 0, width: DW, height: 14, opacity: top, borderBottom: `1px solid ${pal.panelEdge}` }}>
        <Label x={18} y={3} text="FILE   EDIT   VIEW   WINDOW   TOOLS   HELP" pal={pal} size={7.5} mono color={pal.dim} />
        <Label x={960} y={3} text="SYS-0396 // GLOBAL TRACKING NODE" pal={pal} size={7.5} mono color={pal.dim} anchor="center" />
        <Label x={1900} y={3} text={`${String(Math.floor(frame / 30) + 14).padStart(2, "0")}:${String((frame * 2) % 60).padStart(2, "0")}:07  UTC`} pal={pal} size={7.5} mono color={pal.dim} anchor="right" />
      </div>
      {/* Header labels */}
      <div style={{ opacity: p }}>
        <Label x={22} y={24} text="LOCATION" pal={pal} size={7} mono color={pal.dim} />
        <Label x={22} y={33} text={scanLabel} pal={pal} size={15} weight={600} />
        <ProgressLine x={22} y={52} w={66} p={1} pal={pal} />
      </div>
      <div style={{ opacity: p2 }}>
        <Label x={108} y={33} text={posLabel} pal={pal} size={15} weight={600} />
        <ProgressLine x={108} y={52} w={120} p={0.35} pal={pal} />
        {/* Folder list */}
        <div style={{ position: "absolute", left: 22, top: 66 }}>
          <DataRows n={6} seed={40} frame={frame} pal={pal} icon len={12} lineH={13} />
        </div>
      </div>
      <div style={{ opacity: p }}>
        <Label x={1890} y={20} text={searchLabel} pal={pal} size={15} weight={600} anchor="right" />
        <ProgressLine x={1720} y={40} w={170} p={ramp(frame, W.panelsIn, W.alpha)} pal={pal} />
        <Label x={1890} y={46} text={`${Math.round(ramp(frame, W.panelsIn, W.alpha) * 100)}% / NODE 07`} pal={pal} size={7} mono color={pal.dim} anchor="right" />
      </div>
      {/* INFO */}
      <Panel x={30} y={622} w={250} h={430} title="INFO" pal={pal} opacity={p}>
        <DataRows n={30} seed={100} frame={frame} pal={pal} icon len={24} lineH={13} highlight={Math.floor(frame / 12) % 30} />
      </Panel>
      {/* DECODING PROCESS */}
      <Panel x={205} y={770} w={280} h={282} title="DECODING PROCESS" pal={pal} opacity={p2}>
        <Label x={8} y={6} text="PROGRAMMING SUPPORT" pal={pal} size={8} mono color={pal.text} />
        <div style={{ position: "absolute", left: 8, top: 22 }}>
          <DataRows n={Math.min(18, Math.floor(Math.max(0, frame - W.decodeIn) / 4))} seed={300} frame={frame} pal={pal} len={40} lineH={12} />
        </div>
      </Panel>
      {/* SATELLITE CONNECTION */}
      <Panel x={1556} y={412} w={282} h={250} title="SATELLITE CONNECTION" pal={pal} opacity={sat}>
        <Label x={8} y={6} text="ALPHA PROTOCOL" pal={pal} size={8} mono />
        <div style={{ position: "absolute", left: 8, top: 22 }}>
          <DataRows n={7} seed={500} frame={frame} pal={pal} len={30} lineH={12} />
        </div>
        <svg width={266} height={80} style={{ position: "absolute", left: 8, top: 120 }}>
          <polyline points="6,70 70,52 140,66 210,22 258,70" fill="none" stroke={pal.text} strokeWidth={1} opacity={0.8} />
          {[6, 70, 140, 210, 258].map((x, i) => (
            <circle key={i} cx={x} cy={[70, 52, 66, 22, 70][i]} r={3} fill={pal.panel} stroke={pal.text} />
          ))}
        </svg>
      </Panel>
      {/* TRACKING PROGRESS */}
      <Panel x={1625} y={778} w={262} h={272} title="TRACKING PROGRESS" pal={pal} opacity={p}>
        <div style={{ display: "flex", gap: 14, fontFamily: FONT_MONO, fontSize: 7, color: pal.text, marginBottom: 4 }}>
          <span>ID</span>
          <span>COORDINATES</span>
          <span>STATUS</span>
        </div>
        <DataRows n={17} seed={700} frame={frame} pal={pal} len={34} lineH={12} accentEvery={frame > W.alpha ? 4 : 0} />
        <ProgressLine x={0} y={236} w={246} p={trackP} pal={pal} />
      </Panel>
    </>
  );
};

/** Opening authentication dialog, loading bar and search request. */
export const BootDialogs: React.FC<{ frame: number; pal: WorldPalette }> = ({ frame, pal }) => {
  const auth = ramp(frame, W.authIn, W.authIn + 6, easeOut) * (1 - ramp(frame, W.authOut - 4, W.authOut));
  const user = "•".repeat(Math.max(0, Math.min(10, Math.floor((frame - W.authUser) / 1.2))));
  const pass = "•".repeat(Math.max(0, Math.min(14, Math.floor((frame - W.authPass) / 1.0))));
  const btn = frame >= W.authButton;
  const loadP = ramp(frame, W.loadingIn, W.loadingDone);
  const loading = flickerIn(frame, W.loadingIn, 5) * (1 - ramp(frame, W.loadingDone + 2, W.loadingDone + 6));
  const search = ramp(frame, W.searchIn, W.searchIn + 6, easeOut) * (1 - ramp(frame, W.searchOut - 4, W.searchOut));
  const query = typed("OBJ-96-BETA", frame, W.searchType, 9);
  const caret = Math.floor(frame / 8) % 2 ? "▌" : " ";
  const field = (x: number, y: number, w: number, text: string, active: boolean) => (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: 18,
        border: `1px solid ${active ? pal.highlight : pal.panelEdge}`,
        fontFamily: FONT_MONO,
        fontSize: 11,
        color: pal.text,
        lineHeight: "18px",
        textAlign: "center",
        letterSpacing: 2,
      }}
    >
      {text}
    </div>
  );
  return (
    <>
      {auth > 0 ? (
        <div style={{ position: "absolute", left: 700, top: 395, width: 520, height: 170, opacity: auth, transform: `scaleY(${0.3 + 0.7 * auth})` }}>
          <Panel x={0} y={0} w={520} h={170} title="" pal={pal} opacity={1}>
            <Label x={260} y={6} text="AUTHENTICATION PROTOCOL" pal={pal} size={14} weight={600} anchor="center" />
            <Label x={260} y={26} text="USER ACCESS LEVEL 4 REQUIRED" pal={pal} size={7} mono color={pal.dim} anchor="center" />
            {field(60, 42, 384, user, frame < W.authPass)}
            {field(60, 70, 384, pass, frame >= W.authPass && !btn)}
            <div
              style={{
                position: "absolute",
                left: 190,
                top: 104,
                width: 120,
                height: 18,
                background: btn ? pal.highlight : "transparent",
                border: `1px solid ${pal.panelEdge}`,
                color: btn ? "#111" : pal.text,
                fontFamily: FONT_LABEL,
                fontSize: 10,
                letterSpacing: 1.5,
                lineHeight: "18px",
                textAlign: "center",
              }}
            >
              AUTHENTICATION
            </div>
          </Panel>
        </div>
      ) : null}
      {auth > 0 ? (
        <>
          <Label x={300} y={936} text="LOADING PROTOCOL" pal={pal} size={8} mono color={pal.dim} opacity={auth} />
          <div style={{ position: "absolute", left: 340, top: 1020, width: 1240, opacity: auth * 0.7 }}>
            <DataRows n={2} seed={900} frame={frame} pal={pal} len={180} lineH={10} />
          </div>
          <ProgressLine x={1100} y={905} w={300} p={ramp(frame, W.authIn, W.authOut)} pal={pal} opacity={auth} />
        </>
      ) : null}
      {loading > 0 ? (
        <div style={{ position: "absolute", left: 820, top: 520, width: 280, height: 20, opacity: loading }}>
          <div style={{ position: "absolute", inset: 0, border: `1px solid ${pal.panelEdge}` }} />
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${loadP * 100}%`, background: pal.highlight, opacity: 0.9 }} />
          <div style={{ position: "absolute", inset: 0, textAlign: "center", lineHeight: "20px", fontFamily: FONT_LABEL, fontWeight: 600, fontSize: 13, letterSpacing: 1.5, color: loadP > 0.5 ? "#111" : pal.text, mixBlendMode: "normal" }}>
            INTERFACE LOADING
          </div>
          <Label x={290} y={5} text={`${Math.round(loadP * 100)}%`} pal={pal} size={9} mono />
        </div>
      ) : null}
      {search > 0 ? (
        <div style={{ position: "absolute", left: 690, top: 488, width: 540, height: 88, opacity: search, transform: `scaleY(${0.3 + 0.7 * search})` }}>
          <Panel x={0} y={0} w={540} h={88} title="SEARCH REQUEST" pal={pal} opacity={1}>
            <Label x={270} y={4} text="INSERT OBJECT DESIGNATION" pal={pal} size={7} mono color={pal.dim} anchor="center" />
            {field(14, 22, 380, query + caret, true)}
            <div
              style={{
                position: "absolute",
                left: 404,
                top: 22,
                width: 112,
                height: 18,
                border: `1px solid ${pal.panelEdge}`,
                background: frame > W.searchOut - 12 ? pal.highlight : "transparent",
                color: frame > W.searchOut - 12 ? "#111" : pal.text,
                fontFamily: FONT_LABEL,
                fontSize: 10,
                letterSpacing: 1.5,
                lineHeight: "18px",
                textAlign: "center",
              }}
            >
              SEARCH ⌕
            </div>
          </Panel>
        </div>
      ) : null}
    </>
  );
};

const COORDS = {
  world: ["00000 N", "00000 E"],
  na: ["59840 N", "22784 E"],
  asia: ["24364 N", "11288 E"],
  africa: ["22984 N", "27404 E"],
};

// Reticle waypoints per region (lon/lat).
const RETICLE: Record<string, [number, number][]> = {
  na: [[-100, 44], [-88, 41], [-79, 46], [-95, 52]],
  asia: [[128, 36], [108, 50], [92, 56], [86, 48]],
  africa: [[47, 41], [44, 30], [30, 27], [31, 30]],
};

const ZONES = ["NORTH AMERICA", "EUROPE", "ASIA", "AUSTRALIA/OCEANIA", "ANTARCTICA", "SOUTH AMERICA", "AFRICA"];

/** Search frame, reticle, coordinates and the final alpha-protocol beat. */
export const SearchFrame: React.FC<{ frame: number; cam: MapCamera; pal: WorldPalette }> = ({ frame, cam, pal }) => {
  const objOnMap = flickerIn(frame, W.objLabel, 4) * (1 - ramp(frame, W.zoomNA[0], W.zoomNA[0] + 4));
  const fIn = ramp(frame, W.frameIn, W.frameIn + 10, easeOut);
  const region = regionAt(frame);
  const whipping =
    (frame > W.whipAsia[0] && frame < W.whipAsia[1]) || (frame > W.whipAfrica[0] && frame < W.whipAfrica[1]);
  const scramble = (s: string, seed: number) =>
    whipping ? s.replace(/\d/g, (_, i) => String(Math.floor(hash(frame * 1.7 + i + seed) * 10))) : s;
  const [cn, ce] = COORDS[region];
  const alpha = frame >= W.alpha;
  const alphaIn = flickerIn(frame, W.alpha, 8);
  const tData = flickerIn(frame, W.targetData, 6);
  const regionStart = region === "na" ? W.zoomNA[1] : region === "asia" ? W.whipAsia[1] : W.whipAfrica[1];
  const regionEnd = region === "na" ? W.whipAsia[0] : region === "asia" ? W.whipAfrica[0] : W.alpha;

  // Reticle travels along the waypoints for the active region.
  let ret: { x: number; y: number } | null = null;
  if (region !== "world") {
    const pts = RETICLE[region];
    const t = ramp(frame, regionStart + 8, regionEnd, (x) => x) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(t));
    const u = t - i;
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const lon = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * e;
    const lat = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * e;
    ret = projectPoint(cam, lon, lat, DW, DH);
  }
  const P = (lon: number, lat: number) => projectPoint(cam, lon, lat, DW, DH);
  const marks = region === "africa" ? ramp(frame, W.targetMarks, W.targetMarks + 10) : 0;
  const grid = region === "africa" ? ramp(frame, W.gridScan, W.gridScan + 12) : 0;
  const cairo = P(31.2, 30.0);
  const tgt = P(33.4, 27.6);
  const caspian = P(50.5, 41.0);

  return (
    <>
      {/* OBJ label on the world view */}
      <div style={{ opacity: objOnMap }}>
        <Label x={400} y={350} text="OBJ-96-BETA" pal={pal} size={18} weight={600} />
        <Label x={400} y={372} text="QUERY ACCEPTED / GLOBAL SWEEP" pal={pal} size={7} mono color={pal.dim} />
      </div>
      {fIn > 0 ? (
        <div style={{ position: "absolute", inset: 0, opacity: fIn }}>
          <svg width={DW} height={DH} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <clipPath id="focusClip">
                <rect x={FOCUS.x} y={FOCUS.y} width={FOCUS.w} height={FOCUS.h} />
              </clipPath>
            </defs>
            <rect x={FOCUS.x} y={FOCUS.y} width={FOCUS.w} height={FOCUS.h} fill="none" stroke={pal.panelEdge} strokeWidth={1.2} />
            {/* corner ticks */}
            {[
              [FOCUS.x, FOCUS.y, 1, 1],
              [FOCUS.x + FOCUS.w, FOCUS.y, -1, 1],
              [FOCUS.x, FOCUS.y + FOCUS.h, 1, -1],
              [FOCUS.x + FOCUS.w, FOCUS.y + FOCUS.h, -1, -1],
            ].map(([x, y, sx, sy], i) => (
              <path key={i} d={`M${x} ${y + sy * 14}V${y}H${x + sx * 14}`} stroke={pal.text} strokeWidth={2} fill="none" />
            ))}
            {/* Screen-space crosshair ticks across the whole frame */}
            {[0.25, 0.5, 0.75].map((f) => (
              <g key={f} stroke={pal.accent} strokeWidth={1} opacity={0.6}>
                <line x1={FOCUS.x + FOCUS.w * f} y1={FOCUS.y - 6} x2={FOCUS.x + FOCUS.w * f} y2={FOCUS.y + 6} />
                <line x1={FOCUS.x + FOCUS.w * f} y1={FOCUS.y + FOCUS.h - 6} x2={FOCUS.x + FOCUS.w * f} y2={FOCUS.y + FOCUS.h + 6} />
                <line x1={FOCUS.x - 6} y1={FOCUS.y + FOCUS.h * f} x2={FOCUS.x + 6} y2={FOCUS.y + FOCUS.h * f} />
              </g>
            ))}
            <g clipPath="url(#focusClip)">
              {/* Scan grid over the Middle East in the last region */}
              {grid > 0 ? (
                <g opacity={grid}>
                  {Array.from({ length: 31 }, (_, i) => (
                    <line key={`v${i}`} x1={FOCUS.x + i * 40} y1={FOCUS.y} x2={FOCUS.x + i * 40} y2={FOCUS.y + FOCUS.h} stroke={pal.text} strokeWidth={0.5} opacity={alpha ? 0.28 : 0.12} />
                  ))}
                  {Array.from({ length: 18 }, (_, i) => (
                    <line key={`h${i}`} x1={FOCUS.x} y1={FOCUS.y + i * 40} x2={FOCUS.x + FOCUS.w} y2={FOCUS.y + i * 40} stroke={pal.text} strokeWidth={0.5} opacity={alpha ? 0.28 : 0.12} />
                  ))}
                  {!alpha
                    ? Array.from({ length: 6 }, (_, i) => {
                        const r = rng(Math.floor((frame - W.gridScan) / 6) * 31 + i);
                        const gx = FOCUS.x + 40 * Math.floor(10 + r() * 14);
                        const gy = FOCUS.y + 40 * Math.floor(4 + r() * 8);
                        return <rect key={i} x={gx} y={gy} width={40} height={40} fill={pal.accentSoft} stroke={pal.accent} strokeWidth={0.8} />;
                      })
                    : null}
                </g>
              ) : null}
              {/* Target marks near the Caspian */}
              {marks > 0 ? (
                <g opacity={marks} stroke={pal.accent} strokeWidth={1.5} fill="none">
                  <circle cx={caspian.x} cy={caspian.y} r={26} strokeDasharray="4 4" />
                  <path d={`M${caspian.x - 40} ${caspian.y}h22M${caspian.x + 18} ${caspian.y}h22M${caspian.x} ${caspian.y - 40}v22M${caspian.x} ${caspian.y + 18}v22`} />
                  <circle cx={tgt.x} cy={tgt.y} r={4} fill={pal.accent} stroke="none" />
                </g>
              ) : null}
              {alpha ? (
                <g opacity={alphaIn}>
                  {/* Red Sea corridor and target */}
                  <path d={`M${P(32.5, 31).x} ${P(32.5, 31).y}L${P(33.8, 27.8).x} ${P(33.8, 27.8).y}L${P(36, 24).x} ${P(36, 24).y}L${P(38.5, 19).x} ${P(38.5, 19).y}`} stroke={pal.accent} strokeWidth={2.5} fill="none" />
                  <path d={`M${tgt.x} ${tgt.y - 9}L${tgt.x + 8} ${tgt.y + 6}L${tgt.x - 8} ${tgt.y + 6}Z`} fill={pal.accent} />
                  <g transform={`translate(${cairo.x + 14} ${cairo.y - 10})`}>
                    <rect width={46} height={14} fill="rgba(0,0,0,0.35)" stroke={pal.text} strokeWidth={0.8} />
                    <text x={23} y={10.5} textAnchor="middle" fontFamily={FONT_LABEL} fontSize={9} fill={pal.text} letterSpacing={1}>
                      CAIRO
                    </text>
                  </g>
                  {[
                    ["LIBYA SECTOR", 17, 26],
                    ["SUDAN SECTOR", 29, 15],
                    ["ARABIA SECTOR", 45, 24],
                    ["SAHARA GRID 07", 4, 22],
                  ].map(([t, lon, lat]) => {
                    const p = P(lon as number, lat as number);
                    return (
                      <text key={t as string} x={p.x} y={p.y} fontFamily={FONT_MONO} fontSize={8} fill={pal.accent} opacity={0.9}>
                        {t as string}
                      </text>
                    );
                  })}
                  <circle cx={P(20, 21).x} cy={P(20, 21).y} r={3} fill={pal.accent} />
                </g>
              ) : null}
              {/* Reticle */}
              {ret ? (
                <g transform={`translate(${ret.x} ${ret.y})`} opacity={whipping ? 0.3 : 0.9}>
                  <circle r={46} fill="none" stroke={pal.text} strokeWidth={1} opacity={0.7} />
                  <circle r={30} fill="none" stroke={pal.text} strokeWidth={1} strokeDasharray="3 3" transform={`rotate(${frame * 3})`} />
                  <circle r={62} fill="none" stroke={pal.accent} strokeWidth={0.8} opacity={0.6} strokeDasharray="20 10" transform={`rotate(${-frame * 2})`} />
                  <path d="M-80 0h30M50 0h30M0 -80v30M0 50v30" stroke={pal.text} strokeWidth={1} opacity={0.8} />
                  <circle r={3} fill={pal.accent} />
                </g>
              ) : null}
            </g>
          </svg>
          {/* Frame captions */}
          <Label x={FOCUS.x + 12} y={FOCUS.y + 10} text={alpha ? "SEARCH COMPLETE" : "SEARCH IN PROGRESS"} pal={pal} size={13} weight={600} opacity={alpha ? 0.45 : 1} />
          {alpha ? (
            <>
              <Label x={FOCUS.x + 180} y={FOCUS.y + 12} text="TARGET IDENTIFIED // PRIORITY ONE" pal={pal} size={7} mono color={pal.accent} opacity={alphaIn} />
              <Label x={FOCUS.x + 180} y={FOCUS.y + 22} text="ALPHA PROTOCOL INITIALIZATION" pal={pal} size={15} weight={600} color={pal.accent} opacity={alphaIn} />
            </>
          ) : null}
          <Label x={FOCUS.x + FOCUS.w - 120} y={FOCUS.y + 10} text={scramble(cn, 1)} pal={pal} size={14} weight={600} anchor="right" />
          <Label x={FOCUS.x + FOCUS.w - 16} y={FOCUS.y + 10} text={scramble(ce, 2)} pal={pal} size={14} weight={600} anchor="right" />
          <Label x={FOCUS.x + 12} y={FOCUS.y + 66} text="OBJECT" pal={pal} size={7} mono color={pal.dim} />
          <Label x={FOCUS.x + 12} y={FOCUS.y + 76} text="OBJ-96-BETA" pal={pal} size={15} weight={600} />
          <div style={{ position: "absolute", left: FOCUS.x + 12, top: FOCUS.y + 100 }}>
            {[0.8, 0.55, 0.3, 0.65].map((v, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", height: 12 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 6.5, color: pal.dim, width: 44 }}>{fakeRow(i + 60, 7)}</span>
                <div style={{ width: 50, height: 4, background: pal.panelEdge }}>
                  <div style={{ width: `${(v + 0.15 * Math.sin(frame / 9 + i)) * 100}%`, height: 4, background: pal.highlight }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 6, width: 40, height: 12, border: `1px solid ${pal.panelEdge}`, fontFamily: FONT_MONO, fontSize: 6.5, color: pal.text, textAlign: "center", lineHeight: "12px" }}>
              TRACK
            </div>
          </div>
          {/* Search zones */}
          <div style={{ position: "absolute", left: FOCUS.x + FOCUS.w - 230, top: FOCUS.y + 420, width: 214, opacity: alpha ? 0 : 1 }}>
            <Label x={0} y={0} text="SEARCH ZONES" pal={pal} size={10} weight={600} />
            {ZONES.map((z, i) => {
              const active = (region === "na" && i === 0) || (region === "asia" && i === 2) || (region === "africa" && i === 6);
              return (
                <div key={z} style={{ position: "absolute", top: 20 + i * 28, left: 0, width: 214, display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 7.5, color: active ? pal.accent : pal.dim }}>
                  <span>{z}</span>
                  <span>{active ? "SCANNING" : i % 2 ? "CLEAR" : "QUEUED"}</span>
                </div>
              );
            })}
          </div>
          {/* Right data column outside the frame */}
          <div style={{ position: "absolute", left: FOCUS.x + FOCUS.w + 18, top: FOCUS.y + 200, width: 110 }}>
            {Array.from({ length: 20 }, (_, i) => (
              <div key={i} style={{ display: "flex", gap: 4, alignItems: "center", height: 11 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 6, color: pal.dim }}>{fakeRow(i + 820, 9)}</span>
                <div style={{ width: 3 + 22 * hash(i + Math.floor(frame / 6) * 0.37), height: 3, background: hash(i * 3.3) > 0.7 ? pal.accent : pal.dim }} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {/* TARGET DATA panel with a street-network extraction */}
      {tData > 0 ? (
        <div style={{ opacity: tData }}>
          <Panel x={1210} y={640} w={360} h={250} title="TARGET DATA" pal={pal} opacity={1}>
            <Label x={336} y={-14} text="OBJ-96-BETA" pal={pal} size={7} mono color={pal.dim} anchor="right" />
            <StreetNet frame={frame} pal={pal} />
            <div style={{ position: "absolute", left: 8, top: 176 }}>
              <DataRows n={4} seed={950} frame={frame} pal={pal} len={52} lineH={11} />
            </div>
          </Panel>
        </div>
      ) : null}
    </>
  );
};

/** Procedural street network "satellite extraction" (draws on over time). */
const NET = (() => {
  const r = rng(4242);
  const lines: string[] = [];
  for (let i = 0; i < 70; i++) {
    let x = r() * 340;
    let y = r() * 160;
    let a = r() * Math.PI * 2;
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const steps = 6 + Math.floor(r() * 18);
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.5;
      x += Math.cos(a) * 9;
      y += Math.sin(a) * 9;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    lines.push(d);
  }
  return lines;
})();

const StreetNet: React.FC<{ frame: number; pal: WorldPalette }> = ({ frame, pal }) => {
  const t = ramp(frame, W.targetData, W.targetData + 40);
  return (
    <svg width={344} height={166} style={{ position: "absolute", left: 8, top: 4, background: "rgba(0,0,0,0.55)" }}>
      {NET.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke={pal.text}
          strokeWidth={i % 7 === 0 ? 1.6 : 0.7}
          fill="none"
          opacity={0.55 + 0.4 * hash(i)}
          pathLength={1}
          strokeDasharray={`${Math.min(1, Math.max(0, t * 1.6 - (i / NET.length) * 0.6))} 1`}
        />
      ))}
      <circle cx={170} cy={84} r={5} fill="none" stroke={pal.accent} strokeWidth={1.5} opacity={t} />
    </svg>
  );
};

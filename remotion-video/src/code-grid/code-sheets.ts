import { SHEET_HEIGHT, SHEET_WIDTH } from "./constants";

export const CODE_FONT_FAMILY = "JetBrains Mono";

// Deterministic PRNG so every render produces identical sheets.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Line = { indent: number; text: string; hot?: boolean };

// Snippets styled after the decoder source visible in the reference.
const BLOCKS: Line[][] = [
  [
    { indent: 0, text: "memset(fragments_buffer, 0, fragments_real_size);" },
    { indent: 0, text: "" },
    { indent: 0, text: "for (int offset = 0; offset < length; offset += 2)" },
    { indent: 0, text: "{" },
    { indent: 1, text: "int x = finder[offset];" },
    { indent: 1, text: "int y = finder[offset + 1];" },
    { indent: 1, text: "fragments_buffer[y * fragments_width + x] = 1;" },
    { indent: 0, text: "}" },
    { indent: 0, text: "return length;" },
  ],
  [
    { indent: 0, text: "int VDChannel::fragments_from_map(BYTE *map, int map_length)", hot: true },
    { indent: 0, text: "{" },
    { indent: 1, text: "int length = map_length;" },
    { indent: 1, text: "int y = 0;" },
    { indent: 1, text: "int x = 0;" },
    { indent: 0, text: "" },
    { indent: 1, text: "for (int i = 0; i < length; i++)" },
    { indent: 1, text: "{" },
    { indent: 2, text: "int value = map[i];" },
    { indent: 2, text: "for (int j = 0, mask = 0x01; j < 8; j++, mask <<= 1)" },
    { indent: 2, text: "{" },
    { indent: 3, text: "if ((value & mask) != 0)" },
    { indent: 4, text: "fragments_buffer[y * fragments_width + x] = 1;" },
    { indent: 3, text: "x++;" },
    { indent: 3, text: "if (x >= fragments_width) { x = 0; y++; }" },
    { indent: 2, text: "}" },
    { indent: 1, text: "}" },
    { indent: 0, text: "}" },
  ],
  [
    { indent: 1, text: "case MFX_ERR_MORE_DATA:" },
    { indent: 2, text: "more_data_needed = 0;" },
    { indent: 2, text: "break;" },
    { indent: 1, text: "case MFX_WRN_VIDEO_PARAM_CHANGED:" },
    { indent: 2, text: "SendError(\"Video parameters changed\", 0);" },
    { indent: 2, text: "break;" },
    { indent: 1, text: "case MFX_ERR_NONE:" },
    { indent: 2, text: "more_data_needed = 0;" },
    { indent: 2, text: "break;" },
    { indent: 1, text: "default:" },
    { indent: 2, text: "sprintf(log, \"DecodeFrameAsync error, sts: %d, cnt: %d\", sts, cnt);", hot: true },
    { indent: 2, text: "SendError(log, -13);" },
    { indent: 2, text: "/*stillSpray = 0;*/" },
    { indent: 2, text: "break;" },
  ],
  [
    { indent: 0, text: "if (sts == MFX_ERR_NONE && syncp) sts = MFX_ERR_NONE;" },
    { indent: 0, text: "sts = mfxSession.SyncOperation(syncp, 60000);", hot: true },
    { indent: 0, text: "switch (sts) {" },
    { indent: 1, text: "case MFX_WRN_DEVICE_BUSY:" },
    { indent: 2, text: "MSDK_SLEEP(1);" },
    { indent: 2, text: "break;" },
    { indent: 1, text: "case MFX_ERR_MORE_SURFACE:" },
    { indent: 2, text: "nIndex = GetFreeSurfaceIndex(pSurfaces, numSurfaces);" },
    { indent: 2, text: "break;" },
    { indent: 0, text: "}" },
  ],
  [
    { indent: 0, text: "#define MFX_FRAME_HDR_SIZE  0x40   // header bytes" },
    { indent: 0, text: "#define MFX_FRAME_FLAG_KEY  (1 << 3)" },
    { indent: 0, text: "#define MFX_FRAME_FLAG_EOS  (1 << 6)", hot: true },
    { indent: 0, text: "" },
    { indent: 0, text: "static const BYTE g_lookup[] = {" },
  ],
  [
    { indent: 0, text: "rgb_pixel->r = (BYTE)(clip(y + 1.402f * v));" },
    { indent: 0, text: "rgb_pixel->g = (BYTE)(clip(y - 0.344f * u - 0.714f * v));" },
    { indent: 0, text: "rgb_pixel->b = (BYTE)(clip(y + 1.772f * u));" },
    { indent: 0, text: "x_offset += (stride >> 1) + pitch;" },
    { indent: 0, text: "__SCRAMBLE_out_of_range(fragments, &mask);", hot: true },
  ],
  [
    { indent: 0, text: "while (m_bRunning && !m_bExit)" },
    { indent: 0, text: "{" },
    { indent: 1, text: "DWORD wait = WaitForSingleObject(hEvent, 16);" },
    { indent: 1, text: "if (wait == WAIT_TIMEOUT) continue;" },
    { indent: 1, text: "ProcessPacket(&queue[head++ & QUEUE_MASK]);" },
    { indent: 1, text: "packets_total++;" },
    { indent: 0, text: "}" },
  ],
];

const hexByte = (rand: () => number) =>
  Math.floor(rand() * 256)
    .toString()
    .padStart(3, " ");

const makeTable = (rand: () => number): Line[] => {
  const rows = 5 + Math.floor(rand() * 6);
  const out: Line[] = [];
  for (let r = 0; r < rows; r++) {
    const cells: string[] = [];
    for (let c = 0; c < 12; c++) cells.push(hexByte(rand) + ",");
    out.push({ indent: 1, text: cells.join(" ") });
  }
  out.push({ indent: 0, text: "};" });
  return out;
};

const buildLines = (rand: () => number, count: number) => {
  const lines: Line[] = [];
  // Table-heavy sheets read like the number grids in the reference.
  const tableBias = rand() < 0.35 ? 0.5 : 0.12;
  while (lines.length < count) {
    if (rand() < tableBias) {
      lines.push(BLOCKS[4][4]);
      lines.push(...makeTable(rand));
    } else {
      const block = BLOCKS[Math.floor(rand() * BLOCKS.length)];
      const shift = rand() < 0.4 ? 1 : 0;
      for (const l of block) {
        lines.push({ ...l, indent: l.indent + shift });
      }
    }
    if (rand() < 0.6) lines.push({ indent: 0, text: "" });
  }
  return lines.slice(0, count);
};

// Draws one tall sheet of code. The shader reads channels as masks:
// R = any glyph coverage, G = highlighted glyph coverage.
export const drawCodeSheet = (seed: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const rand = mulberry32(seed * 7919 + 13);
  const fontSize = 25;
  const lineHeight = 40;
  const charWidth = fontSize * 0.6;
  const marginX = 34 + Math.floor(rand() * 30);
  const count = Math.floor(SHEET_HEIGHT / lineHeight);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `500 ${fontSize}px "${CODE_FONT_FAMILY}", monospace`;
  ctx.textBaseline = "middle";
  // Plain ASCII glyphs: no "->" style ligatures.
  ctx.textRendering = "optimizeSpeed";

  const lines = buildLines(rand, count);
  lines.forEach((line, i) => {
    if (!line.text) return;
    const y = i * lineHeight + lineHeight / 2;
    const x = marginX + line.indent * charWidth * 4;
    const hot = line.hot || rand() < 0.04;
    // Occasional selection bar behind a line, like an editor cursor row.
    const selected = rand() < 0.012;
    if (selected) {
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(x - 4, y - lineHeight / 2 + 3, Math.min(560, line.text.length * charWidth + 8), lineHeight - 6);
    }
    ctx.fillStyle = hot ? (selected ? "#ffffff" : "#ffff00") : selected ? "#ff00ff" : "#ff0000";
    ctx.fillText(line.text, x, y);
  });
  return canvas;
};

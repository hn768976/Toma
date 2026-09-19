// Timing, palette and layout for the "cyber alert" glitch composition —
// a recreation of a 15s warning-screen loop: a red warning triangle over
// an animated blue pixel-mosaic field, with recurring signal-glitch hits.
//
// Every geometric value below is authored at 1x (1920x1080) and
// multiplied by `resolutionScale` at draw time, so the 1080p and 4K
// compositions are pixel-for-pixel the same picture at different sizes.

export const FPS = 30;

// The reference clip is 15.08s. 452 frames at 30fps = 15.067s, the
// closest whole-frame match.
export const DURATION_IN_FRAMES = 452;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Palette -------------------------------------------------------------
// Sampled from the reference: the field sits on near-black navy and the
// mosaic blocks ramp up through it to a saturated electric blue.
export const BG_COLOR = "#05010c";
export const MOSAIC_HUE = 222; // degrees; the blue the whole field lives in
export const MOSAIC_MAX_LIGHTNESS = 46; // % — brightest a block ever gets
export const BLOOM_COLOR = "80, 140, 255"; // rgb triplet for the light sweeps

export const ALERT_RED = "#e80023"; // triangle fill
export const ALERT_RED_BRIGHT = "#ff0f30"; // triangle outline / glow
export const CODE_BLUE = "#4b7fd8"; // faint code-fragment text
export const DIGIT_BLUE = "#6f93cc"; // scattered binary/hex digits

// --- Layout (1x) ---------------------------------------------------------
// Measured off the reference and scaled to 1920x1080: the triangle's
// glow-inclusive bounding box is ~340x330 centred at (960, 435), and the
// headline's caps run from y=694 to y=791.
export const TRIANGLE_CENTER_Y = 435;
export const TRIANGLE_WIDTH = 356; // outer width of the rounded triangle
export const HEADLINE_BASELINE_Y = 791;
export const HEADLINE_FONT_SIZE = 133; // gives the reference's 97px cap height
// The reference face is noticeably narrower than Archivo Black, so the
// headline is drawn horizontally compressed to match its proportions.
export const HEADLINE_CONDENSE = 0.86;
export const HEADLINE_MAX_WIDTH = 1560; // 1x px; longer strings shrink to fit

// --- Mosaic field --------------------------------------------------------
// Block size at 1x. The reference reads as roughly 4-6px blocks at 596px
// wide, which scales to ~16px here.
export const MOSAIC_BLOCK = 16;
// How often (in frames) the whole mosaic reshuffles to a new pattern.
// Low value = frantic static; the reference is a fast, restless field.
export const MOSAIC_RESHUFFLE_PERIOD = 2;

// --- Glitch schedule -----------------------------------------------------
// Hand-placed to match where the reference actually breaks up. `at` and
// `dur` are seconds; `intensity` 0..1 drives slice count, RGB split
// distance and how far the headline smears.
//
//   heavy — full-frame slice tearing + RGB split + headline shred
//   drop  — signal loss: foreground blinks out, background dims
//   soft  — gentle wobble and chromatic fringing only
export type GlitchKind = "heavy" | "drop" | "soft";

export type GlitchEvent = {
  at: number;
  dur: number;
  intensity: number;
  kind: GlitchKind;
};

export const GLITCH_EVENTS: GlitchEvent[] = [
  { at: 0.0, dur: 0.8, intensity: 0.9, kind: "heavy" },
  { at: 1.15, dur: 0.2, intensity: 0.35, kind: "soft" },
  { at: 2.3, dur: 0.9, intensity: 0.75, kind: "drop" },
  { at: 3.8, dur: 0.5, intensity: 1.0, kind: "heavy" },
  { at: 4.9, dur: 0.17, intensity: 0.3, kind: "soft" },
  { at: 5.95, dur: 0.85, intensity: 0.6, kind: "drop" },
  { at: 7.3, dur: 0.45, intensity: 0.8, kind: "heavy" },
  { at: 8.35, dur: 0.55, intensity: 1.0, kind: "heavy" },
  { at: 9.35, dur: 0.6, intensity: 0.4, kind: "soft" },
  { at: 10.6, dur: 0.2, intensity: 0.3, kind: "soft" },
  { at: 12.3, dur: 0.5, intensity: 0.95, kind: "drop" },
  { at: 12.85, dur: 0.4, intensity: 0.9, kind: "heavy" },
  { at: 13.8, dur: 0.5, intensity: 1.0, kind: "drop" },
  { at: 14.8, dur: 0.35, intensity: 0.95, kind: "heavy" },
];

// --- Bloom sweeps --------------------------------------------------------
// Soft blue light pools that drift across the field. Positions are in 1x
// coordinates; `at`/`dur` in seconds.
export const BLOOM_SWEEPS: {
  at: number;
  dur: number;
  x: number;
  y: number;
  radius: number;
  peak: number;
}[] = [
  { at: -0.6, dur: 2.4, x: 430, y: 120, radius: 1050, peak: 1.15 },
  { at: 2.5, dur: 2.0, x: 1200, y: 480, radius: 1200, peak: 0.7 },
  { at: 5.1, dur: 1.8, x: 640, y: 760, radius: 980, peak: 0.55 },
  { at: 8.9, dur: 2.2, x: 1500, y: 300, radius: 1300, peak: 0.85 },
  { at: 10.5, dur: 2.2, x: 700, y: 420, radius: 1400, peak: 1.0 },
  { at: 14.4, dur: 1.8, x: 1100, y: 560, radius: 1150, peak: 0.9 },
];

// --- Code fragments ------------------------------------------------------
// The reference shows tiny C preprocessor / inline-asm snippets fading in
// and out in the corners. Kept as flavour text, deliberately unreadable at
// normal viewing distance.
export const CODE_LINES: string[] = [
  "#ifndef  _dontattack",
  "#define  _dontattack",
  "#ifdef   __cplusplus",
  "#endif",
  'extern "C" { /* our assembly functions have C calling convention */',
  'void DoOnStackLoad();  /* prototype for DoOnStack routine */',
  'void FixedOnAccessAgent(char *);  /* prototype for FlowThread */',
  "unsigned long  __stdcall  ThreadProc(void *lpParameter);",
  "if (hProcess == INVALID_HANDLE_VALUE) return FALSE;",
  "memcpy(payload + offset, shellcode, sizeof(shellcode));",
  "0x4A3F  mov  eax, dword ptr [ebp-0x1C]",
  "0x4A44  call  sub_401A70  ; inject",
  "status = NtQuerySystemInformation(SystemModuleInformation);",
  "WriteProcessMemory(hProc, remoteBuf, buf, len, NULL);",
];

// Looks 3 and 5: text labels and generated tables. All placeholder text;
// the code below was written for this project and does nothing real.
import { LAND_MASK } from "../../data/world";
import { makeSeries, mulberry32, rInt, rPick } from "../../lib/random";

export const AL = {
  appTitle: "AI SYSTEM INTERFACE",
  nav: ["PROJECT", "FILE MANAGER", "CODE", "AI ASSISTANT", "NEURAL NETWORK", "SYSTEM"],
  status: "SYSTEM STATUS",
  online: "Online",
  footer: [
    ["PROJECT:", "Cyber_Project"],
    ["ENV:", "production"],
    ["USER:", "admin"],
    ["BRANCH:", "main"],
    ["BUILD:", "v1.2.4"],
  ],
  folders: "FOLDERS",
  file: "main.cpp",
  assistant: "AI Assistant",
  greeting: "Hi! How can I help you?",
  inputPlaceholder: "Type a message…",
  menu: ["New Chat", "History", "Settings", "Help"],
  core: "AI CORE",
  metrics: "SYSTEM METRICS",
  structure: "PROJECT STRUCTURE",
  flow: "DATA FLOW",
  network: "NEURAL NETWORK",
  logs: "SYSTEM LOGS",
  terminal: "BUILD OUTPUT",
  processing: "AI PROCESSING",
  model: "QORIN-7", // invented model name
  version: "3.8.14",
  steps: ["ANALYZING INPUT", "EMBEDDING", "VECTOR SEARCH", "CONTEXT MATCH", "INFERENCE", "RESPONSE READY"],
  flowSteps: ["USER INPUT", "PREPROCESS", "EMBEDDING", "VECTOR DB", "AI MODEL", "RESPONSE"],
  layers: ["INPUT LAYER", "HIDDEN LAYERS", "OUTPUT LAYER"],
};

// --------------------------------------------------------- folder tree --
export type TreeRow = { name: string; depth: number; open?: boolean; folder: boolean };
export const TREE: TreeRow[] = [
  { name: "Cyber_Project", depth: 0, open: true, folder: true },
  { name: "01_Source", depth: 1, open: true, folder: true },
  { name: "images", depth: 2, folder: true },
  { name: "footage", depth: 2, folder: true },
  { name: "audio", depth: 2, folder: true },
  { name: "02_Code", depth: 1, open: true, folder: true },
  { name: "core", depth: 2, folder: true },
  { name: "modules", depth: 2, folder: true },
  { name: "utils", depth: 2, folder: true },
  { name: "tests", depth: 2, folder: true },
  { name: "03_Data", depth: 1, open: true, folder: true },
  { name: "datasets", depth: 2, folder: true },
  { name: "models", depth: 2, folder: true },
  { name: "output", depth: 2, folder: true },
  { name: "04_Docs", depth: 1, open: true, folder: true },
  { name: "readme", depth: 2, folder: true },
  { name: "api", depth: 2, folder: true },
  { name: "references", depth: 2, folder: true },
  { name: "05_Build", depth: 1, open: true, folder: true },
  { name: "bin", depth: 2, folder: true },
  { name: "lib", depth: 2, folder: true },
  { name: "temp", depth: 2, folder: true },
];
/** Selection stops: 8 x 75 frames = 600. Indices into TREE. */
export const TREE_STOPS = [6, 7, 11, 12, 3, 15, 19, 8];
/** Which top-level project node (0..4) each stop belongs to. */
export const STOP_GROUP = [1, 1, 2, 2, 0, 3, 4, 1];

// ---------------------------------------------------------------- code --
export const CODE: string[] = [
  "#include \"core/bus.h\"",
  "#include \"core/safe.h\"",
  "",
  "namespace orbit {",
  "",
  "class SignalBus",
  "{",
  "public:",
  "    bool open(const std::string& host, int port)",
  "    {",
  "        log(\"Opening bus on \" + host);",
  "        return link_.bind(host, port);",
  "    }",
  "",
  "    void push(const Packet& p)",
  "    {",
  "        queue_.emplace_back(p);",
  "        notify();",
  "    }",
  "",
  "private:",
  "    Link link_;",
  "    std::vector<Packet> queue_;",
  "};",
  "",
  "class TokenSafe",
  "{",
  "public:",
  "    std::string issueToken(int userId)",
  "    {",
  "        auto seed = clock_.tick() ^ userId;",
  "        return hex(mix(seed, salt_));",
  "    }",
  "",
  "private:",
  "    Clock clock_;",
  "    uint64_t salt_ = 0x5eed;",
  "};",
  "",
  "class FrameRenderer",
  "{",
  "public:",
  "    void draw(const Scene& s)",
  "    {",
  "        for (auto& layer : s.layers())",
  "            layer.paint(target_);",
  "        ++frames_;",
  "    }",
  "",
  "private:",
  "    Surface target_;",
  "    int frames_ = 0;",
  "};",
  "",
  "int run(const Config& cfg)",
  "{",
  "    SignalBus bus;",
  "    if (!bus.open(cfg.host, cfg.port))",
  "        return 1;  // no route",
  "    return 0;",
  "}",
  "",
  "} // namespace orbit",
  "",
];

const KW = new Set([
  "class", "public", "private", "return", "if", "for", "auto", "const", "namespace", "void", "bool", "int",
  "#include", "uint64_t",
]);
export type Tok = { t: string; k: "kw" | "type" | "str" | "num" | "com" | "plain" | "punct" };
export const tokenize = (line: string): Tok[] => {
  const out: Tok[] = [];
  const ci = line.indexOf("//");
  const body = ci >= 0 ? line.slice(0, ci) : line;
  const re = /("[^"]*")|(#include|[A-Za-z_][A-Za-z0-9_]*)|(0x[0-9a-f]+|\d+)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    if (m[1]) out.push({ t: m[1], k: "str" });
    else if (m[2]) out.push({ t: m[2], k: KW.has(m[2]) ? "kw" : /^[A-Z]/.test(m[2]) || m[2] === "std" ? "type" : "plain" });
    else if (m[3]) out.push({ t: m[3], k: "num" });
    else if (m[4]) out.push({ t: m[4], k: "plain" });
    else out.push({ t: m[5], k: "punct" });
  }
  if (ci >= 0) out.push({ t: line.slice(ci), k: "com" });
  return out;
};
export const CODE_TOKENS = CODE.map(tokenize);

// ---------------------------------------------------------------- logs --
const stamp = (t: number) =>
  `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const LOG_TEXT = [
  "Validating input structure…",
  "Preprocessing text…",
  "Normalizing input tokens…",
  "Tokenizing input sequence…",
  "Generating embeddings…",
  "Encoding semantic vectors…",
  "Searching vector index…",
  "Matching context window…",
  "Loading inference engine…",
  "Running model inference…",
  "Scoring candidate replies…",
  "Response ready (412 ms)",
  "Writing cache entry…",
  "Health check passed",
  "Syncing model weights…",
  "Idle, awaiting input…",
];
export const AI_LOG = (() => {
  const r = mulberry32(3001);
  let t = 14 * 3600 + 32 * 60 + 1;
  return LOG_TEXT.map((m) => {
    t += rInt(r, 1, 6);
    return { time: stamp(t), msg: m };
  });
})();
export const BUILD_LOG = [
  "$ build --target release",
  "[  8%] Compiling core/bus.cpp",
  "[ 17%] Compiling core/safe.cpp",
  "[ 29%] Compiling modules/render.cpp",
  "[ 41%] Compiling modules/net.cpp",
  "[ 55%] Compiling utils/hex.cpp",
  "[ 68%] Generating model bindings",
  "[ 82%] Linking orbit_core",
  "[100%] Linking app",
  "Build succeeded in 14.2 s",
  "$ run tests",
  "248 passed, 0 failed",
];

// ---------------------------------------------------------- chat cycles --
// One cycle = 200 frames, 3 cycles per loop, each with its own Q/A.
export const QA: { q: string; a: string }[] = [
  {
    q: "Summarize today's build status.",
    a: "Build v1.2.4 passed all 248 tests. Two warnings in modules/net were logged for review.",
  },
  {
    q: "Why is this function slow?",
    a: "The loop re-allocates its buffer on every pass. Move the allocation outside the loop to cut runtime by about 40%.",
  },
  {
    q: "Explain the embedding step.",
    a: "Each input chunk becomes a 768-dimension vector, which is matched against the index to find the closest context.",
  },
];
export const wrap = (s: string, maxChars: number) => {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      lines.push(cur.trim());
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
};

// ------------------------------------------------------------- globe --
/** Fibonacci sphere, land flag from the Natural Earth mask. */
export const GLOBE_POINTS = (() => {
  const N = 4200;
  const r = mulberry32(3002);
  const pts: { x: number; y: number; z: number; land: boolean; s: number }[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = ga * i;
    const x = Math.cos(th) * rad;
    const z = Math.sin(th) * rad;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(z, x) * 180) / Math.PI;
    const row = Math.min(179, Math.max(0, Math.floor(90 - lat)));
    const col = Math.min(359, Math.max(0, Math.floor(lon + 180)));
    const land = LAND_MASK[row][col] === "1";
    if (!land && r() > 0.22) continue; // sparse ocean
    pts.push({ x, y, z, land, s: 0.7 + r() * 0.6 });
  }
  return pts;
})();

// --------------------------------------------------------- networks --
export const makeNet = (seed: number, layers: number[], pulses: number) => {
  const r = mulberry32(seed);
  const edges: { l: number; a: number; b: number }[] = [];
  for (let l = 0; l < layers.length - 1; l++)
    for (let a = 0; a < layers[l]; a++) for (let b = 0; b < layers[l + 1]; b++) edges.push({ l, a, b });
  // A signal wave crosses the net every 60 frames: transition l is
  // travelled during frames [l*T, (l+1)*T) of the wave. Two interleaved
  // waves (offset 0 or 30) keep the net busy.
  const P = Array.from({ length: pulses }, () => {
    const e = rPick(r, edges);
    return { ...e, offset: rPick(r, [0, 30] as const) };
  });
  return { edges, pulses: P };
};

export const SPARKS = [3101, 3102, 3103, 3104, 3105, 3106].map((s) => makeSeries(s, 60, [1, 2, 3, 5, 8, 11]));

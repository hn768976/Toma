import { clamp } from "../../lib/loop";
import { hash01, mulberry32 } from "../../lib/random";

/* ───────────────────────── Typing schedule ───────────────────────── */

/**
 * A seeded typing schedule computed ONCE at module level: times[i] is the
 * (fractional) frame at which character i appears. Leading indentation
 * appears instantly (editor auto-indent); there are bursts, short pauses
 * at word boundaries and longer pauses at line ends. The schedule is then
 * scaled to span [start, end]. charsAt(frame) is a pure function.
 */
export type Schedule = { times: Float64Array; text: string };

export const buildSchedule = (text: string, seed: number, start: number, end: number): Schedule => {
  const rnd = mulberry32(seed);
  const raw = new Float64Array(text.length);
  let t = 0;
  let atLineStart = true;
  let burst = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (atLineStart && ch === " ") {
      raw[i] = t; // auto-indent
      continue;
    }
    atLineStart = false;
    if (burst <= 0) burst = 6 + Math.floor(rnd() * 22); // characters until the next micro-pause
    let d = 0.55 + rnd() * 0.9;
    burst--;
    if (burst === 0) d += 2 + rnd() * 5;
    if (ch === " " && rnd() < 0.08) d += 4 + rnd() * 8; // thinking pause between words
    if (ch === "\n") {
      d += 3 + rnd() * 6;
      atLineStart = true;
      if (text[i + 1] === "\n") d += 6;
    }
    t += d;
    raw[i] = t;
  }
  const total = raw[raw.length - 1] || 1;
  const times = new Float64Array(text.length);
  for (let i = 0; i < text.length; i++) times[i] = start + ((end - start) * raw[i]) / total;
  return { times, text };
};

/** Number of visible characters at `frame` (binary search, pure). */
export const charsAt = (s: Schedule, frame: number) => {
  let lo = 0;
  let hi = s.times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (s.times[mid] <= frame) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

/* ───────────────────────── Syntax highlighting ───────────────────────── */

export const SYNTAX = {
  text: "#C9D4E2",
  keyword: "#C792EA",
  string: "#B5DB8C",
  number: "#F5A36C",
  comment: "#5E6F84",
  func: "#7DB4FF",
  cls: "#F2CC6B",
  builtin: "#58D0D6",
  deco: "#E58BC4",
  op: "#8FA3BA",
};

const KEYWORDS = new Set(
  "import from as def class return for in if elif else while with not and or is None True False lambda yield try except raise pass break continue global".split(" "),
);
const BUILTINS = new Set("self super print range len float int str list dict tuple open max min round sorted enumerate zip abs sum".split(" "));

export type Seg = { text: string; color: string; start: number };

/** Tokenise Python source into coloured segments, grouped per line. */
export const highlight = (src: string): Seg[][] => {
  const segs: Seg[] = [];
  let i = 0;
  const push = (text: string, color: string, start: number) => segs.push({ text, color, start });
  while (i < src.length) {
    const c = src[i];
    const start = i;
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      push(src.slice(start, i), SYNTAX.comment, start);
    } else if (c === '"' || c === "'" || ((c === "f" || c === "b") && (src[i + 1] === '"' || src[i + 1] === "'"))) {
      if (c === "f" || c === "b") i++;
      const q = src[i];
      i++;
      while (i < src.length && src[i] !== q && src[i] !== "\n") {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      push(src.slice(start, i), SYNTAX.string, start);
    } else if (c === "@") {
      while (i < src.length && /[\w.@]/.test(src[i])) i++;
      push(src.slice(start, i), SYNTAX.deco, start);
    } else if (/[0-9]/.test(c)) {
      while (i < src.length && /[0-9.e\-x_]/.test(src[i]) && !(src[i] === "-" && !/e/.test(src[i - 1]))) i++;
      push(src.slice(start, i), SYNTAX.number, start);
    } else if (/[A-Za-z_]/.test(c)) {
      while (i < src.length && /\w/.test(src[i])) i++;
      const word = src.slice(start, i);
      const prev = src.slice(Math.max(0, start - 6), start);
      let color = SYNTAX.text;
      if (KEYWORDS.has(word)) color = SYNTAX.keyword;
      else if (/class\s$/.test(prev)) color = SYNTAX.cls;
      else if (BUILTINS.has(word)) color = SYNTAX.builtin;
      else if (src[i] === "(") color = /^[A-Z]/.test(word) ? SYNTAX.cls : SYNTAX.func;
      else if (/^[A-Z][a-z]/.test(word)) color = SYNTAX.cls;
      push(word, color, start);
    } else if (c === "\n") {
      push("\n", SYNTAX.text, start);
      i++;
    } else {
      while (i < src.length && !/[\w#"'@\n]/.test(src[i])) i++;
      push(src.slice(start, i), /^\s+$/.test(src.slice(start, i)) ? SYNTAX.text : SYNTAX.op, start);
    }
  }
  const lines: Seg[][] = [[]];
  for (const s of segs) {
    if (s.text === "\n") lines.push([]);
    else lines[lines.length - 1].push(s);
  }
  return lines;
};

/* ───────────────────────── Training timeline & logs ───────────────────────── */

export const TRAIN_START = 20;
export const TRAIN_END = 540;
export const TOTAL_STEPS = 3600;
export const EPOCHS = 3;

export const progressAt = (frame: number) => clamp((frame - TRAIN_START) / (TRAIN_END - TRAIN_START));
export const stepAt = (frame: number) => Math.round(progressAt(frame) * TOTAL_STEPS);
export const epochAt = (frame: number) => Math.min(EPOCHS, 1 + Math.floor(stepAt(frame) / (TOTAL_STEPS / EPOCHS)));

export const lossAt = (step: number, kind: "llm" | "finetune") => {
  const base = kind === "llm" ? 0.86 + 2.45 * Math.exp(-step / 820) : 0.41 + 0.95 * Math.exp(-step / 1100);
  return base + (hash01(step, 77) - 0.5) * 0.035;
};
export const valAccAt = (step: number) => 0.62 + 0.21 * (1 - Math.exp(-step / 1300)) + (hash01(step, 91) - 0.5) * 0.004;
export const gpuAt = (frame: number) => 90 + 3.2 * Math.sin(frame * 0.11) + 1.6 * Math.sin(frame * 0.37 + 1) + (hash01(Math.floor(frame / 6), 5) - 0.5) * 2;
export const vramAt = (frame: number) => 39.2 + 0.6 * Math.sin(frame * 0.05) + (hash01(Math.floor(frame / 15), 6) - 0.5) * 0.3;

/** Simulated wall clock: each frame ≈ 7 s of training time. */
export const clockAt = (frame: number, offsetS = 0) => {
  const s = 12 * 3600 + 14 * 60 + 32 + Math.floor(frame * 7) + offsetS;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600) % 24)}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
};

export type LogEntry = { frame: number; text: string; level: "INFO" | "WARN" | "DONE" };

export const buildLogs = (kind: "llm" | "finetune", model: string): LogEntry[] => {
  const out: LogEntry[] = [];
  const L = (frame: number, level: LogEntry["level"], msg: string) =>
    out.push({ frame, level, text: `${clockAt(frame)} | ${level === "DONE" ? "INFO" : level} | ${msg}` });
  L(-30, "INFO", `Starting ${kind === "llm" ? "training" : "fine-tuning"} on 4 GPUs`);
  L(-29, "INFO", `Model: ${model} | Precision: bf16 | Batch size: ${kind === "llm" ? 32 : 16}`);
  L(-28, "INFO", kind === "llm" ? "Dataset: corpus-mix-v3 | Tokens: ~1.2B | Seq len: 2048" : "Dataset: support-dialogs-v2 | Examples: 48,200 | Seq len: 1024");
  L(-27, "INFO", `Training for ${EPOCHS} epochs, ${TOTAL_STEPS.toLocaleString("en-US")} steps total`);
  L(-26, "INFO", "Checkpoints: ./ckpt | Dashboard: http://localhost:6006");
  let lastEpoch = 1;
  for (let f = TRAIN_START + 8; f < TRAIN_END; f += 9) {
    const step = stepAt(f);
    const ep = epochAt(f);
    if (ep !== lastEpoch) {
      const prevStep = (TOTAL_STEPS / EPOCHS) * lastEpoch;
      L(f - 4, "INFO", `Epoch ${lastEpoch}/${EPOCHS} finished | avg loss ${lossAt(prevStep, kind).toFixed(4)} | saved ./ckpt/epoch_${lastEpoch}.pt`);
      if (kind === "finetune") L(f - 2, "INFO", `Validation | val_acc ${valAccAt(prevStep).toFixed(3)} | val_loss ${(lossAt(prevStep, kind) + 0.06).toFixed(4)}`);
      else L(f - 2, "INFO", "Running evaluation on validation set...");
      lastEpoch = ep;
    }
    const lr = kind === "llm" ? 3e-4 * (0.5 + 0.5 * Math.cos((Math.PI * step) / TOTAL_STEPS)) : 2e-5;
    if (kind === "finetune" && step % 400 < 40 && step > 300) {
      L(f, "INFO", `[Epoch ${ep}/${EPOCHS}] [Step ${step}/${TOTAL_STEPS}] val_acc: ${valAccAt(step).toFixed(3)} (rising)`);
    } else {
      L(
        f,
        "INFO",
        `[Epoch ${ep}/${EPOCHS}] [Step ${step}/${TOTAL_STEPS}] loss: ${lossAt(step, kind).toFixed(4)} | lr: ${lr.toExponential(1)} | GPU: ${Math.round(gpuAt(f))}% | VRAM: ${vramAt(f).toFixed(1)}/80 GB`,
      );
    }
    if (hash01(f, 404) < 0.05) L(f + 3, "WARN", `Gradient norm spike ${(1.2 + hash01(f, 3)).toFixed(2)} → clipped to 1.0`);
  }
  L(TRAIN_END, "DONE", `Epoch 3/3 complete | final loss ${lossAt(TOTAL_STEPS, kind).toFixed(4)}${kind === "finetune" ? ` | val_acc ${valAccAt(TOTAL_STEPS).toFixed(3)}` : ""}`);
  L(TRAIN_END + 6, "DONE", `Saved ./ckpt/epoch_3.pt | total time 1h 01m`);
  return out.sort((a, b) => a.frame - b.frame);
};

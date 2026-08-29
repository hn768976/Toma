// One-off voiceover transcription: mp3 -> 16kHz WAV -> Whisper.cpp (medium.en,
// word-level timestamps) -> @remotion/captions Caption[] in public/.
//
//   node scripts/transcribe.mjs [input.mp3] [slug]
//
// Set WHISPER_JSON=<file> to skip Whisper and re-derive the outputs from a
// previously saved raw whisper.cpp result (written to node_modules/.cache).
//
// Writes public/captions-<slug>.json and public/transcript-<slug>.txt and
// prints a timing summary to the terminal.

import { execFileSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from "@remotion/install-whisper-cpp";
import { FPS } from "../src/timing.ts";

const WHISPER_VERSION = "1.7.4";
const WHISPER_PATH = path.join(process.cwd(), "whisper.cpp");
const MODEL = "medium.en";

const input = path.resolve(process.argv[2] ?? "public/voiceover-01.mp3");
const slug = process.argv[3] ?? "01";
const jsonOut = path.join(process.cwd(), "public", `captions-${slug}.json`);
const textOut = path.join(process.cwd(), "public", `transcript-${slug}.txt`);

// --- 1. 16kHz mono WAV (whisper.cpp accepts nothing else) -----------------

const tmpDir = path.join(process.cwd(), "node_modules", ".cache", "transcribe");
mkdirSync(tmpDir, { recursive: true });
const rawOut = path.join(tmpDir, `${slug}-whisper.json`);

const runWhisper = async () => {
  const wav = path.join(tmpDir, `${slug}-16k.wav`);
  console.log(
    `Converting ${path.relative(process.cwd(), input)} -> 16kHz mono WAV`,
  );
  execFileSync(
    "npx",
    ["remotion", "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", input,
     "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav, "-y"],
    { stdio: "inherit" },
  );

  // --- 2. Whisper.cpp + medium.en -----------------------------------------

  await installWhisperCpp({ to: WHISPER_PATH, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: MODEL, folder: WHISPER_PATH });

  // The model comes from huggingface.co. Behind a proxy that blocks it, the
  // download "succeeds" with an HTML/error body and whisper.cpp then dies with
  // an opaque "invalid model data (bad magic)". Check the ggml magic up front
  // so the failure names the real cause.
  const modelPath = path.join(WHISPER_PATH, `ggml-${MODEL}.bin`);
  const magic = Buffer.alloc(4);
  const fd = openSync(modelPath, "r");
  readSync(fd, magic, 0, 4, 0);
  closeSync(fd);
  if (magic.toString("hex") !== "6c6d6767") {
    throw new Error(
      `${modelPath} is not a ggml model (${statSync(modelPath).size} bytes, ` +
        `magic ${JSON.stringify(magic.toString("utf8"))}).\n` +
        `The download from huggingface.co did not return the weights — most ` +
        `likely the host is blocked by a network egress policy. Delete the ` +
        `file and re-run once huggingface.co is reachable, or copy ` +
        `ggml-${MODEL}.bin into ${WHISPER_PATH}/ by hand.`,
    );
  }

  // --- 3. Transcribe with word-level timestamps ----------------------------

  const result = await transcribe({
    inputPath: wav,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    model: MODEL,
    modelFolder: WHISPER_PATH,
    tokenLevelTimestamps: true,
    printOutput: false,
    onProgress: (p) =>
      process.stdout.write(`\rTranscribing: ${Math.round(p * 100)}%  `),
  });
  process.stdout.write("\n");
  writeFileSync(rawOut, `${JSON.stringify(result, null, 2)}\n`);
  return result;
};

const whisperCppOutput = process.env.WHISPER_JSON
  ? JSON.parse(readFileSync(process.env.WHISPER_JSON, "utf8"))
  : await runWhisper();

const { captions } = toCaptions({ whisperCppOutput });

// whisper.cpp emits sub-word tokens with a leading space marking a word start;
// toCaptions() keeps that shape, so drop the empty/marker-only entries.
const words = captions.filter((c) => c.text.trim().length > 0);

writeFileSync(jsonOut, `${JSON.stringify(captions, null, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), jsonOut)} (${captions.length} captions)`);

// --- 4. Readable transcript with per-sentence timestamps -------------------

const fmt = (ms) => {
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = (total - m * 60).toFixed(2).padStart(5, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
};

const sentences = [];
let current = null;
for (const w of words) {
  if (current === null) {
    current = { startMs: w.startMs, endMs: w.endMs, text: "" };
  }
  current.text += w.text;
  current.endMs = w.endMs;
  if (/[.!?]["')\]]?\s*$/.test(w.text.trim())) {
    sentences.push(current);
    current = null;
  }
}
if (current) sentences.push(current);

const transcriptBody = sentences
  .map((s) => `[${fmt(s.startMs)}] ${s.text.trim()}`)
  .join("\n\n");

const durationMs = words.length ? words[words.length - 1].endMs : 0;
const durationSec = durationMs / 1000;
const durationFrames = Math.ceil((durationMs / 1000) * FPS);
const wpm = durationSec > 0 ? (words.length / durationSec) * 60 : 0;

writeFileSync(
  textOut,
  [
    `Transcript ${slug} — ${path.basename(input)}`,
    `${durationSec.toFixed(2)}s · ${durationFrames} frames @ ${FPS}fps · ${words.length} words · ${wpm.toFixed(1)} wpm`,
    "",
    transcriptBody,
    "",
  ].join("\n"),
);
console.log(`Wrote ${path.relative(process.cwd(), textOut)} (${sentences.length} sentences)`);

// --- 5. Summary ------------------------------------------------------------

const gaps = [];
for (let i = 1; i < words.length; i++) {
  gaps.push({
    ms: words[i].startMs - words[i - 1].endMs,
    afterWord: words[i - 1].text.trim(),
    beforeWord: words[i].text.trim(),
    atMs: words[i - 1].endMs,
    untilMs: words[i].startMs,
  });
}
gaps.sort((a, b) => b.ms - a.ms);

const lowConfidence = words.filter((w) => w.confidence !== null && w.confidence < 0.5);

console.log("");
console.log("═══ TRANSCRIPTION SUMMARY ═══════════════════════════════════");
console.log(`  Duration        ${durationSec.toFixed(2)}s  (${durationFrames} frames @ ${FPS}fps)`);
console.log(`  Words           ${words.length}`);
console.log(`  Sentences       ${sentences.length}`);
console.log(`  Average pace    ${wpm.toFixed(1)} words/min`);
console.log("");
console.log("  10 longest gaps between words (natural beat boundaries):");
console.log("    #   gap      from      to        between");
for (const [i, g] of gaps.slice(0, 10).entries()) {
  console.log(
    `    ${String(i + 1).padStart(2)}  ${(g.ms / 1000).toFixed(2)}s   ` +
      `${fmt(g.atMs)}  ${fmt(g.untilMs)}   ` +
      `"${g.afterWord}" → "${g.beforeWord}"   (frame ${Math.round((g.atMs / 1000) * FPS)} → ${Math.round((g.untilMs / 1000) * FPS)})`,
  );
}
console.log("");
if (lowConfidence.length === 0) {
  console.log("  Low-confidence words (< 0.5): none");
} else {
  console.log(`  Low-confidence words (< 0.5) — check these timings by ear (${lowConfidence.length}):`);
  for (const w of lowConfidence) {
    console.log(
      `    ${fmt(w.startMs)}  conf ${w.confidence.toFixed(2)}  "${w.text.trim()}"  (frame ${Math.round((w.startMs / 1000) * FPS)})`,
    );
  }
}
console.log("═════════════════════════════════════════════════════════════");

// Generates the source text that gets etched onto the blocks.
//
// The reference clip is covered in C, in the house style of a libcurl
// example: setopt calls, CURLcode checks, fprintf'd error strings. This
// module produces the same flavour procedurally, so the field can be
// filled with thousands of lines that never repeat verbatim without
// shipping a real source file (and without accidentally showing a real
// project's code on screen).
//
// Output is a flat list of indented lines. It is pure and deterministic:
// same Rng seed in, same listing out.

import { chance, intRange, pick, range, type Rng } from "./random";

const TYPES = [
  "int",
  "long",
  "size_t",
  "char *",
  "const char *",
  "unsigned",
  "CURLcode",
  "static int",
  "uint32_t",
  "double",
] as const;

const NOUNS = [
  "conn",
  "session",
  "buffer",
  "header",
  "payload",
  "socket",
  "stream",
  "handle",
  "request",
  "response",
  "chunk",
  "token",
  "packet",
  "record",
  "entry",
  "node",
  "frame",
  "index",
  "cursor",
  "channel",
] as const;

const VERBS = [
  "init",
  "read",
  "write",
  "flush",
  "parse",
  "encode",
  "decode",
  "resolve",
  "commit",
  "reset",
  "close",
  "open",
  "append",
  "verify",
  "sync",
  "drain",
] as const;

const CURL_OPTIONS = [
  "CURLOPT_URL",
  "CURLOPT_WRITEFUNCTION",
  "CURLOPT_WRITEDATA",
  "CURLOPT_ERRORBUFFER",
  "CURLOPT_TIMEOUT",
  "CURLOPT_FOLLOWLOCATION",
  "CURLOPT_NOPROGRESS",
  "CURLOPT_USERAGENT",
  "CURLOPT_HTTPHEADER",
  "CURLOPT_SSL_VERIFYPEER",
  "CURLOPT_CONNECTTIMEOUT",
  "CURLOPT_POSTFIELDS",
] as const;

const ERRORS = [
  "Failed to set URL [%s]",
  "Failed to set writer [%s]",
  "Failed to set write data [%s]",
  "Failed to open stream [%s]",
  "unable to allocate %lu bytes",
  "unexpected status %d for %s",
  "short read: wanted %lu, got %lu",
  "handshake aborted after %d ms",
  "invalid header at offset %lu",
  "checksum mismatch (%08x != %08x)",
] as const;

const snake = (rng: Rng) => `${pick(rng, VERBS)}_${pick(rng, NOUNS)}`;

/** One line of generated source: an indent level plus its text. */
export type CodeLine = { indent: number; text: string };

const statement = (rng: Rng, indent: number): CodeLine[] => {
  const roll = rng();

  if (roll < 0.14) {
    return [
      {
        indent,
        text: `code = curl_easy_setopt(conn, ${pick(rng, CURL_OPTIONS)}, ${pick(rng, NOUNS)});`,
      },
    ];
  }

  if (roll < 0.28) {
    return [
      { indent, text: "if (code != CURLE_OK) {" },
      {
        indent: indent + 1,
        text: `fprintf(stderr, "${pick(rng, ERRORS)}\\n", errbuf);`,
      },
      { indent: indent + 1, text: "return false;" },
      { indent, text: "}" },
    ];
  }

  if (roll < 0.38) {
    const n = pick(rng, NOUNS);
    return [
      { indent, text: `if (${n} == NULL || ${n}->len == 0) {` },
      { indent: indent + 1, text: `return ${pick(rng, ["-1", "0", "false", "NULL"])};` },
      { indent, text: "}" },
    ];
  }

  if (roll < 0.48) {
    return [
      {
        indent,
        text: `for (i = 0; i < ${pick(rng, NOUNS)}_count; i++) {`,
      },
      {
        indent: indent + 1,
        text: `${snake(rng)}(&${pick(rng, NOUNS)}[i], flags);`,
      },
      { indent, text: "}" },
    ];
  }

  if (roll < 0.56) {
    return [
      {
        indent,
        text: `memcpy(${pick(rng, NOUNS)}, ${pick(rng, NOUNS)}, ${intRange(rng, 2, 512)});`,
      },
    ];
  }

  if (roll < 0.64) {
    return [
      {
        indent,
        text: `snprintf(buf, sizeof(buf), "%s/%s", base, ${pick(rng, NOUNS)});`,
      },
    ];
  }

  if (roll < 0.72) {
    return [
      {
        indent,
        text: `${pick(rng, TYPES)} ${snake(rng)} = ${intRange(rng, 0, 4096)};`,
      },
    ];
  }

  if (roll < 0.78) {
    return [{ indent, text: `/* ${pick(rng, VERBS)} the ${pick(rng, NOUNS)} */` }];
  }

  if (roll < 0.84) {
    return [
      {
        indent,
        text: `${pick(rng, NOUNS)}->${pick(rng, NOUNS)} = ${snake(rng)}(ctx);`,
      },
    ];
  }

  if (roll < 0.9) {
    return [
      { indent, text: `while (${snake(rng)}(${pick(rng, NOUNS)}) > 0) {` },
      { indent: indent + 1, text: `total += ${pick(rng, NOUNS)}_size;` },
      { indent, text: "}" },
    ];
  }

  if (roll < 0.95) {
    return [{ indent, text: `return ${pick(rng, ["true", "false", "code", "total", "0"])};` }];
  }

  return [
    {
      indent,
      text: `assert(${pick(rng, NOUNS)} != NULL && ${pick(rng, NOUNS)}_len > 0);`,
    },
  ];
};

const fn = (rng: Rng): CodeLine[] => {
  const lines: CodeLine[] = [];
  const args = Array.from({ length: intRange(rng, 1, 3) }, () => {
    return `${pick(rng, TYPES)}${pick(rng, NOUNS)}`;
  }).join(", ");

  lines.push({ indent: 0, text: `${pick(rng, TYPES)} ${snake(rng)}(${args})` });
  lines.push({ indent: 0, text: "{" });
  lines.push({ indent: 1, text: "CURLcode code;" });

  const body = intRange(rng, 3, 8);
  for (let i = 0; i < body; i++) {
    lines.push(...statement(rng, 1));
    if (chance(rng, 0.12)) lines.push({ indent: 0, text: "" });
  }

  lines.push({ indent: 1, text: "return code;" });
  lines.push({ indent: 0, text: "}" });
  lines.push({ indent: 0, text: "" });
  return lines;
};

const PREAMBLE: CodeLine[] = [
  { indent: 0, text: "#include <stdio.h>" },
  { indent: 0, text: "#include <stdlib.h>" },
  { indent: 0, text: "#include <string.h>" },
  { indent: 0, text: '#include "curl/curl.h"' },
  { indent: 0, text: "" },
];

/** Produces at least `minLines` lines of listing. */
export const generateListing = (rng: Rng, minLines: number): CodeLine[] => {
  const lines: CodeLine[] = [...PREAMBLE];
  while (lines.length < minLines) {
    if (chance(rng, 0.1)) {
      lines.push({
        indent: 0,
        text: `#define ${snake(rng).toUpperCase()} ${intRange(rng, 1, 8192)}`,
      });
      continue;
    }
    lines.push(...fn(rng));
  }
  return lines.slice(0, Math.ceil(minLines));
};

/**
 * Per-line brightness. The reference has a few hot white lines among many
 * dim ones rather than a uniform wall of text, which is most of what makes
 * it read as depth rather than as wallpaper.
 */
export const lineBrightness = (rng: Rng) => {
  const roll = rng();
  // Weighted hard towards the bottom on purpose. Every block past the
  // focal plane is sampled from a mip level that averages its whole face,
  // so the mean luminance of this sheet *is* the brightness of the distant
  // field: a comfortable-looking spread here turns the far half of the
  // frame into an even glowing carpet instead of the reference's near
  // black with a scatter of hot lines.
  if (roll < 0.06) return range(rng, 0.85, 1);
  if (roll < 0.22) return range(rng, 0.34, 0.55);
  if (roll < 0.67) return range(rng, 0.12, 0.26);
  return range(rng, 0.035, 0.1);
};

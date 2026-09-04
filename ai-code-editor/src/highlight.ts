import Prism from "prismjs";
import "prismjs/components/prism-python";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";

import type { SynKey } from "./theme";

export type Span = { text: string; key: SynKey };
export type HLine = Span[];

/** Prism token name -> palette slot. Anything unlisted renders as plain code. */
const MAP: Record<string, SynKey> = {
  keyword: "keyword",
  boolean: "keyword",
  "control-flow": "keyword",
  "module-declaration": "keyword",
  string: "string",
  "triple-quoted-string": "string",
  "template-string": "string",
  "string-property": "string",
  char: "string",
  regex: "string",
  function: "function",
  "function-variable": "function",
  "method-name": "function",
  comment: "comment",
  "doc-comment": "comment",
  "class-name": "type",
  "maybe-class-name": "type",
  builtin: "type",
  "known-class-name": "type",
  constant: "number",
  number: "number",
  operator: "operator",
  punctuation: "punct",
  decorator: "decorator",
  "annotation-punctuation": "decorator",
  tag: "tag",
  "attr-name": "attr",
  "attr-value": "string",
  parameter: "plain",
  property: "plain",
};

type PrismToken = string | { type: string; content: unknown; alias?: string | string[] };

const resolve = (type: string, alias: string | string[] | undefined, inherited: SynKey): SynKey => {
  const aliases = alias ? (Array.isArray(alias) ? alias : [alias]) : [];
  for (const name of [...aliases, type]) {
    if (MAP[name]) {
      return MAP[name];
    }
  }
  return inherited;
};

const flatten = (tokens: PrismToken[], inherited: SynKey, out: Span[]) => {
  for (const token of tokens) {
    if (typeof token === "string") {
      out.push({ text: token, key: inherited });
      continue;
    }
    const key = resolve(token.type, token.alias, inherited);
    const { content } = token;
    if (typeof content === "string") {
      out.push({ text: content, key });
    } else if (Array.isArray(content)) {
      flatten(content as PrismToken[], key, out);
    } else if (content) {
      flatten([content as PrismToken], key, out);
    }
  }
};

/**
 * Tokenise once at module scope and hand back an array of lines. The animation
 * then reveals whole lines by index, so nothing is re-highlighted per frame.
 */
export const highlight = (code: string, language: "python" | "tsx"): HLine[] => {
  const grammar = Prism.languages[language];
  const flat: Span[] = [];
  if (grammar) {
    flatten(Prism.tokenize(code, grammar) as PrismToken[], "plain", flat);
  } else {
    flat.push({ text: code, key: "plain" });
  }

  const lines: HLine[] = [[]];
  for (const span of flat) {
    const pieces = span.text.split("\n");
    pieces.forEach((piece, index) => {
      if (index > 0) {
        lines.push([]);
      }
      if (piece.length > 0) {
        lines[lines.length - 1].push({ text: piece, key: span.key });
      }
    });
  }
  return lines;
};

export const lineText = (line: HLine): string => line.map((span) => span.text).join("");

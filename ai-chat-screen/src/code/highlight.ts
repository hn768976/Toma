import Prism from "prismjs/components/prism-core";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-python";

import { PYTHON_SOURCE } from "./source";
import type { SyntaxRole } from "../theme";

export type Span = { text: string; role: SyntaxRole };
export type CodeLine = { spans: Span[]; length: number };

// Prism's token vocabulary -> the seven colour roles in theme.ts.
const ROLE_BY_TOKEN: Record<string, SyntaxRole> = {
  keyword: "keyword",
  boolean: "number",
  number: "number",
  string: "string",
  "triple-quoted-string": "string",
  comment: "comment",
  function: "func",
  decorator: "func",
  "class-name": "type",
  builtin: "type",
  operator: "plain",
  punctuation: "plain",
};

type PrismToken = string | { type: string; content: unknown };

const flatten = (node: unknown, inherited: SyntaxRole, out: Span[]): void => {
  if (typeof node === "string") {
    if (node.length > 0) out.push({ text: node, role: inherited });
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, inherited, out);
    return;
  }
  const token = node as Exclude<PrismToken, string>;
  const role = ROLE_BY_TOKEN[token.type] ?? inherited;
  flatten(token.content, role, out);
};

// Tokenize the whole module ONCE, at module scope, so that revealing the
// code is nothing more than slicing an array. Highlighting per frame
// would re-run Prism 600 times for an identical result.
const buildLines = (source: string): CodeLine[] => {
  const spans: Span[] = [];
  flatten(Prism.tokenize(source, Prism.languages.python), "plain", spans);

  const lines: CodeLine[] = [{ spans: [], length: 0 }];
  for (const span of spans) {
    const pieces = span.text.split("\n");
    pieces.forEach((piece, index) => {
      if (index > 0) lines.push({ spans: [], length: 0 });
      if (piece.length === 0) return;
      const current = lines[lines.length - 1];
      current.spans.push({ text: piece, role: span.role });
      current.length += piece.length;
    });
  }
  return lines;
};

export const CODE_LINES: CodeLine[] = buildLines(PYTHON_SOURCE);
export const LINE_COUNT = CODE_LINES.length;

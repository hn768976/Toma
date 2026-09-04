export type SynKey =
  | "plain"
  | "keyword"
  | "string"
  | "function"
  | "comment"
  | "type"
  | "number"
  | "operator"
  | "punct"
  | "decorator"
  | "tag"
  | "attr";

export type Theme = {
  id: "dark" | "light";
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  chrome: string;
  chromeDim: string;
  code: string;
  accent: string;
  onAccent: string;
  gutter: string;
  gutterActive: string;
  activeLine: string;
  hover: string;
  field: string;
  warn: string;
  ok: string;
  badge: string;
  blobCanvas: string;
  bubbleUser: string;
  bubbleAi: string;
  codeBlock: string;
  syn: Record<SynKey, string>;
};

export const DARK: Theme = {
  id: "dark",
  bg: "#0d1117",
  panel: "#121821",
  panelAlt: "#0f151d",
  border: "#1e2733",
  chrome: "#8b949e",
  chromeDim: "#5b6673",
  code: "#c9d1d9",
  accent: "#2f6feb",
  onAccent: "#ffffff",
  gutter: "#3d4652",
  gutterActive: "#8b949e",
  activeLine: "rgba(255,255,255,0.028)",
  hover: "rgba(255,255,255,0.045)",
  field: "#0b1017",
  warn: "#d6a03a",
  ok: "#3fb950",
  badge: "#d6a03a",
  blobCanvas: "#080b11",
  bubbleUser: "#182130",
  bubbleAi: "#111823",
  codeBlock: "#0b1017",
  syn: {
    plain: "#c9d1d9",
    keyword: "#c678dd",
    string: "#e5c07b",
    function: "#61afef",
    comment: "#5c6370",
    type: "#56b6c2",
    number: "#d19a66",
    operator: "#56b6c2",
    punct: "#7f8896",
    decorator: "#e5c07b",
    tag: "#e06c75",
    attr: "#d19a66",
  },
};

export const LIGHT: Theme = {
  id: "light",
  bg: "#ffffff",
  panel: "#f6f8fa",
  panelAlt: "#f0f3f6",
  border: "#d0d7de",
  chrome: "#57606a",
  chromeDim: "#8c959f",
  code: "#24292f",
  accent: "#2f6feb",
  onAccent: "#ffffff",
  gutter: "#b3bac2",
  gutterActive: "#57606a",
  activeLine: "rgba(31,35,40,0.035)",
  hover: "rgba(31,35,40,0.05)",
  field: "#ffffff",
  warn: "#9a6700",
  ok: "#1a7f37",
  badge: "#bf8700",
  blobCanvas: "#0c1017",
  bubbleUser: "#eaeef2",
  bubbleAi: "#ffffff",
  codeBlock: "#f6f8fa",
  syn: {
    plain: "#24292f",
    keyword: "#a626a4",
    string: "#50a14f",
    function: "#4078f2",
    comment: "#a0a1a7",
    type: "#0184bc",
    number: "#986801",
    operator: "#0184bc",
    punct: "#6a737d",
    decorator: "#986801",
    tag: "#e45649",
    attr: "#986801",
  },
};

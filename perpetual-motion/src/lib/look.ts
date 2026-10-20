// Two looks share one set of class names. Anatomy's solids carry `iso-fill`,
// `iso-top`, `iso-shade[data-shade=0..3]` and `iso-line[data-tone]`; our build
// adds a material class (`m-brass`, `m-oak`, ...) around each part. A look is a
// table of colours per material, turned into CSS custom properties.

export type LookName = "workshop" | "blueprint";
export type Material = "brass" | "oak" | "iron" | "stone" | "glass" | "water" | "ink";

export interface MaterialTone {
  fill: string;
  top: string;
  shades: [string, string, string, string];
  edge: string;
}

export interface Look {
  name: LookName;
  background: string;
  vignette: [number, number, number];
  vignetteStrength: number;
  shadow: [number, number, number];
  shadowStrength: number;
  grid: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  water: string;
  waterDeep: string;
  waterLight: string;
  highlight: string;
  glassFill: string;
  glassEdge: string;
  glassShine: string;
  ironBall: [string, string, string];
  materials: Record<Exclude<Material, "ink">, MaterialTone>;
}

const workshop: Look = {
  name: "workshop",
  background: "#EFE6D2",
  vignette: [92, 66, 40],
  vignetteStrength: 0.2,
  shadow: [74, 52, 32],
  shadowStrength: 0.34,
  grid: "rgba(90,58,34,0.10)",
  ink: "#2A1D12",
  inkSoft: "rgba(42,29,18,0.62)",
  inkFaint: "rgba(42,29,18,0.30)",
  water: "#4A8AC8",
  waterDeep: "#3A73AD",
  waterLight: "#7FB0DE",
  highlight: "#FFFFFF",
  glassFill: "rgba(214,232,236,0.30)",
  glassEdge: "#3E5A60",
  glassShine: "rgba(255,255,255,0.85)",
  ironBall: ["#5C636B", "#3A3E44", "#1E2125"],
  materials: {
    brass: { fill: "#B8893A", top: "#D9AE5C", shades: ["#87601F", "#9A6E28", "#AC7D32", "#C2954A"], edge: "#3D2A0E" },
    oak: { fill: "#5A3A22", top: "#83593A", shades: ["#3A2414", "#462C19", "#52351F", "#654328"], edge: "#1E120A" },
    iron: { fill: "#3A3E44", top: "#5E656D", shades: ["#24272B", "#2D3035", "#363A40", "#454A51"], edge: "#141618" },
    stone: { fill: "#B3A68C", top: "#CFC3A8", shades: ["#8E8169", "#9B8E75", "#A89B81", "#BDB096"], edge: "#3B3226" },
    glass: { fill: "rgba(214,232,236,0.28)", top: "rgba(236,246,248,0.4)", shades: ["rgba(150,180,188,0.3)", "rgba(170,196,202,0.3)", "rgba(190,212,218,0.3)", "rgba(206,226,230,0.3)"], edge: "#3E5A60" },
    water: { fill: "#4A8AC8", top: "#6FA6DA", shades: ["#326AA3", "#3A77B2", "#4282BE", "#5592CE"], edge: "#1D3E60" },
  },
};

const blue = (fill: string, top: string, shades: [string, string, string, string]): MaterialTone => ({ fill, top, shades, edge: "#F4FBFF" });

const blueprint: Look = {
  name: "blueprint",
  background: "#0E3A6A",
  vignette: [4, 22, 44],
  vignetteStrength: 0.32,
  shadow: [6, 30, 60],
  shadowStrength: 0.4,
  grid: "rgba(175,228,250,0.13)",
  ink: "#F4FBFF",
  inkSoft: "rgba(175,228,250,0.85)",
  inkFaint: "rgba(175,228,250,0.42)",
  water: "rgba(175,228,250,0.34)",
  waterDeep: "rgba(175,228,250,0.22)",
  waterLight: "rgba(220,244,255,0.7)",
  highlight: "#F4FBFF",
  glassFill: "rgba(175,228,250,0.08)",
  glassEdge: "#AFE4FA",
  glassShine: "rgba(244,251,255,0.8)",
  ironBall: ["#2E6299", "#164A80", "#0B2F57"],
  materials: {
    brass: blue("#14497F", "#1C5893", ["#0E3B69", "#104071", "#134679", "#174F88"]),
    oak: blue("#11416F", "#174E85", ["#0B335B", "#0D3862", "#103D69", "#134577"]),
    iron: blue("#0F3E6E", "#164C84", ["#0A3159", "#0C3660", "#0F3B67", "#124274"]),
    stone: blue("#134679", "#1A558D", ["#0D3964", "#0F3E6B", "#124373", "#154B80"]),
    glass: { fill: "rgba(175,228,250,0.06)", top: "rgba(175,228,250,0.1)", shades: ["rgba(175,228,250,0.08)", "rgba(175,228,250,0.07)", "rgba(175,228,250,0.06)", "rgba(175,228,250,0.05)"], edge: "#AFE4FA" },
    water: { fill: "rgba(175,228,250,0.3)", top: "rgba(200,238,255,0.4)", shades: ["rgba(175,228,250,0.22)", "rgba(175,228,250,0.26)", "rgba(175,228,250,0.3)", "rgba(175,228,250,0.34)"], edge: "#AFE4FA" },
  },
};

export const LOOKS: Record<LookName, Look> = { workshop, blueprint };

// One line weight for the whole series: anatomy's 0.6 px on a ~600 px card,
// scaled to the 3840 px composition, so lines keep anatomy's proportion.
export const LINE = 3.6;

export function lookCss(look: Look): string {
  const rules: string[] = [];
  const vars = (tone: MaterialTone) =>
    `--f:${tone.fill};--t:${tone.top};--s0:${tone.shades[0]};--s1:${tone.shades[1]};--s2:${tone.shades[2]};--s3:${tone.shades[3]};--e:${tone.edge}`;
  rules.push(`.pm{${vars(look.materials.iron)};--ink:${look.ink};--ink-soft:${look.inkSoft};--ink-faint:${look.inkFaint};--w:${LINE}px}`);
  for (const [name, tone] of Object.entries(look.materials)) rules.push(`.pm .m-${name}{${vars(tone)}}`);
  const lineEdge = look.name === "blueprint" ? "var(--ink)" : "var(--e)";
  rules.push(
    `.pm path,.pm circle,.pm ellipse,.pm line,.pm polyline,.pm polygon{vector-effect:non-scaling-stroke}`,
    `.pm .iso-fill{fill:var(--f);stroke:none}`,
    `.pm .iso-top{fill:var(--t);stroke:none}`,
    `.pm .iso-shade{stroke:none}`,
    `.pm .iso-shade[data-shade="0"]{fill:var(--s0)}`,
    `.pm .iso-shade[data-shade="1"]{fill:var(--s1)}`,
    `.pm .iso-shade[data-shade="2"]{fill:var(--s2)}`,
    `.pm .iso-shade[data-shade="3"]{fill:var(--s3)}`,
    `.pm .iso-solid[data-seamless]>.iso-shade,.pm .iso-solid[data-seamless]>.iso-top{stroke-width:1.2px;stroke-linejoin:round}`,
    `.pm .iso-solid[data-seamless]>.iso-shade[data-shade="0"]{stroke:var(--s0)}`,
    `.pm .iso-solid[data-seamless]>.iso-shade[data-shade="1"]{stroke:var(--s1)}`,
    `.pm .iso-solid[data-seamless]>.iso-shade[data-shade="2"]{stroke:var(--s2)}`,
    `.pm .iso-solid[data-seamless]>.iso-shade[data-shade="3"]{stroke:var(--s3)}`,
    `.pm .iso-solid[data-seamless]>.iso-top{stroke:var(--t)}`,
    `.pm .iso-line{fill:none;stroke:${lineEdge};stroke-width:var(--w);stroke-linecap:round;stroke-linejoin:round}`,
    `.pm .iso-line[data-tone="mid"]{stroke:var(--ink-soft)}`,
    `.pm .iso-line[data-tone="lo"]{stroke:var(--ink-soft);stroke-width:calc(var(--w) * 0.8)}`,
    `.pm .iso-line[data-tone="faint"]{stroke:var(--ink-faint);stroke-width:calc(var(--w) * 0.7)}`,
    `.pm .iso-crease{stroke:var(--ink-faint)}`,
    `.pm .iso-dots circle{fill:${lineEdge};stroke:none;opacity:.75}`,
    `.pm .iso-dots[data-tone="lo"] circle{opacity:.45}`,
    `.pm .tb-body{fill:var(--s2);stroke:none}`,
    `.pm .tb-shine{fill:var(--t);stroke:none}`,
    `.pm .tb-shade{fill:var(--s0);stroke:none}`,
    `.pm .tb-ring{fill:none;stroke:var(--ink-soft);stroke-width:calc(var(--w) * 0.7)}`,
    // Flat parts that turn in a plane: a face copy in front, side copies behind it.
    `.pm .fp{fill:var(--t);stroke:${lineEdge};stroke-width:var(--w);stroke-linejoin:round;stroke-linecap:round}`,
    `.pm .fp.dark{fill:var(--f)}`,
    `.pm .fp-line{fill:none;stroke:${lineEdge};stroke-width:calc(var(--w) * 0.8);stroke-linecap:round}`,
    `.pm .fp-faint{fill:none;stroke:var(--ink-faint);stroke-width:calc(var(--w) * 0.7);stroke-linecap:round}`,
    `.pm .fp-dot{fill:${lineEdge};stroke:none}`,
    `.pm .side .fp{fill:var(--s1);stroke:none}`,
    `.pm .side .fp.dark{fill:var(--s0)}`,
    `.pm .side .fp-line,.pm .side .fp-faint,.pm .side .fp-dot{display:none}`,
    `.pm .back .fp{fill:var(--s0);stroke:${lineEdge}}`,
    `.pm .back .fp-line,.pm .back .fp-faint,.pm .back .fp-dot{display:none}`,
    `.pm .water{fill:${look.water};stroke:none}`,
    `.pm .water-deep{fill:${look.waterDeep};stroke:none}`,
    `.pm .water-edge{fill:none;stroke:${look.name === "blueprint" ? look.inkSoft : "#1D3E60"};stroke-width:calc(var(--w) * 0.7)}`,
    `.pm .water-hl{fill:none;stroke:${look.highlight};stroke-linecap:round}`,
    `.pm .glass{fill:${look.glassFill};stroke:${look.glassEdge};stroke-width:var(--w)}`,
    `.pm .glass-shine{fill:none;stroke:${look.glassShine};stroke-linecap:round}`,
  );
  return rules.join("\n");
}

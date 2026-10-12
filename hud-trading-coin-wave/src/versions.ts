import React from "react";
import { NumberMatrix } from "./looks/NumberMatrix";
import { RadialHud } from "./looks/RadialHud";
import { TradingTerminal } from "./looks/TradingTerminal";
import { NebulaHud } from "./looks/NebulaHud";
import { CoinBadge } from "./looks/coin/CoinBadge";
import { ParticleWave } from "./looks/wave/ParticleWave";

// One data row per version. To add a colourway, add a row here.
export type Version = { id: string; component: React.FC<never>; props: unknown };

export const VERSIONS: Version[] = [
  {
    id: "NumberMatrix-Green",
    component: NumberMatrix,
    props: { idx: "#4A8A7A", str: "#C8F0E0", val: "#7AD8B8", hi: "#2A6A5A", line: "#2E4842", flash: "#F0FFF8" },
  },
  {
    id: "NumberMatrix-Amber",
    component: NumberMatrix,
    props: { idx: "#8A6A3A", str: "#FFE0B0", val: "#F0A84A", hi: "#6A3A0A", line: "#4A3822", flash: "#FFF6E8" },
  },
  {
    id: "RadialHUD-GreyGold",
    component: RadialHud,
    props: {
      greys: ["#5A5A5A", "#6E6E6E", "#8A8A8A", "#A8A8A8"],
      text: "#E6E6E6",
      dim: "#8C8C8C",
      faint: "#3A3A3A",
      counter: "#F0C030",
      bar: "#3AC88A",
      accent: "#3FA89A",
      accentDark: "#1E4A40",
    },
  },
  {
    id: "RadialHUD-Cyan",
    component: RadialHud,
    props: {
      greys: ["#5AA8C8", "#78BCD8", "#9CD4EA", "#C8F0FF"],
      text: "#C8F0FF",
      dim: "#5A90A8",
      faint: "#1E3A48",
      counter: "#FFFFFF",
      bar: "#3AE8F0",
      accent: "#3AE8F0",
      accentDark: "#164A5A",
    },
  },
  {
    id: "TradingTerminal-Dark",
    component: TradingTerminal,
    props: {
      bg: "#0E1420",
      panel: "#0F1622",
      grid: "#1E2838",
      up: "#2AB88A",
      down: "#E83A4A",
      text: "#A8B8C8",
      bright: "#E4ECF4",
      ma1: "#D8CCA8",
      ma2: "#8A8070",
      summary: ["#4AB88A", "#E8945A", "#9A90D8", "#D8C878"],
      analysis: "#E8506A",
      chartBg: "#131A27",
      card: "#162032",
      tickerCell: "#29333C",
    },
  },
  {
    id: "NebulaHUD-Purple",
    component: NebulaHud,
    props: {
      bg: "#12062A",
      grid: "#3A2A6A",
      violet: [110, 30, 210],
      magenta: [190, 40, 200],
      deep: [42, 26, 106],
      dots: ["#F0F0FF", "#C8B0FF", "#5AE8F0", "#FF8AD8"],
      text: "#C8B0FF",
      line: "#E8E0FF",
      accent: "#5AE8F0",
    },
  },
  {
    id: "CoinBadge-EtherPurple",
    component: CoinBadge,
    props: { symbol: "xi", ring: "#FFE0F0", rays: "#E87ACB", rays2: "#F4A878", nebula: "#7A2A9A", nebula2: "#B04AD8", face: "#1A0A22", metal: "#F0E8F0" },
  },
  {
    id: "CoinBadge-BitcoinOrange",
    component: CoinBadge,
    props: { symbol: "btc", ring: "#FFF0D0", rays: "#F7A03A", rays2: "#FFD890", nebula: "#7A3A0A", nebula2: "#C8682A", face: "#1E1008", metal: "#F0E8F0" },
  },
  {
    id: "ParticleWave-BlueViolet",
    component: ParticleWave,
    props: {
      point: [0.784, 0.847, 0.941], // #C8D8F0
      glowL: [0.541, 0.353, 1.0], // #8A5AFF
      glowR: [0.227, 0.784, 1.0], // #3AC8FF
      haze: [0.04, 0.065, 0.12],
      bg: [0.045, 0.06, 0.09],
    },
  },
];

import React from "react";
import { Composition } from "remotion";
import { Stage, type LookFactory } from "./core/Stage";
import { lockHUDLook, type LockHUDProps } from "./looks/LockHUD";
import { commodityBoardLook, type CommodityBoardProps } from "./looks/CommodityBoard";
import { waveMapLook, type WaveMapProps } from "./looks/WaveMap";
import { energyBatteryLook, type EnergyBatteryProps } from "./looks/EnergyBattery";
import { tradeChartLook, type TradeChartProps } from "./looks/TradeChart";

const W = 3840;
const H = 2160;
const FPS = 30;

// One component per look; the data row (colours, text, series) is the
// composition's defaultProps, so a new version is a new <Composition/>.
const make = <P extends Record<string, unknown>>(factory: LookFactory<P>) => {
  const C: React.FC<P> = (props) => <Stage factory={factory} props={props} />;
  return C;
};

const LockHUD = make<LockHUDProps>(lockHUDLook);
export const LOCK_BLUE_ORANGE: LockHUDProps = {
  lockA: "#7AB8FF",
  lockB: "#BFE0FF",
  ring: "#5AD8FF",
  ringDim: "#2A6AE0",
  text: "#BFE0FF",
  accent: "#FF9A2A",
  hazeCentre: "#0A2A8A",
  hazeEdge: "#020A2A",
};

const WaveMap = make<WaveMapProps>(waveMapLook);

export const WAVE_TEAL: WaveMapProps = {
  land: "#2A7A8A",
  base: "#062A4A",
  baseGlow: "#0D4A70",
  lines: "#BFF8FF",
  candles: "#E6F4FA",
  streak: "#5AD8FF",
  labels: "#9FE6F0",
};
export const WAVE_GOLD: WaveMapProps = {
  land: "#8A6A2A",
  base: "#1A1004",
  baseGlow: "#3A2608",
  lines: "#FFF0C8",
  candles: "#FFF6E6",
  streak: "#FFB84A",
  labels: "#F0D49A",
};

const TradeChart = make<TradeChartProps>(tradeChartLook);

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026];
// Illustrative, invented values (16 points, 2021 -> 2026 every four months).
export const TRADE_TARIFFS: TradeChartProps = {
  title: "Tariffs",
  subtitle: "The Effects of Tariffs on Trade",
  years: YEARS,
  yMax: 40,
  yStep: 10,
  note: "Illustrative data",
  series: [
    {
      label: "IMPORT",
      color: "#3AD8FF",
      values: [20.5, 21.8, 19.1, 17.2, 15.6, 12.8, 14.2, 13.9, 15.3, 15.6, 15.9, 15.6, 15.8, 14.6, 9.1, 0.3],
    },
    {
      label: "EXPORT",
      color: "#FF3A7A",
      values: [3.8, 4.6, 5.4, 6.0, 5.6, 6.1, 7.3, 8.4, 10.1, 11.9, 14.2, 16.9, 18.4, 28.1, 31.6, 36.2],
    },
  ],
};
export const TRADE_INFLATION: TradeChartProps = {
  title: "Inflation",
  subtitle: "Prices and Wages Over Time",
  years: YEARS,
  yMax: 50,
  yStep: 10,
  note: "Illustrative data",
  series: [
    {
      label: "PRICES",
      color: "#FF3A7A",
      values: [1.0, 2.4, 4.3, 6.4, 8.3, 9.8, 11.9, 13.6, 15.9, 18.2, 20.6, 23.3, 26.8, 30.5, 34.9, 39.4],
    },
    {
      label: "WAGES",
      color: "#3AD8FF",
      values: [0.8, 1.6, 2.7, 3.8, 4.9, 6.1, 7.5, 8.8, 10.3, 11.6, 12.8, 13.7, 14.3, 14.6, 14.8, 14.9],
    },
  ],
};

const CommodityBoard = make<CommodityBoardProps>(commodityBoardLook);
export const COMMODITY_BLUE: CommodityBoardProps = {
  names: ["GOLD", "OIL", "COAL", "SUGAR", "SOYBEAN", "WHEAT", "COFFEE", "PORK", "CHICKEN", "FREIGHT"],
  bg: "#041440",
  panel: "#0A2A6A",
  text: "#BFE0FF",
  highlight: "#5AB8FF",
  up: "#D8FFE6",
  down: "#FFD6DA",
};

const EnergyBattery = make<EnergyBatteryProps>(energyBatteryLook);
export const BATTERY_BLUE: EnergyBatteryProps = { battery: "#3A8AFF", bolt: "#BFE8FF", floor: "#2A5ABF", accent: "#FF4A5A", background: "#030C26" };
export const BATTERY_GREEN: EnergyBatteryProps = { battery: "#2AD86A", bolt: "#D8FFC8", floor: "#1A8A4A", accent: "#FFD24A", background: "#03140C" };

// Verify step 2: pass --props='{"loopCheck":true}' to a loop composition to
// make it 601 frames long, so frames 0 and 600 can be compared pixel for pixel.
const loopMeta = ({ props }: { props: Record<string, unknown> }) => ({ durationInFrames: props.loopCheck ? 601 : 600 });

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="LockHUD-BlueOrange" component={LockHUD} defaultProps={LOCK_BLUE_ORANGE} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="WaveMap-Teal" component={WaveMap} defaultProps={WAVE_TEAL} durationInFrames={600} fps={FPS} width={W} height={H} calculateMetadata={loopMeta} />
    <Composition id="WaveMap-Gold" component={WaveMap} defaultProps={WAVE_GOLD} durationInFrames={600} fps={FPS} width={W} height={H} calculateMetadata={loopMeta} />
    <Composition id="CommodityBoard-Blue" component={CommodityBoard} defaultProps={COMMODITY_BLUE} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="EnergyBattery-Blue" component={EnergyBattery} defaultProps={BATTERY_BLUE} durationInFrames={600} fps={FPS} width={W} height={H} calculateMetadata={loopMeta} />
    <Composition id="EnergyBattery-Green" component={EnergyBattery} defaultProps={BATTERY_GREEN} durationInFrames={600} fps={FPS} width={W} height={H} calculateMetadata={loopMeta} />
    <Composition id="TradeChart-Tariffs" component={TradeChart} defaultProps={TRADE_TARIFFS} durationInFrames={450} fps={FPS} width={W} height={H} />
    <Composition id="TradeChart-Inflation" component={TradeChart} defaultProps={TRADE_INFLATION} durationInFrames={450} fps={FPS} width={W} height={H} />
  </>
);

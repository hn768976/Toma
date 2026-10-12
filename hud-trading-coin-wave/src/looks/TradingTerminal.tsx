import React from "react";
import { CanvasLook } from "../lib/CanvasLook";
import { drawTradingTerminal, TradingTerminalProps } from "./tradingTerminal";

const GRAIN = { amount: 0.015, cleanBlack: false };

export const TradingTerminal: React.FC<TradingTerminalProps> = (props) => (
  <CanvasLook draw={drawTradingTerminal} props={props} grain={GRAIN} />
);

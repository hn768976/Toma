import React from "react";
import { DepartureBoard } from "./board/DepartureBoard";
import { LCD_THEME } from "./board/theme";

export const DeparturesLCD: React.FC = () => (
  <DepartureBoard theme={LCD_THEME} columns={1} />
);

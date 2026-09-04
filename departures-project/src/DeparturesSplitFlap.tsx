import React from "react";
import { DepartureBoard } from "./board/DepartureBoard";
import { FLAP_THEME } from "./board/theme";

export const DeparturesSplitFlap: React.FC = () => (
  <DepartureBoard theme={FLAP_THEME} columns={2} />
);

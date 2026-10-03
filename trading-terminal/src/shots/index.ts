import { ShotKind } from "../engine/versions";
import { macro } from "./macro";
import { orderbook } from "./orderbook";
import { overview } from "./overview";
import { ShotDef } from "./types";

export const SHOTS: Record<ShotKind, ShotDef> = { overview, orderbook, macro };

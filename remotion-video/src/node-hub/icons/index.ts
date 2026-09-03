/**
 * Icon registry.
 *
 * This is the one place icon names are bound to geometry; which names a
 * composition actually uses, and in what order, is decided entirely by the
 * `icons` array in VARIANTS. <IconNode> only ever sees an `IconName`, so
 * swapping the tech set for the health set is a data change, not a code path.
 */
import { HEALTH_ICONS } from "./health";
import { TECH_ICONS } from "./tech";
import type { IconDraw } from "./prims";

export const ICONS = { ...TECH_ICONS, ...HEALTH_ICONS };

export type IconName = keyof typeof ICONS;

export const getIcon = (name: IconName): IconDraw => ICONS[name];

export type { IconDraw } from "./prims";
export { pen } from "./prims";

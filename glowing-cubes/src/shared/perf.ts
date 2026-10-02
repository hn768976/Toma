import { getInputProps } from "remotion";
const p = String((getInputProps() as { perf?: string }).perf ?? "");
export const PERF = (flag: string) => p.split(",").includes(flag);

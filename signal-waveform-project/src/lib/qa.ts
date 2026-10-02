import { getInputProps } from "remotion";

// QA switches, read once at module level from --props. Used only for
// verification (loop isolation, profiling); buyers never need them.
//   --props='{"qaOff":["grain","glow"]}'
const props = getInputProps() as { qaOff?: string[] };
const off = new Set(props.qaOff ?? []);
export const qaOff = (group: string) => off.has(group);

import { FlagDef } from "./shared";
import { UnionJack } from "./UnionJack";

// Union Flag, 1:2 (the government/land ratio), colours per the UK
// Government flag guidance: blue #012169, red #C8102E.
export const UKFlag: FlagDef = {
  width: 60,
  height: 30,
  draw: (uid) => <UnionJack uid={uid} />,
};

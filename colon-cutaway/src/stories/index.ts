import type { Story } from "./common";
import { constipationStory } from "./constipation";
import { floraStory } from "./flora";
import { inflammationStory } from "./inflammation";
import { modelCheckStory } from "./modelCheck";

export const STORIES: Story[] = [constipationStory, floraStory, inflammationStory, modelCheckStory];
export const storyById = (id: string): Story => {
  const s = STORIES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown story ${id}`);
  return s;
};

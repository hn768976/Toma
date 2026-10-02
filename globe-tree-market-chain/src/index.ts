import { registerRoot } from "remotion";
import { loadFonts } from "./lib/fonts";
import { RemotionRoot } from "./Root";

// Shipped OFL fonts are loaded for every composition behind delayRender.
loadFonts();

registerRoot(RemotionRoot);

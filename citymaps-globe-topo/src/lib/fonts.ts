import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// OFL fonts shipped in public/fonts (licences alongside).
export const MONO = "'JetBrains Mono', monospace";
export const SANS = "'Inter', sans-serif";

const FILES: [string, string, string][] = [
  ["JetBrains Mono", "JetBrainsMono-400.woff2", "400"],
  ["JetBrains Mono", "JetBrainsMono-500.woff2", "500"],
  ["JetBrains Mono", "JetBrainsMono-700.woff2", "700"],
  ["Inter", "Inter-400.woff2", "400"],
  ["Inter", "Inter-500.woff2", "500"],
  ["Inter", "Inter-600.woff2", "600"],
];

let started = false;
export const loadFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("Loading fonts");
  Promise.all(
    FILES.map(([family, file, weight]) =>
      new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, { weight })
        .load()
        .then((f) => (document.fonts as unknown as Set<FontFace>).add(f)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((e) => cancelRender(e));
};

import { AbsoluteFill, Img, staticFile } from "remotion";
import { BATCH_PAIRS, COMPOSITION_NAMES, COMPOSITIONS, stillFileName } from "./compositions";

/**
 * A proof sheet of the sixteen stills, two palettes of each composition side
 * by side. It reads the same pairing table the batch renderer does, so the
 * sheet cannot drift out of step with what was rendered.
 *
 * scripts/contact-sheet.ts stages the PNGs into public/ before rendering this
 * and clears them afterwards, which is why the folder is not in the repo.
 */
export const CONTACT_SHEET_DIR = "contact-sheet";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const ContactSheet: React.FC = () => {
  // Two compositions per row, each contributing its pair of palettes.
  const rows = [0, 2, 4, 6].map((i) => COMPOSITION_NAMES.slice(i, i + 2));

  return (
    <AbsoluteFill style={{ backgroundColor: "#151519", padding: 40, fontFamily: MONO }}>
      <div style={{ color: "#EDEDF2", fontSize: 34, letterSpacing: 1, paddingBottom: 28 }}>
        grain gradient stills · 8 compositions × 2 palettes · 3840×2160
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {rows.map((pair) => (
          <div key={pair.join()} style={{ display: "flex", gap: 24 }}>
            {pair.flatMap((composition) =>
              BATCH_PAIRS[composition].map((palette) => (
                <div key={palette} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <Img
                    src={staticFile(`${CONTACT_SHEET_DIR}/${stillFileName(composition, palette)}`)}
                    style={{ width: "100%", aspectRatio: "16 / 9", display: "block" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10 }}>
                    <span style={{ color: "#EDEDF2", fontSize: 22 }}>{composition}</span>
                    <span style={{ color: "#8C8C99", fontSize: 22 }}>{palette}</span>
                  </div>
                  <div style={{ color: "#6E6E7A", fontSize: 17, paddingTop: 4 }}>
                    {COMPOSITIONS[composition].description}
                  </div>
                </div>
              )),
            )}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const SHEET_WIDTH = 3840;
export const SHEET_HEIGHT = 2560;

import { AbsoluteFill } from "remotion";
import { z } from "zod";
import "./load-font";
import { AiChip } from "./AiChip";
import { FlowCanvas } from "./FlowCanvas";
import { PALETTES } from "./palettes";

export const aiDataFlowSchema = z.object({
  palette: z.enum(["original", "ember"]),
  label: z.string(),
});

export type AiDataFlowProps = z.infer<typeof aiDataFlowSchema>;

export const AiDataFlow: React.FC<AiDataFlowProps> = ({ palette, label }) => {
  const colors = PALETTES[palette];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse 75% 85% at 50% 50%, ${colors.bgInner} 0%, ${colors.bgOuter} 100%)`,
      }}
    >
      <FlowCanvas palette={colors} />
      <AiChip palette={colors} label={label} />
    </AbsoluteFill>
  );
};

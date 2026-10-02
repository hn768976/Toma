// Look 2 defaults. The title text and every colour here are also exposed as
// composition props, so they can be edited in Remotion Studio's props panel
// or passed on the command line with --props.
export type BreakingNewsProps = {
  titleTop: string;
  titleBottom: string;
  titleColor: string; // face of the title lettering
  accentColor: string; // red rule, chevrons, top digit bar tint
  streakColor: string; // light streak core (blows out to white at its centre)
  gridColor: string; // fine grid + horizontal light lines
  waveColorA: string; // dense waveform, first trace
  waveColorB: string; // dense waveform, second trace
  gaugeColor: string; // gauges (main)
  gaugeAccent: string; // gauges (secondary ring)
  levelColor: string; // stacked level bars
  digitColor: string; // rolling top digits
};

export const breakingNewsDefaults: BreakingNewsProps = {
  titleTop: "BREAKING",
  titleBottom: "NEWS",
  titleColor: "#ffffff",
  accentColor: "#e0262b",
  streakColor: "#ff5a1a",
  gridColor: "#2a55ff",
  waveColorA: "#2cff8a",
  waveColorB: "#1fc8ff",
  gaugeColor: "#38e05a",
  gaugeAccent: "#ff8a1a",
  levelColor: "#2a7bff",
  digitColor: "#ffd27a",
};

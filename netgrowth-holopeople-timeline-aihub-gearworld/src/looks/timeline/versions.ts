// Timeline labels: edit these six rows (number, title, sub-line).
export type TimelineStep = { num: string; title: string; sub: string };

export type TimelineVersion = {
  id: string;
  ink: string; // lines and text
  steps: TimelineStep[];
};

export const TIMELINE_VERSIONS: TimelineVersion[] = [
  {
    id: "TimelineHUD-White",
    ink: "#E8E8E8",
    steps: [
      { num: "01", title: "Step Title", sub: "Lorem ipsum dolor sit" },
      { num: "02", title: "Step Title", sub: "Lorem ipsum dolor sit" },
      { num: "03", title: "Step Title", sub: "Lorem ipsum dolor sit" },
      { num: "04", title: "Step Title", sub: "Lorem ipsum dolor sit" },
      { num: "05", title: "Step Title", sub: "Lorem ipsum dolor sit" },
      { num: "06", title: "Step Title", sub: "Lorem ipsum dolor sit" },
    ],
  },
];

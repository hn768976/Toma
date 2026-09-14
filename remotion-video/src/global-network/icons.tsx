// Line-art communication glyphs for the icon ring.
//
// Every glyph is drawn inside a shared 0..24 box and returns bare path
// geometry — no stroke colour or width. The caller strokes it twice (a
// thick, transparent pass for the neon bleed and a thin, opaque pass on
// top), so the glyph itself must stay paint-free.

export const ICON_NAMES = [
  "chat",
  "chatPair",
  "envelope",
  "paperPlane",
  "mobile",
  "tablet",
  "monitor",
  "monitorPair",
  "people",
  "pin",
  "videoCall",
  "wifi",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const glyphs: Record<IconName, React.ReactNode> = {
  chat: (
    <path d="M3 5.5h18v11H9.5L4.5 21v-4.5H3z" />
  ),
  chatPair: (
    <>
      <path d="M2 3.5h13v9H7l-4 3.5v-3.5H2z" />
      <path d="M9.5 9.5H22v9h-3v3.5l-4-3.5H9.5z" />
    </>
  ),
  envelope: (
    <>
      <rect x="2" y="5" width="20" height="14" />
      <path d="M2 5l10 8 10-8" />
    </>
  ),
  paperPlane: (
    <>
      <path d="M22 2L2 10.5l7.5 3.2L22 2z" />
      <path d="M22 2l-6 20-6.5-8.3L22 2z" />
    </>
  ),
  mobile: (
    <>
      <rect x="7" y="1.5" width="10" height="21" rx="1.8" />
      <path d="M10.5 19.5h3" />
    </>
  ),
  tablet: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="1.6" />
      <path d="M10 19h4" />
    </>
  ),
  monitor: (
    <>
      <rect x="2" y="3.5" width="20" height="13.5" rx="1.2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  monitorPair: (
    <>
      <rect x="1.5" y="3" width="14" height="10" rx="1.2" />
      <path d="M5.5 16.5h6M8.5 13v3.5" />
      <rect x="12" y="11" width="10.5" height="8" rx="1.2" />
      <path d="M15 22h4.5M17.2 19v3" />
    </>
  ),
  people: (
    <>
      <circle cx="8.5" cy="7" r="3.6" />
      <path d="M1.8 21c0-3.9 3-6.6 6.7-6.6s6.7 2.7 6.7 6.6" />
      <circle cx="17" cy="8" r="2.9" />
      <path d="M14.6 15.2c.8-.4 1.6-.6 2.4-.6 3 0 5.2 2.2 5.2 5.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 22.5s7.2-8 7.2-13a7.2 7.2 0 10-14.4 0c0 5 7.2 13 7.2 13z" />
      <circle cx="12" cy="9.2" r="2.7" />
    </>
  ),
  videoCall: (
    <>
      <rect x="1.5" y="5" width="14" height="12" rx="1.6" />
      <path d="M15.5 10l7-3.8v9.6l-7-3.8z" />
    </>
  ),
  wifi: (
    <>
      <path d="M3 8.5a14 14 0 0118 0" />
      <path d="M6.5 12.6a9 9 0 0111 0" />
      <path d="M10 16.6a4 4 0 014 0" />
      <circle cx="12" cy="20" r="1.3" />
    </>
  ),
};

export const IconGlyph: React.FC<{ name: IconName }> = ({ name }) => (
  <>{glyphs[name]}</>
);

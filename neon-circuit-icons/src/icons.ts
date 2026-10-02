// One data row per icon. Adding an icon = one row here + one SVG in public/icons/.
//   id        composition id (letters/numbers/hyphens) — output name NeonIcon_<id>.mp4
//   svgPath   SVG file under public/ (100×100 viewBox, see public/icons/README.md)
//   label     optional text set in front of the icon (Montserrat Bold, auto-wraps)
//   iconScale 1 = the icon's 100-unit viewBox maps to 1 world unit (≈18% frame width)

export type IconRow = {
  id: string;
  svgPath: string;
  label?: string;
  iconScale: number;
};

export const ICONS: IconRow[] = [
  { id: 'AIChat', svgPath: 'icons/AIChat.svg', iconScale: 1.0 },
  { id: 'Chatbot', svgPath: 'icons/Chatbot.svg', iconScale: 1.0 },
  { id: 'AICloud', svgPath: 'icons/AICloud.svg', iconScale: 1.05 },
  { id: 'CloudUpload', svgPath: 'icons/CloudUpload.svg', iconScale: 1.05 },
  { id: 'AINetwork', svgPath: 'icons/AINetwork.svg', iconScale: 1.0 },
  { id: 'ActiveProtection', svgPath: 'icons/ActiveProtection.svg', label: 'ACTIVE PROTECTION', iconScale: 0.92 },
  { id: 'Warning', svgPath: 'icons/Warning.svg', label: 'WARNING', iconScale: 0.95 },
  { id: 'SystemAlert', svgPath: 'icons/SystemAlert.svg', label: 'ALERT', iconScale: 0.92 },
  { id: 'AIChip', svgPath: 'icons/AIChip.svg', iconScale: 1.0 },
  { id: 'DataLock', svgPath: 'icons/DataLock.svg', label: 'SECURED', iconScale: 0.92 },
];

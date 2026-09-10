// Every measurement is a fraction of the frame, so the identical picture
// comes out at 3840x2160 and at any `--scale`.
export type Layout = ReturnType<typeof computeLayout>;

export const computeLayout = (width: number, height: number) => {
  // The sidebar is wider than the slice of it we see — it runs off the
  // left edge, so it suggests an IDE without being one.
  const sidebarVisible = Math.round(width * 0.0285);
  const sidebarFull = Math.round(sidebarVisible * 1.28);

  const gutterWidth = Math.round(width * 0.0355);
  const codeLeft = sidebarVisible + gutterWidth + Math.round(width * 0.017);

  // ~20px at 1080p. Legibility is the product here: if this ever has to
  // give, drop visible lines before dropping the type size.
  const fontSize = Math.round(height * 0.0182);
  const lineHeight = Math.round(fontSize * 1.5);

  const codeTop = Math.round(height * 0.118);
  const codeBottom = Math.round(height * 0.958);
  const visibleLines = Math.floor((codeBottom - codeTop) / lineHeight);

  const promptTop = Math.round(height * 0.055);
  const promptFontSize = Math.round(height * 0.0205);

  // Placed so the whole sphere clears the right edge rather than
  // bleeding off it. The ~3 degree tilt scales right-hand content
  // outward, so the sphere reaches roughly 3% further right than this
  // centre alone suggests — hence the margin baked in here.
  const orbRadius = Math.round(height * 0.245);
  const orbCenterX = Math.round(width * 0.821);
  const orbCenterY = Math.round(height * 0.575);

  return {
    width,
    height,
    sidebarVisible,
    sidebarFull,
    gutterWidth,
    codeLeft,
    fontSize,
    lineHeight,
    codeTop,
    codeBottom,
    visibleLines,
    promptTop,
    promptFontSize,
    orbRadius,
    orbCenterX,
    orbCenterY,
  };
};

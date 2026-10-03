// Dev check (not part of the render): for every shot, verify the screen
// covers the frame on all frames and report magnification / depth margins.
// Run: npx tsx src/check-camera.ts
import { DURATION } from "./engine/data";
import { projection, VIEW_H, VIEW_W } from "./render/camera";
import { SHOTS } from "./shots";

for (const [name, shot] of Object.entries(SHOTS)) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let worstMargin = Infinity;
  let magFocusMax = 0;
  let fail = -1;
  for (let f = 0; f < DURATION; f += 5) {
    const pr = projection(shot.camera(f), shot.W, shot.H);
    for (const [X, Y] of [[0, 0], [VIEW_W, 0], [VIEW_W, VIEW_H], [0, VIEW_H], [VIEW_W / 2, 0], [VIEW_W / 2, VIEW_H], [0, VIEW_H / 2], [VIEW_W, VIEW_H / 2]]) {
      const q = pr.unproject(X, Y);
      if (!q || q[0] < 0 || q[1] < 0 || q[0] > shot.W || q[1] > shot.H) {
        if (fail < 0) fail = f;
        continue;
      }
      minX = Math.min(minX, q[0]); minY = Math.min(minY, q[1]);
      maxX = Math.max(maxX, q[0]); maxY = Math.max(maxY, q[1]);
      worstMargin = Math.min(worstMargin, pr.P - pr.depth(q[0], q[1]));
    }
    const [fx, fy] = shot.focus(f);
    magFocusMax = Math.max(magFocusMax, pr.mag(fx, fy));
  }
  console.log(
    `${name}: visible x ${minX.toFixed(0)}..${maxX.toFixed(0)} / ${shot.W}, y ${minY.toFixed(0)}..${maxY.toFixed(0)} / ${shot.H}; ` +
      `min (P - z) ${worstMargin.toFixed(0)}; max mag at focus ${magFocusMax.toFixed(2)}; ` +
      (fail >= 0 ? `UNCOVERED from frame ${fail}` : "covers frame") +
      (minX < shot.crop[0] || minY < shot.crop[1] || maxX > shot.crop[2] || maxY > shot.crop[3]
        ? "  CROP TOO SMALL"
        : `  crop ok (${shot.crop.join(",")})`) +
      `  4K texture ${((shot.crop[2] - shot.crop[0]) * Math.min(shot.oversample, 8192 / (shot.crop[2] - shot.crop[0]))).toFixed(0)} px wide, ts ${Math.min(shot.oversample, 8192 / (shot.crop[2] - shot.crop[0]), 8192 / (shot.crop[3] - shot.crop[1])).toFixed(2)}`,
  );
}

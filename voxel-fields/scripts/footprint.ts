// Reports the drawn-cell count and checks the bounding grid covers the footprint.
// Run: npx tsx scripts/footprint.ts
import { COLUMN_COUNT, GRID_X, GRID_Z, columnX, columnZ } from "../src/lib/fields";
import { inDrawArea } from "../src/lib/frameArea";

let drawn = 0;
let edge = 0;
for (let j = 0; j < GRID_Z; j++)
  for (let i = 0; i < GRID_X; i++) {
    if (!inDrawArea(columnX(i), columnZ(j))) continue;
    drawn++;
    if (i === 0 || j === 0 || i === GRID_X - 1 || j === GRID_Z - 1) edge++;
  }
console.log(`bounding grid ${GRID_X}x${GRID_Z} = ${COLUMN_COUNT}, drawn columns ${drawn}, drawn cells on the grid border ${edge}`);

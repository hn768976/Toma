
### How the look was developed

Three still moments per reference were matched before any animation was judged, one layer at a
time (exposure and tone mapping, light, atmosphere, glow, texture, lens), re-measuring after each.
Each project keeps all of this in `src/look.ts`. A fresh reviewer, shown only the three
side-by-side pairs and the fixed instruction, then listed the remaining differences; three rounds
were run per reference (section 5).

Two things the measurements settled where reviewers disagreed with each other:

- **Black level.** Successive reviewers called the conveyor reference both "lifted, milky" and
  "deep, near-black". Its measured p1 is 7.6–9.1 and p5 is 13–15, and the videos were tuned to
  those numbers.
- **Haze inside the Mars dome.** One round asked for more glass veil, the previous one for less.
  The reference's p1 (18) and contrast figures were used to place it.

/**
 * Authoring aid for the "hands" silhouette. One hand is drawn by hand in the
 * 1920x1080 design space; this mirrors it about x = 960 and prints the exact
 * literals to paste into src/variants.ts, so VARIANTS stays the only place a
 * path string lives.
 *
 *   node tools/mirror-hand.mjs
 */
const AXIS = 1920;

const mirror = (d) => {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g);
  const out = [];
  let i = 0;
  let pairsLeft = 0;
  let onX = true;
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[MLCZ]/.test(t)) {
      out.push(t);
      pairsLeft = t === 'C' ? 3 : t === 'Z' ? 0 : 1;
      onX = true;
      i++;
      continue;
    }
    const v = parseFloat(t);
    out.push(onX ? String(AXIS - v) : t);
    if (!onX) pairsLeft--;
    onX = !onX;
    i++;
    if (pairsLeft === 0 && i < tokens.length && !/[MLCZ]/.test(tokens[i])) {
      // implicit repetition of the previous command
      pairsLeft = out.filter((o) => /[MLCZ]/.test(o)).pop() === 'C' ? 3 : 1;
    }
  }
  return out.join(' ');
};

const PALM =
  'M 452 880 C 430 806 448 726 506 682 C 566 636 656 640 712 692 ' +
  'C 758 736 770 812 744 878 C 714 950 606 982 528 952 ' +
  'C 486 936 464 918 452 880 Z';

// Fingers and thumb are capsules: narrow enough that the gaps between them
// survive in the mask, which is what stops the hand reading as a mitten.
const STROKES = [
  {d: 'M 452 1150 C 470 1058 494 992 530 946', w: 158}, // wrist
  {d: 'M 636 690 C 706 640 798 600 866 578', w: 46}, // index
  {d: 'M 676 726 C 748 686 830 656 890 640', w: 48}, // middle
  {d: 'M 708 776 C 772 748 830 726 876 712', w: 44}, // ring
  {d: 'M 726 830 C 774 816 812 800 846 786', w: 38}, // pinky
  {d: 'M 632 910 C 690 936 754 944 818 940', w: 62}, // thumb
];

const CREASES = [
  // palm lines
  {d: 'M 502 690 C 472 760 474 844 512 918', w: 11},
  {d: 'M 452 838 C 534 802 628 796 710 812', w: 11},
  {d: 'M 474 776 C 552 734 646 724 726 742', w: 11},
  // knuckle ridge across the finger roots
  {d: 'M 622 676 C 668 712 700 762 720 830', w: 12},
  // webs between the fingers
  {d: 'M 658 706 C 674 694 686 686 700 678', w: 9},
  {d: 'M 694 750 C 708 738 722 730 736 722', w: 9},
  {d: 'M 720 802 C 734 792 746 784 758 776', w: 9},
  // mid-finger joints
  {d: 'M 760 626 C 768 640 772 650 776 662', w: 8},
  {d: 'M 792 672 C 800 686 804 696 808 708', w: 8},
  {d: 'M 800 738 C 808 750 812 758 816 768', w: 8},
  {d: 'M 792 806 C 798 816 802 822 806 830', w: 8},
  // thumb base
  {d: 'M 620 880 C 600 912 598 940 606 968', w: 10},
];

const q = (s) => `'${s}'`;
console.log('--- fill ---');
console.log(`        ${q(PALM)},`);
console.log(`        ${q(mirror(PALM))},`);
console.log('--- strokes ---');
for (const s of [...STROKES, ...STROKES.map((s) => ({...s, d: mirror(s.d)}))]) {
  console.log(`        {d: ${q(s.d)}, w: ${s.w}},`);
}
console.log('--- creases ---');
for (const c of [...CREASES, ...CREASES.map((c) => ({...c, d: mirror(c.d)}))]) {
  console.log(`      {d: ${q(c.d)}, w: ${c.w}},`);
}

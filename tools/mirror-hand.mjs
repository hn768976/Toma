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
  'M 462 862 C 442 792 462 718 518 676 C 578 632 670 636 726 686 ' +
  'C 776 730 790 806 762 872 C 730 946 620 976 540 946 ' +
  'C 496 930 474 902 462 862 Z';

const STROKES = [
  {d: 'M 470 1150 C 486 1060 508 990 540 940', w: 148}, // wrist
  {d: 'M 660 726 C 730 670 800 622 856 600', w: 58}, // index
  {d: 'M 700 762 C 768 720 830 686 868 664', w: 60}, // middle
  {d: 'M 726 806 C 786 774 830 750 860 726', w: 54}, // ring
  {d: 'M 740 856 C 782 838 810 814 836 788', w: 46}, // pinky
  {d: 'M 652 900 C 700 922 750 926 800 918', w: 70}, // thumb
];

const CREASES = [
  {d: 'M 516 686 C 488 756 490 836 526 908', w: 11},
  {d: 'M 470 828 C 548 794 638 788 716 804', w: 11},
  {d: 'M 490 770 C 566 730 656 720 734 738', w: 11},
  {d: 'M 646 712 C 690 746 718 792 734 856', w: 12},
  {d: 'M 682 736 C 698 722 710 712 724 704', w: 9},
  {d: 'M 710 780 C 724 764 738 754 752 746', w: 9},
  {d: 'M 728 828 C 742 812 754 802 768 794', w: 9},
  {d: 'M 748 660 C 758 672 764 680 770 690', w: 9},
  {d: 'M 786 706 C 796 718 802 726 808 736', w: 9},
  {d: 'M 800 758 C 810 770 816 778 822 788', w: 9},
  {d: 'M 790 816 C 798 826 804 832 810 840', w: 9},
  {d: 'M 640 878 C 620 906 616 934 624 960', w: 10},
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

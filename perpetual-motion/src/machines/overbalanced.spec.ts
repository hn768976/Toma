// Overbalanced hammer wheel (Villard de Honnecourt, c. 1230; Bhāskara II, c. 1150).
// World units are centimetres; z is up. The axle runs along world x and the
// wheel turns in the y–z plane, seen on its +x face.
export const WHEEL = {
  centre: [0, 0, 128] as [number, number, number],
  rimOuter: 80,
  rimInner: 70,
  hub: 13,
  spokes: 12,
  thickness: 10,
  hammers: 12,
  /** hinge radius on the rim face */
  hinge: 75,
  /** arm length to the head's centre, cm */
  arm: 27,
  /** relative arm angle on the peg (trailing) and on the stop (leading), degrees */
  folded: -75,
  out: 10,
  /** the hammer plane sits just in front of the wheel's face */
  hammerPlane: 8.5,
  hammerThickness: 4,
  trestleX: 34,
};

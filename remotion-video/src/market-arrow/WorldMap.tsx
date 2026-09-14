import React from "react";

// Coarse continent outlines in [longitude, latitude] pairs. Deliberately
// low-vertex: this is a backdrop that lives behind heavy blur and ~15%
// opacity, so silhouette is all that survives and precision would be
// wasted bytes.
const CONTINENTS: number[][][] = [
  // North America (incl. Mexico)
  [
    [-168, 66],
    [-160, 71],
    [-140, 70],
    [-125, 70],
    [-110, 68],
    [-95, 68],
    [-85, 70],
    [-75, 73],
    [-62, 66],
    [-55, 52],
    [-65, 45],
    [-70, 42],
    [-75, 35],
    [-81, 25],
    [-90, 29],
    [-95, 29],
    [-97, 26],
    [-105, 20],
    [-115, 30],
    [-125, 40],
    [-135, 57],
    [-150, 59],
    [-165, 55],
  ],
  // Central + South America
  [
    [-92, 15],
    [-83, 9],
    [-77, 8],
    [-72, 12],
    [-62, 11],
    [-52, 5],
    [-50, 0],
    [-44, -3],
    [-35, -6],
    [-38, -13],
    [-48, -25],
    [-58, -35],
    [-62, -41],
    [-65, -48],
    [-70, -55],
    [-75, -50],
    [-73, -42],
    [-71, -30],
    [-70, -18],
    [-77, -6],
    [-81, 0],
    [-79, 7],
    [-85, 11],
  ],
  // Africa
  [
    [-17, 15],
    [-16, 22],
    [-10, 30],
    [0, 36],
    [10, 37],
    [20, 32],
    [32, 31],
    [34, 28],
    [37, 22],
    [43, 12],
    [51, 12],
    [44, 0],
    [40, -10],
    [35, -18],
    [33, -26],
    [27, -34],
    [20, -35],
    [15, -28],
    [12, -17],
    [9, -1],
    [5, 5],
    [-5, 5],
    [-13, 9],
  ],
  // Eurasia
  [
    [-10, 36],
    [-9, 43],
    [-2, 48],
    [2, 51],
    [5, 53],
    [8, 58],
    [12, 55],
    [16, 55],
    [21, 60],
    [25, 65],
    [30, 70],
    [40, 68],
    [55, 70],
    [70, 72],
    [85, 74],
    [100, 76],
    [115, 74],
    [130, 72],
    [145, 70],
    [160, 68],
    [178, 66],
    [178, 62],
    [165, 60],
    [155, 58],
    [140, 52],
    [135, 45],
    [128, 40],
    [122, 30],
    [110, 20],
    [105, 10],
    [100, 5],
    [95, 15],
    [90, 22],
    [80, 12],
    [75, 8],
    [72, 20],
    [65, 25],
    [60, 25],
    [55, 20],
    [48, 28],
    [40, 38],
    [35, 36],
    [28, 40],
    [20, 42],
    [14, 45],
    [10, 44],
    [0, 40],
  ],
  // Greenland
  [
    [-45, 60],
    [-55, 66],
    [-58, 72],
    [-45, 80],
    [-30, 83],
    [-20, 78],
    [-22, 70],
    [-38, 62],
  ],
  // Australia
  [
    [114, -22],
    [118, -20],
    [125, -14],
    [132, -11],
    [137, -12],
    [142, -11],
    [145, -15],
    [150, -22],
    [153, -28],
    [150, -37],
    [145, -38],
    [140, -38],
    [135, -35],
    [129, -32],
    [122, -34],
    [115, -34],
  ],
  // British Isles
  [
    [-5, 50],
    [-6, 54],
    [-3, 58],
    [0, 54],
    [1, 51],
  ],
  // Japan
  [
    [130, 32],
    [136, 36],
    [141, 42],
    [145, 44],
    [142, 39],
    [138, 35],
    [133, 33],
  ],
  // Madagascar
  [
    [44, -13],
    [50, -16],
    [48, -25],
    [44, -22],
  ],
  // New Zealand
  [
    [172, -34],
    [178, -38],
    [174, -42],
    [168, -47],
    [166, -45],
  ],
];

// Equirectangular projection onto a 3600x1800 viewBox (10 px per degree).
const MAP_W = 3600;
const MAP_H = 1800;

const project = (lon: number, lat: number) => [
  ((lon + 180) / 360) * MAP_W,
  ((90 - lat) / 180) * MAP_H,
];

const PATH_DATA = CONTINENTS.map(
  (ring) =>
    ring
      .map(([lon, lat], i) => {
        const [x, y] = project(lon, lat);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z",
).join(" ");

// Soft continental silhouette used as the rally backdrop.
export const WorldMap: React.FC<{
  width: number;
  height: number;
  left: number;
  top: number;
  color: string;
  opacity: number;
  blurPx: number;
}> = ({ width, height, left, top, color, opacity, blurPx }) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${MAP_W} ${MAP_H}`}
    preserveAspectRatio="none"
    style={{
      position: "absolute",
      left,
      top,
      opacity,
      filter: `blur(${blurPx}px)`,
    }}
  >
    <path d={PATH_DATA} fill={color} />
  </svg>
);

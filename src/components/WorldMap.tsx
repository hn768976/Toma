import React from 'react';
import {COLORS} from '../lib/theme';

/**
 * Simplified inline world map. Grey landmasses, no borders, no labels
 * (Scene 2 element list). Every vertex is a real coastal lon/lat pushed
 * through an equirectangular projection into a 1000 x 500 space:
 *   x = (lon + 180) / 360 * 1000      y = (90 - lat) / 180 * 500
 * which means router coordinates can be derived the same way and land where
 * they belong. Antarctica is dropped; it has no routers on it.
 */

/** Cropped to the drawn coastline so the map fills the frame. */
export const MAP_VIEWBOX = {x: 20, y: 8, width: 962, height: 404};

const LANDMASSES: string[] = [
  // North America
  'M 33 69 L 67 53 L 153 56 L 236 56 L 236 83 L 283 78 L 322 89 L 353 117 L 322 128 L 306 133 L 289 153 L 275 167 L 278 181 L 268 172 L 250 169 L 231 178 L 247 200 L 256 206 L 267 214 L 281 225 L 285 231 L 279 231 L 255 213 L 222 203 L 200 183 L 181 167 L 175 158 L 158 144 L 156 119 L 139 100 L 111 83 L 78 86 Z',
  // Greenland
  'M 389 19 L 444 28 L 439 56 L 400 78 L 378 83 L 355 66 L 340 45 L 358 25 Z',
  // Iceland
  'M 432 62 L 462 58 L 472 70 L 458 80 L 438 76 Z',
  // South America
  'M 292 219 L 328 222 L 339 231 L 403 264 L 403 272 L 394 286 L 381 314 L 372 317 L 358 333 L 339 347 L 328 358 L 319 375 L 311 403 L 292 389 L 297 361 L 303 333 L 286 283 L 275 256 L 286 239 Z',
  // Great Britain
  'M 489 86 L 497 92 L 502 105 L 496 112 L 487 108 L 484 96 Z',
  // Ireland
  'M 472 100 L 481 99 L 482 110 L 473 110 Z',
  // Europe
  'M 475 142 L 489 117 L 514 103 L 525 94 L 556 94 L 583 83 L 603 94 L 597 122 L 581 136 L 564 144 L 550 139 L 544 144 L 528 130 L 508 138 L 495 143 L 483 150 Z',
  // Scandinavia
  'M 512 88 L 528 78 L 552 58 L 572 52 L 583 66 L 560 78 L 548 92 L 530 95 Z',
  // Africa
  'M 483 150 L 528 147 L 556 161 L 583 164 L 592 167 L 608 208 L 642 219 L 619 244 L 611 261 L 608 269 L 611 294 L 586 333 L 550 344 L 533 314 L 533 275 L 525 250 L 525 239 L 508 233 L 500 236 L 486 236 L 469 233 L 453 208 L 456 192 L 464 175 L 475 161 Z',
  // Asia, including India and the south-east peninsula
  'M 667 61 L 750 47 L 833 47 L 944 56 L 950 83 L 903 97 L 867 131 L 853 153 L 839 164 L 817 189 L 800 203 L 792 222 L 786 244 L 772 222 L 761 206 L 750 189 L 736 194 L 717 228 L 703 194 L 686 183 L 661 194 L 625 214 L 619 203 L 597 172 L 600 150 L 625 133 L 644 133 L 667 125 L 640 120 L 615 102 L 598 88 L 610 70 L 640 62 Z',
  // Japan
  'M 890 126 L 900 130 L 895 145 L 880 158 L 872 156 L 884 142 Z',
  // Philippines
  'M 828 210 L 838 208 L 840 226 L 830 228 Z',
  // Sumatra
  'M 776 246 L 790 262 L 796 270 L 788 272 L 776 258 L 768 248 Z',
  // Java
  'M 798 272 L 822 270 L 824 276 L 798 278 Z',
  // Borneo
  'M 804 244 L 822 246 L 828 258 L 812 262 L 802 254 Z',
  // Sulawesi
  'M 832 248 L 842 246 L 840 260 L 832 262 Z',
  // New Guinea
  'M 862 262 L 890 258 L 918 268 L 910 276 L 880 272 L 864 270 Z',
  // Australia
  'M 864 283 L 894 281 L 925 325 L 919 344 L 903 356 L 883 347 L 822 339 L 817 311 L 839 300 Z',
  // Tasmania
  'M 900 362 L 912 360 L 910 372 L 900 372 Z',
  // New Zealand
  'M 958 350 L 968 344 L 972 360 L 962 372 L 956 366 Z',
];

export const WorldMap: React.FC = () => (
  <g>
    {LANDMASSES.map((d) => (
      <path key={d} d={d} fill={COLORS.fill} />
    ))}
  </g>
);

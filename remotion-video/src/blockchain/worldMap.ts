// Coarse equirectangular world map, used to scatter the background
// dot-matrix continents behind the chain (the same device the
// reference clip uses to say "global network").
//
// Stored as ASCII art because that is the one representation of a map
// a human can actually check: '#' is land, a space is water. The grid
// is MAP_COLS wide over 360 deg of longitude (col 0 = 180W, col 48 =
// the prime meridian) and MAP_ROWS tall over +80..-58 deg of latitude
// (row 0 = 80N). The poles are cropped because an equirectangular
// projection smears them into meaningless bands.
//
// It is deliberately coarse: at render size each cell is a single
// glowing dot a few pixels across, so coastline detail finer than this
// would never survive. Inland seas (Hudson Bay, the Mediterranean, the
// Red Sea, the Bay of Bengal) are kept because without them the
// continents fuse into one unreadable slab.

export const MAP_COLS = 96;
export const MAP_ROWS = 44;

const MAP: string[] = [
  "                                  #########                                                     ",
  "                                 ###########       ##     ####                      #######     ",
  "              #########  ####### ###########            ##### ##################################",
  "   ########  ########### ######## ##########    #####  #########################################",
  "  ######################  #######  ########### ####### #########################################",
  "  ######################    ######  ########## ####### #########################################",
  "   #####################    #######  #####    ######## #########################################",
  "    #######  ###########    #######            ######  ######################################## ",
  "              #####################          ## ##### ##################################### ### ",
  "               ####################          ## ##### ###################################  #### ",
  "                ###################           ####### #################################  ####   ",
  "                 #################           ### ##################################### ####     ",
  "                 #################           ### #### ######### #########################       ",
  "                 ################            ###  ## ########## ########################        ",
  "                  ##############            ############### ###########################         ",
  "                   ###########              ###############  ######################             ",
  "                    ########                ###############  ### #################              ",
  "                     ##########             #################### ####### ########               ",
  "                      ##### #####          ####################  #######  ###### ##             ",
  "                       ##### #####         ##################     ######  #####  ##             ",
  "                        #####              ###################    #####    ####  ###            ",
  "                         ###########      #####################    ####    #####  ###           ",
  "                           ###########    ####################              ####  ###           ",
  "                           ############   ############## ####        #      #####  ###          ",
  "                           #############  #################                ##########           ",
  "                           #############   ################               ###########           ",
  "                           ##############  ###############                 ###########          ",
  "                           ##############   ##############                   #####  ######      ",
  "                            #############   ##############                     ####  ######     ",
  "                            ############    #########       ##                        #####     ",
  "                             ###########     ########       ###                ############     ",
  "                             ##########      ########       ###               #############     ",
  "                              #########       #######        ##               #############     ",
  "                              ########        #######                         #############     ",
  "                               ######          ######                          ###########      ",
  "                               #####           #####                           ##########       ",
  "                                ####            ###                             ########   ##   ",
  "                                ###                                                  ##    ###  ",
  "                                ###                                                  ##     ##  ",
  "                                ###                                                         ### ",
  "                                ###                                                             ",
  "                                ###                                                             ",
  "                                 ##                                                             ",
  "                                                                                                ",
];

// u: 0..1 across longitude, v: 0..1 down latitude.
export type MapCell = { u: number; v: number };

export const worldMapCells = (): MapCell[] => {
  const cells: MapCell[] = [];
  for (let row = 0; row < MAP.length; row++) {
    const line = MAP[row];
    for (let col = 0; col < line.length; col++) {
      if (line[col] !== "#") continue;
      cells.push({ u: col / (MAP_COLS - 1), v: row / (MAP_ROWS - 1) });
    }
  }
  return cells;
};

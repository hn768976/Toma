/**
 * The single source of truth for both compositions.
 *
 * Flight codes are invented two-letter prefixes with invented three-digit
 * numbers — they are deliberately not real airline IATA prefixes paired with
 * real route numbers, and no carrier is named or implied anywhere.
 */

export const STATUSES = [
  "ON TIME",
  "BOARDING",
  "CHECK IN",
  "LAST CALL",
  "GATE CLOSED",
  "DELAYED",
  "CANCELLED",
] as const;

export type Status = (typeof STATUSES)[number];

export type FlightRow = {
  flight: string;
  time: string;
  destination: string;
  gate: string;
  status: Status;
};

/**
 * One departure bank, times ascending. The LCD board shows the first twelve;
 * the split-flap board shows all thirty-two, sixteen to a column.
 */
export const ROWS: FlightRow[] = [
  { flight: "VT516", time: "11:34", destination: "Buenos Aires", gate: "3", status: "ON TIME" },
  { flight: "RS521", time: "11:38", destination: "Cape Town", gate: "26", status: "BOARDING" },
  { flight: "QN307", time: "11:43", destination: "San Francisco", gate: "8", status: "GATE CLOSED" },
  { flight: "ZP884", time: "11:45", destination: "Bangalore", gate: "14", status: "LAST CALL" },
  { flight: "XK162", time: "11:48", destination: "Hong Kong", gate: "21", status: "BOARDING" },
  { flight: "NQ435", time: "11:52", destination: "Paris", gate: "3", status: "BOARDING" },
  { flight: "YR970", time: "11:55", destination: "Los Angeles", gate: "14", status: "ON TIME" },
  { flight: "DV248", time: "12:00", destination: "Taipeh", gate: "7", status: "CHECK IN" },
  { flight: "PZ713", time: "12:05", destination: "New York", gate: "18", status: "BOARDING" },
  { flight: "WK529", time: "12:09", destination: "Abu Dhabi", gate: "5", status: "CHECK IN" },
  { flight: "GX146", time: "12:13", destination: "Copenhagen", gate: "12", status: "ON TIME" },
  { flight: "FQ802", time: "12:17", destination: "Melbourne", gate: "23", status: "CHECK IN" },
  { flight: "JV355", time: "12:20", destination: "Berlin", gate: "9", status: "ON TIME" },
  { flight: "ZR618", time: "12:24", destination: "Warsaw", gate: "31", status: "BOARDING" },
  { flight: "TQ271", time: "12:29", destination: "Stockholm", gate: "4", status: "ON TIME" },
  { flight: "MV463", time: "12:33", destination: "Singapore", gate: "17", status: "DELAYED" },
  { flight: "BQ590", time: "12:36", destination: "Prague", gate: "28", status: "ON TIME" },
  { flight: "DQ127", time: "12:41", destination: "Brussels", gate: "6", status: "CANCELLED" },
  { flight: "KV744", time: "12:45", destination: "Helsinki", gate: "11", status: "ON TIME" },
  { flight: "LQ308", time: "12:48", destination: "Zurich", gate: "20", status: "ON TIME" },
  { flight: "NV652", time: "12:52", destination: "Athens", gate: "2", status: "BOARDING" },
  { flight: "PV419", time: "12:57", destination: "Munich", gate: "15", status: "BOARDING" },
  { flight: "RQ836", time: "13:01", destination: "Tokyo", gate: "24", status: "ON TIME" },
  { flight: "TV205", time: "13:05", destination: "Beijing", gate: "8", status: "BOARDING" },
  { flight: "WQ973", time: "13:09", destination: "Seoul", gate: "33", status: "ON TIME" },
  { flight: "XV581", time: "13:14", destination: "Doha", gate: "19", status: "BOARDING" },
  { flight: "YQ364", time: "13:18", destination: "London", gate: "1", status: "ON TIME" },
  { flight: "ZV720", time: "13:22", destination: "Vienna", gate: "27", status: "DELAYED" },
  { flight: "FV198", time: "13:26", destination: "Lisbon", gate: "10", status: "BOARDING" },
  { flight: "JZ457", time: "13:31", destination: "Madrid", gate: "22", status: "ON TIME" },
  { flight: "QZ603", time: "13:35", destination: "Milan", gate: "13", status: "ON TIME" },
  { flight: "VQ289", time: "13:40", destination: "Dubai", gate: "30", status: "BOARDING" },
];

/** Cities the boards swap in when a destination is re-assigned mid-loop. */
export const SPARE_DESTINATIONS = [
  "Amsterdam",
  "Frankfurt",
  "Barcelona",
  "Bangkok",
  "Toronto",
  "Cairo",
  "Rome",
  "Oslo",
  "Riga",
];

/** How a status realistically progresses when the board updates a cell. */
const NEXT_STATUS: Record<Status, Status> = {
  "ON TIME": "CHECK IN",
  "CHECK IN": "BOARDING",
  BOARDING: "LAST CALL",
  "LAST CALL": "GATE CLOSED",
  "GATE CLOSED": "DELAYED",
  DELAYED: "CANCELLED",
  CANCELLED: "DELAYED",
};

export const nextStatus = (status: Status): Status => NEXT_STATUS[status];

/**
 * The split-flap board only carries four remarks, so the seven-state model is
 * folded down for it. Keeping the fold here means both boards still read from
 * the same rows.
 */
const FLAP_STATUS: Record<Status, Status> = {
  "ON TIME": "ON TIME",
  "CHECK IN": "ON TIME",
  BOARDING: "BOARDING",
  "LAST CALL": "BOARDING",
  "GATE CLOSED": "CANCELLED",
  DELAYED: "DELAYED",
  CANCELLED: "CANCELLED",
};

export const toFlapStatus = (status: Status): Status => FLAP_STATUS[status];

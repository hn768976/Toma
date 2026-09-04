import { DURATION_IN_FRAMES, FRAMES_PER_ROW } from "./constants";

export type Alert = {
  text: string;
  /** Row in the scrolling field's own coordinate space. */
  row: number;
  /** Column of the label's first character. */
  col: number;
  /** The frame it is written on — instant, no fade. */
  appearsAt: number;
  bg: string;
  fg: string;
};

/**
 * Generic status text only: no addresses, hostnames, paths or instructions.
 *
 * Rows are picked so that every alert is on screen the frame it is written and
 * still on screen at the end of the loop: the field carries each one upward by
 * (DURATION_IN_FRAMES - appearsAt) / FRAMES_PER_ROW rows before the wrap.
 */
export const ALERTS: Alert[] = [
  { text: "Virus detected",             row: 48, col: 12,  appearsAt: 18,  bg: "#e01030", fg: "#ffffff" },
  { text: "Firewall down",              row: 30, col: 96,  appearsAt: 62,  bg: "#e01030", fg: "#ffffff" },
  { text: "Security breach",            row: 54, col: 40,  appearsAt: 110, bg: "#ff4d1a", fg: "#ffffff" },
  { text: "Data lost",                  row: 23, col: 150, appearsAt: 152, bg: "#e01030", fg: "#ffffff" },
  { text: "Vulnerability found",        row: 40, col: 68,  appearsAt: 198, bg: "#f59e0b", fg: "#20100a" },
  { text: "Malware found",              row: 57, col: 8,   appearsAt: 246, bg: "#e01030", fg: "#ffffff" },
  { text: "DDoS Attack Detected",       row: 34, col: 120, appearsAt: 292, bg: "#ff4d1a", fg: "#ffffff" },
  { text: "Protection failed",          row: 60, col: 55,  appearsAt: 336, bg: "#e01030", fg: "#ffffff" },
  { text: "Data Leakage detected",      row: 45, col: 166, appearsAt: 380, bg: "#fb923c", fg: "#20100a" },
  { text: "System hacked",              row: 51, col: 30,  appearsAt: 424, bg: "#ff4d1a", fg: "#ffffff" },
  { text: "System safety compromised",  row: 26, col: 88,  appearsAt: 468, bg: "#e01030", fg: "#ffffff" },
];

/** Frames the full set is held for before the loop wraps. */
export const HOLD_FRAMES =
  DURATION_IN_FRAMES - ALERTS[ALERTS.length - 1].appearsAt;

/** Screen row an alert occupies at a given frame, for sanity checks. */
export const screenRowAt = (alert: Alert, frame: number) =>
  alert.row - frame / FRAMES_PER_ROW;

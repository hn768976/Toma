/**
 * Template data — one row per composition.
 * Adding an acronym is one row: `{ id: 'XYZ', text: 'XYZ' }`.
 * `id` becomes the composition id `HudAcronym-<id>` (letters, digits, '-' only).
 */
export type AcronymRow = { id: string; text: string };

export const ACRONYMS: AcronymRow[] = [
  { id: "DEFI", text: "DEFI" },
  { id: "CBDC", text: "CBDC" },
  { id: "DAO", text: "DAO" },
  { id: "AGI", text: "AGI" },
  { id: "RAG", text: "RAG" },
  { id: "NPU", text: "NPU" },
  { id: "MFA", text: "MFA" },
  { id: "KYC", text: "KYC" },
  { id: "AI", text: "AI" },
];

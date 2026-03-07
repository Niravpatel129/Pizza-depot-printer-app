export const PRINTER = {
  model: "Epson TM-T88IV",
  escposPort: 9100,
  paperWidth58mm: 42,
  paperWidth80mm: 48,
} as const;

export type PaperWidth = 42 | 48;

export function getPaperWidth(use80mm = false): number {
  return use80mm ? PRINTER.paperWidth80mm : PRINTER.paperWidth58mm;
}

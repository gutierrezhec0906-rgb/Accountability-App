// Pixel-art block-letter bitmaps for the SQDIP Board. Each letter is a grid
// (array of row-strings, '1' = part of the letter, '0' = empty background)
// with exactly 32 '1' cells — 31 for the longest possible month, plus one
// extra "finisher" square that always stays blank (no number) to complete
// the shape. Cells are numbered 1..daysInMonth in reading order (left→right,
// top→bottom); everything after that — the finisher square, and for shorter
// months (28-30 days) the unused tail too — renders blank. The letter is
// only ever 100% numbered-and-colored when the month has 31 days.
const S = [
  '1111', '1111',
  '1000', '1000', '1000', '1000',
  '1111', '1111',
  '0001', '0001', '0001', '0001',
  '1111', '1111',
];
const Q = [
  '1111', '1111',
  '1001', '1001', '1001', '1001', '1001', '1001', '1001', '1001',
  '1111',
  '0011',
  '0001',
  '0001',
];
// D and I are solid blocks (no hollow interior) — every row fully filled,
// so the day sequence has no mid-shape gaps; the trailing blank(s) fall
// naturally at the end, same as S and Q.
const D = [
  '1111', '1111', '1111', '1111',
  '1111', '1111', '1111', '1111',
];
const I = [
  '11', '11', '11', '11', '11', '11', '11', '11',
  '11', '11', '11', '11', '11', '11', '11', '11',
];
const P = [
  '1111', '1111',
  '1001', '1001', '1001', '1001', '1001',
  '1111', '1111',
  '1000', '1000', '1000', '1000', '1000', '1000',
];

export const LETTER_SHAPES = { S, Q, D, I, P };

export const SQDIP_META = {
  S: { key: 'S', defaultLabel: 'Safety',    icon: '🦺', color: '#ef4444' },
  Q: { key: 'Q', defaultLabel: 'Quality',   icon: '✅', color: '#0d9488' },
  D: { key: 'D', defaultLabel: 'Delivery',  icon: '🚚', color: '#2563eb' },
  I: { key: 'I', defaultLabel: 'Inventory', icon: '📦', color: '#f59e0b', altLabel: 'Cost' },
  P: { key: 'P', defaultLabel: 'People',    icon: '🤝', color: '#7c3aed', altLabel: 'Productivity' },
};

export const SQDIP_ORDER = ['S', 'Q', 'D', 'I', 'P'];

// All 32 cell positions for a letter — [{ day, row, col }, ...]. `day` is
// 1..maxDays for the first `maxDays` positions in reading order; every
// position after that (the finisher square, and the unused tail on a
// shorter month) has `day: null` and renders as a permanently blank square.
export function letterCells(letterKey, maxDays) {
  const grid = LETTER_SHAPES[letterKey];
  const cells = [];
  let seq = 0;
  for (let row = 0; row < grid.length; row++) {
    const cols = grid[row];
    for (let col = 0; col < cols.length; col++) {
      if (cols[col] === '1') {
        seq++;
        cells.push({ day: seq <= maxDays ? seq : null, row, col });
      }
    }
  }
  return cells;
}

export function letterGridSize(letterKey) {
  const grid = LETTER_SHAPES[letterKey];
  return { rows: grid.length, cols: grid[0].length };
}

export function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

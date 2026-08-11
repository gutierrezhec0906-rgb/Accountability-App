// Pixel-art block-letter bitmaps for the SQDIP Board. Each letter is a grid
// (array of row-strings, '1' = part of the letter, '0' = empty background)
// with exactly 31 '1' cells — one per possible day of the longest month.
// Cells are numbered 1..31 in reading order (left→right, top→bottom). A
// shorter month (28-30 days) just renders/uses the first N numbered cells,
// leaving the tail of the shape unfilled — the letter is only ever 100%
// complete when the month actually has that many days.
const S = [
  '1111', '1111',
  '1000', '1000', '1000', '1000',
  '1111', '1111',
  '0001', '0001', '0001',
  '1111', '1111',
];
const Q = [
  '1111', '1111',
  '1001', '1001', '1001', '1001', '1001', '1001', '1001', '1001',
  '1111',
  '0011',
  '0001',
];
const D = [
  '1111', '1111',
  '1001', '1001', '1001', '1001', '1001', '1001', '1001',
  '1000',
  '1111', '1111',
];
const I = [
  '1111', '1111',
  '0110', '0110', '0110', '0110', '0110', '0110', '0110',
  '0100',
  '1111', '1111',
];
const P = [
  '1111', '1111',
  '1001', '1001', '1001', '1001', '1001',
  '1111', '1111',
  '1000', '1000', '1000', '1000', '1000',
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

// Flattened, numbered cell positions for a letter — [{ day, row, col }, ...].
// Only returns the cells that exist for `maxDays` (28-31).
export function letterCells(letterKey, maxDays) {
  const grid = LETTER_SHAPES[letterKey];
  const cells = [];
  let day = 0;
  for (let row = 0; row < grid.length; row++) {
    const cols = grid[row];
    for (let col = 0; col < cols.length; col++) {
      if (cols[col] === '1') {
        day++;
        if (day <= maxDays) cells.push({ day, row, col });
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

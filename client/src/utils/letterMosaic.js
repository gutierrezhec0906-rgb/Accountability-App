// Builds a "stylised sticker" grid for a SQDIP letter: instead of a
// hand-authored blocky bitmap, rasterize the real glyph on an offscreen
// canvas and keep whichever grid cells the glyph's ink actually covers.
// That gives every letter smooth, letter-shaped edges automatically,
// without hand-tuning a bitmap per character.
const COLS = 9;
const ROWS = 15;
const CANVAS_SIZE = 360;
const FILL_THRESHOLD = 0.32; // fraction of a cell that must be inked to count

const cache = new Map();

function rasterize(letter) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = '#000';
  ctx.font = `900 ${CANVAS_SIZE * 0.92}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + CANVAS_SIZE * 0.03);
  return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
}

// Returns { cells: [{row, col}], rows, cols } — `cells` is in reading order
// (top-to-bottom, left-to-right), which is later assigned day numbers 1..N.
export function computeLetterMosaic(letter) {
  if (cache.has(letter)) return cache.get(letter);
  if (typeof document === 'undefined') return { cells: [], rows: ROWS, cols: COLS };

  const data = rasterize(letter);
  const cellW = CANVAS_SIZE / COLS, cellH = CANVAS_SIZE / ROWS;
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x0 = Math.floor(col * cellW), x1 = Math.floor((col + 1) * cellW);
      const y0 = Math.floor(row * cellH), y1 = Math.floor((row + 1) * cellH);
      let hits = 0, samples = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          samples++;
          const alpha = data[(y * CANVAS_SIZE + x) * 4 + 3];
          if (alpha > 120) hits++;
        }
      }
      if (samples && hits / samples >= FILL_THRESHOLD) cells.push({ row, col });
    }
  }
  const result = { cells, rows: ROWS, cols: COLS };
  cache.set(letter, result);
  return result;
}

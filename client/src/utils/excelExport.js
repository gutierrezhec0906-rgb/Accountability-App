import * as XLSX from 'xlsx';

// Builds a single-sheet .xlsx workbook from headers + rows and triggers a
// browser download — a real Excel binary (not a CSV), so it opens with no
// format-mismatch warning and columns land in the exact order given.
export function downloadXLSX(filename, sheetName, headers, rows) {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

// Generic CSV export — builds a CSV string from headers + rows and triggers a
// browser download. CSV opens directly in Excel (double-click) with columns
// in the exact order passed in. A UTF-8 BOM is prepended so Excel renders
// special characters correctly instead of mangling them.
function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function downloadCSV(filename, headers, rows) {
  const lines = [headers, ...rows].map(row => row.map(escapeCsvCell).join(','));
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

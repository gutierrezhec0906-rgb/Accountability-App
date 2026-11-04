import * as XLSX from 'xlsx';

// Shared status label for an active (non-closed) action, matching the
// color logic in VisualBoard.jsx's computeStatus (kept independent here
// since export only needs the label, not the color).
function statusLabel(dueDate, recommitmentDate) {
  const active = recommitmentDate || dueDate;
  if (!active) return 'On Track';
  const today = new Date().toISOString().split('T')[0];
  if (active < today) return 'Past Due';
  const days = Math.ceil((new Date(active + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);
  return days <= 5 ? 'Due Soon' : 'On Track';
}

function formatDate(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  const seconds = val.seconds ?? val._seconds;
  if (seconds) return new Date(seconds * 1000).toLocaleDateString('en-US');
  return '';
}

function rowsFromItems(items) {
  return items.map(item => ({
    'Action': item.title || '',
    'Owner': item.owner || '',
    'Due Date': item.dueDate || '',
    'Status': item.closed ? 'Closed' : statusLabel(item.dueDate, item.recommitmentDate),
    'Recommitments': item.recommitmentCount || 0,
    'Closed On Time': item.closed ? (item.closedOnTime ? 'Yes' : 'No') : '',
    'Closed Date': item.closed ? formatDate(item.closedAt) : '',
    'Notes': item.notes || '',
    'Closing Notes': item.closingNotes || '',
    'Created': formatDate(item.createdAt),
  }));
}

// Builds and downloads a .xlsx of Visual Management / Accountability Board
// action items. `items` should already be filtered to what the caller wants
// exported (all actions, or just closed ones).
export function exportActionsToExcel(items, filename, sheetName = 'Actions') {
  const rows = rowsFromItems(items);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Action': 'No items to export' }]);
  ws['!cols'] = [
    { wch: 42 }, // Action
    { wch: 18 }, // Owner
    { wch: 12 }, // Due Date
    { wch: 12 }, // Status
    { wch: 14 }, // Recommitments
    { wch: 14 }, // Closed On Time
    { wch: 12 }, // Closed Date
    { wch: 40 }, // Notes
    { wch: 40 }, // Closing Notes
    { wch: 12 }, // Created
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Team Action Tracker export — mirrors TeamBoard.jsx's enriched/filtered row
// shape exactly (title, ownerName=Creator, owner=Responsible, st=computeStatus
// result, recommitmentCount, notes) so the downloaded file matches whatever
// view (filters/sort) was on screen when the user clicked export. A 🔴/🟡/🟢
// glyph is prefixed onto the Status text as the stand-in for the on-screen
// color badge — the free xlsx library can't paint cell background colors.
export function exportTeamActionsToExcel(items, filename, companyName) {
  const rows = items.map(item => {
    const activeDue = item.recommitmentDate || item.dueDate;
    const daysLeft = item.st?.daysLeft;
    const dot = item.st?.label === 'Red' ? '🔴' : item.st?.label === 'Yellow' ? '🟡' : '🟢';
    return {
      'Title': item.title || '',
      'Creator': item.ownerName || '',
      'Responsible': item.owner || '',
      'Due Date': activeDue || '',
      'Status': `${dot} ${item.st?.label || ''}`,
      'Days Left': daysLeft === null || daysLeft === undefined ? '' : daysLeft,
      'Recommitments': item.recommitmentCount || 0,
      'Notes': item.notes || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Title': 'No items to export' }]);
  ws['!cols'] = [
    { wch: 44 }, // Title
    { wch: 20 }, // Creator
    { wch: 20 }, // Responsible
    { wch: 12 }, // Due Date
    { wch: 12 }, // Status
    { wch: 10 }, // Days Left
    { wch: 14 }, // Recommitments
    { wch: 44 }, // Notes
  ];
  const wb = XLSX.utils.book_new();
  const safeSheetName = (companyName || 'Team Actions').replace(/[/\\?*[\]:]/g, ' ').slice(0, 31) || 'Team Actions';
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  XLSX.writeFile(wb, filename);
}

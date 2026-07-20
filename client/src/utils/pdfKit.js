import { jsPDF } from 'jspdf';

export const C = {
  navy:   [15, 32, 68],
  teal:   [13, 148, 136],
  cyan:   [8, 145, 178],
  purple: [124, 58, 237],
  pink:   [190, 24, 93],
  amber:  [180, 83, 9],
  green:  [21, 128, 61],
  red:    [220, 38, 38],
  white:  [255, 255, 255],
  light:  [248, 250, 252],
  muted:  [100, 116, 132],
  border: [210, 218, 228],
  text:   [30, 41, 59],
  line:   [150, 160, 175],
};

// Shared jsPDF document with common helpers. Every generator uses this so the
// look (title band, section headers, write-on blank lines, footer) stays consistent.
export function newDoc() {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const PW = 595, PH = 842, MARGIN = 40, CW = PW - MARGIN * 2;

  const kit = {
    pdf, PW, PH, MARGIN, CW, y: MARGIN,

    safe(s) { return (s == null ? '' : String(s)).replace(/[^\x00-\xFF]/g, ''); },
    newPage() { pdf.addPage(); kit.y = MARGIN; },
    space(n) { if (kit.y + n > PH - MARGIN) kit.newPage(); },

    text(str, x, size, color, bold, maxW, align = 'left') {
      pdf.setFontSize(size); pdf.setTextColor(...color);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      const s = kit.safe(str);
      if (maxW) { const lines = pdf.splitTextToSize(s, maxW); pdf.text(lines, x, kit.y, { align }); return lines.length; }
      pdf.text(s, x, kit.y, { align });
      return 1;
    },

    blankLines(n = 2, x = MARGIN, width = CW) {
      for (let i = 0; i < n; i++) {
        kit.space(20);
        pdf.setDrawColor(...C.line); pdf.setLineWidth(0.5);
        pdf.line(x, kit.y + 8, x + width, kit.y + 8);
        kit.y += 20;
      }
    },

    // Label + value; empty value renders `blanks` write-on lines (hand-writable template).
    field(label, value, { blanks = 2, indent = 0 } = {}) {
      const x = MARGIN + indent;
      kit.space(18);
      kit.text(label, x, 9, C.muted, true, CW - indent);
      kit.y += 13;
      const v = (value || '').toString().trim();
      if (v) {
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.text);
        const lines = pdf.splitTextToSize(kit.safe(v), CW - indent);
        for (const ln of lines) { kit.space(15); pdf.text(ln, x, kit.y + 8); kit.y += 15; }
        kit.y += 6;
      } else {
        kit.blankLines(blanks, x, CW - indent);
        kit.y += 2;
      }
    },

    sectionHeader(title, color = C.navy) {
      kit.space(40);
      pdf.setFillColor(...color);
      pdf.roundedRect(MARGIN, kit.y, CW, 24, 4, 4, 'F');
      pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
      pdf.text(kit.safe(title), MARGIN + 12, kit.y + 16);
      kit.y += 36;
    },

    titleBand(title, subtitle, rightText) {
      pdf.setFillColor(...C.navy);
      pdf.rect(0, 0, PW, 92, 'F');
      pdf.setFontSize(20); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...C.white);
      pdf.text(kit.safe(title), MARGIN, 44);
      if (subtitle) {
        pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(147, 197, 253);
        pdf.text(kit.safe(subtitle), MARGIN, 64);
      }
      pdf.setFontSize(9); pdf.setTextColor(203, 213, 225);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      pdf.text(kit.safe(rightText || `Prepared: ${dateStr}`), PW - MARGIN, 44, { align: 'right' });
      kit.y = 112;
    },

    finish(filename) {
      const pages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...C.muted);
        pdf.text('Leadership Flow Technologies - Accountability App', MARGIN, PH - 20);
        pdf.text(`Page ${i} of ${pages}`, PW - MARGIN, PH - 20, { align: 'right' });
      }
      pdf.save(filename);
    },
  };
  return kit;
}

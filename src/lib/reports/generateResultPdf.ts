import { jsPDF } from 'jspdf';
import type { ShareableReport } from './types';

/**
 * Renders any ShareableReport as a paginated, print-formatted PDF ("Complete
 * Report"). Used by every calculator via ShareDownloadMenu; calculators never
 * touch jsPDF directly — they only ever build a ShareableReport object.
 */

const PAGE_W = 595.28; // A4 in pt
const PAGE_H = 841.89;
const MARGIN = 48;
const HEADER_H = 130;
const ROW_BOTTOM_MARGIN = 100; // reserve space above the footer before breaking

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const bigint = parseInt(normalized, 16) || 0;
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

export const generateResultPdf = (report: ShareableReport): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const [r, g, b] = hexToRgb(report.accentColor);
      let y = HEADER_H + 40;

      const drawHeader = () => {
        doc.setFillColor(r, g, b);
        doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(report.title.toUpperCase(), MARGIN, 34);

        doc.setFontSize(40);
        doc.text(report.headlineValue, MARGIN, 82);

        doc.setFontSize(16);
        doc.text(report.headlineLabel.toUpperCase(), MARGIN, 106);

        if (report.meta?.length) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          report.meta.slice(0, 3).forEach((line, i) => {
            doc.text(line, PAGE_W - MARGIN, 34 + i * 14, { align: 'right' });
          });
        }
      };

      const addPage = () => {
        doc.addPage();
        drawHeader();
        y = HEADER_H + 40;
      };

      drawHeader();

      const allSections = [...(report.pdfOnlySections ?? []), ...report.sections];

      const drawSectionHeading = (text: string) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(15, 23, 42);
        doc.text(text.toUpperCase(), MARGIN, y);
        y += 24;
      };

      allSections.forEach((section) => {
        if (y > PAGE_H - ROW_BOTTOM_MARGIN) addPage();

        if (section.heading) {
          drawSectionHeading(section.heading);
        }

        section.rows.forEach((row) => {
          if (y > PAGE_H - ROW_BOTTOM_MARGIN) {
            addPage();
            // A section that spills onto a new page repeats its heading
            // (marked "continued") instead of leaving headless rows
            // floating with no context on the new page.
            if (section.heading) {
              drawSectionHeading(`${section.heading} (Continued)`);
            }
          }

          doc.setDrawColor(226, 232, 240);
          doc.line(MARGIN, y, PAGE_W - MARGIN, y);
          y += 22;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(100, 116, 139);
          doc.text(row.label, MARGIN, y);

          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(row.value, PAGE_W - MARGIN, y, { align: 'right' });

          y += 14;
        });

        y += 16;
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        if (report.disclaimer) {
          doc.text(report.disclaimer, MARGIN, PAGE_H - 40);
        }
        doc.text(new Date().toLocaleDateString(), MARGIN, PAGE_H - 26);
        doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 26, { align: 'right' });
      }

      resolve(doc.output('blob'));
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not generate the PDF.'));
    }
  });
};

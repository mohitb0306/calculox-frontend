import { jsPDF } from 'jspdf';
import type { ShareableReport, ReportSection, SiteInfo } from './types';

/**
 * Renders any ShareableReport as a paginated, print-formatted PDF ("Complete
 * Report"). Used by every calculator via ShareDownloadMenu; calculators never
 * touch jsPDF directly — they only ever build a ShareableReport object.
 *
 * Layout: each ReportSection is drawn as its own rounded "card" so inputs and
 * results read as clearly separated, self-contained groups rather than one
 * long undifferentiated list. Cards are tagged INPUT (neutral/slate) or
 * RESULT (tinted with the report's accent color) based on `section.variant`.
 */

const PAGE_W = 595.28; // A4 in pt
const PAGE_H = 841.89;
const MARGIN = 48;
const HEADER_H = 130;
const ROW_BOTTOM_MARGIN = 100; // reserve space above the footer before breaking

const CARD_PADDING = 16;
const CARD_RADIUS = 10;
const CARD_GAP = 18;
const CARD_HEADING_H = 26;
const ROW_H = 26;
const TAG_H = 16;

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const bigint = parseInt(normalized, 16) || 0;
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
};

/** Blend an RGB color toward white. factor=1 -> white, factor=0 -> original color. */
const tint = ([r, g, b]: [number, number, number], factor: number): [number, number, number] => [
  Math.round(255 * factor + r * (1 - factor)),
  Math.round(255 * factor + g * (1 - factor)),
  Math.round(255 * factor + b * (1 - factor)),
];

const SLATE: [number, number, number] = [100, 116, 139]; // neutral "input" base color

/**
 * jsPDF's built-in fonts (Helvetica/Times/Courier) only embed the WinAnsi
 * character set — a Latin-1-ish range. Common math/typographic symbols like
 * "≥" or "≤" fall outside it and render as garbled glyphs instead of text
 * (e.g. a BMI label of "≥ 40.0" printing as '"e 40.0'). Since any current or
 * future calculator's labels can contain these, sanitize every string drawn
 * to the PDF through this one map rather than special-casing BMI.
 */
const PDF_SAFE_REPLACEMENTS: Record<string, string> = {
  '\u2265': '>=', // ≥
  '\u2264': '<=', // ≤
  '\u2260': '!=', // ≠
  '\u2212': '-',  // − (minus sign, distinct from hyphen)
  '\u2192': '->', // →
  '\u2190': '<-', // ←
  '\u00b1': '+/-',// ± (safe in WinAnsi too, but normalized for consistency)
};

const pdfSafe = (text: string): string =>
  text.replace(/[\u2265\u2264\u2260\u2212\u2192\u2190\u00b1]/g, (ch) => PDF_SAFE_REPLACEMENTS[ch] ?? ch);

export const generateResultPdf = (report: ShareableReport, siteInfo?: SiteInfo): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const accentRgb = hexToRgb(report.accentColor);
      const contentW = PAGE_W - MARGIN * 2;
      let y = HEADER_H + 40;

      const drawHeader = () => {
        doc.setFillColor(...accentRgb);
        doc.rect(0, 0, PAGE_W, HEADER_H, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(pdfSafe(report.title.toUpperCase()), MARGIN, 34);

        doc.setFontSize(40);
        doc.text(pdfSafe(report.headlineValue), MARGIN, 82);

        doc.setFontSize(16);
        doc.text(pdfSafe(report.headlineLabel.toUpperCase()), MARGIN, 106);

        if (report.meta?.length) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          report.meta.slice(0, 3).forEach((line, i) => {
            doc.text(pdfSafe(line), PAGE_W - MARGIN, 34 + i * 14, { align: 'right' });
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

      // Per-variant palette: background tint, border tint, heading color, tag pill.
      const paletteFor = (variant: ReportSection['variant']) => {
        const base = variant === 'input' ? SLATE : accentRgb;
        return {
          bg: tint(base, 0.94),
          border: tint(base, 0.72),
          heading: tint(base, 0.15),
          tagBg: base,
          tagLabel: variant === 'input' ? 'INPUT' : 'RESULT',
        };
      };

      // How tall a card is if drawn with `rowCount` rows and no split.
      const fullCardHeight = (section: ReportSection) =>
        CARD_PADDING * 2 +
        (section.heading ? CARD_HEADING_H : 0) +
        section.rows.length * ROW_H;

      const maxHeightOnFreshPage = PAGE_H - (HEADER_H + 40) - ROW_BOTTOM_MARGIN;

      const drawCardFrame = (topY: number, height: number, palette: ReturnType<typeof paletteFor>) => {
        doc.setFillColor(...palette.bg);
        doc.setDrawColor(...palette.border);
        doc.setLineWidth(1);
        doc.roundedRect(MARGIN, topY, contentW, height, CARD_RADIUS, CARD_RADIUS, 'FD');
      };

      const drawCardHeading = (text: string, topY: number, palette: ReturnType<typeof paletteFor>) => {
        // Small colored tag pill, e.g. "INPUT" / "RESULT"
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        const tagW = doc.getTextWidth(text.toUpperCase()) + 14;
        doc.setFillColor(...palette.tagBg);
        doc.roundedRect(MARGIN + CARD_PADDING, topY, tagW, TAG_H, TAG_H / 2, TAG_H / 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.text(text.toUpperCase(), MARGIN + CARD_PADDING + tagW / 2, topY + TAG_H - 4.5, { align: 'center' });
      };

      const drawSectionTitle = (heading: string | undefined, topY: number, palette: ReturnType<typeof paletteFor>) => {
        if (!heading) return;
        drawCardHeading(palette.tagLabel, topY + CARD_PADDING, palette);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...palette.heading);
        doc.text(
          pdfSafe(heading.toUpperCase()),
          MARGIN + contentW - CARD_PADDING,
          topY + CARD_PADDING + TAG_H - 4.5,
          { align: 'right' }
        );
      };

      const drawRow = (row: { label: string; value: string }, rowTopY: number, isFirst: boolean, palette: ReturnType<typeof paletteFor>) => {
        if (!isFirst) {
          doc.setDrawColor(...tint(palette.border, 0.3));
          doc.setLineWidth(0.75);
          doc.line(MARGIN + CARD_PADDING, rowTopY, MARGIN + contentW - CARD_PADDING, rowTopY);
        }
        const textY = rowTopY + ROW_H - 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(100, 116, 139);
        doc.text(pdfSafe(row.label), MARGIN + CARD_PADDING, textY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(pdfSafe(row.value), MARGIN + contentW - CARD_PADDING, textY, { align: 'right' });
      };

      // Draws a section as one or more cards, splitting across pages only
      // when the section genuinely can't fit on a single page.
      const drawSection = (section: ReportSection) => {
        const palette = paletteFor(section.variant);
        let rowsRemaining = section.rows;
        let continued = false;

        while (rowsRemaining.length > 0 || (continued === false && rowsRemaining.length === 0 && section.heading)) {
          const headingH = section.heading ? CARD_HEADING_H : 0;
          const availableH = PAGE_H - ROW_BOTTOM_MARGIN - y;
          const maxRowsHere = Math.floor((availableH - CARD_PADDING * 2 - headingH) / ROW_H);

          // If nothing at all fits here, move to a fresh page and retry.
          if (maxRowsHere <= 0 && rowsRemaining.length > 0) {
            addPage();
            continue;
          }

          const takeCount = Math.min(maxRowsHere, rowsRemaining.length);
          const rowsHere = rowsRemaining.slice(0, takeCount);
          rowsRemaining = rowsRemaining.slice(takeCount);

          const cardH = CARD_PADDING * 2 + headingH + rowsHere.length * ROW_H;
          const cardTop = y;
          drawCardFrame(cardTop, cardH, palette);

          let rowY = cardTop + CARD_PADDING;
          if (section.heading) {
            drawSectionTitle(continued ? `${section.heading} (Continued)` : section.heading, cardTop, palette);
            rowY += headingH;
          }
          rowsHere.forEach((row, i) => {
            drawRow(row, rowY, i === 0, palette);
            rowY += ROW_H;
          });

          y = cardTop + cardH + CARD_GAP;
          continued = true;

          if (rowsRemaining.length > 0) {
            addPage();
          } else {
            break;
          }
        }

        // Section with a heading but zero rows: still draw an empty labeled card once.
        if (section.rows.length === 0 && section.heading && !continued) {
          const headingH = CARD_HEADING_H;
          const cardH = CARD_PADDING * 2 + headingH;
          if (y + cardH > PAGE_H - ROW_BOTTOM_MARGIN) addPage();
          drawCardFrame(y, cardH, palette);
          drawSectionTitle(section.heading, y, palette);
          y += cardH + CARD_GAP;
        }
      };

      allSections.forEach((section) => {
        if (section.rows.length === 0 && !section.heading) return;

        const cardH = fullCardHeight(section);
        const fitsFresh = cardH <= maxHeightOnFreshPage;

        // If the whole card doesn't fit here but WOULD fit cleanly on a new
        // page, start a new page rather than splitting it awkwardly.
        if (y + cardH > PAGE_H - ROW_BOTTOM_MARGIN && fitsFresh) {
          addPage();
        }

        drawSection(section);
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        if (report.disclaimer) {
          doc.text(pdfSafe(report.disclaimer), MARGIN, PAGE_H - 40);
        }
        doc.text(new Date().toLocaleDateString(), MARGIN, PAGE_H - 26);
        doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 26, { align: 'right' });

        if (siteInfo?.name && siteInfo?.url) {
          doc.setFontSize(8);
          doc.setTextColor(180, 188, 199);
          doc.text(
            pdfSafe(`Generated by ${siteInfo.name} at ${siteInfo.url}`),
            PAGE_W / 2,
            PAGE_H - 14,
            { align: 'center' }
          );
        }
      }

      resolve(doc.output('blob'));
    } catch (err) {
      reject(err instanceof Error ? err : new Error('Could not generate the PDF.'));
    }
  });
};

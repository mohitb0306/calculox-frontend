import type { ShareableReport } from './types';

/**
 * Renders any ShareableReport as a single downloadable/shareable PNG "result
 * card". Pure client-side Canvas 2D — no external libraries, no backend, no
 * persistence. Used by every calculator via ShareDownloadMenu; calculators
 * never call this directly with their own drawing code.
 */

const FONT = 'system-ui, -apple-system, Segoe UI, sans-serif';

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

type DrawRow =
  | { kind: 'heading'; text: string }
  | { kind: 'row'; label: string; value: string };

export const generateResultImage = (report: ShareableReport): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Not available in this environment.'));
      return;
    }

    const drawRows: DrawRow[] = [];
    report.sections.forEach((section) => {
      if (section.heading) drawRows.push({ kind: 'heading', text: section.heading });
      section.rows.forEach((row) => drawRows.push({ kind: 'row', label: row.label, value: row.value }));
    });

    const W = 1000;
    const headerH = 300;
    const rowH = 90;
    const headingH = 56;
    const padTop = 60;
    const padBottom = 130;
    const contentH = drawRows.reduce((sum, r) => sum + (r.kind === 'heading' ? headingH : rowH), 0);
    const H = headerH + padTop + contentH + padBottom;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas is not supported in this browser.'));
      return;
    }

    // Page background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, W, H);

    // Outer card with soft shadow
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.15)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, 32, 32, W - 64, H - 64, 28);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, 32, 32, W - 64, H - 64, 28);
    ctx.clip();

    // Header band in the report's accent color
    ctx.fillStyle = report.accentColor;
    ctx.fillRect(32, 32, W - 64, headerH);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(report.title.toUpperCase(), 72, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 120px ${FONT}`;
    ctx.fillText(report.headlineValue, 68, 235);

    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(report.headlineLabel.toUpperCase(), 72, 285);

    if (report.meta?.length) {
      ctx.font = `600 22px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      report.meta.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, W - 72, 100 + i * 30);
      });
      ctx.textAlign = 'left';
    }

    // Section headings + label/value rows
    let y = headerH + padTop;
    let isFirstInBlock = true;
    drawRows.forEach((r) => {
      if (r.kind === 'heading') {
        ctx.fillStyle = '#0f172a';
        ctx.font = `800 22px ${FONT}`;
        ctx.fillText(r.text.toUpperCase(), 72, y + 30);
        y += headingH;
        isFirstInBlock = true;
        return;
      }

      if (!isFirstInBlock) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(72, y);
        ctx.lineTo(W - 72, y);
        ctx.stroke();
      }
      isFirstInBlock = false;

      ctx.fillStyle = '#64748b';
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(r.label.toUpperCase(), 72, y + 40);

      ctx.fillStyle = '#0f172a';
      ctx.font = `700 30px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(r.value, W - 72, y + 44);
      ctx.textAlign = 'left';

      y += rowH;
    });

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = `500 18px ${FONT}`;
    if (report.disclaimer) {
      ctx.fillText(report.disclaimer, 72, H - 76);
    }
    ctx.fillText(new Date().toLocaleDateString(), 72, H - 48);

    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Could not generate the image.'));
      }
    }, 'image/png');
  });
};

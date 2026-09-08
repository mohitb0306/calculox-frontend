/**
 * Calculator-agnostic "shareable report" contract.
 *
 * Every calculator (BMI today, 200+ more later) maps its own result into this
 * one shape. Nothing calculator-specific lives here or in the generators that
 * consume it — a calculator only ever builds a `ShareableReport` object; it
 * never draws pixels or PDF content itself.
 */

export interface ReportRow {
  /** Left-hand label, e.g. "Ideal Weight Range" */
  label: string;
  /** Right-hand value, e.g. "60.1 – 80.9 kg" */
  value: string;
}

export interface ReportSection {
  /** Optional sub-heading above this group of rows, e.g. "Waist Metrics" */
  heading?: string;
  rows: ReportRow[];
}

export interface ShareableReport {
  /** Small eyebrow label in the header, e.g. "BMI RESULT" */
  title: string;
  /** Large headline value, e.g. "23.4" */
  headlineValue: string;
  /** Status/category shown under the headline, e.g. "Normal range" */
  headlineLabel: string;
  /** Hex color (e.g. "#22c55e") driving the header/accent color in both outputs */
  accentColor: string;
  /** Up to 3 short lines shown top-right of the header, e.g. ["WHO Standard", "Metric Units"] */
  meta?: string[];
  /** One or more groups of label/value rows, rendered in order */
  sections: ReportSection[];
  /** Optional footer disclaimer, e.g. "For informational purposes only — not medical advice." */
  disclaimer?: string;
  /** Filename stem (no extension) used for both downloads, e.g. "bmi-result" */
  fileNameBase: string;
}

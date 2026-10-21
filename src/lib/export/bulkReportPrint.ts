/** Build the browser-print version of a saved bulk assessment without an HTML sink. */
export interface BulkReportPrintRow {
  rank: string;
  name: string;
  score: string;
  keywordCount: string;
  relativeRank: string;
  missingKeywords: string[];
  realitySummary?: string;
}

export interface BulkReportPrintContent {
  title: string;
  generated: string;
  historical?: string;
  jobSummaryLabel: string;
  jobSnapshot: string;
  headings: string[];
  hiringDisclaimer: string;
  missingLabel: string;
  realityLabel: string;
  rows: BulkReportPrintRow[];
}

export function renderBulkReportPrint(doc: Document, report: BulkReportPrintContent): void {
  doc.documentElement.lang = 'ar';
  doc.documentElement.dir = 'rtl';
  doc.title = report.title;

  const style = doc.createElement('style');
  style.textContent = `
    :root { color-scheme: light; }
    @page { size: A4; margin: 16mm; }
    body { font-family: Tahoma, Arial, system-ui, sans-serif; color: #1f2937; background: #fff; line-height: 1.55; }
    @media screen { body { box-sizing: border-box; max-width: 210mm; margin: 0 auto; padding: 16mm; } }
    h1 { color: #047857; font-size: 20pt; margin: 0 0 4mm; }
    h2 { font-size: 12pt; margin: 0 0 2mm; }
    p { margin: 0 0 3mm; white-space: pre-wrap; overflow-wrap: anywhere; }
    .muted { color: #4b5563; font-size: 9pt; }
    .warning { color: #92400e; }
    table { width: 100%; border-collapse: collapse; margin: 6mm 0; font-size: 9pt; table-layout: fixed; }
    th, td { border: 1px solid #d1d5db; padding: 2mm; text-align: right; overflow-wrap: anywhere; }
    th { background: #047857; color: white; }
    thead { display: table-header-group; }
    tr, section { break-inside: avoid; }
    section { margin: 5mm 0; }
  `;
  doc.head.appendChild(style);
  doc.body.replaceChildren();

  const appendText = (parent: HTMLElement, tag: string, value: string, className?: string): HTMLElement => {
    const element = doc.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  };

  appendText(doc.body, 'h1', report.title);
  appendText(doc.body, 'p', report.generated, 'muted');
  if (report.historical) appendText(doc.body, 'p', report.historical, 'warning');
  appendText(doc.body, 'h2', report.jobSummaryLabel);
  appendText(doc.body, 'p', report.jobSnapshot);

  const table = doc.createElement('table');
  const thead = doc.createElement('thead');
  const headingRow = doc.createElement('tr');
  for (const heading of report.headings) appendText(headingRow, 'th', heading);
  thead.appendChild(headingRow);
  table.appendChild(thead);
  const tbody = doc.createElement('tbody');
  for (const row of report.rows) {
    const tr = doc.createElement('tr');
    for (const value of [row.rank, row.name, row.score, row.keywordCount, row.relativeRank]) {
      appendText(tr, 'td', value);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  doc.body.appendChild(table);
  appendText(doc.body, 'p', report.hiringDisclaimer, 'muted');

  for (const row of report.rows) {
    if (row.missingKeywords.length === 0 && !row.realitySummary) continue;
    const section = doc.createElement('section');
    appendText(section, 'h2', `${row.rank} ${row.name}`);
    if (row.missingKeywords.length > 0) {
      appendText(section, 'p', `${report.missingLabel} ${row.missingKeywords.join(', ')}`);
    }
    if (row.realitySummary) appendText(section, 'p', `${report.realityLabel} ${row.realitySummary}`);
    doc.body.appendChild(section);
  }
}

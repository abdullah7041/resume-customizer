import type { TextPdfBlock, TextPdfRun, StyledPdfStyle, StyledPdfSnapshot } from '@/types/text-pdf';

function capturedColor(element: HTMLElement, value: string): string {
  if (/^#[0-9a-f]{6}$/iu.test(value)) return value.toLowerCase();
  const rgb = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/u);
  if (rgb) return '#' + rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, '0')).join('');
  // Native canvas resolves modern CSS colors (including Tailwind OKLCH) to sRGB.
  if (value) {
    const canvas = element.ownerDocument.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return '#' + [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => channel.toString(16).padStart(2, '0')).join('');
    }
  }
  return '#111827';
}

function capturedStyle(element: HTMLElement, kind: TextPdfBlock['kind']): StyledPdfStyle {
  const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
  const declaredPoints = /pt$/u.test(element.style.fontSize) ? parseFloat(element.style.fontSize) : undefined;
  const fontSize = Math.max(6, Math.min(32, declaredPoints ?? (parseFloat(computed?.fontSize ?? '') * 0.75 || (kind === 'title' ? 20 : kind === 'heading' ? 12 : 10.5))));
  let direction: 'ltr' | 'rtl' = 'ltr';
  for (let owner: HTMLElement | null = element; owner; owner = owner.parentElement) {
    const value = owner.ownerDocument.defaultView?.getComputedStyle(owner).direction || owner.getAttribute('dir');
    if (value === 'rtl' || value === 'ltr') { direction = value; break; }
  }
  const alignment = computed?.textAlign;
  const align = alignment === 'center' ? 'center' : alignment === 'right' || (alignment !== 'left' && direction === 'rtl') ? 'right' : 'left';
  const height = element.style.lineHeight || computed?.lineHeight || '';
  const lineHeight = Math.max(fontSize, Math.min(72, /^\d+(\.\d+)?$/u.test(height)
    ? Number(height) * fontSize : parseFloat(height) * (/pt$/u.test(height) ? 1 : 0.75) || fontSize * 1.5));
  const after = parseFloat(computed?.marginBottom ?? '') * 0.75;
  return { fontSize, lineHeight, color: capturedColor(element, computed?.color ?? ''),
    bold: ['B', 'STRONG'].includes(element.tagName) || ['bold', 'bolder'].includes(computed?.fontWeight ?? '') || Number(computed?.fontWeight) >= 600 || kind === 'title' || kind === 'heading',
    italic: ['I', 'EM'].includes(element.tagName) || computed?.fontStyle === 'italic', align, direction,
    spacingAfter: Math.max(0, Math.min(36, Number.isFinite(after) ? after : kind === 'heading' ? 5 : kind === 'bullet' ? 2 : 6)),
    ...(parseFloat(computed?.borderBottomWidth ?? '') > 0 ? { borderColor: capturedColor(element, computed?.borderBottomColor ?? '') } : {}),
  };
}

export function captureStyledPdfSnapshot(preview: HTMLElement): StyledPdfSnapshot {
  const styles: StyledPdfStyle[] = [];
  return { blocks: captureTextPdfBlocks(preview, styles), styles };
}

const excluded = (element: Element): boolean => {
  if (element.matches('[data-no-print], [hidden], [aria-hidden="true"], [data-private], [data-private-answer], script, style, svg, canvas, template')) return true;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display === 'none' || style?.visibility === 'hidden' || style?.visibility === 'collapse' || style?.opacity === '0';
};
const hiddenTree = (preview: HTMLElement): boolean => {
  for (let element: Element | null = preview; element; element = element.parentElement) {
    if (excluded(element)) return true;
  }
  return false;
};

/** Clean using the attached source's styles, before detaching the immutable clone. */
export function cloneVisiblePdfPreview(preview: HTMLElement): HTMLElement {
  const clone = preview.cloneNode(true) as HTMLElement;
  if (hiddenTree(preview)) { clone.replaceChildren(); return clone; }
  const clean = (source: Element, target: Element) => {
    if (excluded(source)) { target.remove(); return; }
    const children = Array.from(target.children);
    Array.from(source.children).forEach((child, index) => clean(child, children[index]));
  };
  clean(preview, clone);
  return clone;
}

/** Capture only displayed DOM strings, in document order; never consult a store. */
export function captureTextPdfBlocks(preview: HTMLElement, presentation?: StyledPdfStyle[]): TextPdfBlock[] {
  if (hiddenTree(preview)) return [];
  const blocks: TextPdfBlock[] = [];
  let kind: TextPdfBlock['kind'] = 'body';
  let runs: TextPdfRun[] = [];
  let firstElement: HTMLElement | undefined;
  let owner = preview;
  let previousElement: HTMLElement | undefined;
  let emphasis: NonNullable<StyledPdfStyle['emphasis']> = [];
  let gaps: number[] = [];
  const flush = () => {
    const meaningful: TextPdfRun[] = [];
    let leading = '';
    for (const run of runs) {
      if (run.text.trim()) { meaningful.push({ ...run, text: leading + run.text }); leading = ''; }
      else if (meaningful.length) meaningful[meaningful.length - 1].text += run.text;
      else leading += run.text;
    }
    if (meaningful.length) {
      blocks.push({ kind, runs: meaningful });
      if (presentation) {
        const element = firstElement && !['B', 'STRONG', 'I', 'EM'].includes(firstElement.tagName) ? firstElement : owner;
        const style = capturedStyle(element, kind);
        const length = meaningful.reduce((sum, run) => sum + run.text.length, 0);
        style.emphasis = emphasis.map(range => ({ ...range, end: Math.min(length, range.end) })).filter(range => range.end > range.start);
        style.spacedBoundaries = gaps.filter(position => position > 0 && position < length);
        presentation.push(style);
      }
    }
    runs = [];
    firstElement = undefined;
    previousElement = undefined; emphasis = []; gaps = [];
  };
  const visit = (node: Node, href?: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text) return;
      if (!firstElement && text.trim()) firstElement = node.parentElement ?? preview;
      if (presentation && text.trim()) {
        const element = node.parentElement ?? preview;
        const start = runs.reduce((sum, run) => sum + run.text.length, 0);
        const inline = capturedStyle(element, kind);
        emphasis.push({ start, end: start + text.length, bold: inline.bold, italic: inline.italic, color: inline.color });
        const previousText = runs[runs.length - 1]?.text ?? '';
        if (previousElement && previousElement !== element && !/\s$/u.test(previousText) && !/^\s/u.test(text)) {
          const parent = element.parentElement;
          const parentStyle = parent && element.ownerDocument.defaultView?.getComputedStyle(parent);
          const ownStyle = element.ownerDocument.defaultView?.getComputedStyle(element);
          if (parseFloat(parentStyle?.columnGap ?? '') > 0 || parseFloat(ownStyle?.paddingLeft ?? '') > 0 || parseFloat(ownStyle?.paddingRight ?? '') > 0) gaps.push(start);
        }
        previousElement = element;
      }
      const last = runs[runs.length - 1];
      if (last && last.href === href) last.text += text;
      else runs.push({ text, ...(href ? { href } : {}) });
      return;
    }
    if (!(node instanceof HTMLElement) || excluded(node)) return;
    const tag = node.tagName;
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    const boundary = /^(H[1-6]|P|LI|DIV|SECTION|HEADER|FOOTER|UL|OL|BR)$/.test(tag) || ['block', 'flex', 'grid', 'list-item'].includes(style?.display ?? '');
    const previousKind = kind;
    const previousOwner = owner;
    const before = blocks.length;
    if (boundary) {
      flush();
      kind = tag === 'H1' ? 'title' : /^H[2-6]$/.test(tag) ? 'heading' : tag === 'LI' ? 'bullet' : previousKind;
      owner = node;
    }
    let target = href;
    if (tag === 'A') {
      target = undefined;
      const value = node.getAttribute('href');
      if (value && !/\s/u.test(value) && value.length <= 2048) {
        try {
          const url = new URL(value);
          if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) && !url.username && !url.password) target = value;
        } catch { /* Keep the displayed label without an unsafe link. */ }
      }
    }
    node.childNodes.forEach(child => visit(child, target));
    if (boundary) {
      flush();
      if (presentation && node !== preview && blocks.length > before && /^(SECTION|HEADER|FOOTER|DIV)$/u.test(tag)) {
        const gap = parseFloat(style?.marginBottom ?? '') * 0.75;
        if (Number.isFinite(gap) && gap > 0) presentation[presentation.length - 1].spacingAfter = Math.min(36, presentation[presentation.length - 1].spacingAfter + gap);
      }
      kind = previousKind; owner = previousOwner;
    }
  };
  visit(preview);
  flush();
  return blocks;
}

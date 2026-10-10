import type { TextPdfBlock, TextPdfRun } from '@/types/text-pdf';

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
export function captureTextPdfBlocks(preview: HTMLElement): TextPdfBlock[] {
  if (hiddenTree(preview)) return [];
  const blocks: TextPdfBlock[] = [];
  let kind: TextPdfBlock['kind'] = 'body';
  let runs: TextPdfRun[] = [];
  const flush = () => {
    const meaningful = runs.filter(run => run.text.trim());
    if (meaningful.length) blocks.push({ kind, runs: meaningful });
    runs = [];
  };
  const visit = (node: Node, href?: string) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text) return;
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
    if (boundary) {
      flush();
      kind = tag === 'H1' ? 'title' : /^H[2-6]$/.test(tag) ? 'heading' : tag === 'LI' ? 'bullet' : previousKind;
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
    if (boundary) { flush(); kind = previousKind; }
  };
  visit(preview);
  flush();
  return blocks;
}

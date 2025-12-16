import * as pdfjsLib from 'pdfjs-dist';
import { containsArabic, detectLanguage } from './arabicTextUtils';

export interface ExtractedPdfContent {
  text: string;
  language: 'ar' | 'en' | 'mixed';
  pageCount: number;
  hasRtl: boolean;
}

interface TextItem {
  str: string;
  dir: 'ltr' | 'rtl';
  transform: number[];
  width: number;
  height: number;
}

/**
 * Extract text from PDF with Arabic support
 */
export async function extractPdfWithArabicSupport(
  file: File | ArrayBuffer
): Promise<ExtractedPdfContent> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: '/cmaps/',
    cMapPacked: true,
  }).promise;

  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Process text items with RTL awareness
    const pageText = processTextItems(textContent.items as TextItem[]);
    textParts.push(pageText);
  }

  const fullText = textParts.join('\n\n');
  const language = detectLanguage(fullText);
  const hasRtl = containsArabic(fullText);

  return {
    text: fullText,
    language,
    pageCount: pdf.numPages,
    hasRtl,
  };
}

/**
 * Process text items with proper RTL handling
 */
function processTextItems(items: TextItem[]): string {
  // Group items by line (based on y-position)
  const lines: Map<number, TextItem[]> = new Map();

  for (const item of items) {
    // Round y-position to group items on same line
    const y = Math.round(item.transform[5]);

    if (!lines.has(y)) {
      lines.set(y, []);
    }
    lines.get(y)!.push(item);
  }

  // Sort lines by y-position (top to bottom)
  const sortedLines = [...lines.entries()]
    .sort(([y1], [y2]) => y2 - y1)
    .map(([, items]) => items);

  // Process each line
  const processedLines: string[] = [];

  for (const lineItems of sortedLines) {
    // Sort items within line by x-position
    const hasArabicInLine = lineItems.some(item => containsArabic(item.str));

    if (hasArabicInLine) {
      // For Arabic text, sort right-to-left
      lineItems.sort((a, b) => b.transform[4] - a.transform[4]);
    } else {
      // For English text, sort left-to-right
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);
    }

    // Combine items into line text
    const lineText = lineItems.map(item => item.str).join(' ');

    if (lineText.trim()) {
      processedLines.push(lineText.trim());
    }
  }

  return processedLines.join('\n');
}

/**
 * Handle mixed RTL/LTR content
 */
export function normalizeMixedDirectionText(text: string): string {
  const lines = text.split('\n');
  const normalizedLines: string[] = [];

  for (const line of lines) {
    if (containsArabic(line)) {
      // Add RTL mark at the beginning for proper display
      normalizedLines.push('\u200F' + line);
    } else {
      // Add LTR mark for English lines
      normalizedLines.push('\u200E' + line);
    }
  }

  return normalizedLines.join('\n');
}




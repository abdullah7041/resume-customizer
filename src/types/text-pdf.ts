export interface TextPdfRun { text: string; href?: string }
export interface TextPdfBlock { kind: 'title' | 'heading' | 'body' | 'bullet'; runs: TextPdfRun[] }
export interface StyledPdfStyle {
  fontSize: number; lineHeight: number; color: string; bold: boolean; italic: boolean;
  align: 'left' | 'center' | 'right'; direction: 'ltr' | 'rtl'; spacingAfter: number;
  borderColor?: string;
  spacedBoundaries?: number[];
  emphasis?: Array<{ start: number; end: number; bold: boolean; italic: boolean; color: string }>;
}
export interface StyledPdfMargins { marginTop?: number; marginBottom?: number; marginSide?: number }
export interface StyledPdfSnapshot { blocks: TextPdfBlock[]; styles: StyledPdfStyle[] }
export type TextPdfBox = [number, number, number, number];
export interface TextPdfPiece { text: string; width: number; box: TextPdfBox; content: string }
export interface TextPdfPlacedPiece { piece: TextPdfPiece; x: number }
export interface TextPdfFontHook {
  font: { id: string; objectNumber: number; isAlreadyPutted: boolean };
  newObject(): number;
  putStream(options: { data: string }): void;
  out(value: string): void;
}
export interface TextPdfBidi { doBidiReorder(text: string, map: number[], levels: number[]): string }
export interface TextPdfPathCommands { commands: { command: string; args: number[] }[] }

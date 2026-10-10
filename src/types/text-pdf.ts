export interface TextPdfRun { text: string; href?: string }
export interface TextPdfBlock { kind: 'title' | 'heading' | 'body' | 'bullet'; runs: TextPdfRun[] }
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

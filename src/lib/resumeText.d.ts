export declare const inferMimeType: (input?: {
  mimeType?: string;
  fileName?: string | null;
}) => string;

export declare const extractPlainTextFromArrayBuffer: (
  arrayBuffer: ArrayBuffer,
  options?: {
    mimeType?: string;
    fileName?: string | null;
  }
) => Promise<string>;

export declare const isPdfMimeType: (mime: string) => boolean;

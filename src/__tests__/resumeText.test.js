import { deflateRawSync } from "node:zlib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.doMock(
  "pdfjs-dist/legacy/build/pdf.mjs",
  () => {
    const getPage = vi.fn(async () => ({
      getTextContent: vi.fn(async () => ({
        items: [
          { str: "Hello ", transform: [1, 0, 0, 1, 0, 100] },
          { str: "Riyadh", transform: [1, 0, 0, 1, 50, 100] }
        ]
      })),
      cleanup: vi.fn(),
    }));

    const document = {
      numPages: 1,
      getPage,
      cleanup: vi.fn(),
      destroy: vi.fn(),
    };

    return {
      getDocument: vi.fn(() => ({ promise: Promise.resolve(document) })),
      GlobalWorkerOptions: {},
    };
  },
  { virtual: true }
);

const { extractPlainTextFromArrayBuffer, inferMimeType } = await import("../lib/utils/resumeText.ts");

describe("resume text helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("infers mime type from explicit value", () => {
    expect(inferMimeType({ mimeType: "application/pdf" })).toBe("application/pdf");
  });

  it("falls back to file extension when mime type missing", () => {
    expect(inferMimeType({ fileName: "resume.DOCX" })).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("returns octet-stream when mime type unknown", () => {
    expect(inferMimeType({ fileName: "resume.unknown" })).toBe("application/octet-stream");
  });

  it("extracts text from pdf content via pdf.js", async () => {
    const buffer = new Uint8Array([1, 2, 3]).buffer;
    const text = await extractPlainTextFromArrayBuffer(buffer, { mimeType: "application/pdf" });
    expect(text).toBe("Hello Riyadh");
  });

  it("decodes utf-8 text when not a pdf", async () => {
    const encoded = new TextEncoder().encode("Résumé تجربة").buffer;
    const text = await extractPlainTextFromArrayBuffer(encoded, { mimeType: "text/plain" });
    expect(text).toBe("Résumé تجربة");
  });

  it("extracts text from docx payload", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:body>' +
      '<w:p><w:r><w:t>Senior Engineer</w:t></w:r></w:p>' +
      '<w:p><w:pPr><w:pStyle w:val="ListParagraph"/></w:pPr><w:r><w:t>Led projects</w:t></w:r></w:p>' +
      '</w:body></w:document>';

    const arrayBuffer = buildDocxArchive(xml);
    const text = await extractPlainTextFromArrayBuffer(arrayBuffer, {
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(text).toContain("Senior Engineer");
    expect(text).toContain("Led projects");
  });
});

const buildDocxArchive = (xml) => {
  const fileName = "word/document.xml";
  const textEncoder = new TextEncoder();
  const xmlBytes = textEncoder.encode(xml);
  const compressed = deflateRawSync(xmlBytes);
  const fileNameBytes = textEncoder.encode(fileName);
  const crc = crc32(xmlBytes);

  const localHeader = Buffer.alloc(30);
  let offset = 0;
  localHeader.writeUInt32LE(0x04034b50, offset);
  offset += 4;
  localHeader.writeUInt16LE(20, offset); // version needed to extract
  offset += 2;
  localHeader.writeUInt16LE(0, offset); // general purpose bit flag
  offset += 2;
  localHeader.writeUInt16LE(8, offset); // compression method (deflate)
  offset += 2;
  localHeader.writeUInt16LE(0, offset); // last mod file time
  offset += 2;
  localHeader.writeUInt16LE(0, offset); // last mod file date
  offset += 2;
  localHeader.writeUInt32LE(crc, offset); // crc-32
  offset += 4;
  localHeader.writeUInt32LE(compressed.length, offset); // compressed size
  offset += 4;
  localHeader.writeUInt32LE(xmlBytes.length, offset); // uncompressed size
  offset += 4;
  localHeader.writeUInt16LE(fileNameBytes.length, offset); // file name length
  offset += 2;
  localHeader.writeUInt16LE(0, offset); // extra field length

  const localFile = Buffer.concat([localHeader, Buffer.from(fileNameBytes), Buffer.from(compressed)]);

  const centralHeader = Buffer.alloc(46);
  offset = 0;
  centralHeader.writeUInt32LE(0x02014b50, offset);
  offset += 4;
  centralHeader.writeUInt16LE(20, offset); // version made by
  offset += 2;
  centralHeader.writeUInt16LE(20, offset); // version needed to extract
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // general purpose bit flag
  offset += 2;
  centralHeader.writeUInt16LE(8, offset); // compression method
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // last mod file time
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // last mod file date
  offset += 2;
  centralHeader.writeUInt32LE(crc, offset);
  offset += 4;
  centralHeader.writeUInt32LE(compressed.length, offset);
  offset += 4;
  centralHeader.writeUInt32LE(xmlBytes.length, offset);
  offset += 4;
  centralHeader.writeUInt16LE(fileNameBytes.length, offset);
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // extra field length
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // file comment length
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // disk number start
  offset += 2;
  centralHeader.writeUInt16LE(0, offset); // internal file attrs
  offset += 2;
  centralHeader.writeUInt32LE(0, offset); // external file attrs
  offset += 4;
  centralHeader.writeUInt32LE(0, offset); // relative offset of local header

  const centralDir = Buffer.concat([centralHeader, Buffer.from(fileNameBytes)]);

  const endRecord = Buffer.alloc(22);
  offset = 0;
  endRecord.writeUInt32LE(0x06054b50, offset);
  offset += 4;
  endRecord.writeUInt16LE(0, offset); // number of this disk
  offset += 2;
  endRecord.writeUInt16LE(0, offset); // disk where central directory starts
  offset += 2;
  endRecord.writeUInt16LE(1, offset); // number of central directory records on this disk
  offset += 2;
  endRecord.writeUInt16LE(1, offset); // total number of central directory records
  offset += 2;
  endRecord.writeUInt32LE(centralDir.length, offset); // size of central directory
  offset += 4;
  endRecord.writeUInt32LE(localFile.length, offset); // offset of start of central directory
  offset += 4;
  endRecord.writeUInt16LE(0, offset); // comment length

  const archive = Buffer.concat([localFile, centralDir, endRecord]);
  return archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength);
};

const crc32 = (bytes) => {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();




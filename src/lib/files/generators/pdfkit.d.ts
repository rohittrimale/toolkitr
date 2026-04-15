declare module "pdfkit" {
  import { Readable } from "stream";

  interface PDFDocumentOptions {
    size?: string | [number, number];
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
    info?: { Title?: string; Author?: string; Subject?: string; Keywords?: string };
    autoFirstPage?: boolean;
    compress?: boolean;
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    fontSize(size: number): this;
    font(font: string): this;
    text(text: string, options?: Record<string, unknown>): this;
    moveDown(lines?: number): this;
    addPage(options?: PDFDocumentOptions): this;
    fillColor(color: string): this;
    end(): void;
  }

  export default PDFDocument;
}

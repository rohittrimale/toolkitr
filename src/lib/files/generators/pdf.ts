import PDFDocument from "pdfkit";

export interface PdfSection {
  heading: string;
  content: string;
}

export async function generatePdf(
  title: string,
  content: string,
  sections?: PdfSection[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(24).font("Helvetica-Bold").fillColor("#2563eb").text(title, { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#666666").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(1);

    // Main content
    doc.fontSize(11).font("Helvetica").fillColor("#000000");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) {
        doc.moveDown(0.5);
        doc.fontSize(16).font("Helvetica-Bold").text(line.slice(2));
        doc.moveDown(0.3);
        doc.fontSize(11).font("Helvetica");
      } else if (line.startsWith("## ")) {
        doc.moveDown(0.3);
        doc.fontSize(14).font("Helvetica-Bold").text(line.slice(3));
        doc.moveDown(0.2);
        doc.fontSize(11).font("Helvetica");
      } else if (line.startsWith("- ")) {
        doc.text(`  • ${line.slice(2)}`, { indent: 20 });
      } else if (line.trim()) {
        doc.text(line);
      } else {
        doc.moveDown(0.3);
      }
    }

    // Sections
    if (sections) {
      for (const section of sections) {
        doc.addPage();
        doc.fontSize(18).font("Helvetica-Bold").fillColor("#1e40af").text(section.heading);
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica").fillColor("#000000");
        
        const sectionLines = section.content.split("\n");
        for (const line of sectionLines) {
          if (line.startsWith("## ")) {
            doc.moveDown(0.3);
            doc.fontSize(14).font("Helvetica-Bold").text(line.slice(3));
            doc.moveDown(0.2);
            doc.fontSize(11).font("Helvetica");
          } else if (line.startsWith("- ")) {
            doc.text(`  • ${line.slice(2)}`, { indent: 20 });
          } else if (line.trim()) {
            doc.text(line);
          } else {
            doc.moveDown(0.3);
          }
        }
      }
    }

    doc.end();
  });
}

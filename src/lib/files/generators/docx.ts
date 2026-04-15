import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from "docx";

export interface DocxSection {
  heading: string;
  content: string;
}

export interface DocxTable {
  headers: string[];
  rows: string[][];
}

export async function generateDocx(
  title: string,
  content: string,
  sections?: DocxSection[],
  table?: DocxTable
): Promise<Buffer> {
  const docParagraphs: (Paragraph | Table)[] = [];

  // Title
  docParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 36,
          color: "2563eb",
        }),
      ],
      heading: HeadingLevel.TITLE,
      spacing: { after: 400 },
    })
  );

  // Date
  docParagraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleString()}`,
          size: 20,
          color: "666666",
          italics: true,
        }),
      ],
      spacing: { after: 300 },
    })
  );

  // Main content
  if (content) {
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line.slice(2), bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 200 },
          })
        );
      } else if (line.startsWith("## ")) {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line.slice(3), bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 250, after: 150 },
          })
        );
      } else if (line.startsWith("### ")) {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line.slice(4), bold: true, size: 22 })],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );
      } else if (line.startsWith("- ")) {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${line.slice(2)}`, size: 22 })],
            spacing: { after: 50 },
            indent: { left: 360 },
          })
        );
      } else if (line.trim()) {
        docParagraphs.push(
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 100 },
          })
        );
      }
    }
  }

  // Sections
  if (sections) {
    for (const section of sections) {
      docParagraphs.push(
        new Paragraph({
          children: [new TextRun({ text: section.heading, bold: true, size: 28, color: "1e40af" })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const sectionLines = section.content.split("\n");
      for (const line of sectionLines) {
        if (line.startsWith("## ")) {
          docParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line.slice(3), bold: true, size: 24 })],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 250, after: 150 },
            })
          );
        } else if (line.startsWith("- ")) {
          docParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${line.slice(2)}`, size: 22 })],
              spacing: { after: 50 },
              indent: { left: 360 },
            })
          );
        } else if (line.trim()) {
          docParagraphs.push(
            new Paragraph({
              children: [new TextRun({ text: line, size: 22 })],
              spacing: { after: 100 },
            })
          );
        }
      }
    }
  }

  // Table
  if (table && table.headers.length > 0) {
    docParagraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "Data Table", bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const headerRow = new TableRow({
      children: table.headers.map(
        (header) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: header, bold: true, size: 20, color: "ffffff" })],
                alignment: AlignmentType.CENTER,
              }),
            ],
            shading: { fill: "2563eb" },
            width: { size: Math.floor(9000 / table.headers.length), type: WidthType.DXA },
          })
      ),
    });

    const dataRows = table.rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: String(cell), size: 20 })],
                  }),
                ],
                width: { size: Math.floor(9000 / table.headers.length), type: WidthType.DXA },
              })
          ),
        })
    );

    docParagraphs.push(
      new Table({
        rows: [headerRow, ...dataRows],
        width: { size: 9000, type: WidthType.DXA },
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docParagraphs as Paragraph[],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

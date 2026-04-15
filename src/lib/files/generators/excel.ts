import ExcelJS from "exceljs";

export interface ExcelSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export async function generateExcel(
  title: string,
  sheets: ExcelSheet[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AI Copilot";
  workbook.created = new Date();

  // Add summary sheet
  const summarySheet = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: "2563EB" } },
  });

  summarySheet.mergeCells("A1:E1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 18, color: { argb: "2563EB" } };
  titleCell.alignment = { horizontal: "center" };

  summarySheet.mergeCells("A2:E2");
  const dateCell = summarySheet.getCell("A2");
  dateCell.value = `Generated: ${new Date().toLocaleString()}`;
  dateCell.font = { italic: true, size: 11, color: { argb: "666666" } };
  dateCell.alignment = { horizontal: "center" };

  summarySheet.getCell("A4").value = "Sheet";
  summarySheet.getCell("B4").value = "Records";
  summarySheet.getCell("A4").font = { bold: true };
  summarySheet.getCell("B4").font = { bold: true };

  sheets.forEach((sheet, idx) => {
    summarySheet.getCell(`A${5 + idx}`).value = sheet.name;
    summarySheet.getCell(`B${5 + idx}`).value = sheet.rows.length;
  });

  // Add data sheets
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name, {
      properties: { tabColor: { argb: "2563EB" } },
    });

    // Add title row
    ws.mergeCells(`A1:${String.fromCharCode(64 + sheet.headers.length)}1`);
    const sheetTitle = ws.getCell("A1");
    sheetTitle.value = sheet.name;
    sheetTitle.font = { bold: true, size: 14, color: { argb: "2563EB" } };

    // Add headers (row 3)
    sheet.headers.forEach((header, idx) => {
      const cell = ws.getCell(3, idx + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "2563EB" } };
      cell.alignment = { horizontal: "center" };
      cell.border = {
        top: { style: "thin" as ExcelJS.BorderStyle },
        left: { style: "thin" as ExcelJS.BorderStyle },
        bottom: { style: "thin" as ExcelJS.BorderStyle },
        right: { style: "thin" as ExcelJS.BorderStyle },
      };
    });

    // Add data rows
    sheet.rows.forEach((row, rowIdx) => {
      row.forEach((cellValue, colIdx) => {
        const cell = ws.getCell(4 + rowIdx, colIdx + 1);
        cell.value = cellValue;
        cell.border = {
          top: { style: "thin" as ExcelJS.BorderStyle },
          left: { style: "thin" as ExcelJS.BorderStyle },
          bottom: { style: "thin" as ExcelJS.BorderStyle },
          right: { style: "thin" as ExcelJS.BorderStyle },
        };
        if (rowIdx % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3F4F6" } };
        }
      });
    });

    // Auto-fit columns
    sheet.headers.forEach((_, idx) => {
      ws.getColumn(idx + 1).width = 20;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

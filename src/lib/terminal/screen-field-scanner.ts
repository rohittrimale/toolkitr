/**
 * Screen Field Scanner - detects input fields on TN3270 screens
 */

export interface ScannedField {
  label: string;
  value: string;
  row: number;
  col: number;
  width: number;
}

export interface ScannedScreen {
  title: string;
  commandField: ScannedField | null;
  fields: ScannedField[];
}

export function scanScreen(cells: any[], rows: number, cols: number): ScannedScreen {
  const grid: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = cells[r * cols + c];
      const ch = cell && !cell.isAttr ? cell.char || " " : " ";
      row.push(ch);
    }
    grid.push(row);
  }
  const screenText = grid.map((row) => row.join(""));

  const screenTitle = (screenText[2] || "").trim().replace(/\s+/g, " ");

  let commandField: ScannedField | null = null;
  for (let r = 0; r < rows; r++) {
    const idx = screenText[r].indexOf("===>");
    if (idx !== -1) {
      const inputStart = idx + 4;
      let inputValue = "";
      for (let c = inputStart; c < cols && c < screenText[r].length; c++) {
        inputValue += screenText[r][c];
      }
      commandField = {
        label: "Command",
        value: inputValue.trim(),
        row: r,
        col: inputStart,
        width: cols - inputStart,
      };
      break;
    }
  }

  const fields: ScannedField[] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (screenText[r][c] === "_" || screenText[r][c] === "\u2588") {
        const startCol = c;
        let value = "";
        while (c < cols && (screenText[r][c] === "_" || screenText[r][c] === "\u2588" || screenText[r][c] !== " ")) {
          value += screenText[r][c] === "_" ? " " : screenText[r][c];
          c++;
          if (c >= cols || screenText[r][c] === " ") break;
        }
        let label = "";
        for (let lc = startCol - 1; lc >= 0 && lc > startCol - 30; lc--) {
          if (screenText[r][lc] === " " && label.length > 0) break;
          label = screenText[r][lc] + label;
        }
        fields.push({
          label: label.trim() || `Field at (${r},${startCol})`,
          value: value.trim(),
          row: r,
          col: startCol,
          width: c - startCol,
        });
      }
      c++;
    }
  }

  return { title: screenTitle, commandField, fields };
}

export function formatFieldMap(scanned: ScannedScreen): string {
  const lines: string[] = [];
  if (scanned.commandField) {
    lines.push(`Command: "${scanned.commandField.value}"`);
  }
  for (const f of scanned.fields) {
    lines.push(`${f.label}: "${f.value}" (row ${f.row}, col ${f.col})`);
  }
  return lines.join("\n");
}

import ExcelJS from 'exceljs';
import type { Sheet, CellStyle } from '../types/spreadsheet';
import { cellAddressToCoords, colToLetter } from './cellUtils';

function applyStyleToCell(cell: ExcelJS.Cell, style: CellStyle) {
  const font: Partial<ExcelJS.Font> = {};
  if (style.bold) font.bold = true;
  if (style.italic) font.italic = true;
  if (style.underline) font.underline = true;
  if (style.fontSize) font.size = style.fontSize;
  if (style.fontColor) {
    font.color = { argb: style.fontColor.replace('#', 'FF') };
  }
  if (Object.keys(font).length > 0) {
    cell.font = font;
  }

  if (style.backgroundColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: style.backgroundColor.replace('#', 'FF') },
    };
  }

  const alignment: Partial<ExcelJS.Alignment> = {};
  if (style.align) alignment.horizontal = style.align;
  if (style.verticalAlign) alignment.vertical = style.verticalAlign;
  if (Object.keys(alignment).length > 0) {
    cell.alignment = alignment;
  }

  if (style.border) {
    const border: Partial<ExcelJS.Borders> = {};
    const parseSide = (side: { style: string; color?: string } | undefined) => {
      if (!side) return undefined;
      const result: Partial<ExcelJS.Border> = {
        style: side.style as ExcelJS.BorderStyle,
      };
      if (side.color) {
        result.color = { argb: side.color.replace('#', 'FF') };
      }
      return result;
    };
    if (style.border.top) border.top = parseSide(style.border.top);
    if (style.border.right) border.right = parseSide(style.border.right);
    if (style.border.bottom) border.bottom = parseSide(style.border.bottom);
    if (style.border.left) border.left = parseSide(style.border.left);
    cell.border = border;
  }
}

export async function exportToXlsx(sheets: Sheet[], filename: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    // Set column widths
    for (const [colIndex, width] of Object.entries(sheet.columnWidths)) {
      const col = worksheet.getColumn(parseInt(colIndex, 10) + 1);
      col.width = width / 7;
    }

    // Export all cells
    const cellEntries = Object.entries(sheet.cells);
    for (const [address, cellData] of cellEntries) {
      if (cellData.value === '' || cellData.value === undefined || cellData.value === null) {
        continue; // Skip empty cells
      }
      const { row, col } = cellAddressToCoords(address);
      const cell = worksheet.getCell(row + 1, col + 1);

      cell.value = cellData.value;
      if (cellData.style) {
        applyStyleToCell(cell, cellData.style);
      }
      if (cellData.comment) {
        cell.note = cellData.comment.text;
      }
    }

    // Apply merged cells
    for (const merged of sheet.mergedCells) {
      const startAddr = `${colToLetter(merged.startCol)}${merged.startRow + 1}`;
      const endAddr = `${colToLetter(merged.endCol)}${merged.endRow + 1}`;
      try {
        worksheet.mergeCells(`${startAddr}:${endAddr}`);
      } catch {
        // Ignore merge errors for overlapping regions
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename);
}

export function exportToCsv(sheet: Sheet, filename: string): void {
  const rows: string[][] = [];

  for (let r = 0; r < sheet.dimensions.rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < sheet.dimensions.cols; c++) {
      const address = `${colToLetter(c)}${r + 1}`;
      const cellData = sheet.cells[address];
      const value = cellData?.value ?? '';
      const strValue = String(value);
      if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
        row.push(`"${strValue.replace(/"/g, '""')}"`);
      } else {
        row.push(strValue);
      }
    }
    if (row.some((cell) => cell !== '')) {
      rows.push(row);
    }
  }

  const csv = rows.map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

export function exportToJson(sheets: Sheet[], filename: string): void {
  const data = sheets.map((sheet) => ({
    name: sheet.name,
    cells: Object.entries(sheet.cells).map(([address, cellData]) => ({
      address,
      value: cellData.value,
      formula: cellData.formula,
    })),
    mergedCells: sheet.mergedCells,
    dimensions: sheet.dimensions,
  }));

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

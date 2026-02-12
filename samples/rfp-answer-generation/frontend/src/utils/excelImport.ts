import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { Sheet, CellData, CellStyle, CellComment, MergedCell, BorderStyle } from '../types/spreadsheet';
import { coordsToCellAddress } from './cellUtils';

/**
 * Convert plain text comment format to rich text format.
 * openpyxl generates: <text><t>content</t></text>
 * ExcelJS expects:    <text><r><t>content</t></r></text>
 */
function fixCommentTextFormat(xmlContent: string): string {
  // Match <text> elements that contain <t> directly (without <r> wrapper)
  // We need to wrap <t>...</t> with <r>...</r>
  return xmlContent.replace(
    /<text>(\s*)<t([^>]*)>([\s\S]*?)<\/t>(\s*)<\/text>/g,
    '<text>$1<r><t$2>$3</t></r>$4</text>'
  );
}

/**
 * Pre-process an Excel file to fix compatibility issues with non-standard xlsx files.
 * Some libraries (e.g., openpyxl) generate files with:
 * 1. Non-standard relationship IDs like "comments" instead of "rId2"
 * 2. Absolute paths in Target attributes instead of relative paths
 * 3. Comments in non-standard locations (xl/comments/comment1.xml vs xl/comments1.xml)
 * 4. Plain text comments instead of rich text format
 * ExcelJS crashes when encountering these non-standard formats.
 */
async function fixNonStandardExcel(arrayBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  let modified = false;

  // Fix 3: Move comments from xl/comments/commentN.xml to xl/commentsN.xml
  // ExcelJS expects comments at xl/comments1.xml, not xl/comments/comment1.xml
  const commentFiles = Object.keys(zip.files).filter(name =>
    /^xl\/comments\/comment\d+\.xml$/.test(name)
  );

  const commentMoves: Record<string, string> = {};
  for (const oldPath of commentFiles) {
    const match = oldPath.match(/comment(\d+)\.xml$/);
    if (match) {
      const newPath = `xl/comments${match[1]}.xml`;
      let content = await zip.file(oldPath)?.async('string');
      if (content) {
        // Fix 4: Convert plain text comments to rich text format
        // openpyxl generates: <text><t>content</t></text>
        // ExcelJS expects:    <text><r><t>content</t></r></text>
        content = fixCommentTextFormat(content);
        zip.file(newPath, content);
        zip.remove(oldPath);
        commentMoves[oldPath] = newPath;
        modified = true;
      }
    }
  }

  // Also fix comments that are already in the standard location
  const standardCommentFiles = Object.keys(zip.files).filter(name =>
    /^xl\/comments\d+\.xml$/.test(name)
  );
  for (const commentFile of standardCommentFiles) {
    const content = await zip.file(commentFile)?.async('string');
    if (content) {
      const fixedContent = fixCommentTextFormat(content);
      if (fixedContent !== content) {
        zip.file(commentFile, fixedContent);
        modified = true;
      }
    }
  }

  // Similarly fix VML drawings path: xl/drawings/commentsDrawingN.vml -> xl/drawings/vmlDrawingN.vml
  const vmlFiles = Object.keys(zip.files).filter(name =>
    /^xl\/drawings\/commentsDrawing\d+\.vml$/.test(name)
  );

  const vmlMoves: Record<string, string> = {};
  for (const oldPath of vmlFiles) {
    const match = oldPath.match(/commentsDrawing(\d+)\.vml$/);
    if (match) {
      const newPath = `xl/drawings/vmlDrawing${match[1]}.vml`;
      const content = await zip.file(oldPath)?.async('string');
      if (content) {
        zip.file(newPath, content);
        zip.remove(oldPath);
        vmlMoves[oldPath] = newPath;
        modified = true;
      }
    }
  }

  // Find all .rels files in the archive
  const relsFiles = Object.keys(zip.files).filter(name => name.endsWith('.rels'));

  for (const relsFile of relsFiles) {
    const content = await zip.file(relsFile)?.async('string');
    if (!content) continue;

    let fixedContent = content;
    let fileModified = false;

    // Fix 1: Convert absolute Target paths to relative paths and update moved file paths
    if (relsFile.includes('worksheets/_rels/')) {
      // Handle absolute paths like Target="/xl/comments/comment1.xml"
      // Convert to relative: Target="../comments1.xml" (after the file was moved)
      fixedContent = fixedContent.replace(
        /Target="\/xl\/comments\/comment(\d+)\.xml"/g,
        'Target="../comments$1.xml"'
      );

      fixedContent = fixedContent.replace(
        /Target="\/xl\/drawings\/commentsDrawing(\d+)\.vml"/g,
        'Target="../drawings/vmlDrawing$1.vml"'
      );

      // Also handle already-relative but wrong paths
      fixedContent = fixedContent.replace(
        /Target="\.\.\/comments\/comment(\d+)\.xml"/g,
        'Target="../comments$1.xml"'
      );

      fixedContent = fixedContent.replace(
        /Target="\.\.\/drawings\/commentsDrawing(\d+)\.vml"/g,
        'Target="../drawings/vmlDrawing$1.vml"'
      );

      if (fixedContent !== content) {
        fileModified = true;
      }
    }

    // Fix 2: Check for non-standard relationship IDs (not matching rIdN pattern)
    const idPattern = /Id="([^"]+)"/g;
    let match;
    let hasNonStandardIds = false;
    const ids: string[] = [];

    while ((match = idPattern.exec(fixedContent)) !== null) {
      ids.push(match[1]);
      if (!/^rId\d+$/.test(match[1])) {
        hasNonStandardIds = true;
      }
    }

    if (hasNonStandardIds) {
      // Find the highest existing rId number to avoid conflicts
      let maxId = 0;
      for (const id of ids) {
        const idMatch = id.match(/^rId(\d+)$/);
        if (idMatch) {
          maxId = Math.max(maxId, parseInt(idMatch[1], 10));
        }
      }

      // Replace non-standard IDs with standard ones
      for (const id of ids) {
        if (!/^rId\d+$/.test(id)) {
          maxId++;
          const newId = `rId${maxId}`;
          // Use a regex that matches the exact Id attribute
          fixedContent = fixedContent.replace(
            new RegExp(`Id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
            `Id="${newId}"`
          );
        }
      }
      fileModified = true;
    }

    if (fileModified) {
      zip.file(relsFile, fixedContent);
      modified = true;
    }
  }

  if (modified) {
    return await zip.generateAsync({ type: 'arraybuffer' });
  }

  return arrayBuffer;
}

function parseColor(color: Partial<ExcelJS.Color> | undefined): string | undefined {
  if (!color) return undefined;
  if (color.argb) {
    const argb = color.argb;
    if (argb.length === 8) {
      return `#${argb.substring(2)}`;
    }
    return `#${argb}`;
  }
  if (color.theme !== undefined) {
    const themeColors: Record<number, string> = {
      0: '#FFFFFF',
      1: '#000000',
      2: '#E7E6E6',
      3: '#44546A',
      4: '#4472C4',
      5: '#ED7D31',
      6: '#A5A5A5',
      7: '#FFC000',
      8: '#5B9BD5',
      9: '#70AD47',
    };
    return themeColors[color.theme] || undefined;
  }
  return undefined;
}

function parseBorder(border: Partial<ExcelJS.Borders> | undefined): BorderStyle | undefined {
  if (!border) return undefined;

  const result: BorderStyle = {};
  const parseSide = (side: Partial<ExcelJS.Border> | undefined) => {
    if (!side || !side.style) return undefined;
    return {
      style: side.style,
      color: parseColor(side.color),
    };
  };

  if (border.top) result.top = parseSide(border.top);
  if (border.right) result.right = parseSide(border.right);
  if (border.bottom) result.bottom = parseSide(border.bottom);
  if (border.left) result.left = parseSide(border.left);

  if (Object.keys(result).length === 0) return undefined;
  return result;
}

function parseCellStyle(cell: ExcelJS.Cell): CellStyle | undefined {
  const style: CellStyle = {};

  if (cell.font) {
    if (cell.font.bold) style.bold = true;
    if (cell.font.italic) style.italic = true;
    if (cell.font.underline) style.underline = true;
    if (cell.font.size) style.fontSize = cell.font.size;
    const fontColor = parseColor(cell.font.color);
    if (fontColor) style.fontColor = fontColor;
  }

  if (cell.fill && cell.fill.type === 'pattern') {
    const patternFill = cell.fill as ExcelJS.FillPattern;
    const bgColor = parseColor(patternFill.fgColor);
    if (bgColor) style.backgroundColor = bgColor;
  }

  if (cell.alignment) {
    if (cell.alignment.horizontal) {
      const h = cell.alignment.horizontal;
      if (h === 'left' || h === 'center' || h === 'right') {
        style.align = h;
      }
    }
    if (cell.alignment.vertical) {
      const v = cell.alignment.vertical;
      if (v === 'top' || v === 'middle' || v === 'bottom') {
        style.verticalAlign = v;
      }
    }
  }

  const border = parseBorder(cell.border);
  if (border) style.border = border;

  if (Object.keys(style).length === 0) return undefined;
  return style;
}

function getCellValue(cell: ExcelJS.Cell): string | number {
  const value = cell.value;

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : value;
  }

  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  if (typeof value === 'object') {
    // Formula with result
    if ('result' in value && value.result !== undefined && value.result !== null) {
      const result = value.result;
      if (result instanceof Date) return result.toLocaleDateString();
      if (typeof result === 'number') return result;
      return String(result);
    }
    // Formula without result - formulas are not evaluated, show empty
    if ('formula' in value) {
      return '';
    }
    if ('richText' in value) {
      return value.richText.map((rt) => rt.text).join('');
    }
    if ('text' in value) {
      return value.text;
    }
    if ('error' in value) {
      return String(value.error);
    }
  }

  return String(value);
}

function parseComment(cell: ExcelJS.Cell): CellComment | undefined {
  const note = cell.note;
  if (!note) return undefined;

  // Simple string comment
  if (typeof note === 'string') {
    return { text: note };
  }

  // Rich text comment object
  if (note && typeof note === 'object' && 'texts' in note && Array.isArray(note.texts)) {
    const text = note.texts.map((t: { text: string }) => t.text).join('');
    if (text) {
      return { text };
    }
  }

  return undefined;
}

export async function importExcelFile(file: File): Promise<Sheet[]> {
  const arrayBuffer = await file.arrayBuffer();
  const fixedBuffer = await fixNonStandardExcel(arrayBuffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fixedBuffer);

  const sheets: Sheet[] = [];

  workbook.eachSheet((worksheet) => {
    const cells: Record<string, CellData> = {};
    const mergedCells: MergedCell[] = [];
    const columnWidths: Record<number, number> = {};
    const rowHeights: Record<number, number> = {};

    let maxRow = 0;
    let maxCol = 0;

    worksheet.columns.forEach((col, index) => {
      if (col.width) {
        columnWidths[index] = col.width * 7;
      }
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (row.height) {
        rowHeights[rowNumber - 1] = row.height;
      }
      maxRow = Math.max(maxRow, rowNumber);

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        maxCol = Math.max(maxCol, colNumber);
        const address = coordsToCellAddress(rowNumber - 1, colNumber - 1);
        const value = getCellValue(cell);
        const style = parseCellStyle(cell);

        const comment = parseComment(cell);

        const cellData: CellData = { value };
        if (cell.formula) {
          cellData.formula = cell.formula;
        }
        if (style) {
          cellData.style = style;
        }
        if (comment) {
          cellData.comment = comment;
        }

        cells[address] = cellData;
      });
    });

    const merges = worksheet.model.merges || [];
    for (const merge of merges) {
      const [start, end] = merge.split(':');
      const startMatch = start.match(/^([A-Z]+)(\d+)$/);
      const endMatch = end.match(/^([A-Z]+)(\d+)$/);

      if (startMatch && endMatch) {
        const startCol = letterToColNumber(startMatch[1]);
        const startRow = parseInt(startMatch[2], 10) - 1;
        const endCol = letterToColNumber(endMatch[1]);
        const endRow = parseInt(endMatch[2], 10) - 1;

        mergedCells.push({
          startRow,
          startCol,
          endRow,
          endCol,
        });
      }
    }

    sheets.push({
      name: worksheet.name,
      cells,
      mergedCells,
      columnWidths,
      rowHeights,
      dimensions: {
        rows: Math.max(maxRow, 50),
        cols: Math.max(maxCol, 26),
      },
    });
  });

  return sheets;
}

function letterToColNumber(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

export interface DownloadProgress {
  loaded: number;
  total: number | null;
  percent: number | null;
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Fetch a URL with download progress tracking
 */
async function fetchWithProgress(url: string, onProgress?: ProgressCallback): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Excel file: ${response.status} ${response.statusText}`);
  }

  // Get total size from Content-Length header (may be null for some responses)
  const contentLength = response.headers.get('Content-Length');
  const total = contentLength ? parseInt(contentLength, 10) : null;

  // If no body or no progress callback, use simple arrayBuffer()
  if (!response.body || !onProgress) {
    return response.arrayBuffer();
  }

  // Read the stream and track progress
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    onProgress({
      loaded,
      total,
      percent: total ? Math.round((loaded / total) * 100) : null,
    });
  }

  // Combine chunks into a single ArrayBuffer
  const result = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

/**
 * Import an Excel file from a URL (e.g., S3 pre-signed URL)
 */
export async function importExcelFromUrl(url: string, onProgress?: ProgressCallback): Promise<Sheet[]> {
  const arrayBuffer = await fetchWithProgress(url, onProgress);
  const fixedBuffer = await fixNonStandardExcel(arrayBuffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fixedBuffer);

  const sheets: Sheet[] = [];

  workbook.eachSheet((worksheet) => {
    const cells: Record<string, CellData> = {};
    const mergedCells: MergedCell[] = [];
    const columnWidths: Record<number, number> = {};
    const rowHeights: Record<number, number> = {};

    let maxRow = 0;
    let maxCol = 0;

    worksheet.columns.forEach((col, index) => {
      if (col.width) {
        columnWidths[index] = col.width * 7;
      }
    });

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (row.height) {
        rowHeights[rowNumber - 1] = row.height;
      }
      maxRow = Math.max(maxRow, rowNumber);

      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        maxCol = Math.max(maxCol, colNumber);
        const address = coordsToCellAddress(rowNumber - 1, colNumber - 1);
        const value = getCellValue(cell);
        const style = parseCellStyle(cell);

        const comment = parseComment(cell);

        const cellData: CellData = { value };
        if (cell.formula) {
          cellData.formula = cell.formula;
        }
        if (style) {
          cellData.style = style;
        }
        if (comment) {
          cellData.comment = comment;
        }

        cells[address] = cellData;
      });
    });

    const merges = worksheet.model.merges || [];
    for (const merge of merges) {
      const [start, end] = merge.split(':');
      const startMatch = start.match(/^([A-Z]+)(\d+)$/);
      const endMatch = end.match(/^([A-Z]+)(\d+)$/);

      if (startMatch && endMatch) {
        const startCol = letterToColNumber(startMatch[1]);
        const startRow = parseInt(startMatch[2], 10) - 1;
        const endCol = letterToColNumber(endMatch[1]);
        const endRow = parseInt(endMatch[2], 10) - 1;

        mergedCells.push({
          startRow,
          startCol,
          endRow,
          endCol,
        });
      }
    }

    sheets.push({
      name: worksheet.name,
      cells,
      mergedCells,
      columnWidths,
      rowHeights,
      dimensions: {
        rows: Math.max(maxRow, 50),
        cols: Math.max(maxCol, 26),
      },
    });
  });

  return sheets;
}

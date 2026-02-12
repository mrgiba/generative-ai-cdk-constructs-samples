export interface BorderStyle {
  top?: { style: string; color?: string };
  right?: { style: string; color?: string };
  bottom?: { style: string; color?: string };
  left?: { style: string; color?: string };
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  border?: BorderStyle;
}

export interface CellComment {
  text: string;
  author?: string;
}

export interface CellData {
  value: string | number;
  formula?: string;
  style?: CellStyle;
  comment?: CellComment;
}

export interface MergedCell {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface Sheet {
  name: string;
  cells: Record<string, CellData>;
  mergedCells: MergedCell[];
  columnWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  dimensions: { rows: number; cols: number };
}

export interface SpreadsheetSettings {
  /** How to trigger comment/note display: 'hover' or 'click' */
  commentTrigger: 'hover' | 'click';
}

export interface SpreadsheetState {
  filename: string;
  sheets: Sheet[];
  activeSheetIndex: number;
  selectedCell: string | null;
  editingCell: string | null;
  settings: SpreadsheetSettings;
  /** Whether the spreadsheet has been edited since loading */
  isDirty: boolean;
  /** Original sheets state for reset functionality */
  originalSheets: Sheet[] | null;
}

export type SpreadsheetAction =
  | { type: 'SET_CELL'; sheetIndex: number; cellAddress: string; data: CellData }
  | { type: 'SELECT_CELL'; cellAddress: string | null }
  | { type: 'START_EDITING'; cellAddress: string }
  | { type: 'STOP_EDITING' }
  | { type: 'SET_ACTIVE_SHEET'; index: number }
  | { type: 'LOAD_WORKBOOK'; sheets: Sheet[] }
  | { type: 'SET_FILENAME'; filename: string }
  | { type: 'CLEAR' }
  | { type: 'EXPAND_GRID'; sheetIndex: number; rows: number; cols: number }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<SpreadsheetSettings> }
  | { type: 'RESET_CHANGES' };

import { createContext, useReducer, type ReactNode } from 'react';
import type { SpreadsheetState, SpreadsheetAction, Sheet, CellData } from '../types/spreadsheet';

function createEmptySheet(name: string = 'Sheet1'): Sheet {
  return {
    name,
    cells: {},
    mergedCells: [],
    columnWidths: {},
    rowHeights: {},
    dimensions: { rows: 50, cols: 26 },
  };
}

const initialState: SpreadsheetState = {
  filename: "",
  sheets: [createEmptySheet()],
  activeSheetIndex: 0,
  selectedCell: null,
  editingCell: null,
  settings: {
    commentTrigger: 'hover',
  },
  isDirty: false,
  originalSheets: null,
};

function spreadsheetReducer(
  state: SpreadsheetState,
  action: SpreadsheetAction
): SpreadsheetState {
  switch (action.type) {
    case 'SET_CELL': {
      const newSheets = [...state.sheets];
      const sheet = { ...newSheets[action.sheetIndex] };
      sheet.cells = { ...sheet.cells, [action.cellAddress]: action.data };
      newSheets[action.sheetIndex] = sheet;
      return { ...state, sheets: newSheets, isDirty: true };
    }
    case 'SELECT_CELL':
      return { ...state, selectedCell: action.cellAddress };
    case 'START_EDITING':
      return { ...state, editingCell: action.cellAddress };
    case 'STOP_EDITING':
      return { ...state, editingCell: null };
    case 'SET_ACTIVE_SHEET':
      return {
        ...state,
        activeSheetIndex: action.index,
        selectedCell: null,
        editingCell: null,
      };
    case 'LOAD_WORKBOOK':
      return {
        ...state,
        sheets: action.sheets,
        originalSheets: JSON.parse(JSON.stringify(action.sheets)), // Deep clone for reset
        activeSheetIndex: 0,
        selectedCell: null,
        editingCell: null,
        isDirty: false,
      };
    case 'SET_FILENAME':
      return {
        ...state,
        filename: action.filename
      };
    case 'CLEAR':
      return initialState;
    case 'EXPAND_GRID': {
      const newSheets = [...state.sheets];
      const sheet = { ...newSheets[action.sheetIndex] };
      sheet.dimensions = {
        rows: Math.max(sheet.dimensions.rows, action.rows),
        cols: Math.max(sheet.dimensions.cols, action.cols),
      };
      newSheets[action.sheetIndex] = sheet;
      return { ...state, sheets: newSheets };
    }
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: { ...state.settings, ...action.settings },
      };
    case 'RESET_CHANGES':
      if (!state.originalSheets) return state;
      return {
        ...state,
        sheets: JSON.parse(JSON.stringify(state.originalSheets)), // Deep clone
        activeSheetIndex: 0,
        selectedCell: null,
        editingCell: null,
        isDirty: false,
      };
    default:
      return state;
  }
}

interface SpreadsheetContextValue {
  state: SpreadsheetState;
  dispatch: React.Dispatch<SpreadsheetAction>;
  activeSheet: Sheet;
  setCell: (address: string, data: CellData) => void;
  selectCell: (address: string | null) => void;
  startEditing: (address: string) => void;
  stopEditing: () => void;
  setActiveSheet: (index: number) => void;
  loadWorkbook: (sheets: Sheet[]) => void;
  setFilename: (filename: string) => void;
  clear: () => void;
  expandGrid: (rows: number, cols: number) => void;
  resetChanges: () => void;
}

export const SpreadsheetContext = createContext<SpreadsheetContextValue | null>(null);

interface SpreadsheetProviderProps {
  children: ReactNode;
}

export function SpreadsheetProvider({ children }: SpreadsheetProviderProps) {
  const [state, dispatch] = useReducer(spreadsheetReducer, initialState);

  const activeSheet = state.sheets[state.activeSheetIndex];

  const value: SpreadsheetContextValue = {
    state,
    dispatch,
    activeSheet,
    setCell: (address, data) =>
      dispatch({ type: 'SET_CELL', sheetIndex: state.activeSheetIndex, cellAddress: address, data }),
    selectCell: (address) => dispatch({ type: 'SELECT_CELL', cellAddress: address }),
    startEditing: (address) => dispatch({ type: 'START_EDITING', cellAddress: address }),
    stopEditing: () => dispatch({ type: 'STOP_EDITING' }),
    setActiveSheet: (index) => dispatch({ type: 'SET_ACTIVE_SHEET', index }),
    loadWorkbook: (sheets) => dispatch({ type: 'LOAD_WORKBOOK', sheets }),
    setFilename: (filename) => dispatch({ type: 'SET_FILENAME', filename }),
    clear: () => dispatch({ type: 'CLEAR' }),
    expandGrid: (rows, cols) =>
      dispatch({ type: 'EXPAND_GRID', sheetIndex: state.activeSheetIndex, rows, cols }),
    resetChanges: () => dispatch({ type: 'RESET_CHANGES' }),
  };

  return (
    <SpreadsheetContext.Provider value={value}>{children}</SpreadsheetContext.Provider>
  );
}

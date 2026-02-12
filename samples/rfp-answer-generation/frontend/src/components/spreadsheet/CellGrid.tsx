import { useCallback, useRef, useEffect, useState, useMemo, type CSSProperties, memo } from 'react';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import {
  coordsToCellAddress,
  cellAddressToCoords,
  colToLetter,
  isCellInMergedRegion,
  getMergedCellSpan,
} from '../../utils/cellUtils';
import type { CellData, CellStyle } from '../../types/spreadsheet';
import { Input } from '../ui/input';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '../ui/context-menu';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '../ui/empty';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '../ui/hover-card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

function styleToCSS(style: CellStyle | undefined): CSSProperties {
  if (!style) return {};

  const css: CSSProperties = {};

  if (style.bold) css.fontWeight = 'bold';
  if (style.italic) css.fontStyle = 'italic';
  if (style.underline) css.textDecoration = 'underline';
  if (style.fontSize) css.fontSize = `${style.fontSize}pt`;
  if (style.fontColor) css.color = style.fontColor;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;

  if (style.align) css.textAlign = style.align;
  if (style.verticalAlign) css.verticalAlign = style.verticalAlign;

  if (style.border) {
    if (style.border.top) {
      css.borderTop = `1px ${style.border.top.style} ${style.border.top.color || '#000'}`;
    }
    if (style.border.right) {
      css.borderRight = `1px ${style.border.right.style} ${style.border.right.color || '#000'}`;
    }
    if (style.border.bottom) {
      css.borderBottom = `1px ${style.border.bottom.style} ${style.border.bottom.color || '#000'}`;
    }
    if (style.border.left) {
      css.borderLeft = `1px ${style.border.left.style} ${style.border.left.color || '#000'}`;
    }
  }

  return css;
}

// CommentHoverCard component with copy-to-clipboard functionality
const CommentHoverCard = memo(function CommentHoverCard({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy comment:', err);
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className="absolute top-0 right-0 w-0 h-0 border-t-[8px] border-t-orange-500 border-l-[8px] border-l-transparent cursor-pointer z-10"
        />
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-3" side="top" align="end">
        <p className="text-sm whitespace-pre-wrap">{text}</p>
        <div className="flex justify-end mt-2">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="Copy comment"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{copied ? 'Copied!' : 'Copy to clipboard'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
});

type SelectionMode = 'cell' | 'row' | 'column' | 'range';

interface SelectionState {
  mode: SelectionMode;
  startCell: string | null;
  endCell: string | null;
  selectedRows: Set<number>;
  selectedCols: Set<number>;
}

interface CellProps {
  address: string;
  data: CellData | undefined;
  isPrimary: boolean;
  isInRange: boolean;
  isEditing: boolean;
  showBorderTop: boolean;
  showBorderBottom: boolean;
  showBorderLeft: boolean;
  showBorderRight: boolean;
  rowSpan?: number;
  colSpan?: number;
  width?: number;
  height?: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onStartEditing: () => void;
  onStopEditing: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

const Cell = memo(function Cell({
  data,
  isPrimary,
  isInRange,
  isEditing,
  showBorderTop,
  showBorderBottom,
  showBorderLeft,
  showBorderRight,
  rowSpan,
  colSpan,
  width,
  height,
  onMouseDown,
  onMouseEnter,
  onStartEditing,
  onStopEditing,
  onKeyDown,
}: CellProps) {
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      setEditValue(String(data?.value ?? ''));
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, data?.value]);

  const handleBlur = () => {
    onStopEditing(editValue);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onStopEditing(editValue);
      onKeyDown(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(String(data?.value ?? ''));
      onStopEditing(String(data?.value ?? ''));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onStopEditing(editValue);
      onKeyDown(e);
    }
  };

  const cellStyle: CSSProperties = {
    ...styleToCSS(data?.style),
    minWidth: width ?? 80,
    minHeight: height ?? 24,
    maxWidth: width ?? 80,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    padding: '2px 4px',
    boxSizing: 'border-box',
    borderRight: data?.style?.border?.right ? undefined : '1px solid hsl(var(--border))',
    borderBottom: data?.style?.border?.bottom ? undefined : '1px solid hsl(var(--border))',
    position: 'relative',
    cursor: 'cell',
  };

  // Selection border style (blue outline around selection)
  const selectionBorderStyle: CSSProperties = isInRange ? {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    borderTop: showBorderTop ? '2px solid rgb(37, 99, 235)' : undefined,
    borderBottom: showBorderBottom ? '2px solid rgb(37, 99, 235)' : undefined,
    borderLeft: showBorderLeft ? '2px solid rgb(37, 99, 235)' : undefined,
    borderRight: showBorderRight ? '2px solid rgb(37, 99, 235)' : undefined,
  } : {};

  if (isEditing) {
    return (
      <td
        style={cellStyle}
        rowSpan={rowSpan}
        colSpan={colSpan}
        className="z-10"
        onMouseDown={onMouseDown}
      >
        <div className="absolute inset-0 ring-2 ring-primary pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
          className="w-full h-full border-none p-0 text-sm rounded-none focus-visible:ring-0"
        />
      </td>
    );
  }

  return (
    <td
      style={cellStyle}
      rowSpan={rowSpan}
      colSpan={colSpan}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onDoubleClick={onStartEditing}
      onKeyDown={onKeyDown}
      tabIndex={isPrimary ? 0 : -1}
    >
      {/* Selection highlight overlay - works on top of custom backgrounds */}
      {isInRange && (
        <div
          className="absolute inset-0 pointer-events-none bg-blue-500/20"
          style={selectionBorderStyle}
        />
      )}
      {/* Primary cell indicator */}
      {isPrimary && (
        <div className="absolute inset-0 pointer-events-none ring-2 ring-primary ring-inset" />
      )}
      {/* Comment indicator */}
      {data?.comment && (
        <CommentHoverCard text={data.comment.text} />
      )}
      {data?.value ?? ''}
    </td>
  );
});

const ColumnHeader = memo(function ColumnHeader({
  col,
  width,
  isSelected,
  onMouseDown,
  onMouseEnter,
}: {
  col: number;
  width?: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
}) {
  return (
    <th
      className={cn(
        "sticky top-0 z-10 border-r border-b border-border text-center font-medium text-xs select-none cursor-pointer transition-colors",
        isSelected ? "bg-blue-200 dark:bg-blue-800 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
      style={{ minWidth: width ?? 80, maxWidth: width ?? 80, height: 24 }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      {colToLetter(col)}
    </th>
  );
});

const RowHeader = memo(function RowHeader({
  row,
  height,
  isSelected,
  onMouseDown,
  onMouseEnter,
}: {
  row: number;
  height?: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
}) {
  return (
    <th
      className={cn(
        "sticky left-0 z-5 border-r border-b border-border text-center font-medium text-xs select-none cursor-pointer transition-colors",
        isSelected ? "bg-blue-200 dark:bg-blue-800 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
      style={{ minWidth: 50, maxWidth: 50, height: height ?? 24 }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
    >
      {row + 1}
    </th>
  );
});

export function CellGrid() {
  const { state, activeSheet, setCell, selectCell, startEditing, stopEditing, expandGrid } =
    useSpreadsheet();
  const gridRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState<SelectionState>({
    mode: 'cell',
    startCell: null,
    endCell: null,
    selectedRows: new Set(),
    selectedCols: new Set(),
  });
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionType, setSelectionType] = useState<'cell' | 'row' | 'column'>('cell');

  const { dimensions, cells, mergedCells, columnWidths, rowHeights } = activeSheet;
  const { selectedCell, editingCell, activeSheetIndex } = state;

  // Reset selection when switching sheets
  useEffect(() => {
    setSelection({
      mode: 'cell',
      startCell: null,
      endCell: null,
      selectedRows: new Set(),
      selectedCols: new Set(),
    });
  }, [activeSheetIndex]);

  // Calculate selected range based on selection state
  const selectedRange = useMemo(() => {
    const range = new Set<string>();

    // Row selection
    if (selection.selectedRows.size > 0) {
      for (const row of selection.selectedRows) {
        for (let col = 0; col < dimensions.cols; col++) {
          range.add(coordsToCellAddress(row, col));
        }
      }
      return range;
    }

    // Column selection
    if (selection.selectedCols.size > 0) {
      for (const col of selection.selectedCols) {
        for (let row = 0; row < dimensions.rows; row++) {
          range.add(coordsToCellAddress(row, col));
        }
      }
      return range;
    }

    // Cell/range selection
    if (selection.startCell) {
      const start = cellAddressToCoords(selection.startCell);
      const end = selection.endCell ? cellAddressToCoords(selection.endCell) : start;
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          range.add(coordsToCellAddress(r, c));
        }
      }
    } else if (selectedCell) {
      range.add(selectedCell);
    }

    return range;
  }, [selection, selectedCell, dimensions]);

  // Get selection bounds for clipboard operations
  const getSelectionBounds = useCallback(() => {
    if (selection.selectedRows.size > 0) {
      const rows = Array.from(selection.selectedRows).sort((a, b) => a - b);
      return {
        minRow: rows[0],
        maxRow: rows[rows.length - 1],
        minCol: 0,
        maxCol: dimensions.cols - 1,
      };
    }
    if (selection.selectedCols.size > 0) {
      const cols = Array.from(selection.selectedCols).sort((a, b) => a - b);
      return {
        minRow: 0,
        maxRow: dimensions.rows - 1,
        minCol: cols[0],
        maxCol: cols[cols.length - 1],
      };
    }
    if (selection.startCell) {
      const start = cellAddressToCoords(selection.startCell);
      const end = selection.endCell ? cellAddressToCoords(selection.endCell) : start;
      return {
        minRow: Math.min(start.row, end.row),
        maxRow: Math.max(start.row, end.row),
        minCol: Math.min(start.col, end.col),
        maxCol: Math.max(start.col, end.col),
      };
    }
    if (selectedCell) {
      const { row, col } = cellAddressToCoords(selectedCell);
      return { minRow: row, maxRow: row, minCol: col, maxCol: col };
    }
    return null;
  }, [selection, selectedCell, dimensions]);

  // Clipboard operations
  const handleCopy = useCallback(async () => {
    const bounds = getSelectionBounds();
    if (!bounds) return;

    const rows: string[] = [];
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const rowData: string[] = [];
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const address = coordsToCellAddress(r, c);
        const cellData = cells[address];
        rowData.push(String(cellData?.value ?? ''));
      }
      rows.push(rowData.join('\t'));
    }
    const text = rows.join('\n');
    await navigator.clipboard.writeText(text);
  }, [getSelectionBounds, cells]);

  const handlePaste = useCallback(async () => {
    const startAddress = selection.startCell || selectedCell;
    if (!startAddress) return;

    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split('\n');
      const start = cellAddressToCoords(startAddress);

      rows.forEach((row, rowOffset) => {
        const cols = row.split('\t');
        cols.forEach((value, colOffset) => {
          const address = coordsToCellAddress(start.row + rowOffset, start.col + colOffset);
          const existing = cells[address];
          setCell(address, { value: value.trim(), style: existing?.style });
        });
      });
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }, [selectedCell, selection.startCell, cells, setCell]);

  const handleCut = useCallback(async () => {
    await handleCopy();
    const bounds = getSelectionBounds();
    if (!bounds) return;

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const address = coordsToCellAddress(r, c);
        const existing = cells[address];
        setCell(address, { value: '', style: existing?.style });
      }
    }
  }, [handleCopy, getSelectionBounds, cells, setCell]);

  const handleSelectAll = useCallback(() => {
    setSelection({
      mode: 'range',
      startCell: 'A1',
      endCell: coordsToCellAddress(dimensions.rows - 1, dimensions.cols - 1),
      selectedRows: new Set(),
      selectedCols: new Set(),
    });
  }, [dimensions]);

  // Check if address is in current selection
  const isInSelection = useCallback((address: string) => {
    return selectedRange.has(address);
  }, [selectedRange]);

  // Cell selection handlers
  const handleCellMouseDown = useCallback((address: string, e: React.MouseEvent) => {
    // Right-click: if clicking within selection, don't change selection
    if (e.button === 2 && isInSelection(address)) {
      return;
    }

    if (e.shiftKey && (selectedCell || selection.startCell)) {
      const startAddr = selection.startCell || selectedCell || address;
      setSelection({
        mode: 'range',
        startCell: startAddr,
        endCell: address,
        selectedRows: new Set(),
        selectedCols: new Set(),
      });
    } else if (e.button === 0) { // Left click only
      selectCell(address);
      setSelection({
        mode: 'cell',
        startCell: address,
        endCell: null,
        selectedRows: new Set(),
        selectedCols: new Set(),
      });
      setIsSelecting(true);
      setSelectionType('cell');
    }
  }, [selectCell, selectedCell, selection.startCell, isInSelection]);

  const handleCellMouseEnter = useCallback((address: string) => {
    if (isSelecting && selectionType === 'cell') {
      setSelection((prev) => ({
        ...prev,
        mode: 'range',
        endCell: address,
      }));
    }
  }, [isSelecting, selectionType]);

  // Row selection handlers
  const handleRowMouseDown = useCallback((row: number, e: React.MouseEvent) => {
    if (e.button === 2 && selection.selectedRows.has(row)) {
      return;
    }

    if (e.shiftKey && selection.selectedRows.size > 0) {
      const existingRows = Array.from(selection.selectedRows);
      const firstRow = existingRows[0];
      const minRow = Math.min(firstRow, row);
      const maxRow = Math.max(firstRow, row);
      const newRows = new Set<number>();
      for (let r = minRow; r <= maxRow; r++) {
        newRows.add(r);
      }
      setSelection((prev) => ({
        ...prev,
        mode: 'row',
        selectedRows: newRows,
        selectedCols: new Set(),
        startCell: null,
        endCell: null,
      }));
    } else if (e.button === 0) {
      selectCell(coordsToCellAddress(row, 0));
      setSelection({
        mode: 'row',
        startCell: null,
        endCell: null,
        selectedRows: new Set([row]),
        selectedCols: new Set(),
      });
      setIsSelecting(true);
      setSelectionType('row');
    }
  }, [selection.selectedRows, selectCell]);

  const handleRowMouseEnter = useCallback((row: number) => {
    if (isSelecting && selectionType === 'row') {
      setSelection((prev) => {
        const existingRows = Array.from(prev.selectedRows);
        if (existingRows.length === 0) return prev;
        const firstRow = existingRows[0];
        const minRow = Math.min(firstRow, row);
        const maxRow = Math.max(firstRow, row);
        const newRows = new Set<number>();
        for (let r = minRow; r <= maxRow; r++) {
          newRows.add(r);
        }
        return { ...prev, selectedRows: newRows };
      });
    }
  }, [isSelecting, selectionType]);

  // Column selection handlers
  const handleColMouseDown = useCallback((col: number, e: React.MouseEvent) => {
    if (e.button === 2 && selection.selectedCols.has(col)) {
      return;
    }

    if (e.shiftKey && selection.selectedCols.size > 0) {
      const existingCols = Array.from(selection.selectedCols);
      const firstCol = existingCols[0];
      const minCol = Math.min(firstCol, col);
      const maxCol = Math.max(firstCol, col);
      const newCols = new Set<number>();
      for (let c = minCol; c <= maxCol; c++) {
        newCols.add(c);
      }
      setSelection((prev) => ({
        ...prev,
        mode: 'column',
        selectedCols: newCols,
        selectedRows: new Set(),
        startCell: null,
        endCell: null,
      }));
    } else if (e.button === 0) {
      selectCell(coordsToCellAddress(0, col));
      setSelection({
        mode: 'column',
        startCell: null,
        endCell: null,
        selectedRows: new Set(),
        selectedCols: new Set([col]),
      });
      setIsSelecting(true);
      setSelectionType('column');
    }
  }, [selection.selectedCols, selectCell]);

  const handleColMouseEnter = useCallback((col: number) => {
    if (isSelecting && selectionType === 'column') {
      setSelection((prev) => {
        const existingCols = Array.from(prev.selectedCols);
        if (existingCols.length === 0) return prev;
        const firstCol = existingCols[0];
        const minCol = Math.min(firstCol, col);
        const maxCol = Math.max(firstCol, col);
        const newCols = new Set<number>();
        for (let c = minCol; c <= maxCol; c++) {
          newCols.add(c);
        }
        return { ...prev, selectedCols: newCols };
      });
    }
  }, [isSelecting, selectionType]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleStartEditing = useCallback(
    (address: string) => {
      startEditing(address);
    },
    [startEditing]
  );

  const handleStopEditing = useCallback(
    (address: string, value: string) => {
      const existing = cells[address];
      setCell(address, {
        value,
        style: existing?.style,
        formula: undefined,
      });
      stopEditing();
    },
    [cells, setCell, stopEditing]
  );

  const navigateCell = useCallback(
    (rowDelta: number, colDelta: number, shift: boolean = false) => {
      const current = selectedCell || selection.startCell || 'A1';
      const { row, col } = cellAddressToCoords(current);
      const newRow = Math.max(0, row + rowDelta);
      const newCol = Math.max(0, col + colDelta);

      if (newRow >= dimensions.rows - 5 || newCol >= dimensions.cols - 5) {
        expandGrid(
          Math.max(dimensions.rows, newRow + 10),
          Math.max(dimensions.cols, newCol + 10)
        );
      }

      const newAddress = coordsToCellAddress(newRow, newCol);

      if (shift) {
        setSelection((prev) => ({
          ...prev,
          mode: 'range',
          startCell: prev.startCell || current,
          endCell: newAddress,
          selectedRows: new Set(),
          selectedCols: new Set(),
        }));
      } else {
        setSelection({
          mode: 'cell',
          startCell: newAddress,
          endCell: null,
          selectedRows: new Set(),
          selectedCols: new Set(),
        });
        selectCell(newAddress);
      }
    },
    [selectedCell, selection.startCell, dimensions, selectCell, expandGrid]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Handle clipboard shortcuts
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod) {
        switch (e.key.toLowerCase()) {
          case 'c':
            e.preventDefault();
            handleCopy();
            return;
          case 'v':
            e.preventDefault();
            handlePaste();
            return;
          case 'x':
            e.preventDefault();
            handleCut();
            return;
          case 'a':
            e.preventDefault();
            handleSelectAll();
            return;
        }
      }

      if (editingCell) return;

      const shift = e.shiftKey;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigateCell(-1, 0, shift);
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigateCell(1, 0, shift);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigateCell(0, -1, shift);
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateCell(0, 1, shift);
          break;
        case 'Tab':
          e.preventDefault();
          navigateCell(0, e.shiftKey ? -1 : 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedCell) {
            if (e.shiftKey) {
              navigateCell(-1, 0);
            } else {
              navigateCell(1, 0);
            }
          }
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Clear selected cells
          for (const address of selectedRange) {
            const existing = cells[address];
            setCell(address, { value: '', style: existing?.style });
          }
          break;
        default:
          if (selectedCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            startEditing(selectedCell);
          }
          break;
      }
    },
    [editingCell, selectedCell, navigateCell, startEditing, handleCopy, handlePaste, handleCut, handleSelectAll, selectedRange, cells, setCell]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        !editingCell &&
        gridRef.current?.contains(document.activeElement as Node)
      ) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingCell]);

  // Get selection bounds for border calculation
  const selectionBounds = useMemo(() => {
    return getSelectionBounds();
  }, [getSelectionBounds]);

  const renderCell = (row: number, col: number) => {
    const address = coordsToCellAddress(row, col);
    const mergeInfo = isCellInMergedRegion(row, col, mergedCells);

    if (mergeInfo.isMerged && !mergeInfo.isOrigin) {
      return null;
    }

    const span = mergeInfo.isOrigin ? getMergedCellSpan(row, col, mergedCells) : null;
    const inRange = selectedRange.has(address);
    const isPrimary = selectedCell === address || selection.startCell === address;

    // Calculate if this cell is on the edge of the selection
    const showBorderTop = inRange && selectionBounds ? row === selectionBounds.minRow : false;
    const showBorderBottom = inRange && selectionBounds ? row === selectionBounds.maxRow : false;
    const showBorderLeft = inRange && selectionBounds ? col === selectionBounds.minCol : false;
    const showBorderRight = inRange && selectionBounds ? col === selectionBounds.maxCol : false;

    return (
      <Cell
        key={address}
        address={address}
        data={cells[address]}
        isPrimary={isPrimary}
        isInRange={inRange}
        isEditing={editingCell === address}
        showBorderTop={showBorderTop}
        showBorderBottom={showBorderBottom}
        showBorderLeft={showBorderLeft}
        showBorderRight={showBorderRight}
        rowSpan={span?.rowSpan}
        colSpan={span?.colSpan}
        width={columnWidths[col]}
        height={rowHeights[row]}
        onMouseDown={(e) => handleCellMouseDown(address, e)}
        onMouseEnter={() => handleCellMouseEnter(address)}
        onStartEditing={() => handleStartEditing(address)}
        onStopEditing={(value) => handleStopEditing(address, value)}
        onKeyDown={handleKeyDown}
      />
    );
  };

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  // Check if the sheet has any data
  const hasData = useMemo(() => {
    return Object.values(cells).some(cell => cell.value !== '' && cell.value !== undefined && cell.value !== null);
  }, [cells]);

  if (!hasData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Empty className="border-0">
          <EmptyMedia variant="icon">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No spreadsheet loaded</EmptyTitle>
            <EmptyDescription>
              Click <strong>Import</strong> to open an Excel file (.xlsx)
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={gridRef}
          className="overflow-auto flex-1 bg-background select-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th
                  className="sticky top-0 left-0 z-20 bg-muted border-r border-b border-border cursor-pointer hover:bg-muted/80"
                  style={{ minWidth: 50, maxWidth: 50, height: 24 }}
                  onClick={handleSelectAll}
                />
                {Array.from({ length: dimensions.cols }, (_, col) => (
                  <ColumnHeader
                    key={col}
                    col={col}
                    width={columnWidths[col]}
                    isSelected={selection.selectedCols.has(col)}
                    onMouseDown={(e) => handleColMouseDown(col, e)}
                    onMouseEnter={() => handleColMouseEnter(col)}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: dimensions.rows }, (_, row) => (
                <tr key={row}>
                  <RowHeader
                    row={row}
                    height={rowHeights[row]}
                    isSelected={selection.selectedRows.has(row)}
                    onMouseDown={(e) => handleRowMouseDown(row, e)}
                    onMouseEnter={() => handleRowMouseEnter(row)}
                  />
                  {Array.from({ length: dimensions.cols }, (_, col) => renderCell(row, col))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleCut}>
          Cut
          <ContextMenuShortcut>{modKey}+X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy}>
          Copy
          <ContextMenuShortcut>{modKey}+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste}>
          Paste
          <ContextMenuShortcut>{modKey}+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleSelectAll}>
          Select All
          <ContextMenuShortcut>{modKey}+A</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

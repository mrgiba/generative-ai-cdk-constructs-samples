import { useState, useEffect, useMemo } from 'react';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import { Textarea } from '../ui/textarea';
import { Spinner } from '../ui/spinner';

export function FormulaBar() {
  const { state, activeSheet, setCell, startEditing, stopEditing } = useSpreadsheet();
  const { selectedCell, editingCell } = state;

  // Check if the sheet has any data
  const hasData = useMemo(() => {
    return Object.values(activeSheet.cells).some(cell => cell.value !== '' && cell.value !== undefined && cell.value !== null);
  }, [activeSheet.cells]);

  const cellData = selectedCell ? activeSheet.cells[selectedCell] : undefined;
  const displayValue = cellData?.formula
    ? `=${cellData.formula}`
    : String(cellData?.value ?? '');

  const [inputValue, setInputValue] = useState(displayValue);

  useEffect(() => {
    setInputValue(displayValue);
  }, [displayValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleFocus = () => {
    if (selectedCell && !editingCell) {
      startEditing(selectedCell);
    }
  };

  const handleBlur = () => {
    if (selectedCell && editingCell) {
      const existing = activeSheet.cells[selectedCell];
      setCell(selectedCell, {
        value: inputValue,
        style: existing?.style,
      });
      stopEditing();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(displayValue);
      stopEditing();
    }
  };

  // Show skeleton state when no data (loading)
  if (!hasData) {
    return (
      <div className="flex items-stretch border-b bg-background">
        <div className="w-[50px] shrink-0 border-r flex items-center justify-center">
          <Spinner className="size-4" />
        </div>
        <div className="flex-1 py-1.5 px-2">
          <div className="min-h-9 px-3 py-2 text-sm text-muted-foreground/50 border rounded bg-muted/30 flex items-center">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-stretch border-b bg-background">
      <div className="w-[50px] text-sm font-medium text-center text-muted-foreground shrink-0 border-r flex items-center justify-center">
        {selectedCell ?? ''}
      </div>
      <div className="flex-1 py-1.5 px-2">
        <Textarea
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          rows={1}
          className="min-h-9 py-2 resize-y overflow-hidden"
          placeholder="Select a cell"
        />
      </div>
    </div>
  );
}

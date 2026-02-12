import { useContext } from 'react';
import { SpreadsheetContext } from '../context/SpreadsheetContext';

export function useSpreadsheet() {
  const context = useContext(SpreadsheetContext);
  if (!context) {
    throw new Error('useSpreadsheet must be used within a SpreadsheetProvider');
  }
  return context;
}

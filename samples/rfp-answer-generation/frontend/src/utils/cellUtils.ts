export function colToLetter(col: number): string {
  let result = '';
  let n = col;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

export function letterToCol(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

export function cellAddressToCoords(address: string): { row: number; col: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    throw new Error(`Invalid cell address: ${address}`);
  }
  const col = letterToCol(match[1]);
  const row = parseInt(match[2], 10) - 1;
  return { row, col };
}

export function coordsToCellAddress(row: number, col: number): string {
  return `${colToLetter(col)}${row + 1}`;
}

export function isCellInMergedRegion(
  row: number,
  col: number,
  mergedCells: { startRow: number; startCol: number; endRow: number; endCol: number }[]
): { isMerged: boolean; isOrigin: boolean; origin?: { row: number; col: number } } {
  for (const merged of mergedCells) {
    if (
      row >= merged.startRow &&
      row <= merged.endRow &&
      col >= merged.startCol &&
      col <= merged.endCol
    ) {
      const isOrigin = row === merged.startRow && col === merged.startCol;
      return {
        isMerged: true,
        isOrigin,
        origin: { row: merged.startRow, col: merged.startCol },
      };
    }
  }
  return { isMerged: false, isOrigin: false };
}

export function getMergedCellSpan(
  row: number,
  col: number,
  mergedCells: { startRow: number; startCol: number; endRow: number; endCol: number }[]
): { rowSpan: number; colSpan: number } | null {
  for (const merged of mergedCells) {
    if (row === merged.startRow && col === merged.startCol) {
      return {
        rowSpan: merged.endRow - merged.startRow + 1,
        colSpan: merged.endCol - merged.startCol + 1,
      };
    }
  }
  return null;
}

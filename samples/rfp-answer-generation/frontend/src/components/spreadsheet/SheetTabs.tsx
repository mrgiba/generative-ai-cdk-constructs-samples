import { useSpreadsheet } from '../../hooks/useSpreadsheet';

export function SheetTabs() {
  const { state, setActiveSheet } = useSpreadsheet();
  const { sheets, activeSheetIndex } = state;

  if (sheets.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/50 border-t overflow-x-auto">
      {sheets.map((sheet, index) => (
        <button
          key={index}
          onClick={() => setActiveSheet(index)}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            index === activeSheetIndex
              ? 'bg-background text-foreground shadow-sm border'
              : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'
          }`}
        >
          {sheet.name}
        </button>
      ))}
    </div>
  );
}

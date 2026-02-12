import { useState, useCallback } from 'react';
import { Download, FileSpreadsheet, Undo, FileText, FileJson, FileUp, AlertTriangle } from 'lucide-react';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import { exportToXlsx, exportToCsv, exportToJson } from '../../utils/excelExport';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog';
import { FileIcon } from '../../lib/fileIcons';

interface ToolbarProps {
  downloadUrl?: string;
  filename?: string;
}

export function Toolbar({ downloadUrl, filename }: ToolbarProps) {
  const { state, resetChanges } = useSpreadsheet();
  const [exportOpen, setExportOpen] = useState(false);
  const { isDirty } = state;

  const handleExportXlsx = useCallback(async () => {
    const name = 'spreadsheet';
    const sheets = state.sheets;
    await exportToXlsx(sheets, `${name}.xlsx`);
    setExportOpen(false);
  }, [state.sheets]);

  const handleExportCsv = useCallback(() => {
    const activeSheet = state.sheets[state.activeSheetIndex];
    const name = activeSheet.name;
    exportToCsv(activeSheet, `${name}.csv`);
    setExportOpen(false);
  }, [state.sheets, state.activeSheetIndex]);

  const handleExportJson = useCallback(() => {
    const name = 'spreadsheet';
    exportToJson(state.sheets, `${name}.json`);
    setExportOpen(false);
  }, [state.sheets]);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
      {/* Filename and edit actions on the left */}
      {filename ? (
        <div className="flex items-center gap-2 animate-fade-in">
          <FileIcon filename={filename} className="h-5 w-5" />
          <span className="text-base font-semibold">{filename}</span>
          {isDirty && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                    Edited
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Local edits only - not saved to server</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-muted/50" />
          <div className="h-5 w-32 rounded bg-muted/50" />
        </div>
      )}

      {/* Separator and edit action buttons - only shown when dirty */}
      {isDirty && (
        <>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Undo className="mr-2 h-4 w-4" />
                Discard edits
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-md">
              <AlertDialogHeader className="text-center sm:text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <AlertDialogTitle>Discard all edits?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will revert all changes you've made. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-4 sm:justify-center gap-3">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={resetChanges}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Discard edits
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="relative">
            <button
              onClick={() => setExportOpen(!exportOpen)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FileUp className="mr-2 h-4 w-4" />
              Save copy as
              <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {exportOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute left-0 z-50 mt-1 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                  <button
                    onClick={handleExportXlsx}
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-green-600 dark:text-green-500" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                    CSV (.csv)
                  </button>
                  <button
                    onClick={handleExportJson}
                    className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <FileJson className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                    JSON (.json)
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Download from server */}
      {downloadUrl ? (
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors animate-fade-in"
        >
          <Download className="mr-2 h-4 w-4" />
          {isDirty ? 'Download from Server' : 'Download'}
        </a>
      ) : (
        <div className="h-9 w-28 rounded-md bg-muted/50" />
      )}
    </div>
  );
}

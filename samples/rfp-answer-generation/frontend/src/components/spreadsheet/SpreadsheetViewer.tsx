import { useEffect, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { SpreadsheetProvider } from '../../context/SpreadsheetContext';
import { useSpreadsheet } from '../../hooks/useSpreadsheet';
import { useLoadFromUrl } from '../../hooks/useLoadFromUrl';
import { Toolbar } from './Toolbar';
import { FormulaBar } from './FormulaBar';
import { CellGrid } from './CellGrid';
import { SheetTabs } from './SheetTabs';
import { Spinner } from '../ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { AlertTriangle, Trash2, Pencil } from 'lucide-react';

export interface SpreadsheetViewerProps {
  /** Pre-signed URL to an Excel file to load */
  url?: string;
  /** Filename to display */
  filename?: string;
  /** Callback fired when URL loading starts */
  onLoadStart?: () => void;
  /** Callback fired when URL loading succeeds */
  onLoadSuccess?: () => void;
  /** Callback fired when URL loading fails */
  onLoadError?: (error: Error) => void;
}

function SpreadsheetContent({ url, filename, onLoadStart, onLoadSuccess, onLoadError }: SpreadsheetViewerProps) {
  const { state } = useSpreadsheet();
  const { isDirty } = state;
  const [showContent, setShowContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { isLoading, progress, error } = useLoadFromUrl({
    url,
    autoLoad: true,
    onLoadStart,
    onLoadSuccess: () => {
      // Start transition sequence
      setIsTransitioning(true);
      // Small delay for the fade-out animation, then show content
      setTimeout(() => {
        setShowContent(true);
        setIsTransitioning(false);
      }, 300);
      onLoadSuccess?.();
    },
    onLoadError,
  });

  // Block navigation when there are unsaved edits
  const blocker = useBlocker(isDirty);

  // Handle browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const showSkeleton = isLoading || isTransitioning;

  return (
    <div className="flex flex-col h-full bg-background">
      <Toolbar downloadUrl={url} filename={filename} />
      <FormulaBar />
      {/* Download progress bar - discreet line below formula bar */}
      {progress && (
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-150 ease-out"
            style={{ width: progress.percent !== null ? `${progress.percent}%` : '100%' }}
          />
        </div>
      )}
      <div className="flex-1 relative overflow-scroll">
        {/* Loading state - centered spinner */}
        {showSkeleton && (
          <div
            className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${
              isTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex flex-col items-center gap-4 bg-background/95 backdrop-blur-sm rounded-xl p-6 shadow-2xl border animate-fade-in">
              <Spinner className="size-6" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-medium text-foreground">Loading spreadsheet</span>
                <span className="text-xs text-muted-foreground">Preparing your data...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-destructive animate-fade-in">
            <div className="flex flex-col items-center gap-3 p-8 bg-background/80 backdrop-blur-sm rounded-xl">
              <svg
                className="w-12 h-12 text-destructive"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="font-medium">Failed to load spreadsheet</span>
              <span className="text-sm text-muted-foreground">{error.message}</span>
            </div>
          </div>
        )}

        {/* Content */}
        {showContent && !error && (
          <div className="absolute inset-0 animate-fade-in">
            <CellGrid />
          </div>
        )}
      </div>
      <SheetTabs />

      {/* Unsaved edits confirmation dialog */}
      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle>Export before you go?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes are only stored locally. Export before leaving this page to keep your work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 sm:justify-center gap-3">
            <AlertDialogCancel onClick={() => blocker.proceed?.()} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Discard edits and leave
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.reset?.()} className="gap-2">
              <Pencil className="h-4 w-4" />
              Keep editing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SpreadsheetViewer(props: SpreadsheetViewerProps) {
  return (
    <SpreadsheetProvider>
      <SpreadsheetContent {...props} />
    </SpreadsheetProvider>
  );
}

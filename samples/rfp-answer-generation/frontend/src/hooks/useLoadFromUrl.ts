import { useState, useCallback, useEffect, useRef } from 'react';
import { useSpreadsheet } from './useSpreadsheet';
import { importExcelFromUrl, DownloadProgress } from '../utils/excelImport';

export interface UseLoadFromUrlOptions {
  /** URL to load from (optional - can also call loadFromUrl manually) */
  url?: string;
  /** Whether to load automatically when URL is provided */
  autoLoad?: boolean;
  /** Callback fired when loading starts */
  onLoadStart?: () => void;
  /** Callback fired when loading succeeds */
  onLoadSuccess?: () => void;
  /** Callback fired when loading fails */
  onLoadError?: (error: Error) => void;
}

export interface UseLoadFromUrlResult {
  /** Whether the file is currently loading */
  isLoading: boolean;
  /** Download progress (null when not loading) */
  progress: DownloadProgress | null;
  /** Error that occurred during loading, if any */
  error: Error | null;
  /** Function to load a file from a URL */
  loadFromUrl: (url: string) => Promise<void>;
  /** Function to clear the current error */
  clearError: () => void;
}

/**
 * Hook to load Excel files from URLs (e.g., S3 pre-signed URLs)
 */
export function useLoadFromUrl(options: UseLoadFromUrlOptions = {}): UseLoadFromUrlResult {
  const { url, autoLoad = true, onLoadStart, onLoadSuccess, onLoadError } = options;
  const { loadWorkbook } = useSpreadsheet();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Track the URL that was last loaded to prevent duplicate loads
  const loadedUrlRef = useRef<string | null>(null);

  // Use refs for callbacks to avoid dependency issues
  const onLoadStartRef = useRef(onLoadStart);
  const onLoadSuccessRef = useRef(onLoadSuccess);
  const onLoadErrorRef = useRef(onLoadError);

  useEffect(() => {
    onLoadStartRef.current = onLoadStart;
    onLoadSuccessRef.current = onLoadSuccess;
    onLoadErrorRef.current = onLoadError;
  });

  const loadFromUrl = useCallback(async (urlToLoad: string) => {
    setIsLoading(true);
    setProgress(null);
    setError(null);
    onLoadStartRef.current?.();

    try {
      const sheets = await importExcelFromUrl(urlToLoad, (p) => setProgress(p));
      loadWorkbook(sheets);
      onLoadSuccessRef.current?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onLoadErrorRef.current?.(error);
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  }, [loadWorkbook]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-load when URL is provided and autoLoad is true (only once per unique URL)
  useEffect(() => {
    if (url && autoLoad && loadedUrlRef.current !== url) {
      loadedUrlRef.current = url;
      loadFromUrl(url);
    }
  }, [url, autoLoad, loadFromUrl]);

  return {
    isLoading,
    progress,
    error,
    loadFromUrl,
    clearError,
  };
}

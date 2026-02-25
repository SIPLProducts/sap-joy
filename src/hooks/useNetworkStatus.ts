import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelay = 1000 } = {}
) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const execute = useCallback(async (): Promise<T> => {
    let lastError: any;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setRetryCount(attempt);
          setIsRetrying(true);
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
        }
        const result = await fn();
        setRetryCount(0);
        setIsRetrying(false);
        return result;
      } catch (error: any) {
        lastError = error;
        if (error?.message !== 'Failed to fetch' && error?.name !== 'AuthRetryableFetchError') {
          throw error; // Don't retry non-network errors
        }
      }
    }
    setRetryCount(0);
    setIsRetrying(false);
    throw lastError;
  }, [fn, maxRetries, baseDelay]);

  return { execute, retryCount, isRetrying };
}

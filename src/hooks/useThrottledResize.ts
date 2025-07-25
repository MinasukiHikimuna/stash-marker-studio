import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook that provides throttled window resize handling
 * @param callback Function to call when window is resized
 * @param delay Throttle delay in milliseconds (default: 250ms)
 */
export function useThrottledResize(callback: () => void, delay: number = 250) {
  const lastExecuted = useRef<number>(0);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const throttledCallback = useCallback(() => {
    const now = Date.now();
    
    // Clear any pending timeout
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }

    // If enough time has passed since last execution, execute immediately
    if (now - lastExecuted.current >= delay) {
      lastExecuted.current = now;
      callback();
    } else {
      // Otherwise, schedule execution after the remaining delay
      const remainingDelay = delay - (now - lastExecuted.current);
      timeoutId.current = setTimeout(() => {
        lastExecuted.current = Date.now();
        callback();
        timeoutId.current = null;
      }, remainingDelay);
    }
  }, [callback, delay]);

  useEffect(() => {
    window.addEventListener('resize', throttledCallback);
    
    return () => {
      window.removeEventListener('resize', throttledCallback);
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, [throttledCallback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, []);
}
import { useState, useEffect } from 'react';

/**
 * Debounce a value by the given delay in ms.
 * Returns the latest value only after the delay has elapsed
 * since the last change — useful for search inputs.
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

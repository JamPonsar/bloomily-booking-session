import { useCallback, useEffect, useRef, useState } from 'react';

const EVENT = 'bloomily:invalidate';

/** Tell every mounted useQuery whose key starts with one of `prefixes` to refetch. */
export function invalidate(...prefixes: string[]): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: prefixes }));
}

interface Options {
  /** Re-fetch on this interval (ms) while the tab is visible. */
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * Minimal data-fetching hook: loading/error state, optional polling that pauses
 * in background tabs, and key-based invalidation after mutations.
 */
export function useQuery<T>(key: string, fetcher: () => Promise<T>, { intervalMs, enabled = true }: Options = {}) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true);
    try {
      setData(await fetcherRef.current());
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setData(undefined);
    void run(false);

    const onInvalidate = (e: Event) => {
      const prefixes = (e as CustomEvent<string[]>).detail;
      if (prefixes.some((p) => key.startsWith(p))) void run(true);
    };
    window.addEventListener(EVENT, onInvalidate);

    let timer: number | undefined;
    if (intervalMs) {
      timer = window.setInterval(() => {
        if (document.visibilityState === 'visible') void run(true);
      }, intervalMs);
    }
    return () => {
      window.removeEventListener(EVENT, onInvalidate);
      if (timer) window.clearInterval(timer);
    };
  }, [key, intervalMs, enabled, run]);

  return { data, error, loading, reload: () => run(true) };
}

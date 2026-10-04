// Shared pending indicator. CSS-sized at 1em so it inherits the surrounding
// font size (button label, input, etc.). Decorative — the invoking control
// already names the action and carries aria-busy/disabled.
import { useCallback, useState } from 'react';

export function Spinner(): React.ReactElement {
  return <span className="spinner" aria-hidden="true" />;
}

// Tracks one in-flight mutation at a time, keyed so row-level buttons can
// each show their own pending state: disabled={busyKey === key}.
export function useBusyKey(): [string | null, (key: string, work: Promise<unknown>) => void] {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const run = useCallback((key: string, work: Promise<unknown>) => {
    setBusyKey(key);
    const clear = (): void => {
      setBusyKey((k) => (k === key ? null : k));
    };
    void Promise.resolve(work).then(clear, clear);
  }, []);
  return [busyKey, run];
}

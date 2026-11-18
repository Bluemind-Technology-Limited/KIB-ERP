import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, TriangleAlert, WifiOff } from 'lucide-react';
import { useNetworkStatus, type NetworkState } from '../hooks/useNetworkStatus';

const THEME: Record<NetworkState, { bar: string; icon: typeof CheckCircle2; spin?: boolean }> = {
  connected: { bar: 'bg-emerald-600 text-white', icon: CheckCircle2 },
  weak: { bar: 'bg-amber-500 text-white', icon: TriangleAlert },
  connecting: { bar: 'bg-slate-600 text-white', icon: Loader2, spin: true },
  reconnecting: { bar: 'bg-slate-600 text-white', icon: Loader2, spin: true },
  disconnected: { bar: 'bg-rose-600 text-white', icon: WifiOff },
};

/**
 * Full-width network meter that sits above the whole layout. It stays out of the
 * way while everything is healthy, flashes green for a few seconds after
 * recovery, and otherwise shows amber (weak), red (disconnected) or grey
 * (reconnecting).
 */
export default function NetworkMeter() {
  const status = useNetworkStatus();
  const previousState = useRef<NetworkState | null>(null);
  const seenProblem = useRef(false);
  const [recovered, setRecovered] = useState(false);

  // Flash a green confirmation when a problem clears, but never on first load.
  useEffect(() => {
    const previous = previousState.current;
    previousState.current = status.state;

    if (
      status.state === 'weak' ||
      status.state === 'disconnected' ||
      status.state === 'reconnecting'
    ) {
      seenProblem.current = true;
    }

    if (status.state === 'connected' && seenProblem.current && previous !== 'connected') {
      seenProblem.current = false;
      setRecovered(true);
      const timer = window.setTimeout(() => setRecovered(false), 4000);
      return () => window.clearTimeout(timer);
    }
  }, [status.state]);

  const visible =
    status.state === 'connected'
      ? recovered
      : status.state === 'connecting'
        ? false
        : true;

  const theme = THEME[status.state];
  const Icon = theme.icon;
  const browserOnline = typeof navigator === 'undefined' || navigator.onLine;

  const title =
    status.state === 'connected'
      ? 'Back online'
      : status.state === 'weak'
        ? status.degraded
          ? 'Service degraded'
          : 'Unstable connection'
        : status.state === 'reconnecting'
          ? 'Reconnecting…'
          : status.state === 'connecting'
            ? 'Checking connection…'
            : browserOnline
              ? 'Server unreachable'
              : 'No internet connection';

  const detail =
    status.state === 'connected'
      ? 'Everything is syncing normally.'
      : status.state === 'weak'
        ? status.degraded
          ? 'The database is unavailable — some actions may fail.'
          : "The connection looks unstable. We'll keep checking automatically."
        : status.state === 'disconnected'
          ? browserOnline
            ? "We can't reach the server — changes may not be saved."
            : 'You are offline — changes may not be saved until you reconnect.'
          : 'Verifying the connection…';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={`shrink-0 overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
        visible ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div
        className={`flex h-9 items-center gap-3 px-4 text-[11px] font-medium md:px-6 ${theme.bar}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${theme.spin ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap font-semibold tracking-tight">{title}</span>
          <span className="hidden truncate text-white/75 sm:inline">· {detail}</span>
        </div>
      </div>
    </div>
  );
}

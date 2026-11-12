import { useCallback, useEffect, useRef, useState } from 'react';
import { axiosClient } from '../lib/axiosClient';

export type NetworkState = 'connecting' | 'connected' | 'weak' | 'reconnecting' | 'disconnected';

export interface NetworkStatus {
  state: NetworkState;
  /** Round-trip time of the last successful probe, in milliseconds. */
  latencyMs: number | null;
  /** The API answered but its database probe reported `down`. */
  degraded: boolean;
  lastCheckedAt: number | null;
  retry: () => void;
}

/** Above this round-trip time the connection is treated as weak. */
const WEAK_LATENCY_MS = 900;
/** Background probe cadence. */
const PROBE_INTERVAL_MS = 20_000;
/** A probe that takes longer than this is treated as a failure. */
const PROBE_TIMEOUT_MS = 8_000;
/** One blip is "unstable"; two in a row is "disconnected". */
const DISCONNECT_AFTER_FAILURES = 2;

/**
 * The backend exposes an unauthenticated `/health` route at the API origin.
 * `VITE_API_URL` may point at the origin or at `<origin>/api`, so normalise.
 */
function healthUrl(): string {
  const raw = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();
  // `axiosClient` already normalises the API base (origin or `<origin>/api`),
  // so reuse it when the env var is absent.
  const base = raw || String(axiosClient.defaults.baseURL ?? '');
  if (!base) return '/health';
  const origin = base.replace(/\/+$/, '').replace(/\/api$/i, '');
  return `${origin}/health`;
}

async function probe(): Promise<{ ok: boolean; latencyMs: number; degraded: boolean }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = performance.now();

  try {
    const response = await fetch(healthUrl(), {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - started);

    let degraded = false;
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { db?: string } | null;
      degraded = body?.db === 'down';
    }

    return { ok: response.ok, latencyMs, degraded };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started), degraded: false };
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Tracks browser connectivity plus real API response time. Background probes
 * pause while the tab is hidden, and no request touches the auth or toast
 * interceptors, so it cannot interfere with normal ERP traffic.
 */
export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'disconnected' : 'connecting'
  );
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const mountedRef = useRef(true);
  const probingRef = useRef(false);
  const failuresRef = useRef(0);

  const runProbe = useCallback(async (mode: 'auto' | 'manual' | 'online') => {
    if (!mountedRef.current || probingRef.current) return;

    if (!navigator.onLine) {
      failuresRef.current = 0;
      setState('disconnected');
      setLatencyMs(null);
      setDegraded(false);
      setLastCheckedAt(Date.now());
      return;
    }

    probingRef.current = true;
    if (mode !== 'auto') setState('reconnecting');

    const result = await probe();
    probingRef.current = false;

    if (!mountedRef.current) return;
    setLastCheckedAt(Date.now());

    if (!navigator.onLine) {
      failuresRef.current = 0;
      setState('disconnected');
      setLatencyMs(null);
      setDegraded(false);
      return;
    }

    if (result.ok && !result.degraded) {
      failuresRef.current = 0;
      setDegraded(false);
      setLatencyMs(result.latencyMs);
      setState(result.latencyMs >= WEAK_LATENCY_MS ? 'weak' : 'connected');
      return;
    }

    if (result.ok && result.degraded) {
      failuresRef.current = 0;
      setDegraded(true);
      setLatencyMs(result.latencyMs);
      setState('weak');
      return;
    }

    failuresRef.current += 1;
    setDegraded(false);
    // A failed probe has no meaningful round-trip time to display.
    setLatencyMs(null);
    setState(failuresRef.current >= DISCONNECT_AFTER_FAILURES ? 'disconnected' : 'weak');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Defer the first probe a tick so it never causes a synchronous render
    // cascade while the layout is mounting.
    const kickoff = window.setTimeout(() => void runProbe('auto'), 0);

    const handleOffline = () => {
      failuresRef.current = 0;
      setState('disconnected');
      setLatencyMs(null);
      setDegraded(false);
      setLastCheckedAt(Date.now());
    };

    const handleOnline = () => {
      failuresRef.current = 0;
      setState('reconnecting');
      void runProbe('online');
    };

    const handleVisibility = () => {
      if (!document.hidden) void runProbe('auto');
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = window.setInterval(() => {
      if (!document.hidden) void runProbe('auto');
    }, PROBE_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(kickoff);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(interval);
    };
  }, [runProbe]);

  const retry = useCallback(() => {
    failuresRef.current = 0;
    void runProbe('manual');
  }, [runProbe]);

  return { state, latencyMs, degraded, lastCheckedAt, retry };
}

export default useNetworkStatus;

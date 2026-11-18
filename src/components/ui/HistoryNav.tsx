import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Global Back / Forward control for the app header.
 *
 * Deliberately neutral grey — it is chrome, not an action, so it does not use
 * the red 3D button style.
 */

function currentIndex() {
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx === 'number' ? state.idx : 0;
}

const BUTTON_CLASS =
  'inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink-3 transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40';

export function HistoryNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(currentIndex);
  const furthest = useRef(currentIndex());

  useEffect(() => {
    const next = currentIndex();
    setIndex(next);
    if (next > furthest.current) furthest.current = next;
  }, [location.key]);

  const canGoBack = index > 0;
  const canGoForward = index < furthest.current;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => navigate(-1)}
        disabled={!canGoBack}
        className={BUTTON_CLASS}
        aria-label="Go back"
      >
        Back
      </button>
      <button
        type="button"
        onClick={() => navigate(1)}
        disabled={!canGoForward}
        className={BUTTON_CLASS}
        aria-label="Go forward"
      >
        Forward
      </button>
    </div>
  );
}

export default HistoryNav;

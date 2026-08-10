import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared modal shell — portals the overlay to document.body so `position: fixed`
 * always covers the full viewport, regardless of any scroll-container or
 * transform ancestors in the page layout.
 */
export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  // Lock background scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="m-auto w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}

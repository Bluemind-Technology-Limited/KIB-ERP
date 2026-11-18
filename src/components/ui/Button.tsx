import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Shared action button — the red 3D style (`btn-3d`).
 *
 * Used for table row actions and modal actions. Close/“✕” buttons and header
 * icon buttons stay plain, so they are intentionally not built with this.
 *
 * Layout classes (height, padding, width, text size) are still passed through
 * `className`; colour/border styling should not be, so every action looks the
 * same everywhere.
 */
export function Button({
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <button
      type={type}
      {...rest}
      className={`btn-3d text-xs font-semibold text-white ${className}`}
    >
      <span className="inline-flex items-center">{children}</span>
    </button>
  );
}

export default Button;

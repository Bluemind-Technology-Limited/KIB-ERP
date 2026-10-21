/**
 * One-line, truncated page description.
 *
 * Page subtitles were wrapping into two or three lines and pushing the content
 * down. They now stay on a single line and the full text is available on hover.
 */
export function PageDescription({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      title={children}
      className={`text-[#737373] text-xs truncate cursor-help ${className}`}
    >
      {children}
    </p>
  );
}

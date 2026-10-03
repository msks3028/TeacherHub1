/** A hand-drawn red-pen underline that draws itself once. Put inside a `relative inline-block` element. */
export default function PenUnderline({ className = "" }) {
  return (
    <svg viewBox="0 0 100 10" preserveAspectRatio="none" className={`absolute inset-x-0 -bottom-1 w-full h-2.5 text-pen pointer-events-none ${className}`} aria-hidden="true" fill="none">
      <path pathLength="1" className="pen-draw" d="M1 6 C 20 1, 40 9, 60 4 S 90 3, 99 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

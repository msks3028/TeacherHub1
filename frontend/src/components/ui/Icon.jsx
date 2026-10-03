import { ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";

/**
 * Every icon in the product goes through here: one stroke weight (1.75) and
 * three sizes (16 / 20 / 24). Decorative by default (aria-hidden).
 */
export default function Icon({ icon: I, size = 20, className = "", ...rest }) {
  if (!I) return null;
  return <I size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" className={className} {...rest} />;
}

// The app is RTL, so "forward" points left. Import these instead of picking
// Left/Right by hand.
export const ChevronForward = ChevronLeft;
export const ChevronBack = ChevronRight;
export const ArrowForward = ArrowLeft;
export const ArrowBack = ArrowRight;

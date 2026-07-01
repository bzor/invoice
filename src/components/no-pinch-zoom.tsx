"use client";

import { useEffect } from "react";

/**
 * Disables pinch-to-zoom on iOS Safari. The viewport meta's
 * `maximum-scale=1` / `user-scalable=no` are intentionally ignored by iOS
 * Safari for accessibility, so the only reliable block is to preventDefault
 * Safari's non-standard `gesture*` events (and multi-touch touchmove).
 * Double-tap zoom is handled separately via `touch-action: manipulation`.
 */
export function NoPinchZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();

    const onTouchMove = (e: TouchEvent) => {
      // Safari sets a non-1 `scale` on the event while pinching.
      const scale = (e as TouchEvent & { scale?: number }).scale;
      if ((scale != null && scale !== 1) || e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const opts = { passive: false } as const;
    document.addEventListener("gesturestart", prevent, opts);
    document.addEventListener("gesturechange", prevent, opts);
    document.addEventListener("gestureend", prevent, opts);
    document.addEventListener("touchmove", onTouchMove, opts);

    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("gestureend", prevent);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}

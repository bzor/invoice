"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scales a fixed-width child (the 816px document sheet) down to fit the
 * available width — so the invoice/estimate preview is fully visible on a
 * phone instead of being clipped or horizontally scrolled. Never scales up:
 * on wide screens the sheet renders at its natural 1:1 size.
 */
export function PreviewFit({
  width = 816,
  children,
}: {
  width?: number;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const update = () => {
      const s = Math.min(1, outer.clientWidth / width);
      setScale(s);
      // offsetHeight is the pre-transform layout height, so the reserved
      // space collapses in step with the scale (no dead whitespace).
      setHeight(inner.offsetHeight * s);
    };

    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    update();
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outerRef} className="w-full" style={{ height }}>
      <div
        ref={innerRef}
        style={{
          width,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

import { useEffect, useState, useRef, type RefObject } from "react";

/**
 * Uses IntersectionObserver to detect which item in a scrollable feed
 * has the highest visibility ratio. Returns the id of that item.
 *
 * When `scrollingFromClick` is true (programmatic scroll in progress),
 * updates are suppressed to avoid fighting with scrollIntoView.
 */
export function useVisibleItem(
  scrollRef: RefObject<HTMLDivElement | null>,
  itemRefs: RefObject<Map<string, HTMLDivElement>>,
  scrollingFromClick: RefObject<boolean>,
  itemCount: number,
): string | null {
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const ratios = useRef<Map<string, number>>(new Map());
  const rafId = useRef<number>(0);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || itemCount === 0) return;

    ratios.current.clear();

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingFromClick.current) return;

        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.itemId;
          if (id) {
            ratios.current.set(id, entry.intersectionRatio);
          }
        }

        cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          let bestId: string | null = null;
          let bestRatio = 0;
          for (const [id, ratio] of ratios.current) {
            if (ratio > bestRatio) {
              bestRatio = ratio;
              bestId = id;
            }
          }
          if (bestId) {
            setVisibleId(bestId);
          }
        });
      },
      {
        root,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      },
    );

    for (const el of itemRefs.current.values()) {
      observer.observe(el);
    }

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, [scrollRef, itemRefs, scrollingFromClick, itemCount]);

  return visibleId;
}

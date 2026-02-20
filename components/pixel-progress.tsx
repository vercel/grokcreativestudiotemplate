"use client";

interface PixelProgressProps {
  /** 0-100 */
  value: number;
  /** Label shown below the bar */
  label?: string;
}

/**
 * Pixel-grid progress bar.
 * White square cells fill left-to-right — no blinking, no going backwards.
 */
export function PixelProgress({ value, label }: PixelProgressProps) {
  const COLS = 50;
  const filledCount = Math.round((value / 100) * COLS);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-px">
        {Array.from({ length: COLS }, (_, i) => (
          <div
            key={i}
            className={`h-[5px] w-[5px] transition-colors duration-150 ${
              i < filledCount ? "bg-foreground" : "bg-border/50"
            }`}
          />
        ))}
      </div>
      {label && (
        <p className="font-pixel text-[10px] uppercase text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}

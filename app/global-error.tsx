"use client";

import { ErrorContent } from "@/components/error-content";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#050505]">
        <ErrorContent error={error} reset={reset} />
      </body>
    </html>
  );
}

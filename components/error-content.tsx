"use client";

export function ErrorContent({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center font-pixel text-white">
      <h1 className="mb-4 text-4xl">Something went wrong</h1>
      <p className="mb-2 max-w-md text-sm text-neutral-400">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="mb-6 text-xs text-neutral-600">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded border border-neutral-700 bg-neutral-900 px-6 py-2 text-sm text-white transition-colors hover:bg-neutral-800"
      >
        Try again
      </button>
    </div>
  );
}

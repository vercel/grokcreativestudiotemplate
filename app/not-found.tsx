import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center font-pixel text-white">
      <h1 className="mb-4 text-6xl">404</h1>
      <p className="mb-6 text-sm text-neutral-400">
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/explore"
        className="rounded border border-neutral-700 bg-neutral-900 px-6 py-2 text-sm text-white transition-colors hover:bg-neutral-800"
      >
        Back to Explore
      </Link>
    </div>
  );
}

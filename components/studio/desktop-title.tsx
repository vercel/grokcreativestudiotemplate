"use client";

import { useLayout } from "./layout-context";
import { useStudioActions } from "./studio-context";

export function DesktopTitle() {
  const { sidebarWidth, MIN_SIDEBAR } = useLayout();
  const { setShowExplore, setExploreSelection, setExploreSearch } = useStudioActions();

  const handleClick = () => {
    setShowExplore(true);
    setExploreSelection(null);
    setExploreSearch("");
    // Always navigate to explore
    if (window.location.pathname !== "/explore") {
      window.history.replaceState({}, "", "/explore");
      document.title = "Grok Creative Studio";
    }
  };

  if (sidebarWidth > 0) {
    return (
      <div
        className="hidden shrink-0 items-center overflow-hidden px-4 md:flex"
        style={{ width: sidebarWidth }}
      >
        <div
          className="min-w-0"
          style={{
            opacity: sidebarWidth < MIN_SIDEBAR ? 0 : 1,
            transition: "opacity 150ms ease",
          }}
        >
          <button
            type="button"
            onClick={handleClick}
            className="whitespace-nowrap truncate font-pixel text-base text-foreground leading-tight hover:text-muted-foreground transition-colors"
          >
            Grok Creative Studio
          </button>
          <p className="whitespace-nowrap truncate font-pixel text-[10px] text-muted-foreground">
            Powered by{" "}
            <a
              href="https://vercel.com/ai-gateway"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              AI Gateway
            </a>
            ,{" "}
            <a
              href="https://ai-sdk.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              AI SDK
            </a>{" "}
            &amp;{" "}
            <a
              href="https://useworkflow.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Workflows
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden shrink-0 items-center px-4 md:flex animate-in fade-in duration-[1500ms] ease-out">
      <div className="min-w-0">
        <button
          type="button"
          onClick={handleClick}
          className="whitespace-nowrap font-pixel text-base text-foreground leading-tight hover:text-muted-foreground transition-colors"
        >
          Grok Creative Studio
        </button>
        <p className="whitespace-nowrap font-pixel text-[10px] text-muted-foreground">
          Powered by{" "}
          <a
            href="https://vercel.com/ai-gateway"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            AI Gateway
          </a>
          ,{" "}
          <a
            href="https://ai-sdk.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            AI SDK
          </a>{" "}
          &amp;{" "}
          <a
            href="https://useworkflow.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Workflows
          </a>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

const DEFAULT_CLASSNAME =
  "min-w-0 rounded-[14px] border border-white/10 bg-[#1b1830] p-4 shadow-[0_18px_50px_rgba(0,0,0,.15)] sm:p-[18px]";
const MAXIMIZE_SCALE = 1.4;

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "chart";
}

export default function Panel({
  title,
  hint,
  controls,
  children,
  className = DEFAULT_CLASSNAME,
}: {
  title: string;
  hint?: string;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [maximized, setMaximized] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const nodeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!maximized) return;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMaximized(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [maximized]);

  async function downloadPng() {
    if (!nodeRef.current || downloading) return;
    setDownloading(true);
    flushSync(() => setExporting(true));
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(nodeRef.current, {
        backgroundColor: "#1b1830",
        pixelRatio: 2,
        filter: (domNode) => !(domNode instanceof HTMLElement && domNode.dataset.exportIgnore === "true"),
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${slugify(title)}.png`;
      link.click();
    } catch (error) {
      console.error(error);
    } finally {
      flushSync(() => setExporting(false));
      setDownloading(false);
    }
  }

  return (
    <section ref={nodeRef} className={maximized ? "fixed inset-0 z-[999] overflow-auto bg-[#12101c] p-6 sm:p-10" : className}>
      <div className={`flex gap-2 ${exporting ? "flex-col items-center text-center" : "flex-wrap items-start justify-between"}`}>
        <div>
          <h2
            onClick={() => setMaximized((current) => !current)}
            title="Click to maximize · Esc to close"
            className="cursor-pointer select-none text-sm font-bold tracking-[.02em] transition hover:text-[#b06cff]"
          >
            {title}
          </h2>
          {hint && <p className="mt-1 text-[11px] text-[#9c96b3]">{hint}</p>}
        </div>
        <div className={`flex flex-wrap items-center gap-2 ${exporting ? "justify-center" : ""}`}>
          {controls}
          <div className="flex items-center gap-2" data-export-ignore="true">
            <button
              onClick={downloadPng}
              disabled={downloading}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#9c96b3] transition hover:border-[#4dd6c4] hover:text-white disabled:opacity-50"
            >
              {downloading ? "Saving…" : "⬇ PNG"}
            </button>
            {maximized && (
              <button
                onClick={() => setMaximized(false)}
                title="Close (Esc)"
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-[#9c96b3] transition hover:border-[#ff5d8f] hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        style={maximized ? { transform: `scale(${MAXIMIZE_SCALE})`, transformOrigin: "top left", width: `${(100 / MAXIMIZE_SCALE).toFixed(3)}%` } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

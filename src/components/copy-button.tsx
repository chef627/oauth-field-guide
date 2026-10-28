"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy", className = "btn" }: { text: string | (() => Promise<string>); label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(typeof text === "string" ? text : await text());
          setState("copied");
        } catch {
          setState("error");
        }
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "copied" ? "Copied ✓" : state === "error" ? "Copy failed" : label}
    </button>
  );
}

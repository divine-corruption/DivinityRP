"use client";

import { useEffect, useState } from "react";

export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "hidden">("show");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 2200);
    const t2 = setTimeout(() => setPhase("hidden"), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      style={{
        animation: phase === "fade" ? "splash-fade-out 1s ease-out forwards" : undefined,
      }}
    >
      <div className="relative flex flex-col items-center gap-6">
        <div
          className="relative"
          style={{
            animation: "glitch-flicker 2.5s ease-in-out forwards",
          }}
        >
          <img
            src="/images/heavenlogo.png"
            alt="DIVINE"
            className="h-28 w-28 object-contain drop-shadow-[0_0_30px_oklch(0.7_0.26_305/0.5)]"
            style={{
              animation: "glitch-rgb 2.5s ease-in-out forwards",
            }}
          />
          <div
            className="absolute inset-0 -translate-x-[2px] opacity-50"
            style={{
              animation: "glitch-skew 2.5s ease-in-out forwards",
            }}
          >
            <img
              src="/images/heavenlogo.png"
              alt=""
              className="h-28 w-28 object-contain"
              style={{ filter: "hue-rotate(180deg) saturate(2)", clipPath: "inset(0 0 80% 0)" }}
            />
          </div>
          <div
            className="absolute inset-0 translate-x-[2px] opacity-50"
            style={{
              animation: "glitch-skew 2.5s ease-in-out forwards",
            }}
          >
            <img
              src="/images/heavenlogo.png"
              alt=""
              className="h-28 w-28 object-contain"
              style={{ filter: "hue-rotate(-60deg) saturate(1.5)", clipPath: "inset(60% 0 0 0)" }}
            />
          </div>
        </div>
        <span
          className="text-lg font-bold tracking-[0.3em] uppercase divine-wordmark"
          style={{
            animation: "glitch-flicker 2.5s ease-in-out forwards, glitch-rgb 2.5s ease-in-out forwards",
          }}
        >
          DIVINE
        </span>
      </div>
    </div>
  );
}

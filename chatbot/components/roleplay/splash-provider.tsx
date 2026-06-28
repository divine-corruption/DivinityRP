"use client";

import { SplashScreen } from "./splash-screen";

export function SplashProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SplashScreen />
      {children}
    </>
  );
}

"use client";

import type { PointerEvent, ReactNode } from "react";

type RoadmapDemoProps = Readonly<{
  children: ReactNode;
}>;

export function RoadmapDemo({ children }: RoadmapDemoProps) {
  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const normalizedX = (x - 50) / 50;
    const normalizedY = (y - 50) / 50;
    event.currentTarget.style.setProperty("--roadmap-glow-x", `${x}%`);
    event.currentTarget.style.setProperty("--roadmap-glow-y", `${y}%`);
    event.currentTarget.style.setProperty("--demo-gradient-shift-x", `${normalizedX * 28}px`);
    event.currentTarget.style.setProperty("--demo-gradient-shift-y", `${normalizedY * 20}px`);
    event.currentTarget.style.setProperty(
      "--demo-gradient-angle",
      `${128 + normalizedX * 14 - normalizedY * 10}deg`,
    );
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--roadmap-glow-x", "82%");
    event.currentTarget.style.setProperty("--roadmap-glow-y", "14%");
    event.currentTarget.style.setProperty("--demo-gradient-shift-x", "0px");
    event.currentTarget.style.setProperty("--demo-gradient-shift-y", "0px");
    event.currentTarget.style.setProperty("--demo-gradient-angle", "128deg");
  }

  return (
    <div
      className="product-demo roadmap-demo"
      data-reveal="left"
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      {children}
    </div>
  );
}

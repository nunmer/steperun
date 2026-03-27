"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

const rotations = [-3, 2, -1.5, 4, -2.5, 3];
const offsets = [
  { x: 0,   y: 0  },
  { x: 12,  y: 6  },
  { x: -8,  y: 10 },
  { x: 6,   y: -4 },
];

const VISIBLE = 4; // how many cards show in the pile

export function PhotoCarousel({ photos }: { photos: string[] }) {
  const [top, setTop] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const next = useCallback(() => {
    if (isAnimating || photos.length < 2) return;
    setIsAnimating(true);
    setTimeout(() => {
      setTop((prev) => (prev + 1) % photos.length);
      setIsAnimating(false);
    }, 500);
  }, [isAnimating, photos.length]);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [next, photos.length]);

  if (photos.length === 0) return null;

  const visibleCount = Math.min(photos.length, VISIBLE);

  return (
    <div className="relative w-full max-w-2xl mx-auto select-none">
      <div className="relative aspect-[4/3]" onClick={next}>
        {photos.map((photo, i) => {
          // Distance from top in the cycle (0 = top card)
          const pos = ((i - top) % photos.length + photos.length) % photos.length;
          const isTopCard = pos === 0;
          const isVisible = pos < visibleCount;
          const isSweeping = isTopCard && isAnimating;

          const rot = rotations[pos % rotations.length];
          const off = offsets[pos % offsets.length];

          return (
            <div
              key={photo}  // stable key — never remounts, images stay loaded
              className="absolute inset-0 cursor-pointer"
              style={{
                zIndex: isVisible ? visibleCount - pos : 0,
                transform: isSweeping
                  ? "rotate(-14deg) translate(-115%, 50px) scale(0.88)"
                  : isVisible
                    ? `rotate(${rot}deg) translate(${off.x}px, ${off.y}px) scale(${1 - pos * 0.03})`
                    : `rotate(${rot}deg) translate(${off.x}px, ${off.y}px) scale(${1 - pos * 0.03})`,
                opacity: isSweeping
                  ? 0
                  : !isVisible
                    ? 0
                    : isTopCard
                      ? 1
                      : isAnimating && pos === 1
                        ? 1   // snap next card to full opacity as top sweeps away
                        : 0.65 - pos * 0.1,
                transition: isVisible || isSweeping
                  ? "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-out"
                  : "none",
                pointerEvents: isTopCard ? "auto" : "none",
              }}
            >
              <div className="h-full rounded-sm bg-white p-1.5 pb-6 sm:p-2 sm:pb-10 shadow-2xl shadow-black/40">
                <div className="relative h-full w-full overflow-hidden rounded-sm">
                  <Image
                    src={`/carousel/${photo}`}
                    alt={`Photo ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 640px"
                    priority={pos < 2}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {photos.length > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (!isAnimating) setTop(i);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === top
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

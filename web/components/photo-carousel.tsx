"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";

interface Props {
  photos: string[];
}

export function PhotoCarousel({ photos }: Props) {
  const [active, setActive] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const next = useCallback(() => {
    if (isAnimating || photos.length < 2) return;
    setIsAnimating(true);
    setTimeout(() => {
      setActive((prev) => (prev + 1) % photos.length);
      setIsAnimating(false);
    }, 600);
  }, [isAnimating, photos.length]);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(next, 4000);
    return () => clearInterval(id);
  }, [next, photos.length]);

  if (photos.length === 0) return null;

  // Build stack: show up to 4 photos in a pile
  const stackSize = Math.min(photos.length, 4);
  const stack = Array.from({ length: stackSize }, (_, i) => {
    const idx = (active + i) % photos.length;
    return { idx, depth: i };
  });

  // Predefined rotations for the "scattered prints" look
  const rotations = [-3, 2, -1.5, 4];
  const offsets = [
    { x: 0, y: 0 },
    { x: 12, y: 6 },
    { x: -8, y: 10 },
    { x: 6, y: -4 },
  ];

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative aspect-[4/3]">
        {stack
          .slice()
          .reverse()
          .map(({ idx, depth }) => {
            const rot = rotations[depth % rotations.length];
            const off = offsets[depth % offsets.length];
            const isTop = depth === 0;
            const scale = 1 - depth * 0.03;
            const zIndex = stackSize - depth;

            return (
              <div
                key={`${idx}-${depth}`}
                className="absolute inset-0 cursor-pointer"
                style={{
                  zIndex,
                  transform: `rotate(${rot}deg) translate(${off.x}px, ${off.y}px) scale(${scale})`,
                  transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                  opacity: isTop ? 1 : 0.7 - depth * 0.15,
                  ...(isTop && isAnimating
                    ? {
                        transform: "rotate(-12deg) translate(-120%, 40px) scale(0.9)",
                        opacity: 0,
                      }
                    : {}),
                }}
                onClick={next}
              >
                {/* Photo print frame */}
                <div className="h-full rounded-sm bg-white p-1.5 pb-6 sm:p-2 sm:pb-10 shadow-2xl shadow-black/40">
                  <div className="relative h-full w-full overflow-hidden rounded-sm">
                    <Image
                      src={`/carousel/${photos[idx]}`}
                      alt={`Photo ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 640px"
                      priority={depth < 2}
                    />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Dots indicator */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (!isAnimating) setActive(i);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === active
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

"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Shot {
  src: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
  /** Grid placement on lg (12 columns) and on phones (2 columns). */
  lg: string;
  sm: string;
  /** Parallax drift; positive moves slower than the page. */
  speed: number;
}

const SHOTS: Shot[] = [
  { src: "/photos/blocks.jpg", alt: "Sprinter driving out of the starting blocks, long shadow across the track", caption: "On your marks", width: 721, height: 1024, lg: "lg:col-start-1 lg:col-span-5 lg:row-start-1 lg:row-span-2", sm: "col-span-2", speed: 0.06 },
  { src: "/photos/stride-mono.jpg", alt: "Black-and-white close-up of runners' legs and shoes on asphalt", caption: "Cadence", width: 1266, height: 736, lg: "lg:col-start-7 lg:col-span-6 lg:row-start-2 lg:self-start", sm: "col-span-2", speed: -0.04 },
  { src: "/photos/golden-hour.jpg", alt: "Runner seen from above in a band of low sun, shadow stretching behind", caption: "Golden hour", width: 720, height: 1280, lg: "lg:col-start-1 lg:col-span-3 lg:row-start-3 lg:mt-10", sm: "", speed: 0.1 },
  { src: "/photos/finish-lanes.jpg", alt: "Runner crossing numbered lanes at the finish line of a blue track", caption: "Lane four", width: 736, height: 1104, lg: "lg:col-start-5 lg:col-span-3 lg:row-start-3 lg:mt-36", sm: "mt-14", speed: -0.06 },
  { src: "/photos/red-track.jpg", alt: "Aerial view of a lone runner on a red running track", caption: "The oval", width: 736, height: 920, lg: "lg:col-start-9 lg:col-span-4 lg:row-start-3", sm: "", speed: 0.08 },
  { src: "/photos/pack-mono.jpg", alt: "Black-and-white group of runners side by side, motion blur", caption: "The pack", width: 736, height: 920, lg: "lg:col-start-2 lg:col-span-4 lg:row-start-4 lg:mt-8", sm: "mt-14", speed: -0.05 },
  { src: "/photos/sprint-blur.jpg", alt: "Blurred black-and-white runner mid-stride in profile", caption: "Negative split", width: 736, height: 1104, lg: "lg:col-start-7 lg:col-span-3 lg:row-start-4 lg:mt-28", sm: "", speed: 0.09 },
  { src: "/photos/overhead-pack.jpg", alt: "Overhead view of four runners on pale asphalt with soft shadows", caption: "Morning long run", width: 736, height: 920, lg: "lg:col-start-10 lg:col-span-3 lg:row-start-4", sm: "mt-14", speed: -0.03 },
];

/**
 * Editorial spread between the data sections: an asymmetric magazine grid
 * with numbered figure captions. Photos unmask upward as they enter the
 * viewport and drift slightly against the scroll. Both effects are off under
 * reduced motion.
 */
export function PhotoSpread() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const figures = [...root.querySelectorAll<HTMLElement>("[data-shot]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      figures.forEach((f) => f.setAttribute("data-shown", ""));
      return;
    }

    root.setAttribute("data-armed", "");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.setAttribute("data-shown", "");
          io.unobserve(e.target);
        }
      }),
      { rootMargin: "0px 0px -12% 0px" },
    );
    figures.forEach((f) => io.observe(f));

    let frame = 0;
    const drift = () => {
      frame = 0;
      const mid = window.innerHeight / 2;
      for (const f of figures) {
        const r = f.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        const offset = (r.top + r.height / 2 - mid) * Number(f.dataset.speed);
        f.style.setProperty("--drift", `${offset.toFixed(1)}px`);
      }
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(drift); };
    drift();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={rootRef} aria-label="Photographs" className="relative">
      <div className="grid grid-cols-2 gap-x-3 gap-y-8 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-12">
        {/* Pull quote: sits in the open space beside the first photo. */}
        <div className="col-span-2 lg:col-start-7 lg:col-span-6 lg:row-start-1 lg:self-end order-first lg:order-none">
          <p className="eyebrow mb-4">Between the lines</p>
          <p className="headline text-5xl sm:text-7xl leading-[0.9]">
            Fast is a feeling.
            <br />
            <span className="text-primary">The chip makes it a fact.</span>
          </p>
        </div>

        {SHOTS.map((shot, i) => (
          <figure
            key={shot.src}
            data-shot
            data-speed={shot.speed}
            className={cn("group shot", shot.sm, shot.lg)}
          >
            <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: `${shot.width} / ${shot.height}` }}>
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                sizes={shot.width > shot.height ? "(max-width: 1024px) 100vw, 50vw" : "(max-width: 1024px) 50vw, 33vw"}
                className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
              />
            </div>
            <figcaption className="mt-2 flex items-baseline gap-2">
              <span className="time text-[11px] text-primary">{String(i + 1).padStart(2, "0")}</span>
              <span className="eyebrow !text-foreground">{shot.caption}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

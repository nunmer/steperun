"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Muted background loop for the home hero. Never autoplays under reduced
 * motion (the poster frame shows instead), pauses while off screen, and has a
 * visible pause control because it runs longer than five seconds.
 */
export function HeroVideo({ src, poster }: { src: string; poster: string }) {
  const t = useTranslations("home.video");
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = requestAnimationFrame(() => setUserPaused(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [userPaused]);

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  }

  return (
    <>
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover"
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="absolute z-10 bottom-[5.5rem] right-4 sm:right-6 eyebrow !text-foreground/70 hover:!text-foreground flex items-center gap-2"
        aria-label={playing ? t("pauseLabel") : t("playLabel")}
      >
        <span aria-hidden className="inline-flex size-6 items-center justify-center border border-foreground/40">
          {playing ? "❚❚" : "▶"}
        </span>
        {playing ? t("pause") : t("play")}
      </button>
    </>
  );
}

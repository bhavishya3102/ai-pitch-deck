import { useCallback, useEffect, useRef, useState } from "react";

import { toBullets } from "../lib/format.ts";
import { exitFullscreen, requestFullscreen } from "../lib/fullscreen.ts";
import type { Slide } from "../lib/types.ts";

const MIN_RADIUS = 90;
const MAX_RADIUS = 520;
const CONTROLS_HIDE_MS = 2600;

type Props = {
  slides: Slide[];
  startIndex: number;
  deckTitle: string;
  onExit: (lastIndex: number) => void;
};

/**
 * Full-screen presentation for a meeting demo.
 *
 * Keys: → / Space next · ← previous · H highlighter · F fullscreen · Esc exit
 * Highlighter dims the slide and keeps a bright circle around the cursor;
 * the scroll wheel resizes that circle.
 */
export function PresentMode({ slides, startIndex, deckTitle, onExit }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const wasFullscreen = useRef(false);
  const [index, setIndex] = useState(startIndex);
  const [spotlight, setSpotlight] = useState(false);
  const [radius, setRadius] = useState(200);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null);

  const count = slides.length;
  // Slides can still be arriving while presenting, and a re-run can shrink the list
  const position = Math.max(0, Math.min(index, count - 1));
  const slide = slides[position];

  const exit = useCallback(() => onExit(position), [onExit, position]);

  const goTo = useCallback(
    (next: number) => setIndex(Math.max(0, Math.min(next, count - 1))),
    [count],
  );

  // Fullscreen itself is requested in the click handler that opens this view —
  // the browser only allows it from a user gesture, not from an effect.
  useEffect(() => {
    stageRef.current?.focus();

    // Stop the page behind from scrolling (and showing scrollbars) while presenting
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      exitFullscreen();
    };
  }, []);

  // Esc inside fullscreen only leaves fullscreen, so treat that as leaving the presentation
  useEffect(() => {
    function onChange() {
      const active = document.fullscreenElement !== null;
      setIsFullscreen(active);
      // Only close if we were actually fullscreen — otherwise a denied request would
      // close the presentation immediately
      if (active) wasFullscreen.current = true;
      else if (wasFullscreen.current) exit();
    }

    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [exit]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          goTo(position + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          goTo(position - 1);
          break;
        case "Escape":
          exit();
          break;
        case "h":
        case "H":
          setSpotlight((on) => !on);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "Home":
          goTo(0);
          break;
        case "End":
          goTo(count - 1);
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, exit, goTo, position]);

  // Controls fade away while you talk, and come back on any mouse move
  useEffect(() => {
    if (!controlsVisible) return;
    const timer = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [controlsVisible, position]);

  function toggleFullscreen() {
    if (document.fullscreenElement) exitFullscreen();
    else requestFullscreen();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    setControlsVisible(true);
    if (!spotlight) return;
    const node = stageRef.current;
    if (!node) return;
    node.style.setProperty("--spot-x", `${event.clientX}px`);
    node.style.setProperty("--spot-y", `${event.clientY}px`);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!spotlight) return;
    setRadius((r) => Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r - event.deltaY * 0.35)));
  }

  if (!slide) {
    return null;
  }

  return (
    <div
      ref={stageRef}
      className="present"
      data-spotlight={spotlight}
      style={{ "--spot-r": `${radius}px` } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label={`Presenting ${deckTitle}`}
      tabIndex={-1}
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
    >
      <article className="present-slide" key={slide.id}>
        <div className="present-text">
          <span className="mono present-counter">
            {String(position + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
          </span>
          <h2 className="present-title">{slide.title}</h2>
          <ul className="present-bullets">
            {toBullets(slide.content).map((bullet, i) => (
              <li key={i} style={{ animationDelay: `${120 + i * 90}ms` }}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>

        {slide.imageUrl ? (
          <img className="present-image" src={slide.imageUrl} alt={slide.imagePrompt} />
        ) : (
          <div className="present-image present-image-empty">
            <p>{slide.imagePrompt}</p>
          </div>
        )}
      </article>

      {/* Dim layer with a hole around the cursor — pointer-events: none so clicks pass through */}
      {spotlight && <div className="spotlight" aria-hidden />}

      <div className="present-progress" aria-hidden>
        <span style={{ width: `${((position + 1) / count) * 100}%` }} />
      </div>

      <div className="present-bar" data-visible={controlsVisible}>
        <button
          type="button"
          className="present-button"
          onClick={() => goTo(position - 1)}
          disabled={position === 0}
          aria-label="Previous slide"
        >
          ←
        </button>
        <button
          type="button"
          className="present-button"
          onClick={() => goTo(position + 1)}
          disabled={position >= count - 1}
          aria-label="Next slide"
        >
          →
        </button>
        <button
          type="button"
          className="present-button present-wide"
          data-on={spotlight}
          onClick={() => setSpotlight((on) => !on)}
        >
          Highlighter {spotlight ? "on" : "off"} <kbd>H</kbd>
        </button>
        <button type="button" className="present-button present-wide" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit full screen" : "Full screen"} <kbd>F</kbd>
        </button>
        <button type="button" className="present-button present-wide" onClick={exit}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}

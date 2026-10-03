import { useCallback, useEffect, useRef, useState } from "react";

import { useAddNote } from "../lib/api.ts";
import { toBullets } from "../lib/format.ts";
import { exitFullscreen, requestFullscreen } from "../lib/fullscreen.ts";
import type { Slide } from "../lib/types.ts";

const MIN_RADIUS = 90;
const MAX_RADIUS = 520;
const CONTROLS_HIDE_MS = 2600;

type Props = {
  deckId: string;
  slides: Slide[];
  startIndex: number;
  deckTitle: string;
  onExit: (lastIndex: number) => void;
};

/**
 * Full-screen presentation for a meeting demo.
 *
 * Keys: → / Space next · ← previous · H highlighter · L laser · F fullscreen · Esc exit
 * N writes a note on the slide (Alt+N closes it), M flags it without typing — both are for
 * catching feedback from the room without leaving the presentation.
 * Highlighter dims the slide and keeps a bright circle around the cursor;
 * the scroll wheel resizes that circle. Laser leaves the slide fully lit and
 * puts a tight dot on the word under the cursor. The two can be on together.
 */
export function PresentMode({ deckId, slides, startIndex, deckTitle, onExit }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const wasFullscreen = useRef(false);
  const [index, setIndex] = useState(startIndex);
  const [spotlight, setSpotlight] = useState(false);
  const [laser, setLaser] = useState(false);
  const [radius, setRadius] = useState(200);
  // Last pointer position, so turning the laser on puts the dot under the cursor
  // immediately instead of waiting for the next move. Not state: moving must not re-render.
  const pointer = useRef({ x: 0, y: 0 });
  const seenPointer = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  // null = closed. A string (even empty) means the note box is open.
  const [noteDraft, setNoteDraft] = useState<string | null>(null);
  // Wrapped in an object so the same message twice still restarts the timer
  const [flash, setFlash] = useState<{ text: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null);

  const count = slides.length;
  // Slides can still be arriving while presenting, and a re-run can shrink the list
  const position = Math.max(0, Math.min(index, count - 1));
  const slide = slides[position];
  const slideId = slide?.id;
  const noteOpen = noteDraft !== null;

  const { mutate: saveNote } = useAddNote(deckId);

  const exit = useCallback(() => onExit(position), [onExit, position]);

  // An empty body is a flag — "come back to this slide" — filled in after the meeting
  const capture = useCallback(
    (body: string) => {
      if (!slideId) return;
      // Confirm straight away: the round trip takes over a second, and a silent
      // pause in front of a room reads as "it didn't work" and gets pressed twice.
      setFlash({ text: body ? "Noted" : "Flagged" });
      saveNote(
        { slideId, body },
        { onError: () => setFlash({ text: "Couldn't save that — check the connection" }) },
      );
    },
    [saveNote, slideId],
  );

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
      const target = event.target;
      const typing = target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;

      // While the note box is open it owns the keyboard, so no shortcut steals a
      // letter being typed. Alt+N closes the box; Esc still leaves the presentation,
      // because in fullscreen the browser takes Esc and would end it anyway.
      // `code`, not `key`: on a Mac Option+N is a dead key, so `key` isn't "n".
      if (noteOpen) {
        if (event.key === "Escape") exit();
        else if (event.altKey && event.code === "KeyN") {
          event.preventDefault();
          setNoteDraft(null);
        }
        return;
      }
      if (typing) return;

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
        case "l":
        case "L":
          toggleLaser();
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
        case "n":
        case "N":
          // Keep the letter out of the box that is about to take focus
          event.preventDefault();
          setNoteDraft("");
          break;
        case "m":
        case "M":
          capture("");
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture, count, exit, goTo, noteOpen, position]);

  // Controls fade away while you talk, and come back on any mouse move
  useEffect(() => {
    if (!controlsVisible) return;
    const timer = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [controlsVisible, position]);

  // Confirmation is deliberately brief — it must not cover the slide for long
  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function commitNote() {
    const body = (noteDraft ?? "").trim();
    setNoteDraft(null);
    if (body) capture(body);
  }

  function handleNoteKey(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Shift+Enter keeps the newline, plain Enter saves and gets back to the slide
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commitNote();
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) exitFullscreen();
    else requestFullscreen();
  }

  function paintPointer(x: number, y: number) {
    seenPointer.current = true;
    pointer.current = { x, y };
    const node = stageRef.current;
    if (!node) return;
    node.style.setProperty("--spot-x", `${x}px`);
    node.style.setProperty("--spot-y", `${y}px`);
    node.style.setProperty("--laser-x", `${x}px`);
    node.style.setProperty("--laser-y", `${y}px`);
  }

  function toggleLaser() {
    // Place the dot before the element mounts, using the last move.
    if (!laser && seenPointer.current) paintPointer(pointer.current.x, pointer.current.y);
    setLaser((on) => !on);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    setControlsVisible(true);
    // Always record the point. Highlighter and laser read the same CSS variables,
    // so turning one on later does not wait for another move.
    paintPointer(event.clientX, event.clientY);
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
      data-laser={laser}
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

      {/* Tight dot for one word. Above the dim, still click-through. */}
      {laser && <div className="laser" aria-hidden />}

      {flash && (
        <div className="present-flash" role="status">
          {flash.text}
        </div>
      )}

      {noteOpen && (
        <div className="present-note">
          <label className="present-note-label mono" htmlFor="present-note">
            Note on {String(position + 1).padStart(2, "0")} · {slide.title}
          </label>
          <textarea
            id="present-note"
            className="present-note-input"
            rows={3}
            maxLength={500}
            autoFocus
            placeholder="What did the room ask for?"
            value={noteDraft ?? ""}
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={handleNoteKey}
          />
          <p className="present-note-hint mono">
            <kbd>Enter</kbd> save · <kbd>Alt</kbd>+<kbd>N</kbd> close · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
          </p>
        </div>
      )}

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
        <button
          type="button"
          className="present-button present-wide"
          data-on={laser}
          onClick={toggleLaser}
          title="Point at one word. The slide stays fully lit."
        >
          Laser {laser ? "on" : "off"} <kbd>L</kbd>
        </button>
        <button type="button" className="present-button present-wide" onClick={toggleFullscreen}>
          {isFullscreen ? "Exit full screen" : "Full screen"} <kbd>F</kbd>
        </button>
        <button
          type="button"
          className="present-button present-wide"
          data-on={noteOpen}
          onClick={() => setNoteDraft(noteOpen ? null : "")}
          title="Write down feedback on this slide"
        >
          Note
          {slide.notes.length > 0 && <span className="present-note-count">{slide.notes.length}</span>}
          <kbd>N</kbd>
        </button>
        <button
          type="button"
          className="present-button present-wide"
          onClick={() => capture("")}
          title="Flag this slide to come back to — no typing"
        >
          Flag <kbd>M</kbd>
        </button>
        <button type="button" className="present-button present-wide" onClick={exit}>
          Close <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  );
}

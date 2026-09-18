/**
 * Must run inside a click/keypress handler — browsers reject fullscreen otherwise.
 * If it is refused the presentation still fills the window, just with browser chrome.
 */
export function requestFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => undefined);
}

export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
}

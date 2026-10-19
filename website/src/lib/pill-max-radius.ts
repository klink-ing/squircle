/**
 * The textareas and the height scrubber on the max radius demo
 * (src/pages/demos/pill-max-radius.astro). The drawing mode is
 * ./pill-gallery's.
 */
// Textareas grow with `field-sizing: content`; where that isn't
// supported, by setting their height to fit as they're typed in.
if (!CSS.supports("field-sizing", "content")) {
  const fit = (field: HTMLTextAreaElement) => {
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };
  for (const field of document.querySelectorAll<HTMLTextAreaElement>("textarea[data-grow]")) {
    fit(field);
    field.addEventListener("input", () => fit(field));
  }
}

// The scrubber: a field held at a height between one line and five.
const field = document.getElementById("scrub-field") as HTMLTextAreaElement;
const slider = document.getElementById("scrub-lines") as HTMLInputElement;
const readout = document.getElementById("scrub-value") as HTMLOutputElement;
const play = document.getElementById("scrub-play") as HTMLButtonElement;
const line = parseFloat(getComputedStyle(field).lineHeight);
const padding =
  parseFloat(getComputedStyle(field).paddingTop) +
  parseFloat(getComputedStyle(field).paddingBottom);

const show = (lines: number) => {
  slider.value = String(lines);
  readout.value = lines.toFixed(2);
  field.style.height = `${lines * line + padding}px`;
};
/** One sweep, up and back down, in milliseconds. */
const PERIOD = 5000;
let frame = 0;
const pause = () => {
  cancelAnimationFrame(frame);
  frame = 0;
  play.textContent = "Play";
};
slider.addEventListener("input", () => {
  pause();
  show(+slider.value);
});
play.addEventListener("click", () => {
  if (frame) return pause();
  play.textContent = "Pause";
  // Start the sweep from wherever the slider is.
  const from = Math.acos(1 - ((+slider.value - 1) / 4) * 2) / Math.PI;
  const start = performance.now() - from * (PERIOD / 2);
  const tick = (now: number) => {
    const phase = ((now - start) % PERIOD) / PERIOD;
    show(1 + 4 * ((1 - Math.cos(phase * 2 * Math.PI)) / 2));
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
});
show(1);

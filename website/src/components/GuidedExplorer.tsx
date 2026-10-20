import { useCallback, useEffect, useRef, useState } from "react";
import { useAnimate, useMotionValue, useMotionValueEvent } from "motion/react";
import type { AnimationPlaybackControlsWithThen } from "motion";
import ExplorerGraphic, { type GraphicState } from "./ExplorerGraphic";
import FreeExplorer from "./FreeExplorer";
import TourComposition from "./tour/TourComposition";
import { graphicFromTracks } from "./tour/graphic-state";
import {
  CHECKPOINTS,
  DURATION,
  STRENGTH,
  checkpointAtTime,
  nextCheckpoint,
  previousCheckpoint,
} from "./tour/timeline";
import { useMediaQuery } from "./tour/useMediaQuery";
import "./tour/tour.css";

export default function GuidedExplorer() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const clock = useMotionValue(0);
  const baseAmount = useMotionValue(1);
  const choiceWeight = useMotionValue(0);
  const comparison = useMotionValue(0);
  const correction = useMotionValue(0);
  const controls = useRef<AnimationPlaybackControlsWithThen | null>(null);
  const frame = useRef(0);
  const moving = useRef(true);
  const target = useRef(0);
  const focusRequested = useRef(true);
  const [playback, setPlayback] = useState({ time: 0, destination: 0, moving: true });
  const [amount, setAmount] = useState(2);
  const [explore, setExplore] = useState<GraphicState | null>(null);
  const [values, setValues] = useState([1, 0, 0, 0]);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reduced = useRef(reducedMotion);
  reduced.current = reducedMotion;
  const snapshotGraphic = () =>
    setValues([baseAmount.get(), choiceWeight.get(), comparison.get(), correction.get()]);
  useMotionValueEvent(baseAmount, "change", snapshotGraphic);
  useMotionValueEvent(choiceWeight, "change", snapshotGraphic);
  useMotionValueEvent(comparison, "change", snapshotGraphic);
  useMotionValueEvent(correction, "change", snapshotGraphic);
  const graphic = graphicFromTracks(values[0]!, values[1]!, values[2]!, values[3]!, amount);
  const active = checkpointAtTime(playback.time);

  const focusExploreHeading = useCallback((element: HTMLHeadingElement | null) => {
    element?.focus({ preventScroll: true });
  }, []);

  const focusHeading = useCallback(() => {
    scope.current
      ?.querySelector<HTMLElement>("section:not([hidden]) [data-tour-heading]")
      ?.focus({ preventScroll: true });
  }, [scope]);

  const seek = useCallback((time: number, destination: number, focus = true) => {
    focusRequested.current = focus;
    cancelAnimationFrame(frame.current);
    controls.current?.pause();
    if (controls.current) controls.current.time = time;
    moving.current = false;
    target.current = destination;
    setPlayback({ time, destination, moving: false });
  }, []);

  const playTo = useCallback(
    (destination: number) => {
      const current = controls.current;
      if (!current) return;
      const stop = CHECKPOINTS[destination]!.time;
      target.current = destination;
      moving.current = true;
      if (reduced.current) {
        seek(stop, destination);
        return;
      }
      setPlayback({ time: current.time, destination, moving: true });
      current.play();
      const tick = () => {
        if (current.time >= stop) {
          seek(stop, destination);
          return;
        }
        setPlayback({ time: current.time, destination, moving: true });
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [seek],
  );

  useEffect(() => {
    // Actual shared sequence: text, geometry tracks, labels and clock share these controls.
    const animation = animate(
      [
        [clock, [0, DURATION], { at: 0, duration: DURATION, ease: "linear" }],
        { name: "rounded", at: CHECKPOINTS[0].start },
        { name: "superellipse", at: CHECKPOINTS[1].start },
        { name: "radius", at: CHECKPOINTS[2].start },
        { name: "strength", at: CHECKPOINTS[3].start },
        { name: "correction", at: CHECKPOINTS[4].start },
        { name: "alignment", at: CHECKPOINTS[5].start },
        { name: "utilities", at: CHECKPOINTS[6].start },
        [
          '[data-scene="rounded"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "rounded", duration: 0.4, ease: "easeOut" },
        ],
        [
          '[data-scene="superellipse"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "superellipse", duration: 0.4, ease: "easeOut" },
        ],
        [
          '[data-scene="radius"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "radius", duration: 0.4, ease: "easeOut" },
        ],
        [
          '[data-scene="strength"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "strength", duration: 0.4, ease: "easeOut" },
        ],
        [
          '[data-scene="correction"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "correction", duration: 0.4, ease: "easeOut" },
        ],
        [
          '[data-scene="alignment"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "alignment", duration: 0.4, ease: "easeOut" },
        ],
        [
          '[data-scene="utilities"]',
          { opacity: [0, 1], x: [18, 0] },
          { at: "utilities", duration: 0.4, ease: "easeOut" },
        ],
        [baseAmount, [1, 2], { at: "superellipse", duration: 1, ease: "easeInOut" }],
        [comparison, [0, 1], { at: "radius", duration: 0.8, ease: "easeInOut" }],
        [choiceWeight, [0, 1], { at: "strength", duration: 0.5, ease: "easeInOut" }],
        [choiceWeight, [1, 0], { at: "correction", duration: 1, ease: "easeInOut" }],
        [correction, [0, 1], { at: "correction", duration: 1, ease: "easeInOut" }],
      ],
      { autoplay: false },
    );
    controls.current = animation;
    playTo(0);
    return () => {
      cancelAnimationFrame(frame.current);
      animation.stop();
      controls.current = null;
    };
  }, [animate, clock, baseAmount, choiceWeight, comparison, correction, playTo]);

  useEffect(() => {
    if (reducedMotion && moving.current) seek(CHECKPOINTS[target.current]!.time, target.current);
  }, [reducedMotion, seek]);
  useEffect(() => {
    if (!playback.moving && !explore && focusRequested.current) {
      focusHeading();
      focusRequested.current = false;
    }
  }, [playback.moving, playback.destination, explore, focusHeading]);

  const onNext = () => {
    if (moving.current) return;
    if (playback.time >= DURATION) {
      setExplore(graphic);
      return;
    }
    playTo(nextCheckpoint(playback.time));
  };
  const onBack = () => {
    const destination = previousCheckpoint(target.current);
    seek(CHECKPOINTS[destination]!.time, destination);
  };
  return (
    <div ref={scope} className="motion-tour">
      <div
        hidden={explore !== null}
        inert={explore !== null}
        data-tour-composition
        data-tour-time={playback.time.toFixed(4)}
        data-tour-checkpoint={CHECKPOINTS[active]!.id}
        data-tour-moving={playback.moving}
        data-tour-amount={graphic.amount}
        data-tour-correction={graphic.correctionAmount}
      >
        <div className="tour-layout">
          <div className="tour-graphic">
            <ExplorerGraphic {...graphic} />
          </div>
          <div className="tour-narrative">
            <TourComposition
              active={active}
              amount={amount}
              onAmountChange={setAmount}
              strengthActive={!playback.moving && Math.abs(playback.time - STRENGTH.time) < 0.00001}
            />
            <nav aria-label="Tour navigation">
              <button type="button" onClick={onBack} disabled={playback.destination === 0}>
                ← Back
              </button>
              <span aria-label={`Scene ${active + 1} of ${CHECKPOINTS.length}`}>
                {active + 1} / {CHECKPOINTS.length}
              </span>
              <button type="button" onClick={onNext} disabled={playback.moving}>
                {CHECKPOINTS[active]!.nextLabel}
              </button>
            </nav>
            <details className="tour-scrubber">
              <summary>Seek the tour</summary>
              <label htmlFor="tour-time">
                Timeline{" "}
                <output htmlFor="tour-time">
                  {playback.time.toFixed(1)}s / {DURATION}s
                </output>
              </label>
              <input
                id="tour-time"
                aria-label="Tour timeline"
                type="range"
                min={0}
                max={DURATION}
                step={0.01}
                value={playback.time}
                onChange={(event) => {
                  const time = Number(event.target.value);
                  seek(time, checkpointAtTime(time), false);
                }}
              />
            </details>
          </div>
        </div>
      </div>
      {explore && (
        <div className="tour-layout tour-explore">
          <div className="tour-graphic">
            <ExplorerGraphic {...explore} />
          </div>
          <div className="tour-narrative">
            <h2 tabIndex={-1} ref={focusExploreHeading}>
              Explore
            </h2>
            <FreeExplorer
              graphicState={explore}
              onGraphicStateChange={(partial) =>
                setExplore((previous) => (previous ? { ...previous, ...partial } : previous))
              }
            />
            <button
              type="button"
              onClick={() => {
                focusRequested.current = true;
                setExplore(null);
              }}
            >
              ← Back to tour
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import ExplorerGraphic, { type GraphicState } from "./ExplorerGraphic";
import FreeExplorer from "./FreeExplorer";
import TourNarrative from "./tour/TourNarrative";
import { graphicFromTracks } from "./tour/graphic-state";
import {
  CHECKPOINTS,
  APPARENT_RADIUS,
  CORRECTION,
  checkpointAtTime,
  createTourTimeline,
  DURATION,
  DEFAULT_STRENGTH,
  initialTracks,
  STRENGTH,
} from "./tour/timeline";
import { createPlayback, type PlaybackState } from "./tour/playback";
import { useMediaQuery } from "./tour/useMediaQuery";
import "./tour/tour.css";

gsap.registerPlugin(useGSAP);

export default function GuidedExplorer() {
  const root = useRef<HTMLDivElement>(null);
  const tour = useRef<ReturnType<typeof createTourTimeline> | null>(null);
  const controls = useRef<ReturnType<typeof createPlayback> | null>(null);
  const chosen = useRef(DEFAULT_STRENGTH);
  const [amount, setAmount] = useState(DEFAULT_STRENGTH);
  const [view, setView] = useState({ time: 0, graphic: graphicFromTracks(initialTracks(), 0) });
  const [playback, setPlayback] = useState<PlaybackState>({ destination: 0, moving: true });
  const [focusRequest, requestFocus] = useState(0);
  const [explore, setExplore] = useState<GraphicState | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const active = checkpointAtTime(view.time);
  const cue = CHECKPOINTS[active]!;

  const publish = useCallback(() => {
    const current = tour.current;
    if (current) {
      const time = current.timeline.time();
      setView({ time, graphic: graphicFromTracks(current.tracks, time, chosen.current) });
    }
  }, []);

  const { contextSafe } = useGSAP(
    () => {
      const panels = Array.from(root.current!.querySelectorAll<HTMLElement>("[data-tour-panel]"));
      const current = createTourTimeline(publish, panels);
      tour.current = current;
      const transport = createPlayback(current.timeline, publish, setPlayback, () =>
        requestFocus((v) => v + 1),
      );
      controls.current = transport;
      transport.start(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      return () => {
        transport.dispose();
        controls.current = null;
        tour.current = null;
      };
    },
    { scope: root, dependencies: [] },
  );

  useEffect(() => {
    controls.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const focusHeading = useCallback(() => {
    root.current
      ?.querySelector<HTMLElement>("[data-tour-panel]:not([hidden]) h2")
      ?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    if (focusRequest) focusHeading();
  }, [focusRequest, focusHeading]);
  const focusExplore = useCallback(
    (heading: HTMLHeadingElement | null) => heading?.focus({ preventScroll: true }),
    [],
  );

  const changeAmount = (value: number) => {
    chosen.current = value;
    setAmount(value);
    publish(); // Immediate graphic update without recreating the input or the timeline.
  };
  const next = contextSafe(() => {
    if (controls.current?.next()) setExplore({ ...view.graphic });
  });
  const back = contextSafe(() => controls.current?.back());
  const seek = contextSafe((time: number) => controls.current?.seek(time));
  const checkpoint = contextSafe((index: number) => controls.current?.checkpoint(index));
  const togglePlayback = contextSafe(() => {
    if (playback.moving) controls.current?.pause();
    else controls.current?.resume();
  });
  const strengthActive =
    (cue.id === STRENGTH.id || cue.id === APPARENT_RADIUS.id || cue.id === CORRECTION.id) &&
    Math.abs(view.time - cue.time) < 0.001 &&
    !playback.moving;

  return (
    <div ref={root} className="tour-root">
      <div hidden={explore !== null} inert={explore !== null}>
        <div
          className="tour-layout"
          data-tour-checkpoint={cue.id}
          data-tour-time={view.time}
          data-tour-moving={playback.moving}
        >
          <div
            className="tour-graphic"
            data-tour-amount={view.graphic.amount}
            data-tour-correction={view.graphic.correctionAmount}
            data-tour-radius-comparison={Number(view.graphic.radiusComparison) > 0}
          >
            <ExplorerGraphic {...view.graphic} />
          </div>
          <div className="tour-content">
            <TourNarrative
              active={active}
              amount={amount}
              strengthActive={strengthActive}
              onAmountChange={changeAmount}
            />
            <nav aria-label="Tour navigation" className="tour-navigation">
              <button type="button" onClick={back} disabled={playback.destination === 0}>
                ← Back
              </button>
              <span aria-label={`Scene ${active + 1} of ${CHECKPOINTS.length}`}>
                {active + 1} / {CHECKPOINTS.length}
              </span>
              <button type="button" onClick={next} disabled={playback.moving}>
                {CHECKPOINTS[playback.destination]!.nextLabel}
              </button>
            </nav>
            <p className="sr-only" role="status">
              {!playback.moving && `Scene ${active + 1} of ${CHECKPOINTS.length}`}
            </p>
          </div>
        </div>
        {import.meta.env.DEV && (
          <details className="tour-transport">
            <summary>Author transport · GSAP</summary>
            <p>
              Development preview. Seek the shared timeline in seconds or jump to a reading stop.
            </p>
            <div className="tour-transport-actions">
              <button type="button" onClick={togglePlayback}>
                {playback.moving ? "Pause" : "Play to checkpoint"}
              </button>
              <label htmlFor="tour-checkpoint">Reading stop</label>
              <select
                id="tour-checkpoint"
                value={playback.destination}
                onChange={(e) => checkpoint(Number(e.target.value))}
              >
                {CHECKPOINTS.map((stop, index) => (
                  <option key={stop.id} value={index}>
                    {index + 1}. {stop.id}
                  </option>
                ))}
              </select>
            </div>
            <label htmlFor="tour-time">
              Timeline{" "}
              <output htmlFor="tour-time">
                {view.time.toFixed(2)} / {DURATION.toFixed(2)} s
              </output>
            </label>
            <input
              id="tour-time"
              type="range"
              min={0}
              max={DURATION}
              step={0.01}
              value={view.time}
              onChange={(e) => seek(Number(e.target.value))}
            />
          </details>
        )}
      </div>
      {explore && (
        <div className="tour-layout tour-explore">
          <div className="tour-graphic">
            <ExplorerGraphic {...explore} />
          </div>
          <div className="tour-content">
            <h2 tabIndex={-1} ref={focusExplore}>
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
              className="tour-return"
              onClick={() => {
                setExplore(null);
                requestFocus((v) => v + 1);
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

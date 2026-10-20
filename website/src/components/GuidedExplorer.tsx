import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Player, type PlayerRef } from "@remotion/player";
import ExplorerGraphic, { type GraphicState } from "./ExplorerGraphic";
import FreeExplorer from "./FreeExplorer";
import TourComposition from "./tour/TourComposition";
import { graphicAtFrame } from "./tour/graphic-state";
import {
  CHECKPOINTS,
  DURATION,
  FORMATS,
  FPS,
  previousCheckpoint,
  WIDE_QUERY,
} from "./tour/timeline";
import { useMediaQuery } from "./tour/useMediaQuery";

export default function GuidedExplorer() {
  const player = useRef<PlayerRef>(null);
  const root = useRef<HTMLDivElement>(null);
  const movingRef = useRef(true);
  const focusRequested = useRef(false);
  const [playback, setPlayback] = useState({ destination: 0, moving: true });
  const [amount, setAmount] = useState(2);
  const [explore, setExplore] = useState<GraphicState | null>(null);
  const wide = useMediaQuery(WIDE_QUERY);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const format = wide ? FORMATS.wide : FORMATS.compact;

  const focusExploreHeading = useCallback((element: HTMLHeadingElement | null) => {
    element?.focus({ preventScroll: true });
  }, []);

  const focusHeading = useCallback(() => {
    root.current?.querySelector<HTMLElement>("[data-tour-heading]")?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const current = player.current;
    if (!current) return;
    const settled = () => {
      movingRef.current = false;
      setPlayback((previous) => ({ ...previous, moving: false }));
    };
    current.addEventListener("ended", settled);
    return () => current.removeEventListener("ended", settled);
  }, []);

  // Player's ended event can precede the final frame's React commit. Focus only
  // after settlement, and never steal focus on load or on a slider update.
  useEffect(() => {
    if (!playback.moving && !explore && focusRequested.current) {
      focusRequested.current = false;
      focusHeading();
    }
  }, [playback.moving, playback.destination, explore, focusHeading]);

  // Playback bounds have committed before play() runs; Remotion stops at outFrame.
  useEffect(() => {
    const current = player.current;
    if (!current || explore) return;
    if (reducedMotion && playback.moving) {
      current.pause();
      current.seekTo(CHECKPOINTS[playback.destination]!.frame);
      movingRef.current = false;
      setPlayback((previous) => (previous.moving ? { ...previous, moving: false } : previous));
    } else if (!reducedMotion && playback.moving) {
      current.play();
    }
  }, [playback.destination, playback.moving, reducedMotion, explore]);

  const onNext = () => {
    if (movingRef.current) return;
    if (playback.destination === CHECKPOINTS.length - 1) {
      player.current?.pause();
      setExplore(graphicAtFrame(DURATION - 1, amount));
      return;
    }
    movingRef.current = true;
    focusRequested.current = true;
    setPlayback((previous) => ({ destination: previous.destination + 1, moving: true }));
  };

  const onBack = () => {
    const destination = previousCheckpoint(playback.destination);
    player.current?.pause();
    movingRef.current = false;
    focusRequested.current = true;
    // Commit the earlier bound together with the seek to avoid painting a stale destination.
    flushSync(() => setPlayback({ destination, moving: false }));
    player.current?.seekTo(CHECKPOINTS[destination]!.frame);
    focusHeading();
  };

  return (
    <div ref={root}>
      <div hidden={explore !== null} inert={explore !== null}>
        <Player
          ref={player}
          component={TourComposition}
          inputProps={{
            amount,
            moving: playback.moving,
            navigationDestination: playback.destination,
            onAmountChange: setAmount,
            onNext,
            onBack,
          }}
          compositionWidth={format.width}
          compositionHeight={format.height}
          durationInFrames={DURATION}
          fps={FPS}
          outFrame={CHECKPOINTS[playback.destination]!.frame}
          controls={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          moveToBeginningWhenEnded={false}
          style={{ width: "100%", maxWidth: format.maxWidth, margin: "0 auto" }}
        />
      </div>
      {explore && (
        <div className="grid gap-8 pb-10 md:grid-cols-2">
          <ExplorerGraphic {...explore} />
          <div className="min-w-0">
            <h2 tabIndex={-1} ref={focusExploreHeading} className="mb-6 text-3xl font-bold">
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
              className="mt-6 min-h-12 text-zinc-400 hover:text-zinc-100"
              onClick={() => {
                flushSync(() => setExplore(null));
                focusHeading();
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

import type gsap from "gsap";
import { checkpointAtTime, type createTourTimeline } from "./timeline";

export interface PlaybackState {
  destination: number;
  moving: boolean;
}

// Interaction policy only. Native tweenTo/seek own timing, interpolation and exact stops.
export function createPlayback(
  tour: ReturnType<typeof createTourTimeline>,
  publish: () => void,
  onChange: (state: PlaybackState) => void,
  onSettled: () => void,
) {
  const { timeline, checkpoints } = tour;
  let destination = 0;
  let moving = false;
  let reduced = false;
  let driver: gsap.core.Tween | undefined;
  const notify = () => onChange({ destination, moving });
  const cancel = () => {
    driver?.kill();
    driver = undefined;
    timeline.pause();
  };
  const settle = (focus: boolean) => {
    moving = false;
    publish();
    notify();
    if (focus) onSettled();
  };
  const seekStop = (index: number, focus = true) => {
    cancel();
    destination = index;
    timeline.seek(checkpoints[index]!.id);
    settle(focus);
  };
  const move = (index: number) => {
    cancel();
    destination = index;
    if (reduced) {
      seekStop(index);
      return;
    }
    moving = true; // Synchronous guard: rapid activation cannot skip a reading stop.
    notify();
    driver = timeline.tweenTo(checkpoints[index]!.id, {
      ease: "none",
      onComplete: () => settle(true),
    });
  };
  return {
    start(reducedMotion: boolean) {
      reduced = reducedMotion;
      move(0);
    },
    next() {
      if (moving) return false;
      // After an author scrub, settle this scene before continuing.
      if (timeline.time() < checkpoints[destination]!.time - 0.001) {
        move(destination);
        return false;
      }
      if (destination === checkpoints.length - 1) return true;
      move(destination + 1);
      return false;
    },
    back() {
      seekStop(Math.max(0, destination - 1));
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      if (reduced && moving) seekStop(destination);
    },
    seek(time: number) {
      cancel();
      timeline.seek(Math.max(0, Math.min(timeline.duration(), time)));
      destination = checkpointAtTime(timeline.time(), checkpoints);
      settle(false); // Scrubbing must keep focus on the transport input.
    },
    checkpoint(index: number) {
      seekStop(index, false);
    },
    pause() {
      cancel();
      settle(false);
    },
    resume() {
      if (!moving) move(destination);
    },
    dispose: cancel,
  };
}

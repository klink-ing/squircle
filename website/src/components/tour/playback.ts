import gsap from "gsap";
import { checkpointAtTime, type createTourTimeline } from "./timeline";
import { DEFAULT_STRENGTH } from "./state";

// Strength units per second: a full 1.0 change takes 0.25s; no distance takes no time.
export const STRENGTH_RETURN_SPEED = 4;

interface StrengthInput {
  get: () => number;
  set: (value: number) => void;
}

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
  strength?: StrengthInput,
) {
  const { timeline, checkpoints } = tour;
  let destination = 0;
  let moving = false;
  let reduced = false;
  let driver: gsap.core.Tween | undefined;
  let pendingNext: (() => void) | undefined;
  const notify = () => onChange({ destination, moving });
  const cancel = () => {
    driver?.kill();
    driver = undefined;
    pendingNext = undefined;
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
  const returnStrength = (advance: () => void, index: number) => {
    cancel();
    destination = index;
    const value = { amount: strength?.get() ?? DEFAULT_STRENGTH };
    const distance = Math.abs(value.amount - DEFAULT_STRENGTH);
    if (reduced || distance === 0) {
      if (distance > 0) strength!.set(DEFAULT_STRENGTH);
      advance();
      return;
    }
    moving = true;
    pendingNext = advance;
    notify();
    // Keep the slide's playhead still until the live input has returned to the default.
    driver = gsap.to(value, {
      amount: DEFAULT_STRENGTH,
      duration: distance / STRENGTH_RETURN_SPEED,
      ease: "power2.out",
      onUpdate: () => strength!.set(value.amount),
      onComplete: () => {
        pendingNext = undefined;
        strength!.set(DEFAULT_STRENGTH);
        advance();
      },
    });
  };
  return {
    start(reducedMotion: boolean) {
      reduced = reducedMotion;
      move(0);
    },
    next(onExplore?: () => void) {
      if (moving) return;
      // After an author scrub, settle this scene before continuing.
      const unfinished = timeline.time() < checkpoints[destination]!.time - 0.001;
      const explore = !unfinished && destination === checkpoints.length - 1;
      const index = unfinished || explore ? destination : destination + 1;
      returnStrength(() => {
        if (explore) {
          settle(false);
          onExplore?.();
        } else move(index);
      }, index);
    },
    back() {
      seekStop(Math.max(0, destination - 1));
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      if (reduced && moving) {
        if (pendingNext) returnStrength(pendingNext, destination);
        else seekStop(destination);
      }
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
      const advance = pendingNext;
      cancel();
      pendingNext = advance;
      settle(false);
    },
    resume() {
      if (!moving) {
        if (pendingNext) returnStrength(pendingNext, destination);
        else move(destination);
      }
    },
    dispose: cancel,
  };
}

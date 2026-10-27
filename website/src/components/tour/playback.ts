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
  let driver: gsap.core.Tween | gsap.core.Timeline | undefined;
  let movingStrength = false;
  let pendingNext: (() => void) | undefined;
  const notify = () => onChange({ destination, moving });
  const cancel = () => {
    driver?.kill();
    driver = undefined;
    movingStrength = false;
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
    const stop = checkpoints[index]!;
    const from = timeline.time();
    const concurrent = stop.strengthReturn === "with-transition" && from < stop.time;
    const value = { amount: strength?.get() ?? DEFAULT_STRENGTH };
    const distance = Math.abs(value.amount - DEFAULT_STRENGTH);
    if (reduced) {
      if (concurrent && distance > 0) strength!.set(DEFAULT_STRENGTH);
      seekStop(index);
      return;
    }
    moving = true; // Synchronous guard: rapid activation cannot skip a reading stop.
    notify();
    const playhead = timeline.tweenTo(stop.id, { ease: "none" });
    if (concurrent && distance > 0) {
      movingStrength = true;
      // One native timeline owns both motions, so cancellation and pause/resume stay atomic.
      driver = gsap.timeline({ onComplete: () => settle(true) });
      driver.add(playhead, 0);
      const start = stop.start + (stop.strengthReturnStart ?? 0);
      const end = stop.start + (stop.strengthReturnEnd ?? 0);
      const returnStart = Math.max(0, start - from);
      const synchronized = stop.strengthReturnEnd !== undefined;
      const duration = synchronized
        ? Math.max(0, end - Math.max(from, start))
        : distance / STRENGTH_RETURN_SPEED;
      const progress = end > start ? gsap.utils.clamp(0, 1, (from - start) / (end - start)) : 1;
      const ease = gsap.parseEase(stop.strengthReturnEase ?? "none");
      const easedStart = ease(progress);
      // On resume, continue the same easing segment instead of restarting its acceleration.
      const remainingEase = (time: number) =>
        (ease(progress + (1 - progress) * time) - easedStart) / (1 - easedStart);
      driver.to(
        value,
        {
          amount: DEFAULT_STRENGTH,
          duration,
          ease: synchronized ? (progress < 1 ? remainingEase : "none") : "power2.out",
          onUpdate: () => strength!.set(value.amount),
          onComplete: () => strength!.set(DEFAULT_STRENGTH),
        },
        returnStart,
      );
    } else {
      driver = playhead;
      driver.eventCallback("onComplete", () => settle(true));
    }
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
      if (!explore && checkpoints[index]!.strengthReturn === "with-transition") {
        move(index);
        return;
      }
      returnStrength(() => {
        if (explore) {
          settle(false);
          onExplore?.();
        } else move(index);
      }, index);
    },
    back() {
      // tweenTo drives the same authored timeline backward, including text and geometry.
      move(Math.max(0, destination - 1));
    },
    setReducedMotion(value: boolean) {
      reduced = value;
      if (reduced && moving) {
        if (movingStrength) strength?.set(DEFAULT_STRENGTH);
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

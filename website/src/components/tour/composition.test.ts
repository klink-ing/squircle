import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Player } from "@remotion/player";
import { describe, expect, it } from "vitest";
import TourComposition, { type TourCompositionProps } from "./TourComposition";
import { CHECKPOINTS, DURATION, FORMATS, FPS, STRENGTH } from "./timeline";

function render(frame: number, props: TourCompositionProps = {}) {
  return renderToStaticMarkup(
    createElement(Player, {
      component: TourComposition,
      inputProps: { onAmountChange: () => {}, onNext: () => {}, onBack: () => {}, ...props },
      compositionWidth: FORMATS.compact.width,
      compositionHeight: FORMATS.compact.height,
      durationInFrames: DURATION,
      fps: FPS,
      initialFrame: frame,
    }),
  );
}

describe("native composition seeking and interaction gates", () => {
  it("mounts the correct narrative for direct seeks to all seven reading stops", () => {
    for (const cue of CHECKPOINTS) {
      const html = render(cue.frame);
      expect(html).toContain(`data-tour-checkpoint="${cue.id}"`);
      expect(html).toContain(`data-tour-frame="${cue.frame}"`);
      expect(html).not.toContain('aria-hidden="true"');
      expect(html.includes('id="tour-strength"')).toBe(cue === STRENGTH);
      expect(html).toContain(cue.nextLabel);
    }
  });

  it("disables outgoing controls and removes outgoing copy from accessibility", () => {
    const html = render(STRENGTH.frame + 1, { moving: true });
    expect(html).toContain('inert="" aria-hidden="true"');
    expect(html).toMatch(/id="tour-strength"[^>]*disabled=""/);
    expect(html).toMatch(/disabled=""[^>]*>Next<\/button>/);
  });

  it("enables Back immediately when a forward destination is requested", () => {
    const html = render(CHECKPOINTS[0].frame, { moving: true, navigationDestination: 1 });
    expect(html).toMatch(/<button type="button" style="[^"]*">← Back<\/button>/);
    expect(render(CHECKPOINTS[0].frame)).toMatch(/disabled=""[^>]*>← Back<\/button>/);
  });

  it("restores the remembered range value on a direct backward seek", () => {
    const html = render(STRENGTH.frame, { amount: 2.7 });
    expect(html).toMatch(
      /id="tour-strength"[^>]*min="1"[^>]*max="3"[^>]*step="0.1"[^>]*value="2.7"/,
    );
    expect(html).not.toMatch(/id="tour-strength"[^>]*disabled/);
    expect(html.indexOf("Higher strength")).toBeLessThan(html.indexOf('id="tour-strength"'));
    expect(html.indexOf('id="tour-strength"')).toBeLessThan(html.indexOf("Next, we"));
  });
});

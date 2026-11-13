import { expect, test } from "@playwright/test";

// What the corrected radius multiplies the plain one by at the default
// amount of 2: the squircle's 45° point lands where a circle's would.
const FACTOR = (1 - 2 ** -0.5) / (1 - 2 ** -(2 ** -2));
const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"];

for (const source of ["plugin", "utils"]) {
  test(`${source}: combined squircle utilities keep each corner's own radius`, async ({
    page,
    browserName,
  }) => {
    await page.goto(`/tests/radius-combos-${source}.html`);
    await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
    const { supported, boxes } = await page.evaluate((corners) => {
      return {
        supported: CSS.supports("corner-shape", "superellipse(2)"),
        boxes: [...document.querySelectorAll<HTMLElement>(".box")].map((box) => {
          const style = getComputedStyle(box);
          return {
            label: box.dataset["label"]!,
            expected: JSON.parse(box.dataset["expected"]!) as { px: number; squircled: boolean }[],
            actual: corners.map((c) => parseFloat(style.getPropertyValue(`border-${c}-radius`))),
          };
        }),
      };
    }, CORNERS);

    // Chromium is the browser that takes the corrected branch; without it
    // this would only ever check the fallback.
    if (browserName === "chromium") expect(supported).toBe(true);
    expect(boxes.length).toBeGreaterThan(0);

    for (const { label, expected, actual } of boxes) {
      expected.forEach(({ px, squircled }, i) => {
        const want = squircled && supported ? px * FACTOR : px;
        expect.soft(actual[i], `${label}: ${CORNERS[i]}`).toBeCloseTo(want, 1);
      });
    }
  });
}

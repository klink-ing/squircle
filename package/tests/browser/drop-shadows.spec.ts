import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";

test.use({ deviceScaleFactor: 2 });

async function expectDropShadow(page: Page, zoom: number, visible: boolean) {
  const cells = page.locator(".cell");
  const actual = PNG.sync.read(await cells.nth(0).screenshot());
  const reference = PNG.sync.read(await cells.nth(1).screenshot());
  const mask = PNG.sync.read(await cells.nth(2).screenshot());
  const margin = 2 * zoom;
  const at = (x: number, y: number) => (y * actual.width + x) * 4;
  let shadowPixels = 0;
  let differences = 0;
  let maxDifference = 0;
  for (let y = margin; y < actual.height - margin; y++) {
    for (let x = margin; x < actual.width - margin; x++) {
      // Compare the shadow around the caps as well as beyond the border box,
      // excluding one CSS pixel at the fill edge, which rasterizes differently
      // as a CSS mask and as an SVG path.
      if (
        [
          [x, y],
          [x - margin, y],
          [x + margin, y],
          [x, y - margin],
          [x, y + margin],
        ].some(([px, py]) => mask.data[at(px!, py!)]! < 255)
      )
        continue;
      const i = at(x, y);
      if (actual.data[i]! < 250) shadowPixels++;
      maxDifference = Math.max(maxDifference, Math.abs(actual.data[i]! - reference.data[i]!));
      // A CSS mask/clip and a directly filtered SVG can differ by a few
      // coverage levels at normal zoom, even with the identical outline.
      if (Math.abs(actual.data[i]! - reference.data[i]!) > 8) differences++;
    }
  }
  expect(differences, `drop shadow matches silhouette; max difference ${maxDifference}`).toBe(0);
  if (visible) expect(shadowPixels, "drop shadow paints outside the fill").toBeGreaterThan(0);
  else expect(shadowPixels, "removing the filter removes its shadow").toBe(0);
}

for (const mode of ["worklet", "polyfill", "native"]) {
  for (const zoom of [1, 3]) {
    test(`${mode} shadows from drop-shadow() at ${zoom * 100}% zoom`, async ({ page }) => {
      await page.goto(`/tests/drop-shadows.html?mode=${mode}&zoom=${zoom}`);
      await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
      await expectDropShadow(page, zoom, true);
      // A dynamic filter override must also follow the caps and stay unclipped.
      for (const filter of ["drop-shadow(-3px -2px 3px black)", "none"]) {
        await page.locator("button, .cell:nth-child(2) svg").evaluateAll((els, value) => {
          for (const el of els) (el as HTMLElement | SVGElement).style.filter = value;
        }, filter);
        await expectDropShadow(page, zoom, filter !== "none");
      }
      // An empty transparent pill has no rendered alpha to cast a drop shadow.
      await page.locator("button").evaluate((el) => {
        el.style.background = "transparent";
        el.style.filter = "drop-shadow(0 2px 2px black)";
      });
      const empty = PNG.sync.read(await page.locator(".cell").first().screenshot());
      expect(empty.data.every((channel) => channel === 255)).toBe(true);
    });
  }
}

import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

test.use({ deviceScaleFactor: 2 });

for (const mode of ["worklet", "polyfill"]) {
  for (const zoom of [3, 5]) {
    for (const shadow of ["hard", "blurred"]) {
      // Keep "worklet shadows" in the title so WebKit's project excludes an
      // unsupported renderer, just as it does for the other shadow tests.
      test(`${mode} shadows (${shadow}) have no seam at ${zoom * 100}% zoom`, async ({ page }) => {
        await page.goto(
          `/tests/seams.html?mode=${mode}&zoom=${zoom}${shadow === "blurred" ? "&blur" : ""}`,
        );
        await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
        const cells = page.locator(".cell");
        const actual = PNG.sync.read(await cells.nth(0).screenshot());
        const reference = PNG.sync.read(await cells.nth(1).screenshot());
        expect(actual.width).toBe(reference.width);
        expect(actual.height).toBe(reference.height);
        // Ignore the silhouette's outside antialiasing. Well inside its solid
        // black area, even at the curved fill/shadow join, pixels must be black.
        let lightPixels = 0;
        const margin = 2 * zoom;
        for (let y = margin; y < reference.height - margin; y++) {
          for (let x = margin; x < reference.width - margin; x++) {
            const at = (px: number, py: number) => (py * reference.width + px) * 4;
            if (
              [
                [x, y],
                [x - margin, y],
                [x + margin, y],
                [x, y - margin],
                [x, y + margin],
              ].some(([px, py]) => reference.data[at(px!, py!)]! > 0)
            )
              continue;
            if (actual.data[at(x, y)]! > 3) lightPixels++;
          }
        }
        expect(lightPixels, "no light hairline inside the joined fill and shadow").toBe(0);

        // The overlap must be confined to the edge, including transparent pills.
        await page.getByRole("button", { name: "Seam test" }).evaluate((el) => {
          el.style.background = "transparent";
        });
        await expect(page.getByRole("button", { name: "Seam test" })).toHaveCSS(
          "background-color",
          "rgba(0, 0, 0, 0)",
        );
        const transparent = PNG.sync.read(await cells.nth(0).screenshot());
        const center =
          (Math.floor(transparent.height / 2) * transparent.width +
            Math.floor(transparent.width / 2)) *
          4;
        expect([...transparent.data.subarray(center, center + 3)]).toEqual([255, 255, 255]);
      });
    }
  }
}

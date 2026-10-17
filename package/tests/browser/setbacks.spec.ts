import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

test.use({ deviceScaleFactor: 2 });
for (const mode of ["worklet", "polyfill", "native"])
  for (const continuity of [2, 3]) {
    test(`${mode} setbacks in G${continuity} follow inherited variables and updates`, async ({
      page,
    }) => {
      await page.goto(`/tests/setbacks.html?mode=${mode}&continuity=${continuity}`);
      await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
      const cells = page.locator(".cell");
      for (const [arc, edge, degrees] of [
        ["30deg", "1", 30],
        ["calc(0.25turn - 30deg)", "2", 60],
        ["0deg", "1", 0],
        ["45deg", "0", 45],
        ["15deg", "0.05", 15],
        ["30deg", "1", 30],
      ] as const) {
        await page.evaluate(
          async ([a, e, d]) => {
            await (
              window as unknown as { setSetbacks(a: string, e: string, d: number): Promise<void> }
            ).setSetbacks(a, e, d);
          },
          [arc, edge, degrees] as const,
        );
        await expect(page.locator("button").first()).toHaveCSS(
          "--squircle-pill-arc-setback",
          `${degrees}deg`,
        );
        const screenshots: PNG[] = [];
        for (let index = 0; index < 3; index++) {
          const cell = cells.nth(index);
          await cell.evaluate((el) => ((el as HTMLElement).style.visibility = "visible"));
          screenshots.push(PNG.sync.read(await cell.screenshot()));
          await cell.evaluate((el) => ((el as HTMLElement).style.visibility = "hidden"));
        }
        const [actual, literal, reference] = screenshots as [PNG, PNG, PNG];
        let literalDifferences = 0;
        let silhouetteDifferences = 0;
        let solidPixels = 0;
        const at = (x: number, y: number) => (y * actual.width + x) * 4;
        for (let y = 3; y < actual.height - 3; y++)
          for (let x = 3; x < actual.width - 3; x++) {
            const i = at(x, y);
            if (Math.abs(actual.data[i]! - literal.data[i]!) > 3) literalDifferences++;
            // Ignore only one CSS pixel around the SVG's antialiased edge.
            const neighbours = [
              [x, y],
              [x - 3, y],
              [x + 3, y],
              [x, y - 3],
              [x, y + 3],
            ].map(([px, py]) => reference.data[at(px!, py!)]!);
            if (neighbours.every((v) => v === 0)) {
              solidPixels++;
              if (actual.data[i]! > 3) silhouetteDifferences++;
            } else if (neighbours.every((v) => v === 255) && actual.data[i]! < 252)
              silhouetteDifferences++;
          }
        expect(solidPixels).toBeGreaterThan(100);
        expect(literalDifferences, `${arc}, ${edge}: literal and CSS-variable shapes match`).toBe(
          0,
        );
        expect(
          silhouetteDifferences,
          `${arc}, ${edge}: renderer follows the computed silhouette`,
        ).toBe(0);
      }
    });
  }

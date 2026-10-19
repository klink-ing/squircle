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
      for (const [arc, edge, degrees, width, height, max] of [
        ["30deg", "1", 30, 120],
        ["calc(0.25turn - 30deg)", "2", 60, 120],
        ["0deg", "1", 0, 120],
        ["45deg", "0", 45, 120],
        ["15deg", "0.05", 15, 120],
        ["90deg", "1", 90, 120],
        ["90deg", "4", 90, 44],
        ["45deg", "4", 45, 40],
        ["45deg", "4", 45, 40.4],
        ["45deg", "0.001", 45, 56],
        ["45deg", "0.75", 45, 160, 80, "16px"],
        ["45deg", "0.75", 45, 160, 50, "16px"],
        ["30deg", "1", 30, 60, 60, "16px"],
        ["30deg", "1", 30, 120],
      ] as ReadonlyArray<readonly [string, string, number, number, number?, string?]>) {
        await page.evaluate(
          async ([a, e, d, w, h, m]) => {
            await (
              window as unknown as {
                setSetbacks(
                  a: string,
                  e: string,
                  d: number,
                  w: number,
                  h?: number,
                  m?: string,
                ): Promise<void>;
              }
            ).setSetbacks(a, e, d, w, h, m);
          },
          [arc, edge, degrees, width, height, max] as const,
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

test("the max radius is inherited from an ancestor and defaults to unbounded", async ({ page }) => {
  await page.goto("/tests/setbacks.html?mode=native");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const read = () =>
    page
      .locator("button")
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--squircle-pill-max-radius"));
  const unset = await read();
  expect(unset.endsWith("px")).toBe(true);
  expect(parseFloat(unset)).toBeGreaterThan(1e6);
  await page.evaluate(async () => {
    await (
      window as unknown as {
        setSetbacks(
          a: string,
          e: string,
          d: number,
          w: number,
          h: number,
          m: string,
        ): Promise<void>;
      }
    ).setSetbacks("30deg", "1", 30, 160, 80, "16px");
  });
  expect(await read()).toBe("16px");
});

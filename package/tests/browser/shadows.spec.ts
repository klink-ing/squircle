import { expect, test, type Locator } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";

async function expectUnclipped(cells: Locator[], label: string) {
  const screenshots = [];
  for (const cell of cells) screenshots.push(PNG.sync.read(await cell.screenshot()));
  const literal = screenshots[0]!;
  const cellBox = (await cells[0]!.boundingBox())!;
  const buttonBox = (await cells[0]!.locator("button").boundingBox())!;
  const inside = (x: number, y: number) =>
    x >= buttonBox.x - cellBox.x &&
    x < buttonBox.x - cellBox.x + buttonBox.width &&
    y >= buttonBox.y - cellBox.y &&
    y < buttonBox.y - cellBox.y + buttonBox.height;
  let outerPixels = 0;
  for (let y = 0; y < literal.height; y++) {
    for (let x = 0; x < literal.width; x++) {
      if (inside(x, y)) continue;
      const i = (y * literal.width + x) * 4;
      if (Math.min(...literal.data.subarray(i, i + 3)) < 250) outerPixels++;
    }
  }
  expect(outerPixels, "shadow actually paints outside the button").toBeGreaterThan(0);

  // Compare shadow pixels beyond the border box. The background mask can
  // rasterize its cap edges differently after zooming; it is unrelated to
  // shadow clipping. Allow at most 3/255 of blur rasterization noise.
  for (const [index, candidate] of screenshots.slice(1).entries()) {
    expect(candidate.width).toBe(literal.width);
    expect(candidate.height).toBe(literal.height);
    let differences = 0;
    let maxDifference = 0;
    for (let i = 0; i < literal.data.length; i++) {
      const x = Math.floor(i / 4) % literal.width;
      const y = Math.floor(i / 4 / literal.width);
      if (inside(x, y)) continue;
      const delta = Math.abs(literal.data[i]! - candidate.data[i]!);
      if (delta > 3) differences++;
      maxDifference = Math.max(maxDifference, delta);
    }
    if (differences) {
      await writeFile(test.info().outputPath(`${label}-literal.png`), PNG.sync.write(literal));
      await writeFile(
        test.info().outputPath(`${label}-candidate-${index}.png`),
        PNG.sync.write(candidate),
      );
    }
    expect(
      differences,
      `${label}, candidate ${index}, max channel difference: ${maxDifference}`,
    ).toBe(0);
  }
}

for (const mode of ["worklet", "polyfill", "native"]) {
  for (const zoom of [0.5, 1, 1.5]) {
    test(`${mode} shadows at ${zoom * 100}% zoom`, async ({ page, browserName }) => {
      test.skip(mode === "worklet" && browserName !== "chromium", "Paint API requires Chromium");
      await page.goto(`/tests/shadows.html?mode=${mode}&zoom=${zoom}`);
      await page.getByRole("button", { name: "Run shadow regressions" }).click();
      await expect(page.locator("#result")).toContainText("checks passed");
      if (mode === "native") return;
      // Literal, variable and deliberately oversized reference canvases.
      for (const [index, row] of (await page.locator(".row").all()).entries()) {
        await expectUnclipped(await row.locator(".cell").all(), `row-${index}`);
      }
      // A real group hover changes an inherited variable, including the
      // shadow's rendered pixels, without any class or inline-style mutation.
      await page.locator("#fixture").evaluate((el) => el.classList.add("hover-parent"));
      const row = page.locator(".row").first();
      const variable = row.locator("button").nth(1);
      await variable.hover();
      await expect(variable).toHaveCSS("--squircle-pill-shadow-reach", "25px");
      await expectUnclipped([row.locator(".cell").nth(1), row.locator(".cell").nth(2)], "hover");
      await page.mouse.move(1100, 20);
      await expect(variable).toHaveCSS("--squircle-pill-shadow-reach", "4px");
    });
  }
}

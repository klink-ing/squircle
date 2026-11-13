// Open /tests/radius-combos-plugin.html or /tests/radius-combos-utils.html,
// which differ only in the stylesheet they load. Each box combines utilities
// that set different corners; the browser suite reads back the radius each
// corner computes to.

type Corner = { px: number; squircled: boolean };
const squircled = (px: number): Corner => ({ px, squircled: true });
const round = (px: number): Corner => ({ px, squircled: false });

// Corners are top-left, top-right, bottom-right, bottom-left.
const BOXES: { classes: string; dir?: "rtl"; corners: Corner[] }[] = [
  {
    classes: "squircle-t-[24px] squircle-b-[8px]",
    corners: [squircled(24), squircled(24), squircled(8), squircled(8)],
  },
  {
    classes: "squircle-l-[24px] squircle-r-[8px]",
    corners: [squircled(24), squircled(8), squircled(8), squircled(24)],
  },
  {
    classes: "squircle-s-[24px] squircle-e-[8px]",
    corners: [squircled(24), squircled(8), squircled(8), squircled(24)],
  },
  {
    classes: "squircle-s-[24px] squircle-e-[8px]",
    dir: "rtl",
    corners: [squircled(8), squircled(24), squircled(24), squircled(8)],
  },
  {
    classes: "squircle-[8px] squircle-t-[24px]",
    corners: [squircled(24), squircled(24), squircled(8), squircled(8)],
  },
  {
    classes: "squircle-[8px] squircle-tl-[24px]",
    corners: [squircled(24), squircled(8), squircled(8), squircled(8)],
  },
  {
    classes: "squircle-t-[24px] rounded-b-[8px]",
    corners: [squircled(24), squircled(24), round(8), round(8)],
  },
];

const fixture = document.querySelector<HTMLElement>("#fixture")!;
for (const { classes, dir, corners } of BOXES) {
  const box = document.createElement("div");
  box.className = `box ${classes}`;
  if (dir) box.dir = dir;
  box.dataset["label"] = dir ? `${classes} (${dir})` : classes;
  box.dataset["expected"] = JSON.stringify(corners);
  fixture.append(box);
}

requestAnimationFrame(() => document.documentElement.setAttribute("data-ready", "true"));

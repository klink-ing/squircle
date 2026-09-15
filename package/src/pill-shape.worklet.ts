/*!
 * @klinking/squircle — MIT License — Copyright (c) 2026 Chris Klink
 * https://squircle.klink.ing/ · https://github.com/klink-ing/squircle
 */

type PaintRenderingContext2D = CanvasRenderingContext2D & {
  fillRect: (x: number, y: number, w: number, h: number) => void;
};

interface PaintSize {
  width: number;
  height: number;
}

interface PaintProps {
  get: (name: string) => Record<string, unknown>;
}

export const paintDef = class PillShape implements PaintWorklet {
  static get inputProperties() {
    return [
      "--pill-radius",
      "--pill-width",
      "--pill-height",
      "--pill-squircle-amt",
    ];
  }

  // Parse CSS length value (e.g., "12px" -> 12)
  private parseLength(value: unknown): number {
    if (typeof value === "string") {
      return parseFloat(value);
    }
    if (typeof value === "number") {
      return value;
    }
    return 0;
  }

  paint(
    ctx: CanvasRenderingContext2D,
    size: PaintSize,
    props: PaintProps,
  ): void {
    const radius = this.parseLength(
      props.get("--pill-radius").toString(),
    );
    const width = size.width;
    const height = size.height;

    ctx.fillStyle = "currentColor";
    ctx.beginPath();

    // Pill shape algorithm:
    // - For horizontal pill (width > height): semicircles on left/right, straight edges top/bottom
    // - For vertical pill (height > width): semicircles on top/bottom, straight edges left/right
    // - Use G2-continuous Bezier transitions at junctions

    if (width > height) {
      // Horizontal pill: semicircles at left and right
      this.drawHorizontalPill(ctx, width, height, radius);
    } else if (height > width) {
      // Vertical pill: semicircles at top and bottom
      this.drawVerticalPill(ctx, width, height, radius);
    } else {
      // Circle: just draw a circle
      ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    }

    ctx.fill();
  }

  private drawHorizontalPill(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    radius: number,
  ): void {
    const r = Math.min(radius, height / 2);
    const cy = height / 2; // center y
    const x1 = r; // where left semicircle ends
    const x2 = width - r; // where right semicircle starts

    // Left semicircle (center at (r, cy))
    ctx.arc(r, cy, r, Math.PI / 2, (3 * Math.PI) / 2, false);

    // Top straight edge with G2 transition
    ctx.bezierCurveTo(
      x1, // control point 1 x (on tangent of semicircle)
      r * 0.55228,
      x2, // control point 2 x (on tangent of semicircle)
      r * 0.55228,
      x2, // end point x
      0, // end point y (top)
    );

    // Right semicircle (center at (width - r, cy))
    ctx.arc(width - r, cy, r, (3 * Math.PI) / 2, Math.PI / 2, false);

    // Bottom straight edge with G2 transition (mirror of top)
    ctx.bezierCurveTo(
      x2, // control point 1 x
      height - r * 0.55228,
      x1, // control point 2 x
      height - r * 0.55228,
      x1, // end point x
      height, // end point y (bottom)
    );

    // Close path back to start
    ctx.closePath();
  }

  private drawVerticalPill(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    radius: number,
  ): void {
    const r = Math.min(radius, width / 2);
    const cx = width / 2; // center x
    const y1 = r; // where top semicircle ends
    const y2 = height - r; // where bottom semicircle starts

    // Top semicircle (center at (cx, r))
    ctx.arc(cx, r, r, 0, Math.PI, false);

    // Right straight edge with G2 transition
    ctx.bezierCurveTo(
      width - r * 0.55228, // control point 1 x
      y1, // control point 1 y
      width - r * 0.55228, // control point 2 x
      y2, // control point 2 y
      width, // end point x
      y2, // end point y
    );

    // Bottom semicircle (center at (cx, height - r))
    ctx.arc(cx, height - r, r, Math.PI, 0, false);

    // Left straight edge with G2 transition (mirror of right)
    ctx.bezierCurveTo(
      r * 0.55228, // control point 1 x
      y2, // control point 1 y
      r * 0.55228, // control point 2 x
      y1, // control point 2 y
      0, // end point x
      y1, // end point y
    );

    // Close path back to start
    ctx.closePath();
  }
};

registerPaint("pill-shape", paintDef);

import { useEffect, useState } from "react";
import { refreshPills } from "../lib/pill-gallery";
import {
  DEFAULT_SHAPE,
  PINNED,
  PillShapeControls,
  shapeStyle,
  type PillShapeSettings,
} from "./PillControls";

/**
 * The shape controls for the whole gallery. The settings are set on `<html>`
 * and every pill inherits them, as they would from any ancestor.
 */
export default function PillGalleryControls() {
  const [shape, setShape] = useState<PillShapeSettings>(DEFAULT_SHAPE);
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(shapeStyle(shape))) {
      root.style.setProperty(name, String(value));
    }
    refreshPills();
  }, [shape]);
  return (
    <div className={`${PINNED} mb-10 max-w-xl`}>
      <PillShapeControls shape={shape} onChange={setShape} idPrefix="gallery" />
    </div>
  );
}

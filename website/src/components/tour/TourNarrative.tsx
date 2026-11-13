import { SLIDES } from "./slides";

export default function TourNarrative({
  active,
  amount,
  strengthActive,
  onAmountChange,
}: {
  active: number;
  amount: number;
  strengthActive: boolean;
  onAmountChange: (value: number) => void;
}) {
  return SLIDES.map((slide, index) => (
    <section
      key={slide.id}
      data-tour-panel={slide.id}
      hidden={active !== index}
      inert={active !== index}
      aria-labelledby={`heading-${slide.id}`}
    >
      <h2 id={`heading-${slide.id}`} tabIndex={-1}>
        {slide.heading}
      </h2>
      <div className="tour-copy">
        {slide.content({ amount, enabled: strengthActive && active === index, onAmountChange })}
      </div>
    </section>
  ));
}

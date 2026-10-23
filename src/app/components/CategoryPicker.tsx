import { MARKS, type Mark } from "../../domain/marks.ts";

/** The five categories the details offer; "No category yet" and "Not interested" have their own link. */
const CHOICES = MARKS.filter((m) => m.key !== "new" && m.key !== "skip");

/**
 * F005 R9 (docs/design.md v2.2.0 "Category picker"): the game's category as a honeycomb of pointy-top
 * hexagons, three on top and two below. The tapped button is passed on, where the Must Have burst starts.
 */
export function CategoryPicker({
  value,
  onPick,
}: {
  value: Mark;
  onPick: (key: Mark, from: Element) => void;
}) {
  return (
    <div className="cat-picker" role="group" aria-label="Category">
      {CHOICES.map((choice) => (
        <button
          key={choice.key}
          type="button"
          className="cat-btn"
          data-tone={choice.key}
          aria-pressed={value === choice.key}
          onClick={(event) => onPick(choice.key, event.currentTarget)}
        >
          <span className="cat-hex hex">
            <span className="cat-face hex">
              <em className="cat-emoji" aria-hidden="true">
                {choice.emoji}
              </em>
              <span>{choice.label}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

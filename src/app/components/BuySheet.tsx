import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { type Entry, type Paid, suggestPaid } from "../../domain/collection.ts";
import {
  CURRENCIES,
  formatMoney,
  parsePrice,
  priceInput,
} from "../../domain/money.ts";
import { buyGame } from "../actions.ts";
import { centreOf } from "../celebrate.ts";
import { useServices } from "../context.tsx";
import { Sheet } from "./Sheet.tsx";
import { useToast } from "./Toast.tsx";

const PRICE_ERROR = "Type a price from 0 to 9,999, like 12,50.";

/**
 * F005 "Buy sheet" (docs/design.md §7): "Bought <game>?", the price paid prefilled with the listed
 * price (empty = bought without a price), currency, Cancel / Got it. Opened from a game row's Buy
 * action and from "✅ Bought it" in the details; saving celebrates, toasts and calls `onClose`;
 * Cancel, Esc and the scrim call `onCancel` (default `onClose`) (FR-006, FR-007).
 */
export function BuySheet({
  entry,
  name,
  onClose,
  onCancel = onClose,
}: {
  entry: Entry;
  name: string;
  onClose: () => void;
  onCancel?: () => void;
}) {
  const services = useServices();
  const toast = useToast();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestion = suggestPaid(entry);
  const [text, setText] = useState(priceInput(suggestion.cents));
  const [currency, setCurrency] = useState(suggestion.currency);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  const empty = text.trim() === "";
  const cents = parsePrice(text);
  const invalid = !empty && cents === null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    const paid: Paid | null = cents === null ? null : { cents, currency };
    const submitter =
      (event.nativeEvent as SubmitEvent).submitter ?? inputRef.current;
    await buyGame(services, entry, paid, centreOf(submitter));
    onClose();
    toast(
      paid
        ? `${name}: got it for ${formatMoney(paid.cents, paid.currency)}!`
        : `${name}: got it!`,
    );
  };
  return (
    <Sheet open title={`Bought ${name}?`} onClose={onCancel}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <div>
          <label className="label" htmlFor={id}>
            What did you pay?
          </label>
          <div className="price-row">
            <div className="field">
              <input
                id={id}
                ref={inputRef}
                value={text}
                inputMode="decimal"
                autoComplete="off"
                placeholder={
                  suggestion.cents != null ? priceInput(suggestion.cents) : "0"
                }
                aria-invalid={invalid}
                aria-describedby={`${id}-hint`}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <div className="field select">
              <select
                aria-label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <p className={`hint${invalid ? " error" : ""}`} id={`${id}-hint`}>
            {invalid ? PRICE_ERROR : "Leave it empty to just tick it off."}
          </p>
        </div>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-bought" disabled={invalid}>
            Got it
          </button>
        </div>
      </form>
    </Sheet>
  );
}

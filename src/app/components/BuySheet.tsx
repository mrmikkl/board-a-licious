import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import type { Game } from "../../client/types.ts";

import { type Entry, type Paid, suggestPaid } from "../../domain/collection.ts";
import {
  CURRENCIES,
  formatMoney,
  parsePrice,
  priceInput,
} from "../../domain/money.ts";
import { buyGame } from "../actions.ts";
import { celebrate, centreOf } from "../celebrate.ts";
import { useServices } from "../context.tsx";
import { useBggAccount } from "../hooks/useBggAccount.ts";
import { useBgg } from "./BggBadges.tsx";
import { type Bought, MarkOwnedSheet, markOwnedMode } from "./MarkOwnedSheet.tsx";
import { Sheet } from "./Sheet.tsx";
import { useToast } from "./Toast.tsx";

const PRICE_ERROR = "Type a price from 0 to 9,999, like 12,50.";

/**
 * F005 "Buy sheet" (docs/design.md §7): "Bought <game>?", the price paid prefilled with the listed
 * price (empty = bought without a price), currency, Cancel / Got it. Opened from a game row's Buy
 * action and from "✅ Bought it" in the details; saving celebrates, toasts and calls `onClose`;
 * Cancel, Esc and the scrim call `onCancel` (default `onClose`) (FR-006, FR-007).
 * F008: without an `entry` (Bought it in a game sheet outside shopping lists) it asks the price only
 * and stores nothing in the app. After Got it it offers to mark the game as owned on BoardGameGeek
 * (Mark as owned sheet, FR-021) when it is not owned there or a price was entered.
 */
export function BuySheet({
  entry,
  bggId,
  name,
  game,
  onClose,
  onCancel = onClose,
}: {
  entry?: Entry;
  bggId: number;
  name: string;
  /** What the app knows of the game, for the stored BGG collection after marking it as owned. */
  game?: Partial<Game>;
  onClose: () => void;
  onCancel?: () => void;
}) {
  const services = useServices();
  const bgg = useBgg();
  const { signedInAs } = useBggAccount();
  const [owned, setOwned] = useState<{ bought: Bought; mode: "markOwned" | "addPrice" }>();
  const toast = useToast();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestion = entry ? suggestPaid(entry) : { cents: null, currency: "EUR" };
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
    if (entry) await buyGame(services, entry, paid, centreOf(submitter));
    else celebrate({ kind: "bought", from: centreOf(submitter) });
    const mode = markOwnedMode(Boolean(bgg.username || signedInAs), bgg.statuses.get(bggId), paid);
    if (mode) {
      setOwned({
        mode,
        bought: {
          game: { bggId, name, year: game?.year ?? null, thumbnailUrl: game?.thumbnailUrl ?? null, kind: game?.kind ?? "boardgame" },
          paid,
          booth: entry?.facts?.booth,
          fromSpiel: entry?.factsSource === "preview",
        },
      });
    } else onClose();
    toast(
      paid
        ? `${name}: got it for ${formatMoney(paid.cents, paid.currency)}!`
        : `${name}: got it!`,
    );
  };
  if (owned) return <MarkOwnedSheet bought={owned.bought} mode={owned.mode} onClose={onClose} />;
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

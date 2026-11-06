import { useId, useState } from "react";

import {
  type Offer,
  type PriceLanguage,
  type PriceLink,
  type PricesAnswer,
  arrangeOffers,
} from "../../domain/offers.ts";
import { formatMoney } from "../../domain/money.ts";

export type PricesState =
  | { status: "loading" }
  | { status: "ready"; answer: PricesAnswer }
  | { status: "error"; offline: boolean };

const money = (amount: number, currency = "EUR") =>
  formatMoney(Math.round(amount * 100), currency);
const LANGUAGE_NAMES = {
  en: "English",
  de: "German",
  unknown: "language unknown",
} as const;
const LANGUAGE_TAGS = { en: "EN", de: "DE", unknown: "?" } as const;
const LANGUAGES: [PriceLanguage, string][] = [
  ["both", "Both"],
  ["en", "English"],
  ["de", "German"],
];

/** "£25 ≈ €29.41", "€34.89" or "price in the listing" */
function totalText(o: Offer) {
  if (!o.price) return "price in the listing";
  if (o.price.currency !== "EUR")
    return o.euroTotal != null
      ? `${money(o.price.amount, o.price.currency)} ≈ ${money(o.euroTotal)}`
      : money(o.price.amount, o.price.currency);
  return money(o.euroTotal ?? o.price.amount);
}
function shippingText(o: Offer) {
  if (o.shipping == null) return "shipping unknown";
  if (o.shipping === 0)
    return o.kind === "new" && o.price
      ? `${money(o.price.amount)} free shipping`
      : "free shipping";
  return o.kind === "new" && o.price
    ? `${money(o.price.amount)} + ${money(o.shipping)} shipping`
    : `+ ${money(o.shipping)} shipping`;
}
const languageText = (o: Offer) =>
  o.kind === "used" && o.language === "unknown"
    ? "language not stated"
    : LANGUAGE_NAMES[o.language];

function OfferTile({ offer: o }: { offer: Offer }) {
  const label = [
    o.seller,
    totalText(o),
    languageText(o),
    o.kind === "used" && "used",
    !o.available && "not in stock",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <li>
      <a
        className={o.available ? "offer" : "offer out"}
        href={o.link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
      >
        <span className="offer-shop">
          {o.seller}
          <span className="ext" aria-hidden="true">
            ↗
          </span>
          {o.source === "brettspielpreise" && (
            <span className="offer-via">via brettspielpreise.de</span>
          )}
        </span>
        <span className="offer-total">
          {totalText(o)}
          <small>{shippingText(o)}</small>
        </span>
        <span className="offer-meta">
          {o.kind === "used" && (
            <span className="cond">
              Used{o.condition ? ` · ${o.condition}` : ""}
            </span>
          )}
          <span className={`lang ${o.language}`}>
            {LANGUAGE_TAGS[o.language]}
          </span>
          {o.kind === "used" && o.language === "unknown" && (
            <span>language not stated</span>
          )}
          {o.title && <span>{o.title}</span>}
          {o.kind === "new" && (
            <span className={o.available ? "stock" : "stock no"}>
              {o.available ? "in stock" : "not in stock"}
            </span>
          )}
          {o.listedAt && <span>listed {o.listedAt}</span>}
        </span>
        {o.note && <span className="offer-note">“{o.note}”</span>}
      </a>
    </li>
  );
}

/** Search links to marketplaces the app may not read (ADR 0008): used copies, so in the Used tab. */
function PriceLinks({ links }: { links: PriceLink[] }) {
  return (
    <ul className="price-links" aria-label="Search elsewhere">
      {links.map((l) => (
        <li key={l.name}>
          <a
            className="chip"
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Search on {l.name} ↗
          </a>
        </li>
      ))}
    </ul>
  );
}

/** New offers start with this many (the cheapest); "Show more" adds as many again. */
export const PAGE = 5;

function OfferList({ label, offers }: { label: string; offers: Offer[] }) {
  return (
    <ul className="offers" aria-label={label}>
      {offers.map((o) => (
        <OfferTile key={o.link} offer={o} />
      ))}
    </ul>
  );
}

/**
 * F007 (docs/design.md "Offers block"): language choice, the fair price, New and Used offers as tabs
 * (New: the 5 cheapest, "Show more" adds 5),
 * the unknown-language switch, search links, a failed source, the sources line. Used by the price screen
 * and the Prices section in a game's details (`compact`: no unknown-language switch).
 */
export function OffersBlock({
  state,
  language,
  onLanguage,
  fairPrice,
  compact = false,
  onRetry,
}: {
  state: PricesState;
  language: PriceLanguage;
  onLanguage: (language: PriceLanguage) => void;
  fairPrice?: string | null;
  compact?: boolean;
  onRetry: () => void;
}) {
  const [showUnknown, setShowUnknown] = useState(false);
  // New is the first tab; New starts with the 5 cheapest, "Show more" adds 5 (a reload starts over)
  const [tab, setTab] = useState<"new" | "used">("new");
  const [shown, setShown] = useState(PAGE);
  const tabsId = useId();
  if (state.status === "loading") {
    return (
      <div className="offers-block">
        <p className="result-status" role="status">
          <span className="spin-hex" aria-hidden="true" />
          Looking for prices…
        </p>
        <div className="offers" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel" />
          ))}
        </div>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="notice warn">
        <p>
          {state.offline
            ? "You're offline. Prices need a connection."
            : "Prices are not reachable right now."}
        </p>
        <button type="button" className="btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  const { answer } = state;
  const { newOffers, usedOffers } = arrangeOffers(answer.offers, {
    language,
    showUnknown,
  });
  // how many new offers have an unknown language: the switch stays while ticked
  const unknownCount = arrangeOffers(answer.offers, {
    language,
    showUnknown: false,
  }).hiddenUnknown;
  const nothing = newOffers.length + usedOffers.length + unknownCount === 0;
  return (
    <div className="offers-block">
      <div className="seg lang-seg" role="group" aria-label="Language">
        {LANGUAGES.map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={language === value}
            onClick={() => onLanguage(value)}
          >
            {text}
          </button>
        ))}
      </div>
      {fairPrice && <p className="fair-line">At the fair: {fairPrice}</p>}
      {nothing ? (
        <>
          <div className="empty">
            <div className="hex" />
            <h2>No offers in English or German found</h2>
            <p>Shops may list it under another name.</p>
            <div className="actions">
              <a
                className="btn"
                href={answer.siteSearch}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on brettspielpreise.de
              </a>
            </div>
          </div>
          {/* no tabs without offers: used copies may still be on the marketplaces */}
          <PriceLinks links={answer.links} />
        </>
      ) : (
        <>
          <div className="offer-tabs" role="tablist" aria-label="Offers">
            {(["new", "used"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                id={`${tabsId}-${t}`}
                aria-selected={tab === t}
                aria-controls={`${tabsId}-${t}-panel`}
                tabIndex={tab === t ? 0 : -1}
                onClick={() => setTab(t)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    const next = t === "new" ? "used" : "new";
                    setTab(next);
                    document.getElementById(`${tabsId}-${next}`)?.focus();
                  }
                }}
              >
                {t === "new" ? "New" : "Used"}
                <small>
                  {t === "new" ? newOffers.length : usedOffers.length}
                </small>
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${tabsId}-${tab}-panel`}
            aria-labelledby={`${tabsId}-${tab}`}
            className="offer-panel"
          >
            {tab === "new" ? (
              <>
                <p className="panel-note">Cheapest first</p>
                <OfferList
                  label="New offers"
                  offers={newOffers.slice(0, shown)}
                />
                {shown < newOffers.length && (
                  <button
                    type="button"
                    className="btn btn-primary btn-block show-more"
                    onClick={() => setShown((n) => n + PAGE)}
                  >
                    Show more
                  </button>
                )}
                {!compact && unknownCount > 0 && (
                  <label className="unknown-switch">
                    <input
                      type="checkbox"
                      checked={showUnknown}
                      onChange={(e) => setShowUnknown(e.target.checked)}
                    />
                    Show offers with unknown language ({unknownCount})
                  </label>
                )}
              </>
            ) : (
              <>
                <p className="panel-note">From Europe, cheapest first</p>
                <OfferList label="Used offers" offers={usedOffers} />
                <PriceLinks links={answer.links} />
              </>
            )}
          </div>
        </>
      )}
      {answer.failed.map((source) => (
        <div key={source} className="fail-line">
          <span>{source} is not reachable right now.</span>
          <button type="button" className="link-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ))}
      <p className="sources-line">
        New offers from{" "}
        <a
          href="https://brettspielpreise.de"
          target="_blank"
          rel="noopener noreferrer"
        >
          brettspielpreise.de
        </a>
        ; used from the BGG marketplace and unknowns.de. Prices up to an hour
        old.
      </p>
    </div>
  );
}

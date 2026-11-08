import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import type { Game } from "../../client/types.ts";
import { gameUrl } from "../../domain/bgg-link.ts";
import type { Collection, Entry, Facts } from "../../domain/collection.ts";
import { gameInfos, publisherOf } from "../../domain/game-info.ts";
import { inText } from "../../domain/membership.ts";
import {
  CURRENCIES,
  formatMoney,
  parsePrice,
  priceInput,
} from "../../domain/money.ts";
import { removeGame, saveFacts, unbuyGame } from "../actions.ts";
import { useServices, useStoreData } from "../context.tsx";
import { type AddItem, AddToCollectionsSheet } from "./AddToCollectionsSheet.tsx";
import { BggBadges, useBgg } from "./BggBadges.tsx";
import { BggStatusSection, type BggStatusState } from "./BggStatusSection.tsx";
import { BuySheet } from "./BuySheet.tsx";
import { CategorySection } from "./CategorySection.tsx";
import { CopyMoveSheet } from "./CopyMoveSheet.tsx";
import { InfoList } from "./GameInfo.tsx";
import { HexCover } from "./HexCover.tsx";
import { ImageViewer } from "./ImageViewer.tsx";
import { yearText } from "./ListGameRow.tsx";
import { PricesSection } from "./PricesSection.tsx";
import { Sheet } from "./Sheet.tsx";
import { SignInSheet } from "./SignInSheet.tsx";
import { useToast } from "./Toast.tsx";

const PRICE_ERROR = "Type a price from 0 to 9,999, like 12,50.";

/** Where the game sheet is opened: inside a shopping list (its entry), or anywhere else (search, BGG lists). */
export type GameSheetContext =
  | { context: "shopping"; entry: Entry; collection: Collection }
  | { context: "browse"; item: AddItem & { info?: Partial<Game> } };

/**
 * F008 (docs/design.md "Game sheet"): the one sheet for a game, wherever it is opened. Name; cover
 * (image viewer) with year · publisher, all BGG status badges (or "Not in your BGG collection") and the teal "in …" button (the shopping list
 * choice) beside it; Open on BoardGameGeek; the info box; the Category section (shopping lists only);
 * the BGG status section; the Prices section; the actions (shopping list: Bought it, Copy · Move,
 * Remove; elsewhere: Add to shopping lists, Bought it); the description; Close.
 */
export function GameSheet(
  props: GameSheetContext & {
    game?: Game;
    onClose: () => void;
  },
) {
  const { game, onClose } = props;
  const bgg = useBgg();
  const services = useServices();
  const toast = useToast();
  const [step, setStep] = useState<
    "details" | "paid" | "facts" | "copy" | "move" | "lists" | "signin"
  >("details");
  // F008: the BGG status section's fold and draft live here, so they survive the sign-in sheet
  const [bggState, setBggState] = useState<BggStatusState>({ open: false });
  const [viewer, setViewer] = useState(false);
  const shopping = props.context === "shopping" ? props : undefined;
  const browse = props.context === "browse" ? props.item : undefined;
  const entry = shopping?.entry;
  const bggId = entry?.bggId ?? browse!.bggId;
  const name = game?.name || browse?.name || `Game ${bggId}`;
  const pending = Boolean(entry?.detailsPending && !game?.thumbnailUrl);
  // the shopping lists and the game's entries in them: "in …", Copy and Move
  const others = useStoreData(
    async (store) => ({
      bggId,
      collections: (await store.collections())
        .filter((c) => !c.deleted)
        .sort((a, b) => a.name.localeCompare(b.name)),
      entries: (await store.allEntries()).filter(
        (e) => e.bggId === bggId && !e.deleted,
      ),
    }),
    [bggId],
  );
  const ready = others?.bggId === bggId ? others : undefined;
  const listNames = ready
    ? ready.collections
        .filter((c) => ready.entries.some((e) => e.collectionId === c.id))
        .map((c) => c.name)
    : [];
  const where = inText(listNames, shopping?.collection.name);
  const item: AddItem = browse ?? {
    bggId,
    name,
    thumbnailUrl: game?.thumbnailUrl ?? null,
    facts: entry?.facts ?? undefined,
  };
  const close = () => setStep("details");

  if (step === "signin")
    return <SignInSheet onSignedIn={close} onCancel={close} />;
  if (step === "lists")
    return <AddToCollectionsSheet item={item} game={game} onClose={close} />;
  // F005: the price paid is asked in the Buy sheet, shared with the game row's Buy action
  if (step === "paid")
    return (
      <BuySheet
        entry={entry}
        bggId={bggId}
        name={name}
        game={{ ...browse, ...game, kind: game?.kind ?? browse?.kind }}
        onClose={entry ? onClose : close}
        onCancel={close}
      />
    );
  // F005 R11: copying goes back to the details; moving takes the game out of this collection, so they close
  if (entry && (step === "copy" || step === "move"))
    return (
      <CopyMoveSheet
        mode={step}
        entry={entry}
        name={name}
        collections={ready?.collections ?? []}
        entries={ready?.entries ?? []}
        onCancel={close}
        onDone={() => (step === "move" ? onClose() : close())}
      />
    );

  const remove = async () => {
    if (!shopping) return;
    await removeGame(services, shopping.entry);
    onClose();
    toast(`Removed ${name} from ${shopping.collection.name}`);
  };
  const unbuy = async () => {
    if (!entry) return;
    await unbuyGame(services, entry);
    onClose();
    toast(`${name}: not bought`);
  };
  const save = async (facts: Facts) => {
    if (!entry) return;
    await saveFacts(services, entry, facts);
    close();
    toast(`Saved booth, price and publisher for ${name}`);
  };
  const details = { ...browse?.info, ...game };
  const year = game?.year ?? browse?.year;
  const expansion = (game?.kind ?? browse?.kind) === "expansion";
  const publisher = publisherOf(entry?.facts ?? browse?.facts, details);
  const sub = entry?.detailsPending && !game?.year
    ? "Details follow from BoardGameGeek"
    : [
        year !== undefined || entry ? yearText(year) : null,
        expansion && "Expansion",
        publisher,
      ]
        .filter(Boolean)
        .join(" · ");
  const fair = entry?.facts ?? browse?.facts;

  return (
    <Sheet open title={name} onClose={onClose}>
      <div className="detail-head">
        <button
          type="button"
          className="cover-zoom"
          aria-label={`Show the images of ${name} big`}
          onClick={() => setViewer(true)}
        >
          <HexCover
            game={game ?? (browse && { ...browse, year: null, description: null, kind: "boardgame" })}
            name={name}
            pending={pending}
            bought={entry?.bought}
            size={84}
          />
        </button>
        <div className="gs-facts">
          {sub && <p className="detail-sub">{sub}</p>}
          <BggBadges bggId={bggId} big />
          {bgg.known && !bgg.statuses.has(bggId) && (
            <p className="detail-sub muted">Not in your BGG collection</p>
          )}
          {where && (
            <button
              type="button"
              className="gs-in"
              onClick={() => setStep("lists")}
            >
              {where}
              <span aria-hidden="true"> ›</span>
            </button>
          )}
          {entry?.bought && (
            <span className="pill" data-mark="bought">
              ✅{" "}
              {entry.paidCents != null
                ? `Bought for ${formatMoney(entry.paidCents, entry.paidCurrency)}`
                : "Bought"}
            </span>
          )}
        </div>
      </div>
      <a
        className="link-out gs-bgg"
        href={gameUrl(bggId)}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on BoardGameGeek<span aria-hidden="true"> ↗</span>
      </a>
      {entry ? (
        step === "facts" ? (
          <FactsForm
            facts={entry.facts}
            onSave={(facts) => void save(facts)}
            onCancel={close}
          />
        ) : (
          <FactsBox entry={entry} game={game} onEdit={() => setStep("facts")} />
        )
      ) : (
        (publisher || gameInfos(browse?.facts, details).length > 0) && (
          <div className="facts-box">
            <InfoList facts={browse?.facts} details={details} publisher={publisher} />
            <div className="facts-foot">
              <span className="facts-by">From BoardGameGeek</span>
            </div>
          </div>
        )
      )}
      {entry && <CategorySection entry={entry} name={name} />}
      <BggStatusSection
        game={{
          bggId,
          name,
          year: year ?? null,
          thumbnailUrl: game?.thumbnailUrl ?? browse?.thumbnailUrl ?? null,
          kind: expansion ? "expansion" : "boardgame",
        }}
        state={bggState}
        onState={setBggState}
        onSignIn={() => setStep("signin")}
        onSaved={onClose}
      />
      <PricesSection
        bggId={bggId}
        name={name}
        fairPrice={fair?.priceCents != null ? formatMoney(fair.priceCents, fair.currency) : null}
      />
      <div className="sheet-actions">
        {!shopping && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => setStep("lists")}
          >
            Add to shopping lists
          </button>
        )}
        {entry?.bought ? (
          <button
            type="button"
            className="btn btn-block"
            onClick={() => void unbuy()}
          >
            Not bought after all
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-block btn-bought"
            onClick={() => setStep("paid")}
          >
            ✅ Bought it
          </button>
        )}
        {shopping && (
          <>
            <div className="row-actions">
              <button type="button" className="btn" onClick={() => setStep("copy")}>
                Copy
              </button>
              <button type="button" className="btn" onClick={() => setStep("move")}>
                Move
              </button>
            </div>
            <button
              type="button"
              className="btn btn-block btn-danger"
              onClick={() => void remove()}
            >
              Remove from {shopping.collection.name}
            </button>
          </>
        )}
      </div>
      <p className="desc">
        {game?.description ||
          (!entry && game && game.year !== null ? (
            "BoardGameGeek has no description for this game."
          ) : (
            <span className="muted">
              {game || entry || browse?.info
                ? "The description is filled in from BoardGameGeek later."
                : "Loading the details from BoardGameGeek…"}
            </span>
          ))}
      </p>
      <div className="sheet-actions">
        <button type="button" className="btn btn-block" onClick={onClose}>
          Close
        </button>
      </div>
      {viewer && (
        <ImageViewer
          game={{ bggId, name }}
          cover={pending ? null : (game?.thumbnailUrl ?? browse?.thumbnailUrl ?? null)}
          pending={pending || (!game && !browse?.thumbnailUrl)}
          onClose={() => setViewer(false)}
        />
      )}
    </Sheet>
  );
}

/** Publisher and every info of the game (FR-010); booth, price and publisher typed in say so (FR-011). */
function FactsBox({
  entry,
  game,
  onEdit,
}: {
  entry: Entry;
  game?: Game;
  onEdit: () => void;
}) {
  const facts = entry.facts;
  const publisher = publisherOf(facts, game);
  const info = <InfoList facts={facts} details={game} publisher={publisher} />;
  if (!facts) {
    return (
      <>
        {(publisher || gameInfos(facts, game).length > 0) && (
          <div className="facts-box">{info}</div>
        )}
        <button
          type="button"
          className="btn btn-block facts-add"
          onClick={onEdit}
        >
          ➕ Add booth, price and publisher
        </button>
      </>
    );
  }
  return (
    <div className="facts-box">
      {info}
      <div className="facts-foot">
        {entry.factsSource === "manual" && (
          <span className="facts-by">Added by you</span>
        )}
        <button type="button" className="link-btn" onClick={onEdit}>
          ✎ Edit booth, price and publisher
        </button>
      </div>
    </div>
  );
}

/** Booth, Price with a currency (EUR by default) and Publisher; Save once one of them is filled in. */
function FactsForm({
  facts,
  onSave,
  onCancel,
}: {
  facts: Facts | null;
  onSave: (facts: Facts) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const boothRef = useRef<HTMLInputElement>(null);
  const [booth, setBooth] = useState(facts?.booth ?? "");
  const [price, setPrice] = useState(priceInput(facts?.priceCents));
  const [currency, setCurrency] = useState(facts?.currency ?? "EUR");
  const [publisher, setPublisher] = useState(facts?.publisher ?? "");
  useEffect(() => boothRef.current?.focus(), []);
  const cents = parsePrice(price);
  const priceInvalid = price.trim() !== "" && cents === null;
  const filled =
    booth.trim() !== "" || price.trim() !== "" || publisher.trim() !== "";
  const currencies = CURRENCIES.includes(
    currency as (typeof CURRENCIES)[number],
  )
    ? CURRENCIES
    : [...CURRENCIES, currency];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!filled || priceInvalid) return;
    onSave({
      booth,
      priceCents: cents,
      currency: cents === null ? null : currency,
      publisher,
      edition: facts?.edition ?? null,
    });
  };
  return (
    <form className="form facts-form" onSubmit={submit}>
      <div>
        <label className="label" htmlFor={`${id}-booth`}>
          Booth
        </label>
        <div className="field">
          <input
            id={`${id}-booth`}
            ref={boothRef}
            value={booth}
            maxLength={40}
            autoComplete="off"
            placeholder="3-A101"
            onChange={(e) => setBooth(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`${id}-price`}>
          Price
        </label>
        <div className="price-row">
          <div className="field">
            <input
              id={`${id}-price`}
              value={price}
              inputMode="decimal"
              autoComplete="off"
              placeholder="52"
              aria-invalid={priceInvalid}
              aria-describedby={priceInvalid ? `${id}-price-hint` : undefined}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="field select">
            <select
              aria-label="Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
        {priceInvalid && (
          <p className="hint error" id={`${id}-price-hint`}>
            {PRICE_ERROR}
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor={`${id}-publisher`}>
          Publisher
        </label>
        <div className="field">
          <input
            id={`${id}-publisher`}
            value={publisher}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setPublisher(e.target.value)}
          />
        </div>
      </div>
      <div className="form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!filled || priceInvalid}
        >
          Save
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

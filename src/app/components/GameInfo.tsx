import { Fragment, useId, useState } from "react";

import type { Facts } from "../../domain/collection.ts";
import {
  type GameDetails,
  gameInfos,
  rowInfos,
} from "../../domain/game-info.ts";
import { type PlayerVotes, pollTable } from "../../domain/player-poll.ts";

type Source = { facts?: Facts | null; details?: Partial<GameDetails> | null };

const Mechanisms = ({ items }: { items: string[] }) => (
  <span className="info-pills">
    {items.map((m) => (
      <span key={m} className="pill info-pill">
        {m}
      </span>
    ))}
  </span>
);

/** The third line of a game row: the first three infos (FR-010), mechanisms as pills. */
export function InfoLine({ facts, details }: Source) {
  const infos = rowInfos(facts, details);
  if (infos.length === 0) return null;
  const plain = infos.filter((i) => !i.items);
  const mechanisms = infos.find((i) => i.items);
  return (
    <span className="row-info">
      {plain.length > 0 && <span>{plain.map((i) => i.text).join(" · ")}</span>}
      {mechanisms?.items && <Mechanisms items={mechanisms.items} />}
    </span>
  );
}

/** A BGG rating as a small hexagon: rating cool, geek rating dusk (docs/design.md, game info). */
const Rating = ({ value, geek }: { value: string; geek: boolean }) => (
  <span className="rating">
    <i className={geek ? "geek" : undefined}>{value}</i>
  </span>
);

/** The publisher, then every info a game has in the order of FR-010: game details, swipe card. */
export function InfoList({
  facts,
  details,
  publisher,
}: Source & { publisher?: string | null }) {
  const infos = gameInfos(facts, details);
  if (infos.length === 0 && !publisher) return null;
  return (
    <dl className="info-list">
      {publisher && (
        <div>
          <dt>Publisher</dt>
          <dd>{publisher}</dd>
        </div>
      )}
      {infos.map((i) => (
        <Fragment key={i.key}>
          <div>
            <dt>{i.label}</dt>
            <dd>
              {i.key === "rating" || i.key === "geekRating" ? (
                <Rating value={i.text} geek={i.key === "geekRating"} />
              ) : i.items ? (
                <Mechanisms items={i.items} />
              ) : i.key === "booth" ? (
                i.text.replace(/^Booth /, "")
              ) : (
                i.text
              )}
            </dd>
          </div>
          {/* F006 FR-006b: the poll's votes, folded, right below its summary */}
          {i.key ===
            (infos.some((x) => x.key === "recommendedWith")
              ? "recommendedWith"
              : "bestWith") && <PlayerPoll poll={details?.playerPoll} />}
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * F006 FR-006b: "Show details" unfolds BGG's player poll as a table: per player count the share of
 * Best, Recommended and Not recommended votes; the highest share of each column bold.
 */
function PlayerPoll({ poll }: { poll?: PlayerVotes[] | null }) {
  const [open, setOpen] = useState(false);
  const tableId = useId();
  const table = pollTable(poll);
  if (!table) return null;
  const cell = (c: { percent: number; highest: boolean }) => (
    <td>{c.highest ? <b>{c.percent}%</b> : `${c.percent}%`}</td>
  );
  return (
    <div className="poll-row">
      <dt className="visually-hidden">Player votes</dt>
      <dd>
        <button
          type="button"
          className="link-btn poll-toggle"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide details" : "Show details"}
        </button>
        <table id={tableId} className="poll-table" hidden={!open}>
          <caption className="visually-hidden">
            Votes on BoardGameGeek per number of players, in percent
          </caption>
          <thead>
            <tr>
              <th scope="col">Players</th>
              <th scope="col">Best</th>
              <th scope="col">Recommended</th>
              <th scope="col">Not recommended</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r.players}>
                <th scope="row">{r.players}</th>
                {cell(r.best)}
                {cell(r.recommended)}
                {cell(r.notRecommended)}
              </tr>
            ))}
          </tbody>
        </table>
      </dd>
    </div>
  );
}

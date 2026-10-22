import { type FormEvent, useId, useState } from "react";

import type { Collection, Entry } from "../../domain/collection.ts";
import { copyGameTo, moveGameTo } from "../actions.ts";
import { useServices } from "../context.tsx";
import { Sheet } from "./Sheet.tsx";
import { useToast } from "./Toast.tsx";

/**
 * F005 R11 "Copy <game>" / "Move <game>" (docs/design.md v2.2.0 "Copy and move"): a "To collection"
 * dropdown in the Shared game sheet's pattern, collections that hold the game disabled as "(already
 * in it)", the first free one preselected. Copy and move write through the store's outbox.
 */
export function CopyMoveSheet({
  mode,
  entry,
  name,
  collections,
  entries,
  onCancel,
  onDone,
}: {
  mode: "copy" | "move";
  entry: Entry;
  name: string;
  /** live collections, sorted by name */
  collections: Collection[];
  /** live entries of this game in any collection */
  entries: Entry[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const services = useServices();
  const toast = useToast();
  const selectId = useId();
  const [chosen, setChosen] = useState<string>();
  const inside = new Set(entries.map((e) => e.collectionId));
  const free = collections.find((c) => !inside.has(c.id));
  const target = collections.find((c) => c.id === (chosen ?? free?.id));
  const ready = target !== undefined && !inside.has(target.id);
  const verb = mode === "copy" ? "Copy" : "Move";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || !target) return;
    if (mode === "copy") await copyGameTo(services, entry, target.id);
    else await moveGameTo(services, entry, target.id);
    toast(`${mode === "copy" ? "Copied" : "Moved"} ${name} to ${target.name}`);
    onDone();
  };

  return (
    <Sheet open title={`${verb} ${name}`} onClose={onCancel}>
      <form className="form" onSubmit={submit}>
        <div>
          <label className="label" htmlFor={selectId}>
            To collection
          </label>
          <div className="field select">
            <select
              id={selectId}
              value={target?.id ?? ""}
              onChange={(e) => setChosen(e.target.value)}
            >
              {collections.map((c) => (
                <option key={c.id} value={c.id} disabled={inside.has(c.id)}>
                  {c.name}
                  {inside.has(c.id) ? " (already in it)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="lead">
          {mode === "copy"
            ? "Category, booth and price go along; the purchase stays here."
            : "Everything goes along, including the price paid."}
        </p>
        <div className="sheet-actions sheet-actions-row">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            {verb}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

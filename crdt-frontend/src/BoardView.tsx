import { useEffect, useState } from "react";
import { ColumnView } from "./ColumnView";
import {
  createColumn,
  getCardsInColumn,
  getCardsMap,
  getColumnsMap,
  getColumnsSorted,
  type Identity,
} from "./board-model";
import type { YjsClient } from "./yjs";

export function BoardView({
  client,
  identity,
}: {
  client: YjsClient;
  identity: Identity;
}) {
  const [, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Same observer→tick pattern as DebugBoard: re-render on any column/card change.
  useEffect(() => {
    const columns = getColumnsMap(client.doc);
    const cards = getCardsMap(client.doc);
    const onChange = () => setTick((t) => t + 1);
    columns.observe(onChange);
    cards.observe(onChange);
    return () => {
      columns.unobserve(onChange);
      cards.unobserve(onChange);
    };
  }, [client.doc]);

  // Fresh snapshot every render — derived data, never stored in state.
  const columns = getColumnsSorted(getColumnsMap(client.doc));
  const cardsMap = getCardsMap(client.doc);

  const commitAddColumn = () => {
    const title = draft.trim();
    if (title) createColumn(client.doc, title);
    setDraft("");
    setAdding(false);
  };

  // Empty state — no columns, and not mid-add. Centered CTA.
  if (columns.length === 0 && !adding) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">This board is empty.</p>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium text-white transition-colors"
          >
            + Create your first column
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 p-4 h-full items-start">
        {columns.map((col) => (
          <ColumnView
            key={col.id}
            doc={client.doc}
            column={col}
            cards={getCardsInColumn(cardsMap, col.id)}
            identity={identity}
          />
        ))}

        {/* "Add column" — input form when adding, dashed button otherwise. */}
        <div className="flex-shrink-0 w-72">
          {adding ? (
            <div className="bg-neutral-900 rounded-lg border border-neutral-800 p-3 space-y-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitAddColumn();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setDraft("");
                  }
                }}
                placeholder="Column title…"
                className="w-full bg-neutral-800 rounded px-2 py-1.5 text-sm outline-none ring-1 ring-indigo-500 text-neutral-100"
              />
              <div className="flex gap-2">
                <button
                  onClick={commitAddColumn}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium text-white transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setAdding(false);
                    setDraft("");
                  }}
                  className="px-2.5 py-1 text-neutral-400 hover:text-neutral-100 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full bg-neutral-900/40 hover:bg-neutral-900 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-700 px-3 py-3 text-sm text-neutral-500 hover:text-neutral-300 transition-colors text-left"
            >
              + Add column
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

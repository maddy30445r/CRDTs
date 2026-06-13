import { useState } from "react";
import * as Y from "yjs";
import { InlineEdit } from "./InlineEdit";
import { CardView } from "./CardView";
import {
  createCard,
  deleteColumn,
  renameColumn,
  type Card,
  type Column,
  type Identity,
} from "./board-model";

export function ColumnView({
  doc,
  column,
  cards,
  identity,
}: {
  doc: Y.Doc;
  column: Column;
  cards: Card[];
  identity: Identity;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // commitAdd: trim the draft; if non-empty, createCard(doc, column.id, title, identity).
  // Then clear the draft and exit "adding" mode (whether or not it was empty).
  // TODO: write this.
  const commitAdd = () => {
    const finalDraft = draft.trim();
    if (finalDraft) createCard(doc, column.id, finalDraft, identity);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex-shrink-0 w-72 bg-neutral-900 rounded-lg border border-neutral-800 flex flex-col max-h-full">
      <div className="px-3 py-2 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <InlineEdit
            value={column.title}
            onCommit={(t) => renameColumn(doc, column.id, t)}
            className="text-sm font-medium text-neutral-100 truncate"
            placeholder="Column"
          />
          <span className="text-xs text-neutral-500 flex-shrink-0">
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => {
            if (
              window.confirm(
                `Delete column "${column.title}" and its ${cards.length} card(s)?`,
              )
            ) {
              deleteColumn(doc, column.id);
            }
          }}
          className="text-neutral-500 hover:text-neutral-200 text-lg leading-none ml-2"
          aria-label="Delete column"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0">
        {cards.length === 0 && (
          <div className="text-xs text-neutral-500 text-center py-4">
            No cards yet
          </div>
        )}
        {cards.map((c) => (
          <CardView key={c.id} doc={doc} card={c} />
        ))}
      </div>

      <div className="p-2 border-t border-neutral-800">
        {adding ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              placeholder="Card title…"
              className="w-full bg-neutral-800 rounded px-2 py-1.5 text-sm outline-none ring-1 ring-indigo-500 text-neutral-100"
            />
            <div className="flex gap-2">
              <button
                onClick={commitAdd}
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
            className="w-full text-left text-sm text-neutral-500 hover:text-neutral-200 px-2 py-1.5 rounded hover:bg-neutral-800/50 transition-colors"
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  );
}

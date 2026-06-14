import { useState } from "react";
import * as Y from "yjs";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { InlineEdit } from "./InlineEdit";
import { SortableCard } from "./SortableCard";
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
  onOpenDetail,
  memberNames,
}: {
  doc: Y.Doc;
  column: Column;
  cards: Card[];
  identity: Identity;
  onOpenDetail?: (cardId: string) => void;
  memberNames?: Map<string, string>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Makes the column body a drop target, so a card can be dropped into an empty
  // column (or its blank area). id is namespaced "column:<id>" so BoardView's
  // handlers can tell a column-drop from a card-drop.
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: `column:${column.id}`,
    data: { type: "column", columnId: column.id },
  });

  // Add a card to this column from the draft, then reset the add form.
  const commitAdd = () => {
    const finalDraft = draft.trim();
    if (finalDraft) createCard(doc, column.id, finalDraft, identity);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex-shrink-0 w-72 bg-neutral-900 rounded-lg border border-neutral-800 flex flex-col max-h-full t-base">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <InlineEdit
            value={column.title}
            onCommit={(t) => renameColumn(doc, column.id, t)}
            className="text-sm font-medium text-neutral-100 truncate"
            placeholder="Column"
          />
          <span className="text-xs text-neutral-500 flex-shrink-0 bg-neutral-800/60 rounded-full px-1.5 min-w-5 text-center">
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

      <div
        ref={setDroppableRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-2.5 min-h-0"
      >
        <SortableContext
          items={cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.length === 0 && (
            <div className="text-xs text-neutral-600 text-center py-6 border border-dashed border-neutral-800 rounded-md">
              Drop a card here
            </div>
          )}
          {cards.map((c) => (
            <SortableCard
              key={c.id}
              doc={doc}
              card={c}
              onOpenDetail={onOpenDetail}
              assigneeName={
                c.assigneeId ? memberNames?.get(c.assigneeId) : undefined
              }
            />
          ))}
        </SortableContext>
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
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-md text-xs font-medium text-white t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setDraft("");
                }}
                className="px-2.5 py-1 text-neutral-400 hover:text-neutral-100 text-xs t-base"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-left text-sm text-neutral-500 hover:text-neutral-200 px-2 py-1.5 rounded-md hover:bg-neutral-800 t-base"
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  );
}

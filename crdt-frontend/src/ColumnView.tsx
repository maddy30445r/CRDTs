import { useState, type CSSProperties } from "react";
import * as Y from "yjs";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { InlineEdit } from "./InlineEdit";
import { SortableCard } from "./SortableCard";
import {
  createCard,
  deleteColumn,
  paletteEntry,
  renameColumn,
  setColumnAccent,
  PALETTE,
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

  // Makes the whole column a sortable item in BoardView's horizontal columns
  // list. type:"column" lets the shared drag handlers branch (vs type:"card").
  // listeners are attached to the header GRIP only, so the rest of the header
  // (title, accent, delete) stays clickable and card drags are unaffected.
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: "column", column } });

  const sortableStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

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
    <div
      ref={setSortableRef}
      style={sortableStyle}
      className="flex-shrink-0 w-72 bg-neutral-900 rounded-lg border border-neutral-800 flex flex-col max-h-full t-base overflow-hidden"
    >
      {/* Accent bar — thin top stripe driven by the shared palette. */}
      {column.accentColor && (
        <div
          className="h-1"
          style={{ backgroundColor: paletteEntry(column.accentColor).dot }}
        />
      )}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Grip — the ONLY column drag handle. */}
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 select-none leading-none flex-shrink-0"
            aria-label="Drag column"
          >
            ⠿
          </span>
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
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          {/* Accent picker — same palette as labels. */}
          <details className="relative">
            <summary
              className="list-none cursor-pointer text-sm leading-none"
              style={{
                color: column.accentColor
                  ? paletteEntry(column.accentColor).dot
                  : undefined,
              }}
              title="Column accent"
            >
              ●
            </summary>
            <div className="absolute right-0 z-10 mt-1 bg-[var(--surface-card)] border border-[var(--hairline)] rounded-md p-2 flex gap-1.5">
              <button
                onClick={() => setColumnAccent(doc, column.id, undefined)}
                className="w-5 h-5 rounded-full border border-neutral-600 text-[10px] text-neutral-400 flex items-center justify-center"
                aria-label="No accent"
              >
                ×
              </button>
              {PALETTE.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setColumnAccent(doc, column.id, p.key)}
                  className="w-5 h-5 rounded-full t-base"
                  style={{
                    backgroundColor: p.dot,
                    outline:
                      column.accentColor === p.key
                        ? "2px solid white"
                        : "none",
                    outlineOffset: "1px",
                  }}
                  aria-label={p.name}
                />
              ))}
            </div>
          </details>
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
            className="text-neutral-500 hover:text-neutral-200 text-lg leading-none"
            aria-label="Delete column"
          >
            ×
          </button>
        </div>
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

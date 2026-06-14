import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { ColumnView } from "./ColumnView";
import { CardView } from "./CardView";
import { CardDetailPanel } from "./CardDetailPanel";
import { fetchMembers } from "./api";
import {
  createColumn,
  getCardsInColumn,
  getCardsMap,
  getColumnsMap,
  getColumnsSorted,
  moveCard,
  type Card,
  type Column,
  type Identity,
} from "./board-model";
import type { YjsClient } from "./yjs";

export function BoardView({
  client,
  identity,
  token,
  boardId,
}: {
  client: YjsClient;
  identity: Identity;
  token: string;
  boardId: string;
}) {
  const [, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  // Card detail panel: which card is open, and userId→name for assignee labels.
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState<Map<string, string>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    fetchMembers(token, boardId)
      .then(({ members }) => {
        if (cancelled) return;
        setMemberNames(new Map(members.map((m) => [m.user_id, m.name])));
      })
      .catch(() => {
        /* non-fatal: cards just show raw id / no name tooltip */
      });
    return () => {
      cancelled = true;
    };
  }, [token, boardId]);

  // --- drag state ---
  // draggingRef: read synchronously inside the observer to gate re-renders.
  // pendingRemoteRef: set when a remote change was swallowed during a drag.
  const draggingRef = useRef(false);
  const pendingRemoteRef = useRef(false);
  // Frozen copy of columns+cards taken at drag start. While dragging, the board
  // renders from THIS (optimistically mutated in onDragOver), not live reads.
  const [snapshot, setSnapshot] = useState<{
    columns: Column[];
    cardsByColumn: Map<string, Card[]>;
  } | null>(null);
  // The card currently under the cursor — rendered in the DragOverlay.
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 5px of movement before a drag starts — below that it's a click, so
      // click-to-edit on the card title still works.
      activationConstraint: { distance: 5 },
    }),
  );

  useEffect(() => {
    const columns = getColumnsMap(client.doc);
    const cards = getCardsMap(client.doc);
    const onChange = () => {
      // TODO (idea 1 — the drag gate):
      //   If draggingRef.current is true, DON'T re-render mid-drag. Instead set
      //   pendingRemoteRef.current = true and return early. Otherwise bump the tick.
      if (draggingRef.current == true) {
        pendingRemoteRef.current = true;
        return;
      }
      setTick((t) => t + 1);
    };
    columns.observe(onChange);
    cards.observe(onChange);
    return () => {
      columns.unobserve(onChange);
      cards.unobserve(onChange);
    };
  }, [client.doc]);

  // Live reads — the source of truth when NOT dragging.
  const liveColumns = getColumnsSorted(getColumnsMap(client.doc));
  const liveCardsMap = getCardsMap(client.doc);

  // Render source: snapshot while dragging (so the DOM stays stable under
  // @dnd-kit), live Y.Map reads otherwise.
  const columns = snapshot ? snapshot.columns : liveColumns;
  const cardsFor = (columnId: string): Card[] =>
    snapshot
      ? (snapshot.cardsByColumn.get(columnId) ?? [])
      : getCardsInColumn(liveCardsMap, columnId);

  // Utility: which column (in the snapshot) currently holds this card?
  function findColumnOfCard(
    cardsByColumn: Map<string, Card[]>,
    cardId: string,
  ): string | null {
    for (const [colId, list] of cardsByColumn) {
      if (list.some((c) => c.id === cardId)) return colId;
    }
    return null;
  }

  // --- drag handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    // TODO (idea 2 — capture the snapshot):
    //   1. const card = event.active.data.current?.card as Card | undefined; if (!card) return;
    //   2. draggingRef.current = true; pendingRemoteRef.current = false; setActiveCard(card);
    //   3. Build the snapshot from LIVE state right now:
    //        - cols = getColumnsSorted(getColumnsMap(client.doc))
    //        - map = new Map<string, Card[]>(); for each col: map.set(col.id, getCardsInColumn(cardsMap, col.id))
    //        - setSnapshot({ columns: cols, cardsByColumn: map })
    const card = event.active.data.current?.card as Card | undefined;
    if (!card) return;
    draggingRef.current = true;
    pendingRemoteRef.current = false;
    setActiveCard(card);
    const cols = getColumnsSorted(getColumnsMap(client.doc));
    const map = new Map<string, Card[]>();
    cols.map((col) =>
      map.set(col.id, getCardsInColumn(getCardsMap(client.doc), col.id)),
    );
    setSnapshot({ columns: cols, cardsByColumn: map });
  };

  // PROVIDED — optimistic reorder (idea 3). Mutates ONLY the snapshot; no Yjs
  // writes. Read this to understand how the cards shift as you drag over slots.
  const handleDragOver = (event: DragOverEvent) => {
    if (!snapshot) return;
    const activeId = event.active.id as string;
    const overId = event.over?.id as string | undefined;
    // Hovering our own slot is a no-op — without this guard the splice-then-
    // reinsert would append the card to the end of its own column.
    if (!overId || overId === activeId) return;

    const fromCol = findColumnOfCard(snapshot.cardsByColumn, activeId);
    if (!fromCol) return;

    // Destination column: a column droppable is "column:<id>"; otherwise we're
    // over another card, so look up that card's column.
    let toCol: string | null;
    if (overId.startsWith("column:")) {
      toCol = overId.slice("column:".length);
    } else {
      toCol = findColumnOfCard(snapshot.cardsByColumn, overId);
    }
    if (!toCol) return;

    const next = new Map(snapshot.cardsByColumn);

    if (fromCol === toCol) {
      // Same column: direction-aware reorder. arrayMove moves the card TO the
      // target index and shifts correctly whether going up or down — no
      // remove-then-insert-before (which under-shoots by one when moving down).
      const list = [...(next.get(fromCol) ?? [])];
      const oldIndex = list.findIndex((c) => c.id === activeId);
      const newIndex = overId.startsWith("column:")
        ? list.length - 1 // over the column body → end
        : list.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      next.set(fromCol, arrayMove(list, oldIndex, newIndex));
    } else {
      // Across columns: pull the card out of the source, insert into the dest.
      const fromList = [...(next.get(fromCol) ?? [])];
      const activeIdx = fromList.findIndex((c) => c.id === activeId);
      if (activeIdx === -1) return;
      const [moving] = fromList.splice(activeIdx, 1);
      next.set(fromCol, fromList);
      const toList = [...(next.get(toCol) ?? [])];
      if (overId.startsWith("column:")) {
        toList.push(moving); // dropped on the column body → end of list
      } else {
        const overIdx = toList.findIndex((c) => c.id === overId);
        const insertAt = overIdx === -1 ? toList.length : overIdx;
        toList.splice(insertAt, 0, moving);
      }
      next.set(toCol, toList);
    }

    setSnapshot({ columns: snapshot.columns, cardsByColumn: next });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = event.active.id as string;
    const snap = snapshot;

    // Clear drag UI first so the gate resets on every exit path.
    setActiveCard(null);
    draggingRef.current = false;

    if (!snap) {
      setSnapshot(null);
      return;
    }

    // Where did the card land in the optimistic snapshot?
    const toCol = findColumnOfCard(snap.cardsByColumn, activeId);
    if (toCol) {
      const list = snap.cardsByColumn.get(toCol) ?? [];
      const idx = list.findIndex((c) => c.id === activeId);
      // THE BRIDGE: index → beforeCardId. The card after ours, or null if last.
      const beforeCardId =
        idx >= 0 && idx < list.length - 1 ? list[idx + 1].id : null;
      moveCard(client.doc, activeId, toCol, beforeCardId); // the ONE Yjs write
    }

    // Drop the snapshot and re-render from live truth — applies any remote
    // changes that piled up behind the gate during the drag.
    setSnapshot(null);
    pendingRemoteRef.current = false;
    setTick((t) => t + 1);
  };

  const handleDragCancel = () => {
    setActiveCard(null);
    draggingRef.current = false;
    setSnapshot(null);
    pendingRemoteRef.current = false;
    setTick((t) => t + 1);
  };

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
        <div className="text-center max-w-xs">
          <div className="mx-auto mb-5 w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600">
            {/* simple board glyph */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="3" y="4" width="5" height="16" rx="1.5" fill="currentColor" opacity="0.5" />
              <rect x="9.5" y="4" width="5" height="11" rx="1.5" fill="currentColor" opacity="0.5" />
              <rect x="16" y="4" width="5" height="7" rx="1.5" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-neutral-100">
            This board is empty
          </h2>
          <p className="text-sm text-neutral-500 mt-1 mb-5">
            Columns hold your cards. Add one to start organizing work.
          </p>
          <button
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-md text-sm font-medium text-white t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            + Create your first column
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-4 h-full items-start">
          {columns.map((col) => (
            <ColumnView
              key={col.id}
              doc={client.doc}
              column={col}
              cards={cardsFor(col.id)}
              identity={identity}
              onOpenDetail={setOpenCardId}
              memberNames={memberNames}
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
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-md text-xs font-medium text-white t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
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
                className="w-full bg-neutral-900/40 hover:bg-neutral-900 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-700 px-3 py-3 text-sm text-neutral-500 hover:text-neutral-300 t-base text-left"
              >
                + Add column
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating card that follows the cursor during a drag. */}
      <DragOverlay>
        {activeCard ? (
          <div className="rotate-2 elev-drag rounded-lg">
            <CardView doc={client.doc} card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>

      {/* Card detail slide-over. Reads the card LIVE from the Y.Map (not the
          drag snapshot) — it's never open during a drag. */}
      {openCardId && (
        <CardDetailPanel
          doc={client.doc}
          cardId={openCardId}
          token={token}
          boardId={boardId}
          onClose={() => setOpenCardId(null)}
        />
      )}
    </DndContext>
  );
}

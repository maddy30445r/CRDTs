import { useEffect, useState } from "react";
import * as Y from "yjs";
import {
  getColumnsMap,
  getCardsMap,
  getColumnsSorted,
  getCardsInColumn,
  createColumn,
  renameColumn,
  deleteColumn,
  moveColumn,
  createCard,
  renameCard,
  deleteCard,
  moveCard,
  type Column,
  type Card,
  type Identity,
} from "./board-model";

/**
 * Intentionally ugly debug UI. Every button exercises one helper.
 * K2/K3 will replace this with the real kanban UI.
 */
export function DebugBoard({
  doc,
  identity,
}: {
  doc: Y.Doc;
  identity: Identity;
}) {
  // The tick: state whose ONLY job is to force a re-render. The data lives in
  // the Y.Maps, not here. We read it fresh every render via the selectors below.
  const [, setTick] = useState(0);

  // TODO: write this effect — the heart of the component.
  //   - get columns map and cards map from doc
  //   - onChange = () => setTick(t => t + 1)      // doorbell: "something changed, re-render"
  //   - observe BOTH maps with onChange  (columns.observe / cards.observe)
  //   - cleanup: unobserve BOTH
  //   - dependency array: [doc]
  //   WHY observe the MAPS (not individual cards)? one observer catches every
  //   local AND remote change to any column/card. Granular per-card observers
  //   are a K2/K3 perf concern, not needed here.
  useEffect(() => {
    const columns = getColumnsMap(doc);
    const cards = getCardsMap(doc);
    const onChange = () => setTick((t) => t + 1);
    columns.observe(onChange);
    cards.observe(onChange);
    return () => {
      columns.unobserve(onChange);
      cards.unobserve(onChange);
    };
  }, [doc]);

  // Fresh snapshot every render — derived data, never stored in state.
  const columns = getColumnsSorted(getColumnsMap(doc));
  const cardsMap = getCardsMap(doc);

  // ---- handlers (throwaway prompt-driven glue) ----
  const handleAddColumn = () => {
    const title = window.prompt("Column title?");
    if (title) createColumn(doc, title);
  };

  const handleRenameColumn = (col: Column) => {
    const title = window.prompt("New title?", col.title);
    if (title !== null) renameColumn(doc, col.id, title);
  };

  const handleDeleteColumn = (col: Column) => {
    if (window.confirm(`Delete column "${col.title}" and its cards?`)) {
      deleteColumn(doc, col.id);
    }
  };

  const handleMoveColumn = (col: Column) => {
    const others = columns.filter((c) => c.id !== col.id);
    if (others.length === 0) return;
    const labels =
      others.map((c, i) => `${i}: before "${c.title}"`).join("\n") +
      `\n${others.length}: at end`;
    const choice = window.prompt(`Move column where?\n${labels}`);
    if (choice === null) return;
    const idx = parseInt(choice, 10);
    if (isNaN(idx)) return;
    const beforeColumnId = idx >= others.length ? null : others[idx].id;
    moveColumn(doc, col.id, beforeColumnId);
  };

  const handleAddCard = (col: Column) => {
    const title = window.prompt("Card title?");
    if (title) createCard(doc, col.id, title, identity);
  };

  const handleRenameCard = (card: Card) => {
    const title = window.prompt("New title?", card.title);
    if (title !== null) renameCard(doc, card.id, title);
  };

  const handleDeleteCard = (card: Card) => {
    if (window.confirm(`Delete card "${card.title}"?`)) {
      deleteCard(doc, card.id);
    }
  };

  const handleMoveCard = (card: Card) => {
    // Build a flat list of every possible destination slot, across all columns.
    type Slot = {
      columnId: string;
      beforeCardId: string | null;
      label: string;
    };
    const slots: Slot[] = [];
    for (const col of columns) {
      const inCol = getCardsInColumn(cardsMap, col.id).filter(
        (c) => c.id !== card.id,
      );
      inCol.forEach((c) => {
        slots.push({
          columnId: col.id,
          beforeCardId: c.id,
          label: `[${col.title}] before "${c.title}"`,
        });
      });
      slots.push({
        columnId: col.id,
        beforeCardId: null,
        label: `[${col.title}] at end`,
      });
    }
    const menu = slots.map((s, i) => `${i}: ${s.label}`).join("\n");
    const choice = window.prompt(`Move card "${card.title}" where?\n${menu}`);
    if (choice === null) return;
    const idx = parseInt(choice, 10);
    if (isNaN(idx) || !slots[idx]) return;
    moveCard(doc, card.id, slots[idx].columnId, slots[idx].beforeCardId);
  };

  // ---- render (intentionally raw) ----
  return (
    <div style={{ padding: 16, fontFamily: "system-ui" }}>
      <div style={{ marginBottom: 16 }}>
        <button onClick={handleAddColumn}>+ Add column</button>
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          overflowX: "auto",
        }}
      >
        {columns.length === 0 && (
          <div style={{ color: "#888" }}>
            No columns yet. Click "+ Add column" to start.
          </div>
        )}
        {columns.map((col) => (
          <div
            key={col.id}
            style={{
              minWidth: 220,
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: 8,
              background: "#fafafa",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <strong>{col.title}</strong>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => handleRenameColumn(col)} title="Rename">
                  ✎
                </button>
                <button onClick={() => handleMoveColumn(col)} title="Move">
                  ↔
                </button>
                <button onClick={() => handleDeleteColumn(col)} title="Delete">
                  ×
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
              {col.id} · {col.sortKey}
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => handleAddCard(col)}
                style={{ width: "100%" }}
              >
                + Add card
              </button>
            </div>
            <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {getCardsInColumn(cardsMap, col.id).map((card) => (
                <li
                  key={card.id}
                  style={{
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: 4,
                    padding: 6,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{card.title}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleRenameCard(card)}
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button onClick={() => handleMoveCard(card)} title="Move">
                        ↔
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                    {card.id} · {card.sortKey} · by {card.createdBy}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

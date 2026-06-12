// ============================================================
// board-model.ts — the kanban data model on the Y.Doc
//
// Two top-level Y.Maps:
//   "columns" : id -> Column  (plain object, LWW at whole-object level)
//   "cards"   : id -> Card    (plain object; card.columnId says which column)
//
// Order is a STRING, not an index. Each row carries a `sortKey` (a
// fractional-indexing key). To order rows, sort by (sortKey, id).
// ============================================================

// ============================================================
// Types
// ============================================================

import { generateKeyBetween } from "fractional-indexing";
import { nanoid } from "nanoid";
import * as y from "yjs";

export type Column = { id: string; title: string; sortKey: string };

export type Card = {
  id: string;
  title: string;
  columnId: string;
  sortKey: string;
  createdAt: number;
  createdBy: string;
};

export type Identity = { id: string; name: string };

// ============================================================
// Map accessors — return the STABLE top-level Y.Map. Call once
// per render; never stash the returned map in React state.
// ============================================================

export function getColumnsMap(doc: y.Doc): y.Map<Column> {
  return doc.getMap<Column>("columns");
}

export function getCardsMap(doc: y.Doc): y.Map<Card> {
  return doc.getMap<Card>("cards");
}

// ============================================================
// Selectors — pure reads over a Y.Map snapshot.
// ============================================================

// Comparator for the (sortKey, id) tuple.
// WHY not `a.sortKey - b.sortKey`? sortKeys are STRINGS (base-62), so use
// string comparison (`<`). WHY the id fallback? two clients can concurrently
// generate the SAME sortKey for the same gap — id breaks the tie identically
// on every client, so order is deterministic everywhere.
//
function compareByKeyThenId<T extends { sortKey: string; id: string }>(
  a: T,
  b: T,
): number {
  if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
  else return a.id < b.id ? -1 : 1;
}

export function getColumnsSorted(columns: y.Map<Column>): Column[] {
  const arr: Column[] = [];
  columns.forEach((col) => {
    arr.push(col);
  });
  arr.sort(compareByKeyThenId);
  return arr;
}
//   NOTE: Y.Map has no .map()/.values()-to-array; use .forEach to collect.

export function getCardsInColumn(cards: y.Map<Card>, columnId: string): Card[] {
  const arr: Card[] = [];
  cards.forEach((card) => {
    if (card.columnId === columnId) arr.push(card);
  });

  arr.sort(compareByKeyThenId);
  return arr;
}

// ============================================================
// Mutators — columns
// ============================================================

export function createColumn(doc: y.Doc, title: string): Column {
  const columns = getColumnsMap(doc);
  const sortedColumns = getColumnsSorted(columns);
  const lastKey = sortedColumns.length
    ? sortedColumns[sortedColumns.length - 1].sortKey
    : null;
  const newColumn: Column = {
    id: nanoid(10),
    title,
    sortKey: generateKeyBetween(lastKey, null),
  };
  doc.transact(() => {
    columns.set(newColumn.id, newColumn);
  });
  return newColumn;
}
export function renameColumn(
  doc: y.Doc,
  columnId: string,
  title: string,
): void {
  const columns = getColumnsMap(doc);
  const existing = columns.get(columnId);
  if (!existing) return;
  doc.transact(() => columns.set(columnId, { ...existing, title }));
}

export function deleteColumn(doc: y.Doc, columnId: string): void {
  const columns = getColumnsMap(doc);
  const cards = getCardsMap(doc);
  const existing = columns.get(columnId);
  if (!existing) return;
  doc.transact(() => {
    columns.delete(columnId);
    const cardsInColumn = getCardsInColumn(cards, columnId);
    cardsInColumn.map((card) => {
      cards.delete(card.id);
    });
  });
}

export function moveColumn(
  doc: y.Doc,
  columnId: string,
  beforeColumnId: string | null,
): void {
  const columnMap = getColumnsMap(doc);
  const moving = columnMap.get(columnId);
  if (!moving) return;

  const sortedExceptMoving = getColumnsSorted(columnMap).filter(
    (c) => c.id !== columnId,
  );
  const len = sortedExceptMoving.length;
  if (!len) return;
  let prevKey: string | null;
  let nextKey: string | null;

  if (beforeColumnId == null) {
    prevKey = sortedExceptMoving[len - 1].sortKey;
    nextKey = null;
  } else {
    const idx = sortedExceptMoving.findIndex((c) => c.id === beforeColumnId);
    if (idx === -1) return;
    prevKey = idx > 0 ? sortedExceptMoving[idx - 1].sortKey : null;
    nextKey = sortedExceptMoving[idx].sortKey;
  }
  doc.transact(() => {
    try {
      const newKey = generateKeyBetween(prevKey, nextKey);
      columnMap.set(columnId, { ...moving, sortKey: newKey });
    } catch (e) {
      rebalanceColumns(doc);
      moveColumn(doc, columnId, beforeColumnId);
    }
  });
}

function rebalanceColumns(doc: y.Doc): void {
  const columnMap = getColumnsMap(doc);
  const sortedColumns = getColumnsSorted(columnMap);
  doc.transact(() => {
    let prev = null;
    for (const col of sortedColumns) {
      const newKey = generateKeyBetween(prev, null);
      columnMap.set(col.id, { ...col, sortKey: newKey });
      prev = newKey;
    }
  });
}
//   WHY CRDT-safe: getColumnsSorted is deterministic, so every client that runs
//   this on the same state produces the SAME new keys → concurrent rebalances agree.

// ============================================================
// Mutators — cards
// ============================================================

export function createCard(
  doc: y.Doc,
  columnId: string,
  title: string,
  identity: Identity,
): Card {
  const columns = getColumnsMap(doc);
  if (!columns.has(columnId)) {
    throw new Error(`createCard: column ${columnId} does not exist`);
  }
  const cards = getCardsMap(doc);
  const inColumn = getCardsInColumn(cards, columnId);
  const lastKey = inColumn.length
    ? inColumn[inColumn.length - 1].sortKey
    : null;
  const card: Card = {
    id: nanoid(10),
    title,
    columnId,
    sortKey: generateKeyBetween(lastKey, null),
    createdAt: Date.now(),
    createdBy: identity.id,
  };
  doc.transact(() => {
    cards.set(card.id, card);
  });
  return card;
}

export function renameCard(doc: y.Doc, cardId: string, title: string): void {
  const cards = getCardsMap(doc);
  const existing = cards.get(cardId);
  if (!existing) return;
  doc.transact(() => cards.set(cardId, { ...existing, title }));
}

export function deleteCard(doc: y.Doc, cardId: string): void {
  const cards = getCardsMap(doc);
  doc.transact(() => cards.delete(cardId));
}

// ----- the load-bearing one -----
export function moveCard(
  doc: y.Doc,
  cardId: string,
  toColumnId: string,
  beforeCardId: string | null,
): void {
  const cards = getCardsMap(doc);
  const columns = getColumnsMap(doc);
  const card = cards.get(cardId);
  if (!card) return;
  if (!columns.has(toColumnId)) {
    throw new Error(`moveCard: column ${toColumnId} does not exist`);
  }

  doc.transact(() => {
    const attempt = computeInsertKey(cards, toColumnId, beforeCardId, cardId);
    if (attempt.ok) {
      // ONE set carries BOTH columnId and sortKey — observers see the move atomically.
      cards.set(cardId, { ...card, columnId: toColumnId, sortKey: attempt.key });
      return;
    }
    // Degenerate gap: two cards in the destination share a sortKey and we're
    // inserting between them. Rebalance the column, recompute, retry once.
    rebalanceColumn(doc, toColumnId);
    const retry = computeInsertKey(cards, toColumnId, beforeCardId, cardId);
    if (!retry.ok) {
      throw new Error(`moveCard: rebalance failed to fix gap in ${toColumnId}`);
    }
    // Re-read: rebalanceColumn may have rewritten this card's object.
    const refreshed = cards.get(cardId);
    if (refreshed) {
      cards.set(cardId, {
        ...refreshed,
        columnId: toColumnId,
        sortKey: retry.key,
      });
    }
  });
}

type InsertKeyResult = { ok: true; key: string } | { ok: false };

function computeInsertKey(
  cards: y.Map<Card>,
  toColumnId: string,
  beforeCardId: string | null,
  excludeCardId: string,
): InsertKeyResult {
  const incColumn = getCardsInColumn(cards, toColumnId).filter(
    (c) => c.id !== excludeCardId,
  );
  let prevKey: string | null;
  let nextKey: string | null;
  const len = incColumn.length;
  if (beforeCardId == null) {
    prevKey = len ? incColumn[len - 1].sortKey : null;
    nextKey = null;
  } else {
    const idx = incColumn.findIndex((c) => c.id === beforeCardId);
    if (idx === -1) {
      prevKey = len ? incColumn[len - 1].sortKey : null;
      nextKey = null;
    } else {
      prevKey = idx > 0 ? incColumn[idx - 1].sortKey : null;
      nextKey = incColumn[idx].sortKey;
    }
  }
  try {
    return { ok: true, key: generateKeyBetween(prevKey, nextKey) };
  } catch {
    return { ok: false };
  }
}

// Singular — rebalances ONE column's cards (vs. rebalanceColumns for the board).
function rebalanceColumn(doc: y.Doc, columnId: string): void {
  const cards = getCardsMap(doc);
  const inColumn = getCardsInColumn(cards, columnId);
  doc.transact(() => {
    let prev: string | null = null;
    for (const card of inColumn) {
      const newKey = generateKeyBetween(prev, null);
      cards.set(card.id, { ...card, sortKey: newKey });
      prev = newKey;
    }
  });
}

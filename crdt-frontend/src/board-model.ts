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

export type Column = {
  id: string;
  title: string;
  sortKey: string;
  accentColor?: string; // NEW — palette key, or undefined for no accent
};

// A board-level label definition. color is a PALETTE key (e.g. "indigo"), not a
// raw color — the palette guarantees dark-theme-readable contrast.
export type LabelDef = { name: string; color: string };

export type Card = {
  id: string;
  title: string;
  columnId: string;
  sortKey: string;
  createdAt: number;
  createdBy: string;
  description?: string; // NEW
  dueDate?: string; // NEW — ISO date "YYYY-MM-DD", or undefined
  assigneeId?: string; // NEW — board member userId, or undefined
};

export type Identity = { id: string; name: string; color: string };

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

// Board-level label registry: labelId -> LabelDef (plain object, LWW per label).
export function getLabelsMap(doc: y.Doc): y.Map<LabelDef> {
  return doc.getMap<LabelDef>("labels");
}

// Per-card label membership: cardId -> Y.Map<labelId, true> (a nested CRDT set).
// Stored parallel to "cards" (NOT nested inside the Card object) so card scalar
// fields stay plain-object LWW while membership merges per-key offline.
export function getCardLabelsMap(doc: y.Doc): y.Map<y.Map<boolean>> {
  return doc.getMap("cardLabels");
}

// ============================================================
// Palette — shared by labels AND column accents. Kept as data so the picker and
// the pill renderer agree. ~8 colors curated to read on the dark theme.
// ============================================================

export const PALETTE: {
  key: string;
  name: string;
  bg: string;
  text: string;
  dot: string;
}[] = [
  { key: "slate", name: "Slate", bg: "rgba(148,163,184,0.18)", text: "#cbd5e1", dot: "#94a3b8" },
  { key: "indigo", name: "Indigo", bg: "rgba(99,102,241,0.20)", text: "#c7d2fe", dot: "#6366f1" },
  { key: "violet", name: "Violet", bg: "rgba(168,85,247,0.20)", text: "#e9d5ff", dot: "#a855f7" },
  { key: "pink", name: "Pink", bg: "rgba(236,72,153,0.20)", text: "#fbcfe8", dot: "#ec4899" },
  { key: "red", name: "Red", bg: "rgba(239,68,68,0.20)", text: "#fecaca", dot: "#ef4444" },
  { key: "amber", name: "Amber", bg: "rgba(245,158,11,0.20)", text: "#fde68a", dot: "#f59e0b" },
  { key: "green", name: "Green", bg: "rgba(34,197,94,0.20)", text: "#bbf7d0", dot: "#22c55e" },
  { key: "teal", name: "Teal", bg: "rgba(20,184,166,0.20)", text: "#99f6e4", dot: "#14b8a6" },
];

// Resolve a palette key to its entry; falls back to the first color for unknown
// keys (e.g. data from a future palette version).
export function paletteEntry(key: string) {
  return PALETTE.find((p) => p.key === key) ?? PALETTE[0];
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

// Generic whole-card field updater. Spread-and-set: same LWW shape as renameCard,
// but for any subset of fields. New optional fields (description/dueDate/assignee)
// ride through here without touching move/sort logic.
export function updateCard(
  doc: y.Doc,
  cardId: string,
  patch: Partial<Omit<Card, "id">>,
): void {
  const cards = getCardsMap(doc);
  const existing = cards.get(cardId);
  if (!existing) return;
  doc.transact(() => cards.set(cardId, { ...existing, ...patch }));
}

export function setCardDescription(
  doc: y.Doc,
  cardId: string,
  description: string,
): void {
  updateCard(doc, cardId, { description });
}

export function setCardDueDate(
  doc: y.Doc,
  cardId: string,
  dueDate: string | undefined,
): void {
  updateCard(doc, cardId, { dueDate });
}

export function setCardAssignee(
  doc: y.Doc,
  cardId: string,
  assigneeId: string | undefined,
): void {
  updateCard(doc, cardId, { assigneeId });
}

export function deleteCard(doc: y.Doc, cardId: string): void {
  const cards = getCardsMap(doc);
  const cardLabels = getCardLabelsMap(doc);
  doc.transact(() => {
    cards.delete(cardId);
    cardLabels.delete(cardId); // clean up the label set, avoid orphaned sets
  });
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

// ============================================================
// Mutators — column accent (plain field on the Column object, LWW is fine)
// ============================================================

export function setColumnAccent(
  doc: y.Doc,
  columnId: string,
  accentColor: string | undefined,
): void {
  const columns = getColumnsMap(doc);
  const existing = columns.get(columnId);
  if (!existing) return;
  doc.transact(() => columns.set(columnId, { ...existing, accentColor }));
}

// ============================================================
// Mutators — label registry (LWW per label, like a card title)
// ============================================================

export function createLabel(doc: y.Doc, name: string, color: string): string {
  const labels = getLabelsMap(doc);
  const id = nanoid(8);
  doc.transact(() => labels.set(id, { name, color }));
  return id;
}

export function renameLabel(doc: y.Doc, labelId: string, name: string): void {
  const labels = getLabelsMap(doc);
  const existing = labels.get(labelId);
  if (!existing) return;
  doc.transact(() => labels.set(labelId, { ...existing, name }));
}

export function recolorLabel(doc: y.Doc, labelId: string, color: string): void {
  const labels = getLabelsMap(doc);
  const existing = labels.get(labelId);
  if (!existing) return;
  doc.transact(() => labels.set(labelId, { ...existing, color }));
}

export function deleteLabel(doc: y.Doc, labelId: string): void {
  // Remove the definition. Dangling references on cards become harmless no-ops
  // (filtered at render). No cascade cleanup — that'd be a multi-card write storm.
  const labels = getLabelsMap(doc);
  doc.transact(() => labels.delete(labelId));
}

export function getLabelsSorted(
  labels: y.Map<LabelDef>,
): { id: string; def: LabelDef }[] {
  const out: { id: string; def: LabelDef }[] = [];
  labels.forEach((def, id) => out.push({ id, def }));
  out.sort((a, b) => a.def.name.localeCompare(b.def.name));
  return out;
}

// ============================================================
// Card label membership — the Y.Map<labelId, true> set per card.
// Per-key add/remove merges cleanly offline (the whole reason for a set, not an
// array): concurrent add "bug" + add "urgent" on the same card keeps BOTH.
// ============================================================

// Get the live set for a card, creating it lazily on first add. Returns the
// nested Y.Map. MUST be called inside a transaction (it may write).
function ensureCardLabelSet(doc: y.Doc, cardId: string): y.Map<boolean> {
  const cardLabels = getCardLabelsMap(doc);
  let set = cardLabels.get(cardId);
  if (!set) {
    set = new y.Map<boolean>();
    cardLabels.set(cardId, set);
  }
  return set;
}

export function addCardLabel(doc: y.Doc, cardId: string, labelId: string): void {
  doc.transact(() => {
    const set = ensureCardLabelSet(doc, cardId);
    set.set(labelId, true);
  });
}

export function removeCardLabel(
  doc: y.Doc,
  cardId: string,
  labelId: string,
): void {
  doc.transact(() => {
    const set = getCardLabelsMap(doc).get(cardId);
    if (set) set.delete(labelId);
  });
}

// Read a card's label ids (just the keys present in its set).
export function getCardLabelIds(doc: y.Doc, cardId: string): string[] {
  const set = getCardLabelsMap(doc).get(cardId);
  if (!set) return [];
  return Array.from(set.keys());
}

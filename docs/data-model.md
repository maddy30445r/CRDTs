# Kanban data model design

**Author:** Madhur Mittal  
**Date:** 2026-06-05

## 1. What I'm building

A local-first collaborative kanban board. Users edit boards offline; when 
reconnected, changes merge cleanly across devices with no central authority 
required for conflict resolution. Architectural goal: the server is a relay, 
not a source of truth. Every client holds the canonical state for the boards 
it has loaded.

## 2. Y.Doc strategy

**One Y.Doc per board.**

- *Per workspace* rejected: doc grows unbounded, every keystroke syncs to all 
  workspace members.
- *Per card* rejected: too granular, per-card sync overhead.
- *Per board* is the Goldilocks choice — each board syncs independently, 
  presence scopes naturally to "people in this board," and cross-board 
  references can stay soft (just an ID). Matches what Linear does.

## 3. Document structure

**Flat storage, not nested.** Cards stored separately from columns, linked by 
a `columnId` field.
board (Y.Doc)
├── meta:    Y.Map { title: string, schemaVersion: number, createdAt: number }
├── columns: Y.Map<columnId, Y.Map { title: string, order: string }>
└── cards:   Y.Map<cardId, Y.Map {
title: string,
description: string,
columnId: string,
order: string
}>

**Why flat.** In a nested model, moving a card from column A to column B is 
a delete from one Y.Array and an insert into another — two operations on 
different structures with no shared field for last-writer-wins to arbitrate. 
Concurrent moves of the same card produce duplicates. In the flat model, a 
move is a single write to `card.columnId`, which LWW resolves cleanly. Same 
principle applies to reordering.

**Ordering: fractional indexing, not Y.Array.** Each column and card has an 
`order` field — a sortable string key (e.g. `"a0"`, `"a0V"`, `"a1"`). To 
insert between two items, generate a key that sorts between their neighbors. 
Move/reorder = changing one field. The `fractional-indexing` npm package 
handles key generation; the jittered variant avoids collisions on concurrent 
inserts.

**Text fields: plain strings, not Y.Text.** Titles and descriptions are plain 
strings in Y.Maps, resolved by last-writer-wins on conflict. The 
collaborative surface of a kanban is *structural* (drag, reorder, move) — 
not character-level text co-authoring — so the rare lost concurrent edit on 
a title is acceptable, and the binding complexity of Y.Text is not. Y.Text 
deferred unless collaborative descriptions become a product requirement.

**IDs:** generated client-side with `crypto.randomUUID()`. No counters, no 
array indices.

## 4. Deletion semantics

- **Two users delete the same card concurrently.** Idempotent — removing a 
  Y.Map key twice = removed once. No special handling.
- **User A deletes column X while user B adds a card with `columnId = X`.** 
  Cascade deletion can't be made atomic across concurrent clients. Orphans 
  are handled at render time: cards whose `columnId` doesn't exist in 
  `columns` are shown in a recovery "Unsorted" bucket so no work is silently 
  lost. User can move or re-delete from there.
- **User A deletes the entire board while user B edits a card.** Board 
  deletion is a workspace-layer concern, not an operation inside this Y.Doc. 
  Out of scope.

General principle: with flat storage, deletes are idempotent key removals; 
the only hard case (orphans) is handled at render time, never via cascade.

## 5. Schema versioning

- Every board carries `meta.schemaVersion` (starts at 1).
- App code knows the current target version.
- On loading a Y.Doc, the client checks `meta.schemaVersion` and runs 
  sequential migration functions (v1→v2, v2→v3, …) to bring it current, then 
  writes the bumped version.
- **Migrations must be idempotent.** Two clients may concurrently migrate the 
  same old doc; the result must be identical whether the migration runs once 
  or twice.
- **Prefer additive changes.** Optional new fields are safe across versions. 
  Renames or removals require either a backward-compatible read window or a 
  forced-upgrade gate.
- Migrations propagate to peers as ordinary CRDT operations.

## 6. Open questions (deferred)

- **Auth & permissions** — who can read/write a board? CRDTs leak the whole 
  doc to anyone with access, so per-card permissions inside one Y.Doc are 
  architecturally hard.
- **Sharing model** — invite links? email invites? workspace membership?
- **Workspace layer** — how boards are organized, listed, discovered. Likely 
  a separate registry (another Y.Doc or a database).
- **Presence / awareness** — cursors, "X is viewing this card," online 
  indicators. Yjs awareness protocol handles transport; UX is the open part.
- **Card features** — comments (`Y.Map<commentId, ...>`), labels (as a *set*, 
  not LWW), due dates, assignees, attachments. Deferred to v2+.
- **Conflict UX** — how the UI surfaces orphaned cards and concurrent-delete 
  scenarios.
- **Activity history** — audit log, version timeline.
- **Y.Text for descriptions** — only if collaborative card-description 
  editing becomes a feature.
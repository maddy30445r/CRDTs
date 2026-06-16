import * as Y from "yjs";
import { useState } from "react";
import {
  getLabelsMap,
  getLabelsSorted,
  createLabel,
  deleteLabel,
  recolorLabel,
  renameLabel,
  addCardLabel,
  removeCardLabel,
  getCardLabelIds,
  paletteEntry,
  PALETTE,
  type LabelDef,
} from "./board-model";

// A label pill rendered on card faces. Color comes from the shared palette.
export function LabelPill({ def }: { def: LabelDef }) {
  const p = paletteEntry(def.color);
  return (
    <span
      className="text-[10px] px-1.5 py-1 rounded leading-none"
      style={{ backgroundColor: p.bg, color: p.text }}
    >
      {def.name}
    </span>
  );
}

// Picker + manager, rendered inside the card detail panel. The per-card toggle is
// the primary flow; "Manage" exposes rename/recolor/delete on the registry.
export function CardLabelPicker({ doc, cardId }: { doc: Y.Doc; cardId: string }) {
  const [, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);
  // BoardView's observer also re-renders on label/membership change; this local
  // tick is for the picker's own immediate feedback (it reads the doc directly).

  const labels = getLabelsSorted(getLabelsMap(doc));
  const active = new Set(getCardLabelIds(doc, cardId));

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[1].key);
  const [managing, setManaging] = useState(false);

  const toggle = (labelId: string) => {
    if (active.has(labelId)) removeCardLabel(doc, cardId, labelId);
    else addCardLabel(doc, cardId, labelId);
    bump();
  };

  const commitCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const id = createLabel(doc, name, newColor);
    addCardLabel(doc, cardId, id); // apply the just-created label to this card
    setNewName("");
    setCreating(false);
    bump();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {labels.length === 0 && (
          <span className="text-xs text-neutral-500">
            No labels yet — create one below.
          </span>
        )}
        {labels.map(({ id, def }) => {
          const p = paletteEntry(def.color);
          const on = active.has(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`text-[11px] px-2 py-0.5 rounded leading-none t-base ${
                on ? "" : "opacity-45 hover:opacity-80"
              }`}
              style={{
                backgroundColor: p.bg,
                color: p.text,
                outline: on ? `1px solid ${p.dot}` : "none",
              }}
              title={on ? "Click to remove" : "Click to add"}
            >
              {def.name}
            </button>
          );
        })}
      </div>

      {creating ? (
        <div className="space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitCreate();
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="Label name…"
            className="w-full bg-[var(--surface-card)] rounded px-2 py-1.5 text-sm outline-none ring-1 ring-indigo-500 text-neutral-100"
          />
          <div className="flex gap-1.5">
            {PALETTE.map((p) => (
              <button
                key={p.key}
                onClick={() => setNewColor(p.key)}
                className="w-5 h-5 rounded-full t-base"
                style={{
                  backgroundColor: p.dot,
                  outline: newColor === p.key ? "2px solid white" : "none",
                  outlineOffset: "1px",
                }}
                aria-label={p.name}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={commitCreate}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium text-white t-base"
            >
              Create
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setNewName("");
              }}
              className="px-2.5 py-1 text-neutral-400 hover:text-neutral-100 text-xs t-base"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreating(true)}
            className="text-xs text-neutral-400 hover:text-neutral-100 t-base"
          >
            + New label
          </button>
          {labels.length > 0 && (
            <button
              onClick={() => setManaging((m) => !m)}
              className="text-xs text-neutral-400 hover:text-neutral-100 t-base"
            >
              {managing ? "Done" : "Manage"}
            </button>
          )}
        </div>
      )}

      {managing && !creating && (
        <div className="mt-3 space-y-2 border-t border-[var(--hairline)] pt-3">
          {labels.map(({ id, def }) => (
            <LabelManageRow
              key={id}
              labelId={id}
              def={def}
              onChange={() => {
                bump();
              }}
              doc={doc}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// A single editable row in the manage view: rename inline, recolor via swatches,
// delete the label from the registry.
function LabelManageRow({
  doc,
  labelId,
  def,
  onChange,
}: {
  doc: Y.Doc;
  labelId: string;
  def: LabelDef;
  onChange: () => void;
}) {
  const [name, setName] = useState(def.name);

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const next = name.trim();
          if (next && next !== def.name) {
            renameLabel(doc, labelId, next);
            onChange();
          } else {
            setName(def.name);
          }
        }}
        className="flex-1 min-w-0 bg-[var(--surface-card)] rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-100"
      />
      <div className="flex gap-1">
        {PALETTE.map((p) => (
          <button
            key={p.key}
            onClick={() => {
              recolorLabel(doc, labelId, p.key);
              onChange();
            }}
            className="w-3.5 h-3.5 rounded-full t-base"
            style={{
              backgroundColor: p.dot,
              outline: def.color === p.key ? "1.5px solid white" : "none",
              outlineOffset: "1px",
            }}
            aria-label={p.name}
          />
        ))}
      </div>
      <button
        onClick={() => {
          deleteLabel(doc, labelId);
          onChange();
        }}
        className="text-neutral-500 hover:text-red-400 text-sm leading-none"
        aria-label={`Delete label ${def.name}`}
        title="Delete label"
      >
        ×
      </button>
    </div>
  );
}

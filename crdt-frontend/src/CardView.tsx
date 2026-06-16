import * as Y from "yjs";
import { InlineEdit } from "./InlineEdit";
import {
  deleteCard,
  getCardLabelIds,
  getLabelsMap,
  renameCard,
  type Card,
  type LabelDef,
} from "./board-model";
import { LabelPill } from "./labels-ui";
import { colorForUser, initialFor } from "./avatar";

export function CardView({
  doc,
  card,
  onOpenDetail,
  assigneeName,
}: {
  doc: Y.Doc;
  card: Card;
  onOpenDetail?: (cardId: string) => void;
  assigneeName?: string; // resolved by parent for the avatar tooltip
}) {
  const isOverdue =
    card.dueDate && new Date(card.dueDate) < new Date(new Date().toDateString());

  // Resolve this card's label ids to defs. .filter(Boolean) drops dangling ids
  // (label deleted while the card still references it) → renders nothing, no crash.
  const labelsMap = getLabelsMap(doc);
  const defs = getCardLabelIds(doc, card.id)
    .map((id) => labelsMap.get(id))
    .filter(Boolean) as LabelDef[];

  return (
    <div className="group bg-neutral-800 hover:bg-neutral-700/70 border border-neutral-700/60 hover:border-neutral-600 rounded-lg p-3 elev-card hover:elev-card-hover hover:-translate-y-px t-base">
      {defs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {defs.map((def, i) => (
            <LabelPill key={i} def={def} />
          ))}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <InlineEdit
          value={card.title}
          onCommit={(t) => renameCard(doc, card.id, t)}
          className="text-sm text-neutral-100 flex-1 leading-snug"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onOpenDetail && (
            <button
              onClick={() => onOpenDetail(card.id)}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-neutral-500 hover:text-neutral-200 text-sm leading-none"
              aria-label="Open card details"
              title="Open details"
            >
              ⋯
            </button>
          )}
          <button
            onClick={() => {
              if (window.confirm(`Delete "${card.title}"?`)) deleteCard(doc, card.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-neutral-500 hover:text-neutral-200 text-lg leading-none"
            aria-label="Delete card"
          >
            ×
          </button>
        </div>
      </div>

      {/* Badges row — only render if there's something to show */}
      {(card.dueDate || card.assigneeId) && (
        <div className="flex items-center gap-2 mt-2.5">
          {card.dueDate && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                isOverdue
                  ? "bg-red-950/60 text-red-300"
                  : "bg-neutral-700/60 text-neutral-300"
              }`}
            >
              {formatShortDate(card.dueDate)}
            </span>
          )}
          {card.assigneeId && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white ml-auto"
              style={{ backgroundColor: colorForUser(card.assigneeId) }}
              title={assigneeName ?? card.assigneeId}
            >
              {initialFor(assigneeName ?? card.assigneeId)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

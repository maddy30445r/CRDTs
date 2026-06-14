import { useEffect, useState, type ReactNode } from "react";
import * as Y from "yjs";
import {
  setCardAssignee,
  setCardDescription,
  setCardDueDate,
  deleteCard,
  getCardsMap,
  type Card,
} from "./board-model";
import { fetchMembers, type Member } from "./api";
import { colorForUser, initialFor } from "./avatar";

export function CardDetailPanel({
  doc,
  cardId,
  token,
  boardId,
  onClose,
}: {
  doc: Y.Doc;
  cardId: string;
  token: string;
  boardId: string;
  onClose: () => void;
}) {
  // Subscribe to the cards map so the panel reflects remote edits live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const cards = getCardsMap(doc);
    const onChange = () => setTick((t) => t + 1);
    cards.observe(onChange);
    return () => cards.unobserve(onChange);
  }, [doc]);

  const card: Card | undefined = getCardsMap(doc).get(cardId);

  // Local draft for the description (commit on blur), kept in sync when not focused.
  const [descDraft, setDescDraft] = useState(card?.description ?? "");
  const [descFocused, setDescFocused] = useState(false);
  useEffect(() => {
    if (!descFocused) setDescDraft(card?.description ?? "");
  }, [card?.description, descFocused]);

  // Members for the assignee dropdown.
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchMembers(token, boardId)
      .then(({ members }) => {
        if (!cancelled) setMembers(members);
      })
      .catch(() => {
        /* non-fatal: dropdown just won't populate */
      });
    return () => {
      cancelled = true;
    };
  }, [token, boardId]);

  // Card might be deleted remotely while the panel is open.
  if (!card) {
    return (
      <Overlay onClose={onClose}>
        <div className="text-sm text-neutral-400">
          This card was deleted by someone else.
        </div>
        <button
          onClick={onClose}
          className="mt-3 text-sm text-neutral-400 hover:text-neutral-100"
        >
          Close
        </button>
      </Overlay>
    );
  }

  const assignee = members.find((m) => m.user_id === card.assigneeId);
  const isOverdue =
    card.dueDate && new Date(card.dueDate) < new Date(new Date().toDateString());
  const createdByName =
    members.find((m) => m.user_id === card.createdBy)?.name ?? card.createdBy;

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-base font-semibold text-neutral-100 pr-4">
          {card.title}
        </h3>
        <button
          onClick={onClose}
          className="text-neutral-500 hover:text-neutral-200 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Description */}
      <label className="block text-xs text-neutral-500 mb-1">Description</label>
      <textarea
        value={descDraft}
        onChange={(e) => setDescDraft(e.target.value)}
        onFocus={() => setDescFocused(true)}
        onBlur={() => {
          setDescFocused(false);
          if (descDraft !== (card.description ?? "")) {
            setCardDescription(doc, cardId, descDraft);
          }
        }}
        placeholder="Add a description…"
        rows={5}
        className="w-full bg-neutral-800 rounded px-2.5 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-100 resize-y mb-4"
      />

      {/* Due date */}
      <label className="block text-xs text-neutral-500 mb-1">Due date</label>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={card.dueDate ?? ""}
          onChange={(e) => setCardDueDate(doc, cardId, e.target.value || undefined)}
          className="bg-neutral-800 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-100"
        />
        {card.dueDate && (
          <button
            onClick={() => setCardDueDate(doc, cardId, undefined)}
            className="text-xs text-neutral-500 hover:text-neutral-200"
          >
            clear
          </button>
        )}
        {isOverdue && <span className="text-xs text-red-400">overdue</span>}
      </div>

      {/* Assignee */}
      <label className="block text-xs text-neutral-500 mb-1">Assignee</label>
      <select
        value={card.assigneeId ?? ""}
        onChange={(e) => setCardAssignee(doc, cardId, e.target.value || undefined)}
        className="w-full bg-neutral-800 rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 text-neutral-100 mb-4"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.name}
          </option>
        ))}
      </select>
      {assignee && (
        <div className="flex items-center gap-2 mb-4 -mt-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
            style={{ backgroundColor: colorForUser(assignee.user_id) }}
          >
            {initialFor(assignee.name)}
          </div>
          <span className="text-sm text-neutral-300">{assignee.name}</span>
        </div>
      )}

      {/* Meta */}
      <div className="pt-3 mt-2 border-t border-neutral-800 text-xs text-neutral-500">
        Created by {createdByName} · {new Date(card.createdAt).toLocaleString()}
      </div>

      {/* Danger */}
      <div className="pt-4">
        <button
          onClick={() => {
            if (window.confirm(`Delete "${card.title}"?`)) {
              deleteCard(doc, cardId);
              onClose();
            }
          }}
          className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
        >
          Delete card
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 animate-fade-in" />
      <div
        className="relative w-96 max-w-full h-full bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto animate-slide-in elev-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

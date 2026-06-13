import * as Y from "yjs";
import { InlineEdit } from "./InlineEdit";
import { deleteCard, renameCard, type Card } from "./board-model";

export function CardView({ doc, card }: { doc: Y.Doc; card: Card }) {
  return (
    <div className="group bg-neutral-800 hover:bg-neutral-700/70 border border-neutral-700 rounded-md p-2.5 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <InlineEdit
          value={card.title}
          onCommit={(newTitle) => renameCard(doc, card.id, newTitle)}
          className="text-sm text-neutral-100 flex-1"
          placeholder="Untitled"
        />
        <button
          onClick={() => {
            if (window.confirm(`Delete "${card.title}"?`)) {
              deleteCard(doc, card.id);
            }
          }}
          className="opacity-0 group-hover:opacity-100 text-neutral-500 hover:text-neutral-200 transition-opacity text-lg leading-none"
          aria-label="Delete card"
        >
          ×
        </button>
      </div>
    </div>
  );
}

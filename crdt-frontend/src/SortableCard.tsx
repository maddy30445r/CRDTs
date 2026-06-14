import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Y from "yjs";
import { CardView } from "./CardView";
import type { Card } from "./board-model";

/**
 * Wraps CardView with @dnd-kit's useSortable so a card can be dragged.
 * The whole card is the drag handle; the 5px pointer activation constraint
 * (set on the sensor in BoardView) keeps click-to-edit on the title working.
 */
export function SortableCard({ doc, card }: { doc: Y.Doc; card: Card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: "card", card },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The original card dims in place while its floating copy (DragOverlay)
    // follows the cursor. The gap left behind is the drop indicator.
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardView doc={doc} card={card} />
    </div>
  );
}

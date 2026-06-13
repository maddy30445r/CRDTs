import { useEffect, useRef, useState } from "react";

/**
 * Click-to-edit text. Click → <input> (text selected). Enter/blur commits,
 * Escape cancels. Used for column + card titles.
 */
export function InlineEdit({
  value,
  onCommit,
  className = "",
  placeholder = "",
}: {
  value: string;
  onCommit: (newValue: string) => void;
  className?: string;
  placeholder?: string;
}) {
  // editing: are we showing the <input> or the <span>?
  // draft: the in-progress text while editing (local, NOT the committed value).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // EFFECT 1 — keep draft in sync with the external `value`, but ONLY while we
  // are NOT editing. WHY: a remote peer can rename this card while we're idle;
  // we want to show their new value. But if WE are mid-edit, overwriting draft
  // from `value` would yank the text out from under us on every keystroke they
  // make. So: sync only when !editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // EFFECT 2 — when we ENTER edit mode, focus the input and select all its text
  // (so typing replaces it). Guard on inputRef.current existing.
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // commit: trim the draft. Only call onCommit if it's non-empty AND actually
  // changed; otherwise revert draft to value (discard empty/no-op edits).
  // Either way, leave edit mode.
  const commit = () => {
    const finalDraft = draft.trim();
    if (finalDraft && finalDraft !== value) {
      onCommit(finalDraft);
    } else {
      setDraft(value); // revert empty / unchanged edits
    }
    setEditing(false);
  };

  // cancel: throw away the draft (reset to value), leave edit mode.
  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        className={`bg-neutral-800 outline-none ring-1 ring-indigo-500 rounded px-1.5 py-0.5 ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text rounded px-1.5 py-0.5 hover:bg-neutral-800/50 ${className}`}
    >
      {value || <span className="text-neutral-500">{placeholder}</span>}
    </span>
  );
}

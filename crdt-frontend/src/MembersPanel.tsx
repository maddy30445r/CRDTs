import { useEffect, useState } from "react";
import {
  fetchMembers,
  addMember,
  removeMember,
  ApiError,
  type Member,
} from "./api";

export function MembersPanel({
  token,
  boardId,
  currentUserId,
  onClose,
}: {
  token: string;
  boardId: string;
  currentUserId: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [addName, setAddName] = useState("");
  const [busy, setBusy] = useState(false);

  // load: fetch members + ownerId, set both. Called on mount AND after every
  // add/remove to re-sync from the authoritative server list.
  const load = () => {
    fetchMembers(token, boardId)
      .then(({ members, ownerId }) => {
        setMembers(members);
        setOwnerId(ownerId);
      })
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "failed to load"),
      );
  };

  // Run load once on mount (and if token/board change). Passing `load` directly
  // works because it closes over the current token/boardId.
  useEffect(load, [token, boardId]);

  // Owner-gating: only the board owner sees add/remove controls.
  const isOwner = ownerId === currentUserId;

  const handleAdd = async () => {
    const username = addName.trim();
    if (!username) return;
    setError("");
    setBusy(true);
    try {
      await addMember(token, boardId, username);
      setAddName("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "add failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setError("");
    setBusy(true);
    try {
      await removeMember(token, boardId, userId);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    // Full-screen layer. Clicking the backdrop closes; clicking the panel does
    // NOT (stopPropagation), so interacting inside the panel won't dismiss it.
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative w-80 h-full bg-neutral-900 border-l border-neutral-800 p-4 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-100">Members</h3>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        {error && <div className="text-xs text-red-400 mb-3">{error}</div>}

        {members === null ? (
          <div className="text-xs text-neutral-500">Loading…</div>
        ) : (
          <ul className="space-y-1.5 mb-4">
            {members.map((m) => (
              <li
                key={m.user_id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-neutral-200">
                  {m.name}
                  {m.user_id === ownerId && (
                    <span className="ml-1.5 text-xs text-neutral-500">
                      (owner)
                    </span>
                  )}
                </span>
                {/* remove: owner only, and never the owner row itself */}
                {isOwner && m.user_id !== ownerId && (
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    disabled={busy}
                    className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* add form: owner only */}
        {isOwner && (
          <div className="pt-3 border-t border-neutral-800">
            <label className="text-xs text-neutral-500">
              Add member by username
            </label>
            <div className="flex gap-2 mt-1.5">
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="username"
                className="flex-1 bg-neutral-800 rounded px-2 py-1.5 text-sm outline-none ring-1 ring-indigo-500 text-neutral-100"
              />
              <button
                onClick={handleAdd}
                disabled={busy || !addName.trim()}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 rounded text-xs font-medium text-white transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

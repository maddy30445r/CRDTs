import { useEffect, useState } from "react";
import { fetchBoards, createBoard, ApiError, type Board } from "./api";

export function BoardPicker({
  token,
  onPick,
  onLogout,
  initialError,
}: {
  token: string;
  onPick: (boardId: string, boardName: string) => void;
  onLogout: () => void;
  initialError?: string;
}) {
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState<string>(initialError || "");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchBoards(token)
      .then((bs) => {
        if (!cancelled) setBoards(bs);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          // Token expired between login and now. Drop user back to login.
          localStorage.removeItem("token");
          window.location.reload();
          return;
        }
        setError(`failed to load boards: ${e.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreateError("");
    try {
      const board = await createBoard(token, name);
      onPick(board.id, board.name); // jump straight into the new (empty) board
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : "create failed");
    }
  };

  return (
    <div className="min-h-screen text-neutral-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your boards</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Pick a board or start a new one
            </p>
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-neutral-400 hover:text-neutral-100 rounded-md px-2 py-1 hover:bg-neutral-800/60 t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            Log out
          </button>
        </div>

        <div className="mb-4">
          {creating ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-2">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                    setCreateError("");
                  }
                }}
                placeholder="Board name…"
                className="w-full bg-neutral-800 rounded px-2 py-1.5 text-sm outline-none ring-1 ring-indigo-500 text-neutral-100"
              />
              {createError && (
                <div className="text-xs text-red-400">{createError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-md text-xs font-medium text-white t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setCreateError("");
                  }}
                  className="px-2.5 py-1 text-neutral-400 hover:text-neutral-100 text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] rounded-md text-sm font-medium text-white t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              + New board
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-900 text-red-200 text-sm rounded p-3 mb-4">
            {error}
          </div>
        )}

        {boards === null && !error && (
          <div className="text-neutral-500 text-sm">Loading…</div>
        )}

        {boards !== null && boards.length === 0 && (
          <div className="text-center py-16 border border-dashed border-neutral-800 rounded-xl">
            <div className="text-neutral-300 text-sm font-medium">
              No boards yet
            </div>
            <div className="text-neutral-500 text-xs mt-1">
              Create one with “+ New board” to get started.
            </div>
          </div>
        )}

        {boards !== null && boards.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {boards.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => onPick(b.id, b.name)}
                  className="group w-full text-left p-4 bg-neutral-900/70 hover:bg-neutral-800/80 border border-neutral-800 hover:border-neutral-700 rounded-xl elev-card hover:elev-card-hover hover:-translate-y-px t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-sm font-semibold text-indigo-300 flex-shrink-0">
                      {b.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-100 truncate">
                        {b.name}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 font-mono truncate">
                        {b.id}
                      </div>
                    </div>
                    <span className="ml-auto text-neutral-600 group-hover:text-neutral-300 t-base">
                      →
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

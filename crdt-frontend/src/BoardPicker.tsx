import { useEffect, useState } from "react";

const BOARDS_URL = "http://localhost:1235/boards";

type Board = { id: string; name: string };

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

  useEffect(() => {
    let cancelled = false;
    fetch(BOARDS_URL, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            // Token expired between login and now. Drop user back to login.
            localStorage.removeItem("token");
            window.location.reload();
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setBoards(data.boards);
      })
      .catch((e) => {
        if (!cancelled) setError(`failed to load boards: ${e.message}`);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your boards</h2>
          <button
            onClick={onLogout}
            className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            Log out
          </button>
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
          <div className="text-neutral-500 text-sm">
            You're not a member of any boards yet. Ask an admin to add you.
          </div>
        )}

        {boards !== null && boards.length > 0 && (
          <ul className="space-y-2">
            {boards.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => onPick(b.id, b.name)}
                  className="w-full text-left p-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded transition-colors"
                >
                  <div className="font-medium text-neutral-100">{b.name}</div>
                  <div className="text-xs text-neutral-500 mt-1 font-mono">
                    {b.id}
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

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
    <div style={{ maxWidth: 480, margin: "60px auto", fontFamily: "system-ui" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Your boards</h2>
        <button onClick={onLogout}>Log out</button>
      </div>

      {error && (
        <div
          style={{
            background: "#fff3cd",
            padding: 12,
            borderRadius: 4,
            margin: "12px 0",
          }}
        >
          {error}
        </div>
      )}

      {boards === null && !error && <div>Loading…</div>}

      {boards !== null && boards.length === 0 && (
        <div style={{ color: "#666", marginTop: 16 }}>
          You're not a member of any boards yet. Ask an admin to add you (or seed
          yourself in psql for now).
        </div>
      )}

      {boards !== null && boards.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 16 }}>
          {boards.map((b) => (
            <li key={b.id} style={{ marginBottom: 8 }}>
              <button
                onClick={() => onPick(b.id, b.name)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  background: "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  {b.id}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { Login } from "./Login";
import { KanbanBoard } from "./KanbanBoard";
import { BoardPicker } from "./BoardPicker";

export default function App() {
  // Token is the single source of truth for "logged in?". Lazy-init from
  // localStorage so a refresh keeps you signed in without a re-login.
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [boardId, setBoardId] = useState<string | null>(() =>
    localStorage.getItem("boardId"),
  );
  const [boardName, setBoardName] = useState<string | null>(() =>
    localStorage.getItem("boardName"),
  );

  const [pickerError, setPickerError] = useState<string>("");

  const handleLogin = (t: string) => {
    localStorage.setItem("token", t);
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("boardId");
    localStorage.removeItem("boardName");
    setToken(null);
    setBoardId(null);
    setBoardName(null);
    setPickerError("");
  };

  const handlePickBoard = (id: string, name: string) => {
    localStorage.setItem("boardId", id);
    localStorage.setItem("boardName", name);
    setBoardId(id);
    setBoardName(name);
    setPickerError("");
  };

  const handleLeaveBoard = () => {
    localStorage.removeItem("boardId");
    localStorage.removeItem("boardName");
    setBoardId(null);
    setBoardName(null);
    setPickerError("");
  };

  // 4003: authenticated but not a member of THIS board. Back to picker with an
  // explanation — but KEEP the token, the user is still logged in.
  const handleNotMember = () => {
    localStorage.removeItem("boardId");
    localStorage.removeItem("boardName");
    setBoardId(null);
    setBoardName(null);
    setPickerError(
      "You don't have access to that board. It may have been removed or your membership revoked.",
    );
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }
  if (!boardId) {
    return (
      <BoardPicker
        token={token}
        onPick={handlePickBoard}
        onLogout={handleLogout}
        initialError={pickerError}
      />
    );
  }

  return (
    <KanbanBoard
      token={token}
      boardId={boardId}
      boardName={boardName}
      onLogout={handleLogout}
      onLeaveBoard={handleLeaveBoard}
      onNotMember={handleNotMember}
    />
  );
}

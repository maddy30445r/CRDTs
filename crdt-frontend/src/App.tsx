import { useState } from "react";
import { Login } from "./Login";
import { KanbanBoard } from "./KanbanBoard";

export default function App() {
  // Token is the single source of truth for "logged in?". Lazy-init from
  // localStorage so a refresh keeps you signed in without a re-login.
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  return (
    <KanbanBoard
      token={token}
      onLogout={() => {
        localStorage.removeItem("token");
        setToken(null);
      }}
    />
  );
}

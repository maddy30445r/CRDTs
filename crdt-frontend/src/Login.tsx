import { useState } from "react";

const LOGIN_URL = "http://localhost:1235/login";

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(LOGIN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `login failed (${res.status})`);
        return;
      }
      const { token } = await res.json();
      onLogin(token);
    } catch {
      setError("network error — is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 320, margin: "100px auto", fontFamily: "system-ui" }}>
      <h2>Log in</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
          autoFocus
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <button onClick={handleSubmit} disabled={loading || !username || !password}>
          {loading ? "..." : "Log in"}
        </button>
        {error && <div style={{ color: "crimson" }}>{error}</div>}
        <div style={{ color: "#888", fontSize: 12, marginTop: 12 }}>
          Dev users: maddy / shivam / alice / bob — password is <code>dev</code>
        </div>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-sm p-6">
        <h2 className="text-xl font-semibold mb-6">Log in</h2>
        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoFocus
            autoComplete="username"
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-neutral-100"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-neutral-100"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !username || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 rounded px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            {loading ? "…" : "Log in"}
          </button>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="text-xs text-neutral-500 pt-4 border-t border-neutral-800">
            Dev users: maddy / shivam / alice / bob — password is <code>dev</code>
          </div>
        </div>
      </div>
    </div>
  );
}

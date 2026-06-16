import { useState } from "react";
import { API_URL } from "./env";

const LOGIN_URL = `${API_URL}/login`;

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
    <div className="min-h-screen flex items-center justify-center px-6 text-neutral-100">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-indigo-600/20 mb-4">
            K
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Sign in to your boards
          </p>
        </div>

        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 elev-card space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            autoFocus
            autoComplete="username"
            className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-neutral-100 t-base"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full bg-neutral-800/60 border border-neutral-700/60 rounded-md px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-neutral-100 t-base"
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !username || !password}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:bg-neutral-800 disabled:text-neutral-500 disabled:active:scale-100 rounded-md px-3 py-2 text-sm font-medium text-white t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            {loading ? "Signing in…" : "Log in"}
          </button>
          {error && <div className="text-sm text-red-400">{error}</div>}
        </div>

        <div className="text-xs text-neutral-600 mt-5 text-center">
          Dev users: maddy · shivam · alice · bob — password{" "}
          <code className="text-neutral-400">dev</code>
        </div>
      </div>
    </div>
  );
}

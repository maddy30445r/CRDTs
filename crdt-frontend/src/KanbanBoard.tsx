import { useEffect, useState } from "react";
import { createYjsClient, decodeJwtPayload, type YjsClient } from "./yjs";

const ROOM_NAME = "maddy-demo"; // hardcoded for now — boards-by-URL comes in Day 5

export function KanbanBoard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [client, setClient] = useState<YjsClient | null>(null);
  const [text, setText] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<
    { id: string; name: string; color: string }[]
  >([]);

  // Construct the Yjs client once after mount; tear down on unmount.
  // StrictMode-safe: in dev React mounts → unmounts → remounts, so the cleanup
  // destroys the first client and the effect re-runs with a fresh one. Building
  // inside the effect (not at module scope) is what makes that teardown work.
  useEffect(() => {
    const c = createYjsClient(ROOM_NAME, token);
    setClient(c);

    // Awareness identity from the JWT claims, so other connected users see who
    // we are (name + color) via wsProvider.awareness.getStates().
    const identity = decodeJwtPayload(token);
    if (identity) {
      c.wsProvider.awareness.setLocalStateField("user", {
        id: identity.sub,
        name: identity.name,
        color: identity.color,
      });
    }

    // If the WS upgrade is rejected (most commonly an expired/invalid token),
    // the browser surfaces only a generic error event — no HTTP status. Pragmatic
    // fallback: assume the token is bad, clear it, and reload to the login screen.
    const handleConnectionError = () => {
      localStorage.removeItem("token");
      window.location.reload();
    };
    c.wsProvider.on("connection-error", handleConnectionError);

    return () => {
      c.wsProvider.off("connection-error", handleConnectionError);
      c.destroy();
      setClient(null);
    };
  }, [token]);

  // Textarea binding — bidirectional. Preserved from the original App.tsx:
  // controlled component + minimal-span diff so concurrent edits MERGE instead
  // of one side clobbering the whole doc on every keystroke.
  useEffect(() => {
    if (!client) return;
    const { yText } = client;

    // Seed from whatever is already in the doc. observe() only fires on FUTURE
    // changes, so content that loaded fast from IndexedDB before this effect ran
    // would otherwise be missed and the textarea would stay empty.
    setText(yText.toString());

    const onChange = () => setText(yText.toString());
    yText.observe(onChange);

    return () => {
      yText.unobserve(onChange);
    };
  }, [client]);

  // Online presence via awareness. Every client publishes its `user` field
  // (set above from the JWT); awareness.getStates() is the union of everyone's.
  // We recompute on each 'change' event (join / leave / identity update).
  useEffect(() => {
    if (!client) return;
    const { awareness } = client.wsProvider;
    const selfId = decodeJwtPayload(token)?.sub;

    const updateUsers = () => {
      // Dedupe by user id (a person with two tabs is two clientIDs but one
      // user) and drop ourselves so the list reads "who ELSE is online".
      const byId = new Map<string, { id: string; name: string; color: string }>();
      awareness.getStates().forEach((state: any) => {
        const u = state.user;
        if (u && u.id && u.id !== selfId) byId.set(u.id, u);
      });
      setOnlineUsers([...byId.values()]);
    };

    updateUsers();
    awareness.on("change", updateUsers);
    return () => awareness.off("change", updateUsers);
  }, [client, token]);

  if (!client) return <div style={{ margin: "100px auto", textAlign: "center" }}>Connecting…</div>;

  const { doc, yText, wsProvider } = client;
  const identity = decodeJwtPayload(token);

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "system-ui" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Kanban Demo — {identity?.name}</h2>
        <button onClick={onLogout}>Log out</button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <textarea
        style={{ flex: 1, height: 300, fontFamily: "monospace" }}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          const prev = yText.toString();

          // Edit only the span that actually changed (common prefix + common
          // suffix) instead of replacing the whole text. Prevents wiping the doc
          // and lets concurrent edits merge instead of clobbering.
          let start = 0;
          while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
          let endPrev = prev.length, endNext = next.length;
          while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
            endPrev--;
            endNext--;
          }

          doc.transact(() => {
            if (endPrev > start) yText.delete(start, endPrev - start);
            if (endNext > start) yText.insert(start, next.slice(start, endNext));
          });
        }}
      />

        <aside style={{ width: 200, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Online{onlineUsers.length > 0 ? ` (${onlineUsers.length})` : ""}
          </div>
          {onlineUsers.length === 0 ? (
            <div style={{ color: "#888", fontSize: 13 }}>No one else here</div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {onlineUsers.map((u) => (
                <li
                  key={u.id}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: u.color,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  {u.name}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button onClick={() => wsProvider.disconnect()}>Offline</button>
        <button onClick={() => wsProvider.connect()}>Online</button>
      </div>
    </div>
  );
}

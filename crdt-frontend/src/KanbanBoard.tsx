import { useEffect, useState } from "react";
import { createYjsClient, decodeJwtPayload, type YjsClient } from "./yjs";
import { DebugBoard } from "./DebugBoard";
import { type Identity } from "./board-model";

export function KanbanBoard({
  token,
  boardId,
  boardName,
  onLogout,
  onLeaveBoard,
  onNotMember,
}: {
  token: string;
  boardId: string;
  boardName?: string | null;
  onLogout: () => void;
  onLeaveBoard: () => void;
  onNotMember: () => void;
}) {
  const [client, setClient] = useState<YjsClient | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<
    { id: string; name: string; color: string }[]
  >([]);

  // Construct the Yjs client once after mount; tear down on unmount.
  // StrictMode-safe: in dev React mounts → unmounts → remounts, so the cleanup
  // destroys the first client and the effect re-runs with a fresh one. Building
  // inside the effect (not at module scope) is what makes that teardown work.
  useEffect(() => {
    const c = createYjsClient(boardId, token);
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
    const handleConnectionClose = (event: CloseEvent | null) => {
      // A manual wsProvider.disconnect() (the Offline button) fires this with a
      // null event — there's no real CloseEvent for a deliberate local close.
      if (event?.code === 4003) {
        onNotMember();
      }
    };
    c.wsProvider.on("connection-close", handleConnectionClose);
    c.wsProvider.on("connection-error", handleConnectionError);

    return () => {
      c.wsProvider.off("connection-close", handleConnectionClose);
      c.wsProvider.off("connection-error", handleConnectionError);
      c.destroy();
      setClient(null);
    };
  }, [token, boardId]);

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
      const byId = new Map<
        string,
        { id: string; name: string; color: string }
      >();
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

  if (!client)
    return (
      <div style={{ margin: "100px auto", textAlign: "center" }}>
        Connecting…
      </div>
    );

  const { doc, wsProvider } = client;
  const identity = decodeJwtPayload(token);
  const userIdentity: Identity = identity
    ? { id: identity.sub, name: identity.name }
    : { id: "anonymous", name: "Anonymous" };

  return (
    <div
      style={{ maxWidth: 1200, margin: "40px auto", fontFamily: "system-ui" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <button onClick={onLeaveBoard} style={{ marginRight: 12 }}>
            ← Boards
          </button>
          <span style={{ fontSize: 14, color: "#666" }}>
            Board: <strong>{boardName ?? boardId}</strong> · You: {identity?.name}
          </span>
        </div>
        <button onClick={onLogout}>Log out</button>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DebugBoard doc={doc} identity={userIdentity} />
        </div>

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

import { useEffect, useState } from "react";
import { createYjsClient, decodeJwtPayload, type YjsClient } from "./yjs";
import { DebugBoard } from "./DebugBoard";
import { Header } from "./Header";
import { BoardView } from "./BoardView";
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

  if (!client)
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-400">
        Connecting…
      </div>
    );

  const identity = decodeJwtPayload(token);
  const userIdentity: Identity = identity
    ? { id: identity.sub, name: identity.name, color: identity.color }
    : { id: "anonymous", name: "Anonymous", color: "#888888" };

  // ?debug=1 keeps the K1 DebugBoard reachable — our only card-move/rebalance
  // test surface until K4 adds drag-and-drop.
  const debugMode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("debug");

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100">
      <Header
        boardId={boardName ?? boardId}
        identity={userIdentity}
        wsProvider={client.wsProvider}
        onLeaveBoard={onLeaveBoard}
        onLogout={onLogout}
      />
      {debugMode ? (
        <DebugBoard doc={client.doc} identity={userIdentity} />
      ) : (
        <BoardView client={client} identity={userIdentity} />
      )}
    </div>
  );
}

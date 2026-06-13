import type { WebsocketProvider } from "y-websocket";
import { AwarenessAvatars } from "./AwarenessAvatars";
import type { Identity } from "./board-model";

export function Header({
  boardId,
  identity,
  wsProvider,
  onLeaveBoard,
  onLogout,
}: {
  boardId: string;
  identity: Identity;
  wsProvider: WebsocketProvider;
  onLeaveBoard: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="flex-shrink-0 border-b border-neutral-800 bg-neutral-950">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onLeaveBoard}
            className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
          >
            ← Boards
          </button>
          <div className="h-4 w-px bg-neutral-800" />
          <span className="text-sm font-medium text-neutral-100">{boardId}</span>
        </div>
        <div className="flex items-center gap-4">
          <AwarenessAvatars wsProvider={wsProvider} currentUserId={identity.id} />
          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2">
            <div
              title={identity.name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border border-neutral-700 text-neutral-100"
              style={{ backgroundColor: identity.color }}
            >
              {identity.name[0]?.toUpperCase()}
            </div>
            <button
              onClick={onLogout}
              className="text-sm text-neutral-400 hover:text-neutral-100 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

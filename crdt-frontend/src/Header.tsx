import { useState } from "react";
import type { WebsocketProvider } from "y-websocket";
import { AwarenessAvatars } from "./AwarenessAvatars";
import { MembersPanel } from "./MembersPanel";
import type { Identity } from "./board-model";

export function Header({
  boardId,
  boardName,
  identity,
  wsProvider,
  token,
  onLeaveBoard,
  onLogout,
}: {
  boardId: string; // the real id — used for the members API
  boardName?: string | null; // display label
  identity: Identity;
  wsProvider: WebsocketProvider;
  token: string;
  onLeaveBoard: () => void;
  onLogout: () => void;
}) {
  const [showMembers, setShowMembers] = useState(false);

  const label = boardName ?? boardId;

  return (
    <>
      <header className="flex-shrink-0 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur-md">
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onLeaveBoard}
            className="text-sm text-neutral-400 hover:text-neutral-100 rounded-md px-1.5 py-1 hover:bg-neutral-800/60 t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            ← Boards
          </button>
          <div className="h-4 w-px bg-neutral-800" />
          {/* board glyph — first letter, indigo-tinted, for quick recognition */}
          <div className="w-6 h-6 rounded-md bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-[11px] font-semibold text-indigo-300 flex-shrink-0">
            {label?.[0]?.toUpperCase() ?? "?"}
          </div>
          <span className="text-sm font-semibold text-neutral-100 truncate max-w-[40vw]">
            {label}
          </span>
          <button
            onClick={() => setShowMembers(true)}
            className="ml-1 text-xs text-neutral-400 hover:text-neutral-100 bg-neutral-800/60 hover:bg-neutral-800 rounded-full px-2.5 py-1 t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            Members
          </button>
        </div>
        <div className="flex items-center gap-4">
          <AwarenessAvatars wsProvider={wsProvider} currentUserId={identity.id} />
          <div className="h-4 w-px bg-neutral-800" />
          <div className="flex items-center gap-2.5">
            <div
              title={identity.name}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-neutral-900 shadow-sm"
              style={{ backgroundColor: identity.color }}
            >
              {identity.name[0]?.toUpperCase()}
            </div>
            <button
              onClick={onLogout}
              className="text-sm text-neutral-400 hover:text-neutral-100 rounded-md px-1.5 py-1 hover:bg-neutral-800/60 t-base focus-visible:ring-1 focus-visible:ring-indigo-500 focus-visible:outline-none"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
      </header>

      {/* Rendered OUTSIDE the backdrop-blurred <header>: a backdrop-filter
          ancestor becomes the containing block for position:fixed children,
          which would clip this slide-over to the header bar. */}
      {showMembers && (
        <MembersPanel
          token={token}
          boardId={boardId}
          currentUserId={identity.id}
          onClose={() => setShowMembers(false)}
        />
      )}
    </>
  );
}

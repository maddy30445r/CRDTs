import { useEffect, useState } from "react";
import type { WebsocketProvider } from "y-websocket";

type AwarenessUser = { id: string; name: string; color: string };

/**
 * A stack of overlapping circles, one per OTHER online user (not yourself).
 * Driven by wsProvider.awareness — the same presence data the K1 sidebar used.
 */
export function AwarenessAvatars({
  wsProvider,
  currentUserId,
}: {
  wsProvider: WebsocketProvider;
  currentUserId: string;
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    wsProvider.awareness.on("change", onChange);
    return () => {
      wsProvider.awareness.off("change", onChange);
    };
  }, [wsProvider]);

  // Build the "others" list each render: iterate awareness states, take each
  // state.user, drop our own id. (awareness.getStates() is a Map<clientId, state>.)
  const others: AwarenessUser[] = [];
  wsProvider.awareness.getStates().forEach((state) => {
    const u = (state as any).user;
    if (u && u.id !== currentUserId) {
      others.push(u);
    }
  });

  if (others.length === 0) {
    return <div className="text-xs text-neutral-500">no one else here</div>;
  }

  return (
    <div className="flex -space-x-2">
      {others.map((u) => (
        <div key={u.id} className="group relative">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 border-neutral-950 text-neutral-100"
            style={{ backgroundColor: u.color }}
          >
            {u.name[0]?.toUpperCase()}
          </div>
          {/* CSS-only tooltip: hidden until the avatar (the `group`) is hovered. */}
          <div
            className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap rounded bg-neutral-800 border border-neutral-700 px-2 py-1 text-xs text-neutral-100 opacity-0 group-hover:opacity-100 transition-opacity z-10"
            role="tooltip"
          >
            {u.name}
          </div>
        </div>
      ))}
    </div>
  );
}

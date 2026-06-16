import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { WS_URL } from "./env";

export type YjsClient = {
  doc: Y.Doc;
  wsProvider: WebsocketProvider;
  idb: IndexeddbPersistence;
  destroy: () => void;
};

// Factory instead of module-scope singletons: the provider can't be built at
// import time anymore because it needs a token, and we must be able to tear it
// down and rebuild it (logout / token change). One call === one logical session.
export function createYjsClient(roomName: string, token: string): YjsClient {
  const doc = new Y.Doc();

  // IndexedDB persistence: rehydrates `doc` from the local cache, so content
  // shows on first paint before the server round-trip completes.
  const idb = new IndexeddbPersistence(roomName, doc);

  // WebSocket provider: y-websocket serializes `params` into the WS query
  // string, so the backend sees `?token=<JWT>` and can gate the upgrade.
  const wsProvider = new WebsocketProvider(WS_URL, roomName, doc, {
    params: { token },
  });

  // Dev hooks — poke at live state from the console. Dev builds only.
  if (import.meta.env.DEV) {
    (window as any).doc = doc;
    (window as any).wsProvider = wsProvider;
    (window as any).idb = idb;
  }

  const destroy = () => {
    wsProvider.destroy();
    idb.destroy();
    doc.destroy();
  };

  return { doc, wsProvider, idb, destroy };
}

// Decode a JWT payload client-side for DISPLAY ONLY (no signature check — the
// server already verified it; the client just trusts the claims it gets back).
export function decodeJwtPayload(
  token: string
): { sub: string; name: string; color: string } | null {
  try {
    // JWTs are base64url-encoded (`-`/`_`, no `=` padding). atob expects plain
    // base64, so translate the alphabet and re-pad before decoding.
    const base64url = token.split(".")[1];
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

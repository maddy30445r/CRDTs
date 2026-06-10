import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

const doc = new Y.Doc()
const wsProvider = new WebsocketProvider('ws://localhost:1234', 'maddy-demo', doc)
const yText=doc.getText('shared')
const persistence = new IndexeddbPersistence('maddy-demo', doc)
persistence.once('synced', () => { console.log('initial content loaded') })

// Attach listeners at creation time so we never miss the early
// // 'connecting'/'connected' events (the provider connects immediately on construction).
// wsProvider.on('status', (e) => console.log('[yjs] status:', e.status))
// wsProvider.on('connection-error', (e) => console.log('[yjs] connection-error:', e))
// wsProvider.on('sync', (isSynced) => console.log('[yjs] synced:', isSynced))

export {doc,wsProvider,yText}

if (import.meta.env.DEV) {
  ;(window as any).wsProvider = wsProvider
  ;(window as any).doc = doc
  ;(window as any).yText = yText
}

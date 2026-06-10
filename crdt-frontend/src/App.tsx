import { useEffect, useState } from "react";
import "./App.css";
import { doc, wsProvider, yText } from "./yjs";

function App() {
  useEffect(() => {
    const onStatus = (e: { status: string }) => console.log(e.status);
    wsProvider.on("status", onStatus);

    // The provider connects on import, so the initial "connecting"/"connected"
    // status events may have already fired before this effect ran. Log the
    // current state once; the listener above handles any later changes.
    console.log(wsProvider.wsconnected ? "connected" : "connecting");

    const onChange = (event: any) => {
      console.log(event.changes.delta);
      setText(yText.toString());
    };

    yText.observe(onChange);

    return () => {
      wsProvider.off("status", onStatus);
      yText.unobserve(onChange);
    };
  }, []);

  const [text, setText] = useState("");

  return (
    <>
      <textarea
        value={text}
        onChange={(e) => {
          doc.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, e.target.value);
          });
        }}
      ></textarea>

      <button onClick={() => wsProvider.disconnect()}>Offline</button>
<button onClick={() => wsProvider.connect()}>Online</button>
    </>
  );
}

export default App;

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import browser from "webextension-polyfill";
import type { Message } from "../messages";

async function sendToPage(message: Message) {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return browser.tabs.sendMessage(tab.id!, message);
}

function App() {
  const [title, setTitle] = useState<string | null>(null);

  async function handleHighlight() {
    await sendToPage({ action: "highlight" });
  }

  async function handleGetTitle() {
    const response = await sendToPage({ action: "getTitle" });
    setTitle(response.title);
  }

  return (
    <div>
      <button onClick={handleHighlight}>Highlight page</button>
      <button onClick={handleGetTitle}>Get title</button>
      {title && <p>{title}</p>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

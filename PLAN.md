````markdown
# Browser Extension — Development Plan

## Stack

- **Bundler**: Bun
- **UI**: React + TypeScript
- **Browser API**: `webextension-polyfill` (Chrome + Firefox compatibility)

---

## Project Structure

```text
extension/
├── src/
│   ├── popup/
│   │   ├── index.html
│   │   └── popup.tsx
│   ├── background.ts
│   ├── content.ts
│   └── messages.ts
├── public/
│   └── icon.png
├── manifest.json
├── build.ts
├── package.json
└── tsconfig.json
```

---

## Setup

```bash
mkdir extension && cd extension
bun init -y
bun add react react-dom webextension-polyfill
bun add -d @types/react @types/react-dom @types/webextension-polyfill
```

---

## Files

### `manifest.json`

Single manifest file that works in both Chrome and Firefox (for local use).
Publishing to Firefox Add-ons (AMO) requires adding `browser_specific_settings.gecko.id`.

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "action": {
    "default_popup": "popup/index.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "permissions": ["activeTab", "scripting"]
}
```

---

### `src/messages.ts`

Shared message types between popup and content script.
Ensures type safety across the message passing boundary.

```ts
export type Message =
  | { action: "highlight" }
  | { action: "getTitle" }
  | { action: "replaceText"; from: string; to: string };
```

---

### `src/popup/index.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { width: 300px; min-height: 100px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./popup.tsx"></script>
  </body>
</html>
```

---

### `src/popup/popup.tsx`

The popup UI. Communicates with the content script via `browser.tabs.sendMessage`.

```tsx
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
```

---

### `src/content.ts`

Injected into every page. Listens for messages from the popup and mutates the DOM.

> **Note:** Content scripts only get injected into pages opened **after** the
> extension was loaded. Refresh the tab if the content script isn't responding.

```ts
import browser from "webextension-polyfill";
import type { Message } from "./messages";

browser.runtime.onMessage.addListener((message: Message) => {
  switch (message.action) {
    case "highlight":
      document.body.style.background = "yellow";
      break;

    case "getTitle":
      return Promise.resolve({ title: document.title });

    case "replaceText":
      document.body.innerHTML = document.body.innerHTML.replaceAll(
        message.from,
        message.to
      );
      break;
  }
});
```

---

### `src/background.ts`

Service worker. Useful for logic that needs to run without the popup being open,
cross-tab communication, alarms, or persistent state. Can be left minimal if not needed.

```ts
import browser from "webextension-polyfill";

// Runs once when the extension is installed
browser.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

// Example: relay messages, react to tab events, set alarms, etc.
```

#### When you need background.ts

| Use case | Needs background? |
|---|---|
| Popup button → mutate page | ❌ |
| Logic that runs while popup is closed | ✅ |
| Cross-tab communication | ✅ |
| Timers / alarms | ✅ |
| Network requests outliving the popup | ✅ |
| Shared state between popup and content | ✅ |

---

### `build.ts`

Builds all entrypoints, copies static files, and watches `src/` for changes.

```ts
import { cpSync, mkdirSync, watch } from "fs";

const outdir = "dist";

async function build() {
  mkdirSync(outdir, { recursive: true });

  await Bun.build({
    entrypoints: [
      "src/popup/index.html",
      "src/background.ts",
      "src/content.ts",
    ],
    outdir,
    target: "browser",
  });

  cpSync("public", `${outdir}/public`, { recursive: true });
  cpSync("manifest.json", `${outdir}/manifest.json`);

  console.log("Rebuilt →", new Date().toLocaleTimeString());
}

await build();

watch("src", { recursive: true }, build);
watch("manifest.json", build);
watch("public", { recursive: true }, build);

console.log("Watching for changes...");
```

---

### `package.json`

```json
{
  "scripts": {
    "build": "bun run build.ts",
    "dev": "bun run build.ts"
  }
}
```

---

## Message Flow

````
┌─────────────────┐        sendMessage()       ┌──────────────────────┐
│   popup.tsx     │ ─────────────────────────► │    content.ts        │
│  (popup window) │                            │  (runs in the page)  │
└─────────────────┘ ◄───────────────────────── └──────────────────────┘
                          return Promise

              Optional middleman for complex flows:
┌─────────────────┐                            ┌──────────────────────┐
│   popup.tsx     │ ──── sendMessage() ──────► │   background.ts      │
└─────────────────┘                            │  (service worker)    │
                                               └──────────┬───────────┘
                                                          │ sendMessage()
                                               ┌──────────▼───────────┐
                                               │    content.ts        │
                                               └──────────────────────┘
```

---

## Loading the Extension

### Chrome
1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `dist/`
4. After a rebuild, click the **reload icon** on the extension card

### Firefox
1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on**
3. Select `dist/manifest.json`
4. After a rebuild, click **Reload** on the extension card

#### Firefox auto-reload (optional)
Run `web-ext` alongside the build watcher for automatic reloads:

```bash
bun add -d web-ext

# Terminal 1
bun run dev

# Terminal 2
bunx web-ext run --source-dir dist/ --watch-file dist/
```

---

## Publishing (future)

### Chrome Web Store
- Zip the `dist/` folder and upload at [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)

### Firefox Add-ons (AMO)
- Requires adding `browser_specific_settings` to `manifest.json`:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "myextension@example.com",
      "strict_min_version": "109.0"
    }
  }
}
```

- Zip the `dist/` folder and upload at [AMO Developer Hub](https://addons.mozilla.org/developers/)
```

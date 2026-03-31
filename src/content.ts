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

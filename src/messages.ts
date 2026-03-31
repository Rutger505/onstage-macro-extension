export type Message =
  | { action: "highlight" }
  | { action: "getTitle" }
  | { action: "replaceText"; from: string; to: string };

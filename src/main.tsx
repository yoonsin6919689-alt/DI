import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);

// The hosting platform injects a "Made with Qoder" badge into published HTML.
const hideWatermark = () => document.getElementById("qoder-sites-watermark")?.remove();
new MutationObserver(hideWatermark).observe(document.documentElement, { childList: true });
hideWatermark();

// Lets Android offer "홈 화면에 추가" as an installed app and gives the phone
// an offline notice; it deliberately caches no application code.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
